import { describe, expect, it } from 'vitest'
import { SimulationWorkerSupervisor, type SimulationWorkerClientLike } from './workerSupervisor'
import type {
  SimulationWorkerError,
  SimulationWorkerRunRequest,
} from './workerProtocol'
import type {
  SimulationWorkerRunOptions,
  SimulationWorkerRunOutcome,
} from './workerClient'

class FakeWorkerClient implements SimulationWorkerClientLike {
  request: SimulationWorkerRunRequest | undefined
  options: SimulationWorkerRunOptions | undefined
  disposed = false
  private resolvePending: ((outcome: SimulationWorkerRunOutcome) => void) | undefined

  run(request: SimulationWorkerRunRequest, options: SimulationWorkerRunOptions = {}): Promise<SimulationWorkerRunOutcome> {
    this.request = request
    this.options = options
    return new Promise((resolve) => {
      this.resolvePending = resolve
    })
  }

  dispose(): void {
    this.disposed = true
    this.finish(error('forced-termination', 'fake dispose'))
  }

  finish(outcome: SimulationWorkerRunOutcome): void {
    const resolve = this.resolvePending
    this.resolvePending = undefined
    resolve?.(outcome)
  }
}

const component = { id: 'input-a', type: 'input' as const }

function request(requestId: string, ticks = 1, budget?: SimulationWorkerRunRequest['budget']): SimulationWorkerRunRequest {
  return {
    type: 'run',
    protocolVersion: 1,
    requestId,
    components: [component],
    steps: [{ ticks }],
    watch: ['input-a'],
    budget,
    yieldEvery: 1,
    timeoutMs: 30_000,
  }
}

function result(requestId: string): SimulationWorkerRunOutcome {
  return {
    type: 'result',
    protocolVersion: 1,
    requestId,
    snapshots: [],
  }
}

function cancelled(requestId: string): SimulationWorkerRunOutcome {
  return {
    type: 'cancelled',
    protocolVersion: 1,
    requestId,
    message: 'fake cancel',
  }
}

function error(code: SimulationWorkerError['code'], message: string): SimulationWorkerError {
  return { type: 'error', protocolVersion: 1, requestId: 'fake', code, message }
}

