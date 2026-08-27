import type {
  SimulationWorkerCancelled,
  SimulationWorkerError,
  SimulationWorkerProgress,
  SimulationWorkerResult,
  SimulationWorkerRunRequest,
  SimulationWorkerSnapshot,
} from './workerProtocol'

export const NATIVE_SIMULATION_PROGRESS_EVENT = 'veritas://simulation-progress'
export const NATIVE_SIMULATION_COMMAND = 'simulate_circuit_native'
export const NATIVE_SIMULATION_CANCEL_COMMAND = 'cancel_circuit_native'

export interface TauriEvent<T> {
  payload: T
}

export interface TauriSimulationTransport {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
  listen<T>(event: string, handler: (event: TauriEvent<T>) => void): Promise<() => void>
}

export interface TauriSimulationRunOptions {
  signal?: AbortSignal
  onProgress?: (progress: SimulationWorkerProgress) => void
}

export type TauriSimulationOutcome = SimulationWorkerResult | SimulationWorkerCancelled | SimulationWorkerError

export class TauriSimulationError extends Error {
  readonly code: 'unavailable' | 'transport'

  constructor(code: 'unavailable' | 'transport', message: string) {
    super(message)
    this.name = 'TauriSimulationError'
    this.code = code
  }
}

/** Detecta apenas o runtime Tauri; navegador web puro deve continuar funcionando. */
export function isTauriSimulationRuntime(): boolean {
  const runtime = globalThis as typeof globalThis & { __TAURI_INTERNALS__?: unknown }
  return '__TAURI_INTERNALS__' in runtime
}

/**
 * Adapter opt-in do host. Ele não é usado pelo runtime web canônico nem pelo
 * Preview Worker atual; a UI desktop poderá injetá-lo quando o smoke nativo
 * por plataforma estiver disponível.
 */
export class TauriSimulationClient {
  constructor(private readonly injectedTransport?: TauriSimulationTransport) {}

  async run(
    request: SimulationWorkerRunRequest,
    options: TauriSimulationRunOptions = {},
  ): Promise<TauriSimulationOutcome> {
    const transport = await this.resolveTransport()
    const signal = options.signal
    if (signal?.aborted) return cancelledOutcome(request.requestId)

    let unlisten: (() => void) | undefined
    let finished = false
    const cancelNative = (): void => {
      if (finished) return
      void transport.invoke<void>(NATIVE_SIMULATION_CANCEL_COMMAND, { requestId: request.requestId }).catch(() => undefined)
    }

    try {
      unlisten = await transport.listen<unknown>(NATIVE_SIMULATION_PROGRESS_EVENT, (event) => {
        const progress = parseProgress(event.payload, request.requestId)
        if (progress) options.onProgress?.(progress)
      })
      signal?.addEventListener('abort', cancelNative, { once: true })
      if (signal?.aborted) {
        cancelNative()
        return cancelledOutcome(request.requestId)
      }

      const nativeRequest = toNativeRequest(request)
      const nativeResult = await transport.invoke<unknown>(NATIVE_SIMULATION_COMMAND, { request: nativeRequest })
      if (signal?.aborted) return cancelledOutcome(request.requestId)
      const result = parseResult(nativeResult, request.requestId)
      if (result) return result
      return errorOutcome(request.requestId, 'execution', 'O comando nativo devolveu um resultado inválido.')
    } catch (error) {
      if (signal?.aborted) return cancelledOutcome(request.requestId)
      return errorOutcome(request.requestId, errorCode(error), describeError(error))
    } finally {
      finished = true
      signal?.removeEventListener('abort', cancelNative)
      unlisten?.()
    }
  }

  private async resolveTransport(): Promise<TauriSimulationTransport> {
    if (this.injectedTransport) return this.injectedTransport
    if (!isTauriSimulationRuntime()) {
      throw new TauriSimulationError('unavailable', 'A simulação Tauri não está disponível neste runtime.')
    }
    const [{ invoke }, { listen }] = await Promise.all([
      import('@tauri-apps/api/core'),
      import('@tauri-apps/api/event'),
    ])
    return { invoke, listen }
  }
}

function toNativeRequest(request: SimulationWorkerRunRequest): Omit<SimulationWorkerRunRequest, 'type'> {
  const { type: _type, ...nativeRequest } = request
  return nativeRequest
}

function parseProgress(value: unknown, requestId: string): SimulationWorkerProgress | null {
  if (!isRecord(value)) return null
  if (value.type !== undefined && value.type !== 'progress') return null
  if (value.protocolVersion !== 1 || value.requestId !== requestId || !isSnapshot(value.snapshot)) return null
  return { type: 'progress', protocolVersion: 1, requestId, snapshot: value.snapshot }
}

function parseResult(value: unknown, requestId: string): SimulationWorkerResult | null {
  if (!isRecord(value) || value.protocolVersion !== 1 || value.requestId !== requestId || !Array.isArray(value.snapshots)) return null
  if (!value.snapshots.every(isSnapshot)) return null
  return { type: 'result', protocolVersion: 1, requestId, snapshots: value.snapshots }
}

function isSnapshot(value: unknown): value is SimulationWorkerSnapshot {
  if (!isRecord(value) || !Number.isInteger(value.tick) || value.tick < 0 || !isRecord(value.values)) return false
  return Object.values(value.values).every((values) => isBooleanArray(values))
}

function isBooleanArray(value: unknown): value is boolean[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'boolean')
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function errorCode(error: unknown): SimulationWorkerError['code'] {
  if (isRecord(error) && typeof error.code === 'string' && ['invalid-request', 'cancelled', 'timeout', 'document-budget', 'operation-budget', 'forced-termination', 'execution'].includes(error.code)) {
    return error.code as SimulationWorkerError['code']
  }
  return 'execution'
}

function describeError(error: unknown): string {
  if (typeof error === 'string') return error
  if (isRecord(error) && typeof error.message === 'string') return error.message
  if (error instanceof Error) return error.message
  return 'A execução nativa falhou sem diagnóstico textual.'
}

function errorOutcome(requestId: string, code: SimulationWorkerError['code'], message: string): SimulationWorkerError {
  return { type: 'error', protocolVersion: 1, requestId, code, message }
}

function cancelledOutcome(requestId: string): SimulationWorkerCancelled {
  return { type: 'cancelled', protocolVersion: 1, requestId, message: 'A execução nativa foi cancelada cooperativamente.' }
}
