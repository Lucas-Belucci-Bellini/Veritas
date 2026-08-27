import { describe, expect, it } from 'vitest'
import { SimulationWorkerClient } from './workerClient'
import type {
  SimulationWorkerHandle,
  SimulationWorkerMessageEvent,
  SimulationWorkerRequest,
  SimulationWorkerResponse,
  SimulationWorkerRunRequest,
} from './workerProtocol'

class FakeWorkerHandle implements SimulationWorkerHandle {
  readonly sent: SimulationWorkerRequest[] = []
  readonly responses: SimulationWorkerResponse[] = []
  terminated = false
  private readonly listeners = new Set<(event: SimulationWorkerMessageEvent) => void>()

  addEventListener(_type: 'message', listener: (event: SimulationWorkerMessageEvent) => void): void {
    this.listeners.add(listener)
  }

  removeEventListener(_type: 'message', listener: (event: SimulationWorkerMessageEvent) => void): void {
    this.listeners.delete(listener)
  }

  postMessage(message: SimulationWorkerRequest): void {
    this.sent.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  emit(message: SimulationWorkerResponse): void {
    this.responses.push(message)
    const event: SimulationWorkerMessageEvent = { data: message }
    for (const listener of [...this.listeners]) listener(event)
  }
}

const request: SimulationWorkerRunRequest = {
  type: 'run',
  protocolVersion: 1,
  requestId: 'client-request',
  components: [{ id: 'a', type: 'input' }],
  steps: [{ ticks: 1 }],
  watch: ['a'],
  yieldEvery: 1,
  timeoutMs: 30_000,
}

function result(requestId = request.requestId): SimulationWorkerResponse {
  return {
    type: 'result',
    protocolVersion: 1,
    requestId,
    snapshots: [{ tick: 0, values: { a: [false] } }],
  }
}

describe('cliente hospedeiro do Worker', () => {
  it('envia um request e entrega progress/result somente do request ativo', async () => {
    const worker = new FakeWorkerHandle()
    const client = new SimulationWorkerClient({ worker, timeoutMs: 100 })
    const progress: number[] = []
    const promise = client.run(request, { onProgress: (message) => progress.push(message.snapshot.tick) })

    worker.emit({
      type: 'progress',
      protocolVersion: 1,
      requestId: 'outro-request',
      snapshot: { tick: 99, values: {} },
    })
    worker.emit({
      type: 'progress',
      protocolVersion: 1,
      requestId: request.requestId,
      snapshot: { tick: 1, values: { a: [true] } },
    })
    worker.emit(result())

    const outcome = await promise
    expect(worker.sent).toEqual([request])
    expect(progress).toEqual([1])
    expect(outcome.type).toBe('result')
    client.dispose()
  })

  it('converte AbortSignal em cancel request e aguarda cancelled', async () => {
    const worker = new FakeWorkerHandle()
    const client = new SimulationWorkerClient({ worker, timeoutMs: 100 })
    const controller = new AbortController()
    const promise = client.run(request, { signal: controller.signal })

    controller.abort()
    expect(worker.sent).toHaveLength(2)
    expect(worker.sent[1]).toEqual({ type: 'cancel', protocolVersion: 1, requestId: request.requestId })
    worker.emit({
      type: 'cancelled',
      protocolVersion: 1,
      requestId: request.requestId,
      message: 'cancelado',
    })

    const outcome = await promise
    expect(outcome.type).toBe('cancelled')
    client.dispose()
  })

  it('não envia request quando o signal já está abortado', async () => {
    const worker = new FakeWorkerHandle()
    const client = new SimulationWorkerClient({ worker })
    const controller = new AbortController()
    controller.abort()

    const outcome = await client.run(request, { signal: controller.signal })
    expect(outcome.type).toBe('cancelled')
    expect(worker.sent).toHaveLength(0)
    client.dispose()
  })

  it('classifica timeout do host como forced-termination e termina o Worker', async () => {
    const worker = new FakeWorkerHandle()
    const client = new SimulationWorkerClient({ worker, timeoutMs: 1 })

    const outcome = await client.run(request)
    expect(outcome.type).toBe('error')
    if (outcome.type === 'error') expect(outcome.code).toBe('forced-termination')
    expect(worker.terminated).toBe(true)
    const afterTermination = await client.run({ ...request, requestId: 'after-termination' })
    expect(afterTermination.type).toBe('error')
    if (afterTermination.type === 'error') expect(afterTermination.code).toBe('forced-termination')
    client.dispose()
  })

  it('rejeita uma segunda execução enquanto a primeira está ativa', async () => {
    const worker = new FakeWorkerHandle()
    const client = new SimulationWorkerClient({ worker, timeoutMs: 100 })
    const first = client.run(request)
    const second = await client.run({ ...request, requestId: 'second' })

    expect(second.type).toBe('error')
    if (second.type === 'error') expect(second.code).toBe('invalid-request')
    worker.emit(result())
    await first
    client.dispose()
  })

  it('resolve o request ativo como forced-termination ao fazer dispose', async () => {
    const worker = new FakeWorkerHandle()
    const client = new SimulationWorkerClient({ worker, timeoutMs: 100 })
    const promise = client.run(request)

    client.dispose()
    const outcome = await promise

    expect(outcome.type).toBe('error')
    if (outcome.type === 'error') expect(outcome.code).toBe('forced-termination')
    expect(worker.terminated).toBe(true)
  })
})
