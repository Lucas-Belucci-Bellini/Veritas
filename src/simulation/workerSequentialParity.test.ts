import { describe, expect, it } from 'vitest'
import dffFixture from '../../tests/fixtures/worker-sequential-dff.json'
import tffFixture from '../../tests/fixtures/worker-sequential-tff.json'
import jkFixture from '../../tests/fixtures/worker-sequential-jk.json'
import srFixture from '../../tests/fixtures/worker-sequential-sr.json'
import delayFixture from '../../tests/fixtures/worker-sequential-delay.json'
import { Simulator } from './simulator'
import { applySequentialInputs, snapshotSequentialSimulator } from './workspace'
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

type SharedFixture = {
  request: {
    protocolVersion: number
    requestId: string
    components: SimulationWorkerRunRequest['components']
    steps: SimulationWorkerRunRequest['steps']
    watch: SimulationWorkerRunRequest['watch']
    yieldEvery?: number
    timeoutMs?: number
  }
  expectedSnapshots: readonly { tick: number; values: Record<string, boolean[]> }[]
}

const fixtures: readonly { name: string; fixture: SharedFixture }[] = [
  { name: 'DFF', fixture: dffFixture as SharedFixture },
  { name: 'TFF', fixture: tffFixture as SharedFixture },
  { name: 'JK', fixture: jkFixture as SharedFixture },
  { name: 'SR', fixture: srFixture as SharedFixture },
  { name: 'DELAY', fixture: delayFixture as SharedFixture },
]

function toRequest(fixture: SharedFixture): SimulationWorkerRunRequest {
  return {
    type: 'run',
    protocolVersion: 1,
    requestId: fixture.request.requestId,
    components: fixture.request.components,
    steps: fixture.request.steps,
    watch: fixture.request.watch,
    yieldEvery: fixture.request.yieldEvery,
    timeoutMs: fixture.request.timeoutMs,
  }
}

function expectedSnapshots(request: SimulationWorkerRunRequest): readonly { tick: number; values: Record<string, boolean[]> }[] {
  const simulator = new Simulator({ components: [...request.components] })
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
  for (const { name, fixture } of fixtures) {
    it(`preserva snapshots e estado temporal de ${name} com clock dentro de um request`, async () => {
      const request = toRequest(fixture)
      const endpoint = new Endpoint()
      const dispose = installSimulationWorker(endpoint)
      endpoint.emit(request)

      const result = await waitForResult(endpoint)

      expect(expectedSnapshots(request)).toEqual(fixture.expectedSnapshots)
      expect(result.snapshots).toEqual(fixture.expectedSnapshots)
      expect(endpoint.messages.filter((message) => message.type === 'result')).toHaveLength(1)
      dispose()
    })
  }
})
