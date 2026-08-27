import { describe, expect, it } from 'vitest'
import {
  installSimulationWorker,
  MAX_WORKER_PROGRESS_MESSAGES,
  parseSimulationWorkerRequest,
  type SimulationWorkerRequest,
  type SimulationWorkerResponse,
  type SimulationWorkerRunRequest,
  type SimulationWorkerEndpoint,
  type SimulationWorkerMessageEvent,
} from './workerProtocol'

class FakeWorkerEndpoint implements SimulationWorkerEndpoint {
  readonly messages: SimulationWorkerResponse[] = []
  private readonly listeners = new Set<(event: SimulationWorkerMessageEvent) => void>()

  addEventListener(_type: 'message', listener: (event: SimulationWorkerMessageEvent) => void): void {
    this.listeners.add(listener)
  }

  removeEventListener(_type: 'message', listener: (event: SimulationWorkerMessageEvent) => void): void {
    this.listeners.delete(listener)
  }

  postMessage(message: SimulationWorkerResponse): void {
    this.messages.push(message)
  }

  emit(data: unknown): void {
    const event: SimulationWorkerMessageEvent = { data }
    for (const listener of [...this.listeners]) listener(event)
  }
}

const clockComponents = [{ id: 'clk', type: 'clock' as const, options: { period: 2 } }]

function runRequest(overrides: Partial<SimulationWorkerRunRequest> = {}): SimulationWorkerRunRequest {
  return {
    type: 'run',
    protocolVersion: 1,
    requestId: 'request-1',
    components: clockComponents,
    steps: [{ ticks: 4 }],
    watch: ['clk'],
    yieldEvery: 1,
    timeoutMs: 30_000,
    ...overrides,
  }
}

