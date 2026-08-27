import { describe, expect, it } from 'vitest'
import { createCircuitDocument, type CircuitDocument } from '../circuit'
import { DocumentWorkerExecutor } from './documentWorkerExecutor'
import type {
  SimulationWorkerHandle,
  SimulationWorkerMessageEvent,
  SimulationWorkerRequest,
  SimulationWorkerResponse,
} from './workerProtocol'

class FakeWorkerHandle implements SimulationWorkerHandle {
  readonly sent: SimulationWorkerRequest[] = []
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
    const event: SimulationWorkerMessageEvent = { data: message }
    for (const listener of [...this.listeners]) listener(event)
  }
}

function documentFixture(): CircuitDocument {
  const document = createCircuitDocument('Executor test')
  document.nodes = [
    { id: 'input', type: 'input', position: { x: 0, y: 0 }, options: { initial: false } },
    { id: 'output', type: 'output', position: { x: 160, y: 0 } },
  ]
  document.connections = [{ source: { node: 'input' }, target: { node: 'output', port: 0 } }]
  return document
}

describe('executor documental Worker', () => {
  it('compõe bridge e cliente e devolve preflight/result', async () => {
    const worker = new FakeWorkerHandle()
    const executor = new DocumentWorkerExecutor({ worker, timeoutMs: 100 })
    const document = documentFixture()
    const promise = executor.run(document, {
      requestId: 'executor-success',
      inputs: { input: true },
      ticks: 2,
    })

    expect(worker.sent[0]?.type).toBe('run')
    worker.emit({
      type: 'result',
      protocolVersion: 1,
      requestId: 'executor-success',
      snapshots: [{ tick: 2, values: { input: [true], output: [true] } }],
    })

    const execution = await promise
    expect(execution.preflight.status).toBe('acyclic')
    expect(execution.outcome.type).toBe('result')
    expect(JSON.stringify(document)).toContain('Executor test')
    executor.dispose()
  })

  it('converte falha de construção em erro controlado sem enviar request', async () => {
    const worker = new FakeWorkerHandle()
    const executor = new DocumentWorkerExecutor({ worker })

    const execution = await executor.run(documentFixture(), {
      requestId: 'executor-invalid-input',
      inputs: { missing: true },
    })

    expect(execution.preflight.status).toBe('acyclic')
    expect(execution.outcome.type).toBe('error')
    if (execution.outcome.type === 'error') expect(execution.outcome.code).toBe('invalid-request')
    expect(worker.sent).toHaveLength(0)
    executor.dispose()
  })

  it('propaga AbortSignal ao cliente e preserva cancelled', async () => {
    const worker = new FakeWorkerHandle()
    const executor = new DocumentWorkerExecutor({ worker, timeoutMs: 100 })
    const controller = new AbortController()
    const promise = executor.run(documentFixture(), {
      requestId: 'executor-cancel',
      signal: controller.signal,
      ticks: 32,
    })

    controller.abort()
    expect(worker.sent.at(-1)?.type).toBe('cancel')
    worker.emit({
      type: 'cancelled',
      protocolVersion: 1,
      requestId: 'executor-cancel',
      message: 'cancelado',
    })

    const execution = await promise
    expect(execution.outcome.type).toBe('cancelled')
    executor.dispose()
  })

  it('encerra o cliente e o request ativo de modo idempotente', async () => {
    const worker = new FakeWorkerHandle()
    const executor = new DocumentWorkerExecutor({ worker, timeoutMs: 100 })
    const promise = executor.run(documentFixture(), { requestId: 'executor-dispose' })

    executor.dispose()
    executor.dispose()
    const execution = await promise

    expect(execution.outcome.type).toBe('error')
    if (execution.outcome.type === 'error') expect(execution.outcome.code).toBe('forced-termination')
    expect(worker.terminated).toBe(true)
  })
})
