import { describe, expect, it } from 'vitest'
import {
  buildCustomChipDefinition,
  type CircuitDocument,
  type CustomChipLibraryEntry,
} from '../circuit'
import {
  createDocumentRuntime,
  documentInputIds,
  documentWatches,
  runtimeValue,
  snapshotDocumentRuntime,
} from './documentRuntime'

function inverterChip(): CustomChipLibraryEntry {
  const document: CircuitDocument = {
    format: 'veritas-circuit',
    version: 1,
    name: 'Inversor',
    nodes: [
      { id: 'in', type: 'input', position: { x: 0, y: 0 } },
      { id: 'not', type: 'not', position: { x: 100, y: 0 } },
      { id: 'out', type: 'output', position: { x: 200, y: 0 } },
    ],
    connections: [
      { source: { node: 'in' }, target: { node: 'not', port: 0 } },
      { source: { node: 'not' }, target: { node: 'out', port: 0 } },
    ],
  }
  return { id: 1, definition: buildCustomChipDefinition(document, 'Inversor') }
}

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

  it('expõe Q e Q̄ de JK/SR nos watches do documento', () => {
    const document: CircuitDocument = {
      format: 'veritas-circuit',
      version: 1,
      name: 'Watches sequenciais',
      nodes: [
        { id: 'jk', type: 'jk', position: { x: 0, y: 0 } },
        { id: 'sr', type: 'sr', position: { x: 180, y: 0 }, label: 'Memória SR' },
      ],
      connections: [],
    }

    expect(documentWatches(document).map((watch) => watch.label)).toEqual([
      'jk · Q',
      'jk · Q̄',
      'Memória SR · Q',
      'Memória SR · Q̄',
    ])
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

  it('expande chip customizado antes de simular um caminho temporal', () => {
    const document: CircuitDocument = {
      format: 'veritas-circuit',
      version: 1,
      name: 'DFF com inversor',
      nodes: [
        { id: 'd', type: 'input', position: { x: 0, y: 0 } },
        { id: 'clk', type: 'input', position: { x: 0, y: 100 } },
        { id: 'chip', type: 'custom-chip', position: { x: 150, y: 0 }, options: { customChipId: 1 } },
        { id: 'ff', type: 'dff', position: { x: 350, y: 0 } },
        { id: 'out', type: 'output', position: { x: 500, y: 0 } },
      ],
      connections: [
        { source: { node: 'd' }, target: { node: 'chip', port: 0 } },
        { source: { node: 'chip' }, target: { node: 'ff', port: 0 } },
        { source: { node: 'clk' }, target: { node: 'ff', port: 1 } },
        { source: { node: 'ff' }, target: { node: 'out', port: 0 } },
      ],
    }
    const simulator = createDocumentRuntime(document, { customChips: [inverterChip()] })

    simulator.setInput('d', false)
    simulator.setInput('clk', false)
    simulator.tick(2)
    simulator.setInput('clk', true)
    simulator.tick()
    simulator.tick()

    const snapshot = snapshotDocumentRuntime(simulator, document, [inverterChip()])
    expect(simulator.read('out')).toBe(true)
    expect(runtimeValue(snapshot, 'chip')).toBe(true)
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
