import {
  DEFAULT_MAX_MEMORY_BYTES,
  DEFAULT_MAX_TOTAL_OPERATIONS,
  MAX_MEMORY_BYTES,
  MAX_TOTAL_OPERATIONS,
  MAX_TOTAL_TICKS,
} from './simulator'
import {
  parseSimulationWorkerRequest,
  type SimulationWorkerError,
  type SimulationWorkerRunRequest,
} from './workerProtocol'
import {
  SimulationWorkerClient,
  type SimulationWorkerClientOptions,
  type SimulationWorkerRunOptions,
  type SimulationWorkerRunOutcome,
} from './workerClient'

export interface SimulationWorkerSupervisorOptions {
  /** Número máximo de requests que podem executar em paralelo. */
  maxConcurrent?: number
  /** Número máximo de requests aguardando antes de aplicar backpressure. */
  maxQueued?: number
  /** Reserva agregada opcional de tiques declarados no host. */
  maxAggregateTicks?: number
  /** Reserva agregada opcional de memória estimada declarada no host. */
  maxAggregateMemoryBytes?: number
  /** Reserva agregada opcional de operações declaradas no host. */
  maxAggregateOperations?: number
  clientOptions?: SimulationWorkerClientOptions
  createClient?: () => SimulationWorkerClientLike
}

export type SimulationWorkerSupervisorRunOptions = SimulationWorkerRunOptions

export interface SimulationWorkerClientLike {
  run(request: SimulationWorkerRunRequest, options?: SimulationWorkerRunOptions): Promise<SimulationWorkerRunOutcome>
  dispose(): void
}

export interface SimulationWorkerSupervisorSnapshot {
  active: number
  queued: number
  reservedTicks: number
  reservedMemoryBytes: number
  reservedOperations: number
  closed: boolean
}

const DEFAULT_MAX_CONCURRENT = 2
const DEFAULT_MAX_QUEUED = 8
const MAX_CONCURRENT = 16
const MAX_QUEUED = 256

/**
 * Controla vários clientes Worker sem misturar requestIds. A reserva de budget
 * é conservadora e declarativa: ela limita requests no host, mas não substitui
 * a contabilidade executada dentro de cada Worker.
 */
export class SimulationWorkerSupervisor {
  private readonly maxConcurrent: number
  private readonly maxQueued: number
  private readonly maxAggregateTicks: number | undefined
  private readonly maxAggregateMemoryBytes: number | undefined
  private readonly maxAggregateOperations: number | undefined
  private readonly clientOptions: SimulationWorkerClientOptions
  private readonly createClientFactory: () => SimulationWorkerClientLike
  private readonly queue: PendingRequest[] = []
  private readonly active = new Map<string, ActiveRequest>()
  private reservedTicks = 0
  private reservedMemoryBytes = 0
  private reservedOperations = 0
  private closed = false
  private pumping = false

  constructor(options: SimulationWorkerSupervisorOptions = {}) {
    this.maxConcurrent = validateBound(
      options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT,
      1,
      MAX_CONCURRENT,
      'maxConcurrent',
    )
    this.maxQueued = validateBound(options.maxQueued ?? DEFAULT_MAX_QUEUED, 0, MAX_QUEUED, 'maxQueued')
    this.maxAggregateTicks = validateOptionalBound(
      options.maxAggregateTicks,
      1,
      MAX_TOTAL_TICKS,
      'maxAggregateTicks',
    )
    this.maxAggregateMemoryBytes = validateOptionalBound(
      options.maxAggregateMemoryBytes,
      1_024,
      MAX_MEMORY_BYTES,
      'maxAggregateMemoryBytes',
    )
    this.maxAggregateOperations = validateOptionalBound(
      options.maxAggregateOperations,
      1,
      MAX_TOTAL_OPERATIONS,
      'maxAggregateOperations',
    )
    this.clientOptions = options.clientOptions ?? {}
    this.createClientFactory = options.createClient ?? (() => new SimulationWorkerClient(this.clientOptions))
  }

