import {
  createSimulationWorker,
  parseSimulationWorkerRequest,
  type SimulationWorkerCancelled,
  type SimulationWorkerError,
  type SimulationWorkerHandle,
  type SimulationWorkerMessageEvent,
  type SimulationWorkerProgress,
  type SimulationWorkerResponse,
  type SimulationWorkerResult,
  type SimulationWorkerRunRequest,
} from './workerProtocol'

export type SimulationWorkerRunOutcome =
  | SimulationWorkerResult
  | SimulationWorkerCancelled
  | SimulationWorkerError

export interface SimulationWorkerClientOptions {
  worker?: SimulationWorkerHandle
  /** Timeout do host para uma resposta final, incluindo o cancelamento cooperativo. */
  timeoutMs?: number
}

export interface SimulationWorkerRunOptions {
  signal?: AbortSignal
  onProgress?: (progress: SimulationWorkerProgress) => void
}

const DEFAULT_HOST_TIMEOUT_MS = 35_000

/**
 * Orquestra um Worker de simulação sem conhecer a engine. Cada instância
 * mantém no máximo um request ativo para evitar mistura acidental de estados.
 */
export class SimulationWorkerClient {
  private readonly worker: SimulationWorkerHandle
  private readonly timeoutMs: number
  private pending: PendingRun | undefined
  private closed = false

  constructor(options: SimulationWorkerClientOptions = {}) {
    this.worker = options.worker ?? createSimulationWorker()
    this.timeoutMs = options.timeoutMs ?? DEFAULT_HOST_TIMEOUT_MS
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 300_000) {
      throw new RangeError('O timeout do host Worker deve ser um inteiro entre 1 e 300000 ms.')
    }
    this.worker.addEventListener('message', this.onMessage)
  }

  run(request: SimulationWorkerRunRequest, options: SimulationWorkerRunOptions = {}): Promise<SimulationWorkerRunOutcome> {
    const parsed = parseSimulationWorkerRequest(request)
    if ('message' in parsed) return Promise.resolve(this.error(request.requestId, 'invalid-request', parsed.message))
    if (this.closed) return Promise.resolve(this.error(request.requestId, 'forced-termination', 'O cliente Worker já foi encerrado.'))
    if (this.pending) return Promise.resolve(this.error(request.requestId, 'invalid-request', 'Já existe uma execução ativa neste cliente Worker.'))
    if (options.signal?.aborted) {
      return Promise.resolve({
        type: 'cancelled',
        protocolVersion: 1,
        requestId: request.requestId,
        message: 'A execução foi cancelada antes do envio ao Worker.',
      })
    }

    return new Promise<SimulationWorkerRunOutcome>((resolve) => {
      const pending: PendingRun = {
        requestId: request.requestId,
        resolve,
        onProgress: options.onProgress,
        signal: options.signal,
        abortListener: undefined,
        timer: setTimeout(() => this.forceTerminate('O Worker não respondeu dentro do timeout do host.'), this.timeoutMs),
      }
      pending.abortListener = () => {
        if (this.pending !== pending || pending.cancelSent) return
        pending.cancelSent = true
        this.worker.postMessage({ type: 'cancel', protocolVersion: 1, requestId: request.requestId })
      }
      options.signal?.addEventListener('abort', pending.abortListener, { once: true })
      this.pending = pending
      this.worker.postMessage(request)
    })
  }

  dispose(): void {
    if (this.closed) return
    this.closed = true
    this.worker.removeEventListener('message', this.onMessage)
    this.forceTerminate('O cliente Worker foi encerrado antes da resposta final.')
  }

  private readonly onMessage = (event: SimulationWorkerMessageEvent): void => {
    const message = event.data
    if (!isWorkerResponse(message) || !this.pending || message.requestId !== this.pending.requestId) return
    if (message.type === 'progress') {
      this.pending.onProgress?.(message)
      return
    }
    this.finish(message)
  }

  private finish(outcome: SimulationWorkerRunOutcome): void {
    const pending = this.pending
    if (!pending) return
    clearTimeout(pending.timer)
    pending.signal?.removeEventListener('abort', pending.abortListener!)
    this.pending = undefined
    pending.resolve(outcome)
  }

  private forceTerminate(message: string, terminate = true): void {
    const pending = this.pending
    if (terminate) {
      this.closed = true
      this.worker.removeEventListener('message', this.onMessage)
      this.worker.terminate()
    }
    if (!pending) return
    this.finish(this.error(pending.requestId, 'forced-termination', message))
  }

  private error(requestId: string, code: SimulationWorkerError['code'], message: string): SimulationWorkerError {
    return { type: 'error', protocolVersion: 1, requestId, code, message }
  }
}

interface PendingRun {
  requestId: string
  resolve: (outcome: SimulationWorkerRunOutcome) => void
  onProgress?: (progress: SimulationWorkerProgress) => void
  signal?: AbortSignal
  abortListener?: () => void
  timer: ReturnType<typeof setTimeout>
  cancelSent?: boolean
}

function isWorkerResponse(value: unknown): value is SimulationWorkerResponse {
  return typeof value === 'object' && value !== null &&
    (value as { type?: unknown }).type !== undefined &&
    typeof (value as { requestId?: unknown }).requestId === 'string'
}
