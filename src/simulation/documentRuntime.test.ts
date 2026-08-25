import { describe, expect, it } from 'vitest'
import { buildCustomChipDefinition, type CircuitDocument } from '../circuit'
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


describe('runtime temporal com chips customizados', () => {
  const chipDoc = (): CircuitDocument => ({
    format: 'veritas-circuit', version: 1, name: 'inversor',
    nodes: [
      { id: 'i', type: 'input', position: { x: 0, y: 0 }, label: 'IN' },
      { id: 'nn', type: 'not', position: { x: 60, y: 0 } },
      { id: 'o', type: 'output', position: { x: 120, y: 0 }, label: 'OUT' },
    ],
    connections: [
      { source: { node: 'i', port: 0 }, target: { node: 'nn', port: 0 } },
      { source: { node: 'nn', port: 0 }, target: { node: 'o', port: 0 } },
    ],
  })

  it('propaga o sinal através da instância de chip', () => {
    const definition = buildCustomChipDefinition(chipDoc(), 'Inversor')
    const document: CircuitDocument = {
      format: 'veritas-circuit', version: 1, name: 'usa o chip',
      nodes: [
        { id: 'd', type: 'input', position: { x: 0, y: 0 }, label: 'D' },
        { id: 'chip', type: 'custom-chip', position: { x: 80, y: 0 }, label: 'INV', options: { customChipId: 1 } },
        { id: 'q', type: 'output', position: { x: 200, y: 0 }, label: 'Q' },
      ],
      connections: [
        { source: { node: 'd', port: 0 }, target: { node: 'chip', port: 0 } },
        { source: { node: 'chip', port: 0 }, target: { node: 'q', port: 0 } },
      ],
    }

    const simulator = createDocumentRuntime(document, { customChips: [{ id: 1, definition }] })
    simulator.setInput('d', true)
    simulator.tick(8)
    // Regressão: antes o simulador ignorava a ligação para o pino interno do
    // chip elaborado, então o NOT rodava sobre zero e devolvia 1.
    expect(simulator.read('q')).toBe(false)

    simulator.setInput('d', false)
    simulator.tick(8)
    expect(simulator.read('q')).toBe(true)
  })

  it('preserva os IDs do topo depois de achatar a hierarquia', () => {
    const definition = buildCustomChipDefinition(chipDoc(), 'Inversor')
    const document: CircuitDocument = {
      format: 'veritas-circuit', version: 1, name: 'usa o chip',
      nodes: [
        { id: 'entrada', type: 'input', position: { x: 0, y: 0 }, label: 'D' },
        { id: 'chip', type: 'custom-chip', position: { x: 80, y: 0 }, options: { customChipId: 1 } },
        { id: 'saida', type: 'output', position: { x: 200, y: 0 }, label: 'Q' },
      ],
      connections: [
        { source: { node: 'entrada', port: 0 }, target: { node: 'chip', port: 0 } },
        { source: { node: 'chip', port: 0 }, target: { node: 'saida', port: 0 } },
      ],
    }

    const simulator = createDocumentRuntime(document, { customChips: [{ id: 1, definition }] })
    // setInput e read continuam falando dos IDs que o autor vê no canvas.
    expect(() => simulator.setInput('entrada', true)).not.toThrow()
    simulator.tick(6)
    expect(simulator.read('saida')).toBe(false)
  })

  it('recusa simular quando a definição do chip não veio', () => {
    const document: CircuitDocument = {
      format: 'veritas-circuit', version: 1, name: 'sem definição',
      nodes: [
        { id: 'd', type: 'input', position: { x: 0, y: 0 }, label: 'D' },
        { id: 'chip', type: 'custom-chip', position: { x: 80, y: 0 }, options: { customChipId: 42 } },
        { id: 'q', type: 'output', position: { x: 200, y: 0 }, label: 'Q' },
      ],
      connections: [
        { source: { node: 'd', port: 0 }, target: { node: 'chip', port: 0 } },
        { source: { node: 'chip', port: 0 }, target: { node: 'q', port: 0 } },
      ],
    }

    expect(() => createDocumentRuntime(document)).toThrow()
  })
})

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