async function waitFor(
  endpoint: FakeWorkerEndpoint,
  predicate: (message: SimulationWorkerResponse) => boolean,
): Promise<SimulationWorkerResponse> {
  for (let index = 0; index < 500; index += 1) {
    const message = endpoint.messages.find(predicate)
    if (message) return message
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  throw new Error('O Worker não respondeu dentro do limite do teste.')
}

function cancelRequest(requestId: string): SimulationWorkerRequest {
  return { type: 'cancel', protocolVersion: 1, requestId }
}

describe('protocolo de execução Worker', () => {
  it('recusa mensagens incompatíveis antes de criar um runtime', () => {
    const parsed = parseSimulationWorkerRequest({
      type: 'run',
      protocolVersion: 99,
      requestId: 'bad',
      components: clockComponents,
      steps: [],
    })

    expect('message' in parsed && parsed.message).toContain('protocolVersion')
  })

  it('recusa componentes fora do runtime escalar do Worker v1', () => {
    const custom = parseSimulationWorkerRequest({
      ...runRequest(),
      components: [{ id: 'chip', type: 'custom-chip' }],
    })
    const vector = parseSimulationWorkerRequest({
      ...runRequest(),
      components: [{ id: 'bus', type: 'input', options: { width: 4 } }],
    })

    expect('message' in custom && custom.message).toContain('custom-chip')
    expect('message' in vector && vector.message).toContain('vetoriais')
  })

  it('preserva snapshots temporais no caminho isolado', async () => {
    const endpoint = new FakeWorkerEndpoint()
    const dispose = installSimulationWorker(endpoint)

    endpoint.emit(runRequest())
    const result = await waitFor(endpoint, (message) => message.type === 'result')
    expect(result.type).toBe('result')
    if (result.type === 'result') {
      expect(result.snapshots.map((snapshot) => snapshot.tick)).toEqual([0, 1, 2, 3, 4])
      expect(result.snapshots.at(-1)?.values.clk).toEqual([false])
    }

    dispose()
  })

  it('limita progresso e mantém uma única resposta final', async () => {
    const endpoint = new FakeWorkerEndpoint()
    const dispose = installSimulationWorker(endpoint)

    endpoint.emit(runRequest({ requestId: 'bounded', steps: [{ ticks: 100 }] }))
    const result = await waitFor(endpoint, (message) => message.type === 'result')
    const progress = endpoint.messages.filter((message) => message.type === 'progress')

    expect(result.type).toBe('result')
    expect(progress.length).toBeLessThanOrEqual(MAX_WORKER_PROGRESS_MESSAGES)
    expect(endpoint.messages.filter((message) => message.type === 'result')).toHaveLength(1)

    dispose()
  })

  it('cancela antes do primeiro tique e devolve cancelled', async () => {
    const endpoint = new FakeWorkerEndpoint()
    const dispose = installSimulationWorker(endpoint)

    endpoint.emit(runRequest({ requestId: 'before', steps: [{ ticks: 8 }] }))
    endpoint.emit(cancelRequest('before'))
    const cancelled = await waitFor(endpoint, (message) => message.type === 'cancelled')

    expect(cancelled.type).toBe('cancelled')
    expect(endpoint.messages.some((message) => message.type === 'result')).toBe(false)
    dispose()
  })

  it('cancela entre yields e não mantém execução ativa', async () => {
    const endpoint = new FakeWorkerEndpoint()
    const dispose = installSimulationWorker(endpoint)
    let cancelled = false
    const originalPost = endpoint.postMessage.bind(endpoint)
    endpoint.postMessage = (message) => {
      originalPost(message)
      if (message.type === 'progress' && !cancelled) {
        cancelled = true
        endpoint.emit(cancelRequest(message.requestId))
      }
    }

    endpoint.emit(runRequest({ requestId: 'between', steps: [{ ticks: 64 }] }))
    const response = await waitFor(endpoint, (message) => message.type === 'cancelled')

    expect(response.type).toBe('cancelled')
    expect(endpoint.messages.filter((message) => message.type === 'result')).toHaveLength(0)
    dispose()
  })

  it('não permite duas execuções com o mesmo requestId', async () => {
    const endpoint = new FakeWorkerEndpoint()
    const dispose = installSimulationWorker(endpoint)

    endpoint.emit(runRequest({ requestId: 'duplicate', steps: [{ ticks: 64 }] }))
    endpoint.emit(runRequest({ requestId: 'duplicate', steps: [{ ticks: 1 }] }))
    const duplicate = await waitFor(endpoint, (message) => message.type === 'error' && message.requestId === 'duplicate')

    expect(duplicate.type).toBe('error')
    if (duplicate.type === 'error') expect(duplicate.code).toBe('invalid-request')
    endpoint.emit(cancelRequest('duplicate'))
    await waitFor(endpoint, (message) => message.type === 'cancelled')
    dispose()
  })

  it('encerra por timeout global com erro controlado', async () => {
    const endpoint = new FakeWorkerEndpoint()
    const dispose = installSimulationWorker(endpoint)

    endpoint.emit(runRequest({ requestId: 'timeout', steps: [{ ticks: 1_000 }], timeoutMs: 1 }))
    const error = await waitFor(endpoint, (message) => message.type === 'error')

    expect(error.type).toBe('error')
    if (error.type === 'error') expect(error.code).toBe('timeout')
    dispose()
  })

  it('classifica budget de operações como erro controlado', async () => {
    const endpoint = new FakeWorkerEndpoint()
    const dispose = installSimulationWorker(endpoint)

    endpoint.emit(runRequest({
      requestId: 'budget',
      components: [{ id: 'input', type: 'input' }],
      steps: [{ ticks: 1 }],
      watch: ['input'],
      budget: { maxOperations: 1 },
    }))
    const error = await waitFor(endpoint, (message) => message.type === 'error')

    expect(error.type).toBe('error')
    if (error.type === 'error') expect(error.code).toBe('operation-budget')
    dispose()
  })

  it('não envia respostas tardias após dispose', async () => {
    const endpoint = new FakeWorkerEndpoint()
    const dispose = installSimulationWorker(endpoint)

    endpoint.emit(runRequest({ requestId: 'disposed', steps: [{ ticks: 64 }] }))
    dispose()
    await new Promise<void>((resolve) => setTimeout(resolve, 10))

    expect(endpoint.messages).toHaveLength(0)
  })
})