  run(
    request: SimulationWorkerRunRequest,
    options: SimulationWorkerSupervisorRunOptions = {},
  ): Promise<SimulationWorkerRunOutcome> {
    const parsed = parseSimulationWorkerRequest(request)
    if ('message' in parsed) return Promise.resolve(this.error(request.requestId, 'invalid-request', parsed.message))
    if (this.closed) return Promise.resolve(this.error(request.requestId, 'forced-termination', 'O supervisor Worker já foi encerrado.'))
    if (this.active.has(request.requestId) || this.queue.some((entry) => entry.request.requestId === request.requestId)) {
      return Promise.resolve(this.error(request.requestId, 'invalid-request', 'Já existe um request com este requestId.'))
    }
    if (options.signal?.aborted) {
      return Promise.resolve(this.cancelled(request.requestId, 'A execução foi cancelada antes de entrar na fila Worker.'))
    }

    if (parsed.request.type === 'cancel') {
      return Promise.resolve(this.error(request.requestId, 'invalid-request', 'O supervisor aceita somente requests de execução.'))
    }
    const normalizedRequest = parsed.request
    const reservation = reservationFor(normalizedRequest)
    const reservationError = this.checkReservation(reservation)
    if (reservationError) return Promise.resolve(this.error(request.requestId, 'document-budget', reservationError))
    if (this.active.size >= this.maxConcurrent && this.queue.length >= this.maxQueued) {
      return Promise.resolve(this.error(request.requestId, 'invalid-request', 'A fila Worker atingiu o limite de backpressure.'))
    }

    return new Promise<SimulationWorkerRunOutcome>((resolve) => {
      const localController = new AbortController()
      const pending: PendingRequest = {
        request: normalizedRequest,
        resolve,
        options,
        reservation,
        localController,
        externalAbortListener: undefined,
      }
      pending.externalAbortListener = () => {
        if (this.queue.includes(pending)) {
          this.removeQueued(pending)
          this.releaseReservation(reservation)
          pending.resolve(this.cancelled(request.requestId, 'A execução foi cancelada enquanto aguardava na fila Worker.'))
          this.pump()
          return
        }
        localController.abort()
      }
      options.signal?.addEventListener('abort', pending.externalAbortListener, { once: true })
      this.queue.push(pending)
      this.reserve(reservation)
      this.pump()
    })
  }

  cancel(requestId: string): boolean {
    const queued = this.queue.find((entry) => entry.request.requestId === requestId)
    if (queued) {
      this.removeQueued(queued)
      this.releaseReservation(queued.reservation)
      queued.options.signal?.removeEventListener('abort', queued.externalAbortListener!)
      queued.resolve(this.cancelled(requestId, 'A execução foi cancelada enquanto aguardava na fila Worker.'))
      this.pump()
      return true
    }
    const active = this.active.get(requestId)
    if (!active) return false
    active.pending.localController.abort()
    return true
  }

  dispose(): void {
    if (this.closed) return
    this.closed = true
    for (const pending of this.queue.splice(0)) {
      pending.options.signal?.removeEventListener('abort', pending.externalAbortListener!)
      this.releaseReservation(pending.reservation)
      pending.resolve(this.error(pending.request.requestId, 'forced-termination', 'O supervisor foi encerrado antes do envio.'))
    }
    for (const active of this.active.values()) active.pending.localController.abort()
    for (const active of this.active.values()) active.client?.dispose()
  }

  getSnapshot(): SimulationWorkerSupervisorSnapshot {
    return {
      active: this.active.size,
      queued: this.queue.length,
      reservedTicks: this.reservedTicks,
      reservedMemoryBytes: this.reservedMemoryBytes,
      reservedOperations: this.reservedOperations,
      closed: this.closed,
    }
  }

  private pump(): void {
    if (this.pumping) return
    this.pumping = true
    try {
      while (!this.closed && this.active.size < this.maxConcurrent && this.queue.length > 0) {
        const pending = this.queue.shift()!
        const active: ActiveRequest = { pending, client: undefined }
        this.active.set(pending.request.requestId, active)
        void this.execute(active)
      }
    } finally {
      this.pumping = false
    }
  }

