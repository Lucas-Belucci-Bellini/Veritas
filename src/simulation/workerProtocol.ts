import type { ComponentOptions, ComponentSpec, ComponentType, PortRef } from './components'
import {
  DEFAULT_ASYNC_TIMEOUT_MS,
  DEFAULT_ASYNC_YIELD_EVERY,
  DEFAULT_MAX_MEMORY_BYTES,
  DEFAULT_MAX_TOTAL_OPERATIONS,
  MAX_MEMORY_BYTES,
  MAX_TOTAL_OPERATIONS,
  MAX_TOTAL_TICKS,
  Simulator,
  SimulatorExecutionError,
  type SimulatorExecutionErrorCode,
} from './simulator'
import {
  MAX_CIRCUIT_CONNECTIONS,
  MAX_CIRCUIT_NODES,
  MAX_CIRCUIT_SERIALIZED_BYTES,
} from '../circuit/documentLimits'

export const SIMULATION_WORKER_PROTOCOL_VERSION = 1 as const
export const MAX_WORKER_TICKS = 1_000
export const MAX_WORKER_STEPS = 256
export const MAX_WORKER_WATCHES = 128
export const MAX_WORKER_PROGRESS_MESSAGES = 64
export const MAX_WORKER_REQUEST_ID_LENGTH = 128

export interface SimulationWorkerBudget {
  maxTicks?: number
  maxOperations?: number
  maxMemoryBytes?: number
}

export interface SimulationWorkerStep {
  set?: Readonly<Record<string, boolean>>
  ticks?: number
}

export interface SimulationWorkerRunRequest {
  type: 'run'
  protocolVersion: typeof SIMULATION_WORKER_PROTOCOL_VERSION
  requestId: string
  components: readonly ComponentSpec[]
  steps: readonly SimulationWorkerStep[]
  watch?: readonly string[]
  budget?: SimulationWorkerBudget
  yieldEvery?: number
  timeoutMs?: number
}

export interface SimulationWorkerCancelRequest {
  type: 'cancel'
  protocolVersion: typeof SIMULATION_WORKER_PROTOCOL_VERSION
  requestId: string
}

export type SimulationWorkerRequest = SimulationWorkerRunRequest | SimulationWorkerCancelRequest

export interface SimulationWorkerSnapshot {
  tick: number
  values: Record<string, boolean[]>
}

export interface SimulationWorkerProgress {
  type: 'progress'
  protocolVersion: typeof SIMULATION_WORKER_PROTOCOL_VERSION
  requestId: string
  snapshot: SimulationWorkerSnapshot
}

export interface SimulationWorkerResult {
  type: 'result'
  protocolVersion: typeof SIMULATION_WORKER_PROTOCOL_VERSION
  requestId: string
  snapshots: readonly SimulationWorkerSnapshot[]
}

export interface SimulationWorkerCancelled {
  type: 'cancelled'
  protocolVersion: typeof SIMULATION_WORKER_PROTOCOL_VERSION
  requestId: string
  message: string
}

export type SimulationWorkerErrorCode =
  | 'invalid-request'
  | 'aborted'
  | 'cancelled'
  | 'timeout'
  | 'document-budget'
  | 'operation-budget'
  | 'forced-termination'
  | 'execution'

export interface SimulationWorkerError {
  type: 'error'
  protocolVersion: typeof SIMULATION_WORKER_PROTOCOL_VERSION
  requestId: string
  code: SimulationWorkerErrorCode
  message: string
}

export type SimulationWorkerResponse =
  | SimulationWorkerProgress
  | SimulationWorkerResult
  | SimulationWorkerCancelled
  | SimulationWorkerError

export interface SimulationWorkerMessageEvent {
  data: unknown
}

export interface SimulationWorkerEndpoint {
  addEventListener(type: 'message', listener: (event: SimulationWorkerMessageEvent) => void): void
  removeEventListener(type: 'message', listener: (event: SimulationWorkerMessageEvent) => void): void
  postMessage(message: SimulationWorkerResponse): void
}

export interface SimulationWorkerHandle {
  addEventListener(type: 'message', listener: (event: SimulationWorkerMessageEvent) => void): void
  removeEventListener(type: 'message', listener: (event: SimulationWorkerMessageEvent) => void): void
  postMessage(message: SimulationWorkerRequest): void
  terminate(): void
}

