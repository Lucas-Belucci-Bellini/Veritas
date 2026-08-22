import { describe, expect, it } from 'vitest'
import type { CircuitDocument } from '../circuit'
import {
  createDocumentRuntime,
  documentInputIds,
  documentWatches,
  runtimeValue,
  snapshotDocumentRuntime,
} from './documentRuntime'

function feedbackDocument(): CircuitDocument {
  return {
    format: 'veritas-circuit',
    version: 1,
    name: 'Contador visual',
    nodes: [
      { id: 'clk', type: 'input', position: { x: 0, y: 0 }, options: { initial: false } },
      { id: 'ff', type: 'dff', position: { x: 180, y: 50 } },
      { id: 'out', type: 'output', position: { x: 360, y: 50 } },
    ],
    connections: [
      { source: { node: 'ff', port: 1 }, target: { node: 'ff', port: 0 } },
      { source: { node: 'clk' }, target: { node: 'ff', port: 1 } },
      { source: { node: 'ff' }, target: { node: 'out', port: 0 } },
    ],
  }
}

describe('documentRuntime', () => {
  it('converte um documento visual e aplica entradas iniciais', () => {
    const document = feedbackDocument()
    const simulator = createDocumentRuntime(document)
    const snapshot = snapshotDocumentRuntime(simulator)

    expect(documentInputIds(document)).toEqual(['clk'])
    expect(snapshot.tick).toBe(0)
    expect(runtimeValue(snapshot, 'ff')).toBe(false)
    expect(documentWatches(document).map((watch) => watch.label)).toEqual(['clk', 'ff · Q', 'ff · Q̄', 'out'])
  })

  it('propaga sinal wireless sem estado extra no runtime', () => {
    const document: CircuitDocument = {
      format: 'veritas-circuit',
      version: 1,
      name: 'Wireless runtime',
      nodes: [
        { id: 'input', type: 'input', position: { x: 0, y: 0 } },
        { id: 'tx', type: 'transmitter', position: { x: 120, y: 0 }, options: { channel: 'bus-a' } },
        { id: 'rx', type: 'receiver', position: { x: 240, y: 0 }, options: { channel: 'bus-a' } },
        { id: 'out', type: 'output', position: { x: 360, y: 0 } },
      ],
      connections: [
        { source: { node: 'input' }, target: { node: 'tx', port: 0 } },
        { source: { node: 'rx' }, target: { node: 'out', port: 0 } },
      ],
    }
    const simulator = createDocumentRuntime(document)

    simulator.setInput('input', true)
    simulator.tick(3)

    expect(simulator.read('tx')).toBe(true)
    expect(simulator.read('rx')).toBe(true)
    expect(simulator.read('out')).toBe(true)
  })

  it('mantém a realimentação e atualiza Q no pulso de clock', () => {
    const simulator = createDocumentRuntime(feedbackDocument())

    simulator.setInput('clk', true)
    simulator.tick()
    expect(simulator.read('ff')).toBe(true)
    expect(simulator.read('out')).toBe(false)
    simulator.tick()
    expect(simulator.read('out')).toBe(true)

    simulator.setInput('clk', false)
    simulator.tick()
    simulator.setInput('clk', true)
    simulator.tick()
    expect(simulator.read('ff')).toBe(false)
  })
})


describe('configuração temporal do documento', () => {
  it('aplica override de período ao runtime sem alterar o documento', () => {
    const document: CircuitDocument = {
      format: 'veritas-circuit',
      version: 1,
      name: 'Clock configurável',
      nodes: [{ id: 'clk', type: 'clock', position: { x: 0, y: 0 }, options: { period: 1 } }],
      connections: [],
    }
    const simulator = createDocumentRuntime(document, { clockPeriods: { clk: 4 } })

    simulator.tick(3)
    expect(simulator.read('clk')).toBe(false)
    simulator.tick()
    expect(simulator.read('clk')).toBe(true)
    expect(document.nodes[0].options?.period).toBe(1)
  })
})