  private async execute(active: ActiveRequest): Promise<void> {
    const { pending } = active
    try {
      active.client = this.createClientFactory()
      const outcome = await active.client.run(pending.request, {
        ...pending.options,
        signal: pending.localController.signal,
      })
      pending.resolve(outcome)
    } catch (error) {
      pending.resolve(this.error(pending.request.requestId, 'execution', describeError(error)))
    } finally {
      pending.options.signal?.removeEventListener('abort', pending.externalAbortListener!)
      active.client?.dispose()
      this.active.delete(pending.request.requestId)
      this.releaseReservation(pending.reservation)
      this.pump()
    }
  }

  private checkReservation(reservation: Reservation): string | undefined {
    if (this.maxAggregateTicks !== undefined && this.reservedTicks + reservation.ticks > this.maxAggregateTicks) {
      return `A reserva agregada de tiques excede o limite de ${this.maxAggregateTicks}.`
    }
    if (this.maxAggregateMemoryBytes !== undefined &&
      this.reservedMemoryBytes + reservation.memoryBytes > this.maxAggregateMemoryBytes) {
      return `A reserva agregada de memória excede o limite de ${this.maxAggregateMemoryBytes} bytes.`
    }
    if (this.maxAggregateOperations !== undefined &&
      this.reservedOperations + reservation.operations > this.maxAggregateOperations) {
      return `A reserva agregada de operações excede o limite de ${this.maxAggregateOperations}.`
    }
    return undefined
  }

  private reserve(reservation: Reservation): void {
    this.reservedTicks += reservation.ticks
    this.reservedMemoryBytes += reservation.memoryBytes
    this.reservedOperations += reservation.operations
  }

  private releaseReservation(reservation: Reservation): void {
    this.reservedTicks = Math.max(0, this.reservedTicks - reservation.ticks)
    this.reservedMemoryBytes = Math.max(0, this.reservedMemoryBytes - reservation.memoryBytes)
    this.reservedOperations = Math.max(0, this.reservedOperations - reservation.operations)
  }

  private removeQueued(pending: PendingRequest): void {
    const index = this.queue.indexOf(pending)
    if (index >= 0) this.queue.splice(index, 1)
  }

  private error(requestId: string, code: SimulationWorkerError['code'], message: string): SimulationWorkerError {
    return { type: 'error', protocolVersion: 1, requestId, code, message }
  }

  private cancelled(requestId: string, message: string): SimulationWorkerRunOutcome {
    return { type: 'cancelled', protocolVersion: 1, requestId, message }
  }
}

interface Reservation {
  ticks: number
  memoryBytes: number
  operations: number
}

interface PendingRequest {
  request: SimulationWorkerRunRequest
  resolve: (outcome: SimulationWorkerRunOutcome) => void
  options: SimulationWorkerSupervisorRunOptions
  reservation: Reservation
  localController: AbortController
  externalAbortListener?: () => void
}

interface ActiveRequest {
  pending: PendingRequest
  client: SimulationWorkerClientLike | undefined
}

function reservationFor(request: SimulationWorkerRunRequest): Reservation {
  return {
    ticks: request.steps.reduce((sum, step) => sum + (step.ticks ?? 1), 0),
    memoryBytes: request.budget?.maxMemoryBytes ?? DEFAULT_MAX_MEMORY_BYTES,
    operations: request.budget?.maxOperations ?? DEFAULT_MAX_TOTAL_OPERATIONS,
  }
}

function validateBound(value: number, min: number, max: number, name: string): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} deve ser um inteiro entre ${min} e ${max}.`)
  }
  return value
}

function validateOptionalBound(value: number | undefined, min: number, max: number, name: string): number | undefined {
  if (value === undefined) return undefined
  return validateBound(value, min, max, name)
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha no supervisor Worker.'
}
