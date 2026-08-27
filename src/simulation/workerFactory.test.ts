import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SimulationWorkerHandle } from './workerProtocol'

const { workerConstructor } = vi.hoisted(() => ({
  workerConstructor: vi.fn(),
}))

vi.mock('./simulation.worker?worker', () => ({ default: workerConstructor }))

import { createSimulationWorker } from './workerFactory'

const fakeHandle: SimulationWorkerHandle = {
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  postMessage: () => undefined,
  terminate: () => undefined,
}

const hadWorker = 'Worker' in globalThis
const originalWorker = (globalThis as Record<string, unknown>).Worker

afterEach(() => {
  workerConstructor.mockReset()
  if (hadWorker) {
    ;(globalThis as Record<string, unknown>).Worker = originalWorker
  } else {
    delete (globalThis as Record<string, unknown>).Worker
  }
})

describe('factory host-only do Worker', () => {
  it('instancia o construtor virtual Vite somente quando Worker existe', () => {
    vi.stubGlobal('Worker', class Worker {})
    workerConstructor.mockImplementation(function () { return fakeHandle })

    expect(createSimulationWorker()).toBe(fakeHandle)
    expect(workerConstructor).toHaveBeenCalledTimes(1)
    expect(workerConstructor).toHaveBeenCalledWith()
  })

  it('falha fechado sem a API global Worker', () => {
    delete (globalThis as Record<string, unknown>).Worker

    expect(() => createSimulationWorker()).toThrow('A API Worker não está disponível neste ambiente.')
    expect(workerConstructor).not.toHaveBeenCalled()
  })
})