interface ParsedRequest {
  request: SimulationWorkerRequest
}

interface ParseFailure {
  requestId: string
  message: string
}

const COMPONENT_TYPES: readonly ComponentType[] = [
  'input', 'output', 'constant', 'and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor',
  'clock', 'dff', 'tff', 'jk', 'sr', 'delay', 'transmitter', 'receiver', 'splitter',
  'combiner', 'custom-chip',
]

export function parseSimulationWorkerRequest(input: unknown): ParsedRequest | ParseFailure {
  if (!isRecord(input)) return { requestId: '', message: 'A mensagem Worker deve ser um objeto.' }
  const requestId = typeof input.requestId === 'string' ? input.requestId : ''
  if (!requestId || requestId.length > MAX_WORKER_REQUEST_ID_LENGTH) {
    return { requestId, message: 'requestId ausente ou acima do limite.' }
  }
  if (input.protocolVersion !== SIMULATION_WORKER_PROTOCOL_VERSION) {
    return { requestId, message: `protocolVersion deve ser ${SIMULATION_WORKER_PROTOCOL_VERSION}.` }
  }
  if (input.type === 'cancel') return { request: { type: 'cancel', protocolVersion: 1, requestId } }
  if (input.type !== 'run') return { requestId, message: 'Tipo de mensagem Worker desconhecido.' }

  const componentsResult = parseComponents(input.components)
  if (typeof componentsResult === 'string') return { requestId, message: componentsResult }
  const stepsResult = parseSteps(input.steps)
  if (typeof stepsResult === 'string') return { requestId, message: stepsResult }
  const watchResult = parseWatch(input.watch)
  if (typeof watchResult === 'string') return { requestId, message: watchResult }
  const budgetResult = parseBudget(input.budget)
  if (typeof budgetResult === 'string') return { requestId, message: budgetResult }
  const yieldEvery = input.yieldEvery ?? DEFAULT_ASYNC_YIELD_EVERY
  if (!isInteger(yieldEvery) || yieldEvery < 1 || yieldEvery > 1_000) {
    return { requestId, message: 'yieldEvery deve ser um inteiro entre 1 e 1000.' }
  }
  const timeoutMs = input.timeoutMs ?? DEFAULT_ASYNC_TIMEOUT_MS
  if (!isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) {
    return { requestId, message: 'timeoutMs deve ser um inteiro entre 1 e 300000.' }
  }
  const totalTicks = stepsResult.reduce((sum, step) => sum + (step.ticks ?? 1), 0)
  if (totalTicks > MAX_WORKER_TICKS) {
    return { requestId, message: `A execução excede o limite Worker de ${MAX_WORKER_TICKS} tiques.` }
  }

  return {
    request: {
      type: 'run',
      protocolVersion: 1,
      requestId,
      components: componentsResult,
      steps: stepsResult,
      watch: watchResult,
      budget: budgetResult,
      yieldEvery,
      timeoutMs,
    },
  }
}

/** Cria o Worker de simulação sob demanda; a UI ainda precisa orquestrar requests. */
export function createSimulationWorker(): SimulationWorkerHandle {
  type WorkerConstructor = new (url: string, options: { type: 'module' }) => SimulationWorkerHandle
  const WorkerClass = (globalThis as typeof globalThis & { Worker?: WorkerConstructor }).Worker
  if (!WorkerClass) throw new Error('A API Worker não está disponível neste ambiente.')
  return new WorkerClass(new URL('./simulation.worker.ts', import.meta.url).href, { type: 'module' })
}

