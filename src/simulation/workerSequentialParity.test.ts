import { describe, expect, it } from 'vitest'
import { Simulator } from './simulator'
import { applySequentialInputs, getSequentialDemo, snapshotSequentialSimulator } from './workspace'
import {
  installSimulationWorker,
  type SimulationWorkerEndpoint,
  type SimulationWorkerMessageEvent,
  type SimulationWorkerResponse,
  type SimulationWorkerRunRequest,
} from './workerProtocol'

class Endpoint implements SimulationWorkerEndpoint {
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

const request: SimulationWorkerRunRequest = {
  type: 'run',
  protocolVersion: 1,
  requestId: 'sequential-parity-dff',
  components: getSequentialDemo('dff-clock').netlist.components,
  steps: [
    { set: { d: true }, ticks: 1 },
    { ticks: 1 },
    { set: { d: false }, ticks: 1 },
    { ticks: 1 },
  ],
  watch: ['d', 'clk', 'ff', 'qout'],
  yieldEvery: 1,
  timeoutMs: 30_000,
}

function expectedSnapshots(): readonly { tick: number; values: Record<string, boolean[]> }[] {
  const simulator = new Simulator(getSequentialDemo('dff-clock').netlist)
  const snapshots = [snapshotSequentialSimulator(simulator)]
  for (const step of request.steps) {
    applySequentialInputs(simulator, step.set ?? {})
    simulator.tick(step.ticks ?? 1)
    snapshots.push(snapshotSequentialSimulator(simulator))
  }
  return snapshots.map((snapshot) => ({
    tick: snapshot.tick,
    values: Object.fromEntries(request.watch!.map((id) => [id, [snapshot.values[id]?.[0] ?? false]])),
  }))
}

async function waitForResult(endpoint: Endpoint): Promise<Extract<SimulationWorkerResponse, { type: 'result' }>> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const result = endpoint.messages.find((message): message is Extract<SimulationWorkerResponse, { type: 'result' }> => message.type === 'result')
    if (result) return result
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  throw new Error('O Worker não respondeu dentro do limite de paridade.')
}

describe('paridade sequencial Worker versus Simulator', () => {
  it('preserva snapshots e estado temporal de DFF com clock dentro de um request', async () => {
    const endpoint = new Endpoint()
    const dispose = installSimulationWorker(endpoint)
    endpoint.emit(request)

    const result = await waitForResult(endpoint)

    expect(result.snapshots).toEqual(expectedSnapshots())
    expect(result.snapshots.map((snapshot) => snapshot.tick)).toEqual([0, 1, 2, 3, 4])
    expect(endpoint.messages.filter((message) => message.type === 'result')).toHaveLength(1)
    dispose()
  })
})