describe('supervisor bounded de Worker', () => {
  it('limita concorrência, preserva ordem da fila e libera a reserva após cada resultado', async () => {
    const clients: FakeWorkerClient[] = []
    const supervisor = new SimulationWorkerSupervisor({
      maxConcurrent: 1,
      maxQueued: 1,
      createClient: () => {
        const client = new FakeWorkerClient()
        clients.push(client)
        return client
      },
    })

    const first = supervisor.run(request('first', 2))
    const second = supervisor.run(request('second', 3))

    expect(clients).toHaveLength(1)
    expect(supervisor.getSnapshot()).toMatchObject({
      active: 1,
      queued: 1,
      reservedTicks: 5,
      closed: false,
    })

    clients[0].finish(result('first'))
    await expect(first).resolves.toMatchObject({ type: 'result', requestId: 'first' })
    await Promise.resolve()

    expect(clients).toHaveLength(2)
    expect(clients[1].request?.requestId).toBe('second')
    expect(supervisor.getSnapshot()).toMatchObject({ active: 1, queued: 0, reservedTicks: 3 })

    clients[1].finish(result('second'))
    await expect(second).resolves.toMatchObject({ type: 'result', requestId: 'second' })
    expect(supervisor.getSnapshot()).toMatchObject({ active: 0, queued: 0, reservedTicks: 0 })
    supervisor.dispose()
  })

  it('aplica backpressure quando a fila bounded está cheia', async () => {
    const clients: FakeWorkerClient[] = []
    const supervisor = new SimulationWorkerSupervisor({
      maxConcurrent: 1,
      maxQueued: 1,
      createClient: () => {
        const client = new FakeWorkerClient()
        clients.push(client)
        return client
      },
    })

    const first = supervisor.run(request('first'))
    const second = supervisor.run(request('second'))
    const rejected = await supervisor.run(request('third'))

    expect(rejected).toMatchObject({ type: 'error', code: 'invalid-request', requestId: 'third' })
    expect(supervisor.getSnapshot()).toMatchObject({ active: 1, queued: 1, reservedTicks: 2 })

    supervisor.dispose()
    await expect(first).resolves.toMatchObject({ type: 'error', code: 'forced-termination' })
    await expect(second).resolves.toMatchObject({ type: 'error', code: 'forced-termination' })
    expect(clients[0].disposed).toBe(true)
    expect(supervisor.getSnapshot()).toMatchObject({ active: 0, queued: 0, reservedTicks: 0, closed: true })
  })

  it('rejeita reserva agregada declarativa antes de enfileirar e não deixa consumo residual', async () => {
    const client = new FakeWorkerClient()
    const supervisor = new SimulationWorkerSupervisor({
      maxConcurrent: 1,
      maxAggregateTicks: 3,
      maxAggregateMemoryBytes: 2_048,
      maxAggregateOperations: 2,
      createClient: () => client,
    })
    const budget = { maxTicks: 2, maxMemoryBytes: 1_024, maxOperations: 1 }

    const accepted = supervisor.run(request('accepted', 2, budget))
    const rejected = await supervisor.run(request('rejected', 2, budget))

    expect(rejected).toMatchObject({ type: 'error', code: 'document-budget', requestId: 'rejected' })
    expect(supervisor.getSnapshot()).toMatchObject({
      active: 1,
      queued: 0,
      reservedTicks: 2,
      reservedMemoryBytes: 1_024,
      reservedOperations: 1,
    })

    client.finish(result('accepted'))
    await accepted
    expect(supervisor.getSnapshot()).toMatchObject({
      active: 0,
      reservedTicks: 0,
      reservedMemoryBytes: 0,
      reservedOperations: 0,
    })
    supervisor.dispose()
  })

  it('cancela request ainda na fila e devolve a reserva sem tocar no request ativo', async () => {
    const clients: FakeWorkerClient[] = []
    const supervisor = new SimulationWorkerSupervisor({
      maxConcurrent: 1,
      maxQueued: 1,
      createClient: () => {
        const client = new FakeWorkerClient()
        clients.push(client)
        return client
      },
    })
    const first = supervisor.run(request('first'))
    const controller = new AbortController()
    const second = supervisor.run(request('second'), { signal: controller.signal })

    controller.abort()
    await expect(second).resolves.toMatchObject({ type: 'cancelled', requestId: 'second' })
    expect(supervisor.getSnapshot()).toMatchObject({ active: 1, queued: 0, reservedTicks: 1 })
    expect(clients).toHaveLength(1)

    clients[0].finish(result('first'))
    await first
    supervisor.dispose()
  })

  it('cancela request ativo por AbortSignal local e só finaliza após resposta cancelada', async () => {
    const client = new FakeWorkerClient()
    const supervisor = new SimulationWorkerSupervisor({ createClient: () => client })
    const run = supervisor.run(request('active'))

    expect(supervisor.cancel('active')).toBe(true)
    expect(client.options?.signal?.aborted).toBe(true)
    expect(supervisor.cancel('missing')).toBe(false)

    client.finish(cancelled('active'))
    await expect(run).resolves.toMatchObject({ type: 'cancelled', requestId: 'active' })
    expect(supervisor.getSnapshot()).toMatchObject({ active: 0, reservedTicks: 0 })
    supervisor.dispose()
  })

  it('encerra fila e execução ativa de modo bounded e idempotente', async () => {
    const clients: FakeWorkerClient[] = []
    const supervisor = new SimulationWorkerSupervisor({
      maxConcurrent: 1,
      maxQueued: 1,
      createClient: () => {
        const client = new FakeWorkerClient()
        clients.push(client)
        return client
      },
    })

    const first = supervisor.run(request('first'))
    const second = supervisor.run(request('second'))
    supervisor.dispose()
    supervisor.dispose()

    await expect(first).resolves.toMatchObject({ type: 'error', code: 'forced-termination' })
    await expect(second).resolves.toMatchObject({ type: 'error', code: 'forced-termination', requestId: 'second' })
    expect(clients[0].disposed).toBe(true)
    expect(supervisor.getSnapshot()).toMatchObject({ active: 0, queued: 0, reservedTicks: 0, closed: true })
  })
})
