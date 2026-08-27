import { describe, expect, it, vi } from 'vitest'
import {
  NATIVE_SIMULATION_CANCEL_COMMAND,
  NATIVE_SIMULATION_COMMAND,
  NATIVE_SIMULATION_PROGRESS_EVENT,
  TauriSimulationClient,
  TauriSimulationError,
  type TauriEvent,
  type TauriSimulationTransport,
} from './tauriSimulationClient'
import type { SimulationWorkerRunRequest } from './workerProtocol'

const request: SimulationWorkerRunRequest = {
  type: 'run',
  protocolVersion: 1,
  requestId: 'tauri-test',
  components: [{ id: 'input', type: 'input' }],
  steps: [{ ticks: 1 }],
  watch: ['input'],
  yieldEvery: 1,
  timeoutMs: 30_000,
}

function result() {
  return {
    protocolVersion: 1,
    requestId: request.requestId,
    snapshots: [
      { tick: 0, values: { input: [false] } },
      { tick: 1, values: { input: [false] } },
    ],
  }
}

describe('adapter Tauri de simulação', () => {
  it('falha fechado no navegador sem runtime nativo', async () => {
    await expect(new TauriSimulationClient().run(request)).rejects.toMatchObject({
      code: 'unavailable',
    } satisfies Partial<TauriSimulationError>)
  })

  it('filtra progresso por requestId e devolve resultado validado', async () => {
    let handler: ((event: TauriEvent<unknown>) => void) | undefined
    const unlisten = vi.fn()
    const invoke = vi.fn(async (command: string) => {
      if (command === NATIVE_SIMULATION_COMMAND) {
        handler?.({ payload: { protocolVersion: 1, requestId: 'other', snapshot: { tick: 1, values: {} } } })
        handler?.({ payload: { protocolVersion: 1, requestId: request.requestId, snapshot: { tick: 1, values: { input: [true] } } } })
        return result()
      }
      return undefined
    })
    const transport: TauriSimulationTransport = {
      invoke: invoke as TauriSimulationTransport['invoke'],
      listen: vi.fn(async (event, next) => {
        expect(event).toBe(NATIVE_SIMULATION_PROGRESS_EVENT)
        handler = next
        return unlisten
      }),
    }
    const progress = vi.fn()

    const outcome = await new TauriSimulationClient(transport).run(request, { onProgress: progress })

    expect(outcome).toEqual({ type: 'result', protocolVersion: 1, requestId: request.requestId, snapshots: result().snapshots })
    expect(progress).toHaveBeenCalledTimes(1)
    expect(progress.mock.calls[0]?.[0].requestId).toBe(request.requestId)
    expect(invoke).toHaveBeenCalledWith(NATIVE_SIMULATION_COMMAND, { request: expect.not.objectContaining({ type: 'run' }) })
    expect(unlisten).toHaveBeenCalledOnce()
  })

  it('envia cancelamento nativo e devolve cancelled após AbortSignal', async () => {
    let resolveRun: ((value: unknown) => void) | undefined
    const invoke = vi.fn((command: string) => {
      if (command === NATIVE_SIMULATION_COMMAND) return new Promise<unknown>((resolve) => { resolveRun = resolve })
      return Promise.resolve(undefined)
    })
    const transport: TauriSimulationTransport = {
      invoke: invoke as TauriSimulationTransport['invoke'],
      listen: vi.fn(async () => () => undefined),
    }
    const controller = new AbortController()
    const pending = new TauriSimulationClient(transport).run(request, { signal: controller.signal })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    controller.abort()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    resolveRun?.(result())

    await expect(pending).resolves.toMatchObject({ type: 'cancelled', requestId: request.requestId })
    expect(invoke).toHaveBeenCalledWith(NATIVE_SIMULATION_CANCEL_COMMAND, { requestId: request.requestId })
  })
})