export function installSimulationWorker(endpoint: SimulationWorkerEndpoint): () => void {
  const active = new Map<string, AbortController>()
  let stopped = false

  const post = (message: SimulationWorkerResponse): void => {
    if (!stopped) endpoint.postMessage(message)
  }

  const listener = (event: SimulationWorkerMessageEvent): void => {
    const parsed = parseSimulationWorkerRequest(event.data)
    if ('message' in parsed) {
      post({
        type: 'error',
        protocolVersion: SIMULATION_WORKER_PROTOCOL_VERSION,
        requestId: parsed.requestId,
        code: 'invalid-request',
        message: parsed.message,
      })
      return
    }

    const { request } = parsed
    if (request.type === 'cancel') {
      const controller = active.get(request.requestId)
      if (controller) controller.abort()
      else {
        post({
          type: 'error',
          protocolVersion: SIMULATION_WORKER_PROTOCOL_VERSION,
          requestId: request.requestId,
          code: 'invalid-request',
          message: 'Não existe execução ativa para esse requestId.',
        })
      }
      return
    }

    if (active.has(request.requestId)) {
      post({
        type: 'error',
        protocolVersion: SIMULATION_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        code: 'invalid-request',
        message: 'Já existe uma execução ativa para esse requestId.',
      })
      return
    }

    const controller = new AbortController()
    active.set(request.requestId, controller)
    void executeSimulationWorkerRequest(request, controller.signal, (message) => post(message))
      .then((message) => post(message))
      .catch((error: unknown) => post({
        type: 'error',
        protocolVersion: SIMULATION_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        code: 'execution',
        message: describeError(error),
      }))
      .finally(() => active.delete(request.requestId))
  }

  endpoint.addEventListener('message', listener)
  return () => {
    if (stopped) return
    stopped = true
    endpoint.removeEventListener('message', listener)
    for (const controller of active.values()) controller.abort()
    active.clear()
  }
}

async function executeSimulationWorkerRequest(
  request: SimulationWorkerRunRequest,
  signal: AbortSignal,
  emit: (message: SimulationWorkerResponse) => void,
): Promise<SimulationWorkerResult | SimulationWorkerCancelled | SimulationWorkerError> {
  let simulator: Simulator | undefined
  const snapshots: SimulationWorkerSnapshot[] = []
  try {
    simulator = new Simulator({ components: [...request.components] }, {
      maxTotalTicks: request.budget?.maxTicks ?? MAX_WORKER_TICKS,
      maxTotalOperations: request.budget?.maxOperations ?? DEFAULT_MAX_TOTAL_OPERATIONS,
      maxMemoryBytes: request.budget?.maxMemoryBytes ?? DEFAULT_MAX_MEMORY_BYTES,
      signal,
    })
    const observed = request.watch?.length ? [...request.watch] : request.components.map((component) => component.id)
    const known = new Set(request.components.map((component) => component.id))
    const unknown = observed.filter((id) => !known.has(id))
    if (unknown.length > 0) throw new Error(`Watches inexistentes: ${unknown.join(', ')}.`)

    snapshots.push(snapshotSimulator(simulator, observed))
    const startedAt = Date.now()
    const ensureWithinTimeout = () => {
      if (Date.now() - startedAt >= request.timeoutMs!) {
        throw new SimulatorExecutionError('timeout', `A execução excedeu o timeout de ${request.timeoutMs} ms.`)
      }
    }
    await yieldExecution()
    ensureWithinTimeout()
    let completedTicks = 0
    let ticksSinceYield = 0
    const totalTicks = request.steps.reduce((sum, step) => sum + (step.ticks ?? 1), 0)
    const progressStride = Math.max(1, Math.ceil(Math.max(1, totalTicks) / MAX_WORKER_PROGRESS_MESSAGES))

    for (const step of request.steps) {
      for (const [id, value] of Object.entries(step.set ?? {})) simulator.setInput(id, value)
      const ticks = step.ticks ?? 1
      for (let index = 0; index < ticks; index += 1) {
        ensureWithinTimeout()
        const remainingMs = Math.max(1, request.timeoutMs! - (Date.now() - startedAt))
        await simulator.tickAsync(1, {
          yieldEvery: request.yieldEvery,
          timeoutMs: remainingMs,
          signal,
        })
        ensureWithinTimeout()
        completedTicks += 1
        ticksSinceYield += 1
        const snapshot = snapshotSimulator(simulator, observed)
        snapshots.push(snapshot)
        if (completedTicks % progressStride === 0 || completedTicks === totalTicks) {
          emit({
            type: 'progress',
            protocolVersion: SIMULATION_WORKER_PROTOCOL_VERSION,
            requestId: request.requestId,
            snapshot,
          })
        }
        if (completedTicks < totalTicks && ticksSinceYield >= request.yieldEvery!) {
          ticksSinceYield = 0
          await yieldExecution()
          ensureWithinTimeout()
        }
      }
    }

    return {
      type: 'result',
      protocolVersion: SIMULATION_WORKER_PROTOCOL_VERSION,
      requestId: request.requestId,
      snapshots,
    }
  } catch (error) {
    const executionError = error instanceof SimulatorExecutionError ? error : undefined
    if (signal.aborted || executionError?.code === 'aborted') {
      return {
        type: 'cancelled',
        protocolVersion: SIMULATION_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        message: 'A execução foi cancelada cooperativamente.',
      }
    }
    const code = workerErrorCode(executionError?.code, error)
    return {
      type: 'error',
      protocolVersion: SIMULATION_WORKER_PROTOCOL_VERSION,
      requestId: request.requestId,
      code,
      message: describeError(error),
    }
  } finally {
    simulator?.shutdown()
  }
}

function snapshotSimulator(simulator: Simulator, observed: readonly string[]): SimulationWorkerSnapshot {
  const values: Record<string, boolean[]> = {}
  for (const id of observed) values[id] = [simulator.read(id)]
  return { tick: simulator.tickCount, values }
}

function workerErrorCode(code: SimulatorExecutionErrorCode | undefined, error?: unknown): SimulationWorkerErrorCode {
  if (code === 'timeout') return 'timeout'
  if (error instanceof RangeError && error.message.includes('orçamento total')) return 'document-budget'
  if (code === 'document-budget') return 'document-budget'
  if (code === 'operation-budget') return 'operation-budget'
  if (code === 'cancelled') return 'cancelled'
  return 'execution'
}

function parseComponents(value: unknown): readonly ComponentSpec[] | string {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_CIRCUIT_NODES) {
    return `components deve conter entre 1 e ${MAX_CIRCUIT_NODES} itens.`
  }
  let connections = 0
  const ids = new Set<string>()
  const components: ComponentSpec[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id || item.id.length > 200) {
      return 'Cada componente deve possuir um id textual válido.'
    }
    if (ids.has(item.id)) return `Componente duplicado: "${item.id}".`
    if (typeof item.type !== 'string' || !COMPONENT_TYPES.includes(item.type as ComponentType)) {
      return `Tipo de componente inválido em "${item.id}".`
    }
    if (item.type === 'custom-chip') return 'custom-chip deve ser expandido antes de entrar no Worker.'
    if (item.type === 'splitter' || item.type === 'combiner') return 'componentes vetoriais ainda não são suportados pelo Worker v1.'

    const parsedInputs: PortRef[] = []
    if (item.inputs !== undefined) {
      if (!Array.isArray(item.inputs)) return `inputs inválido em "${item.id}".`
      connections += item.inputs.length
      if (connections > MAX_CIRCUIT_CONNECTIONS) return `A mensagem excede ${MAX_CIRCUIT_CONNECTIONS} conexões.`
      for (const input of item.inputs) {
        if (!isRecord(input) || typeof input.node !== 'string' || !input.node ||
          (input.port !== undefined && (!isInteger(input.port) || input.port < 0))) {
          return `Entrada inválida em "${item.id}".`
        }
        parsedInputs.push({ node: input.node, port: input.port as number | undefined })
      }
    }

    const options = parseComponentOptions(item.options)
    if (typeof options === 'string') return `Opções inválidas em "${item.id}": ${options}`
    if (options?.width !== undefined || options?.widths !== undefined) return 'larguras vetoriais ainda não são suportadas pelo Worker v1.'
    if (item.label !== undefined && (typeof item.label !== 'string' || item.label.length > 120)) {
      return `label inválido em "${item.id}".`
    }
    ids.add(item.id)
    components.push({
      id: item.id,
      type: item.type as ComponentType,
      inputs: parsedInputs.length > 0 ? parsedInputs : undefined,
      options,
      label: item.label as string | undefined,
    })
  }
  try {
    const serializedBytes = new TextEncoder().encode(JSON.stringify(components)).byteLength
    if (serializedBytes > MAX_CIRCUIT_SERIALIZED_BYTES) return `components excede ${MAX_CIRCUIT_SERIALIZED_BYTES} bytes.`
  } catch {
    return 'components contém dados não serializáveis.'
  }
  return components
}

function parseComponentOptions(value: unknown): ComponentOptions | undefined | string {
  if (value === undefined) return undefined
  if (!isRecord(value)) return 'deve ser um objeto.'
  const options: ComponentOptions = {}
  if (value.period !== undefined && (!isInteger(value.period) || value.period < 1 || value.period > 64)) return 'period deve estar entre 1 e 64.'
  if (value.ticks !== undefined && (!isInteger(value.ticks) || value.ticks < 1 || value.ticks > MAX_WORKER_TICKS)) return `ticks deve estar entre 1 e ${MAX_WORKER_TICKS}.`
  if (value.value !== undefined && typeof value.value !== 'boolean') return 'value deve ser booleano.'
  if (value.initial !== undefined && typeof value.initial !== 'boolean') return 'initial deve ser booleano.'
  if (value.width !== undefined && (!isInteger(value.width) || value.width < 1 || value.width > 256)) return 'width deve estar entre 1 e 256.'
  if (value.widths !== undefined && (!Array.isArray(value.widths) || value.widths.length > 256 || value.widths.some((width) => !isInteger(width) || width < 1 || width > 256))) return 'widths contém uma largura inválida.'
  if (value.channel !== undefined && (typeof value.channel !== 'string' || value.channel.length > 64)) return 'channel deve ser uma string de no máximo 64 caracteres.'
  if (value.customChipId !== undefined && (!isInteger(value.customChipId) || value.customChipId < 1)) return 'customChipId deve ser um inteiro positivo.'
  if (value.customChipBoundary !== undefined && value.customChipBoundary !== 'internal') return 'customChipBoundary inválido.'

  if (value.period !== undefined) options.period = value.period
  if (value.ticks !== undefined) options.ticks = value.ticks
  if (value.value !== undefined) options.value = value.value
  if (value.initial !== undefined) options.initial = value.initial
  if (value.width !== undefined) options.width = value.width
  if (value.widths !== undefined) options.widths = [...(value.widths as number[])]
  if (value.channel !== undefined) options.channel = value.channel
  if (value.customChipId !== undefined) options.customChipId = value.customChipId
  if (value.customChipBoundary !== undefined) options.customChipBoundary = 'internal'
  return options
}

function parseSteps(value: unknown): readonly SimulationWorkerStep[] | string {
  if (!Array.isArray(value) || value.length > MAX_WORKER_STEPS) {
    return `steps deve conter no máximo ${MAX_WORKER_STEPS} itens.`
  }
  const steps: SimulationWorkerStep[] = []
  for (const item of value) {
    if (!isRecord(item)) return 'Cada step deve ser um objeto.'
    if (item.ticks !== undefined && (!isInteger(item.ticks) || item.ticks < 0)) {
      return 'ticks deve ser um inteiro não negativo.'
    }
    let set: Record<string, boolean> | undefined
    if (item.set !== undefined) {
      if (!isRecord(item.set)) return 'set deve ser um mapa de booleanos.'
      set = {}
      for (const [id, value] of Object.entries(item.set)) {
        if (typeof value !== 'boolean' || !id) return 'set só aceita booleanos com ids válidos.'
        set[id] = value
      }
    }
    steps.push({
      ticks: item.ticks as number | undefined,
      set,
    })
  }
  return steps
}

function parseWatch(value: unknown): readonly string[] | undefined | string {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > MAX_WORKER_WATCHES || value.some((item) => typeof item !== 'string' || !item)) {
    return `watch deve conter strings, no máximo ${MAX_WORKER_WATCHES}.`
  }
  return value as string[]
}

function parseBudget(value: unknown): SimulationWorkerBudget | undefined | string {
  if (value === undefined) return undefined
  if (!isRecord(value)) return 'budget deve ser um objeto.'
  const maxTicks = value.maxTicks ?? MAX_WORKER_TICKS
  const maxOperations = value.maxOperations ?? DEFAULT_MAX_TOTAL_OPERATIONS
  const maxMemoryBytes = value.maxMemoryBytes ?? DEFAULT_MAX_MEMORY_BYTES
  if (!isInteger(maxTicks) || maxTicks < 1 || maxTicks > MAX_TOTAL_TICKS) return 'budget.maxTicks inválido.'
  if (!isInteger(maxOperations) || maxOperations < 1 || maxOperations > MAX_TOTAL_OPERATIONS) return 'budget.maxOperations inválido.'
  if (!isInteger(maxMemoryBytes) || maxMemoryBytes < 1_024 || maxMemoryBytes > MAX_MEMORY_BYTES) return 'budget.maxMemoryBytes inválido.'
  return { maxTicks, maxOperations, maxMemoryBytes }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha na execução Worker.'
}

function yieldExecution(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
