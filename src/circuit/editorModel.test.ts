import { describe, expect, it } from 'vitest'
import { toBinary } from '../bus'
import {
  CircuitValidationError,
  createCircuitDocument,
  EDITOR_COMPONENT_TYPES,
  editorInputCount,
  evaluateCircuit,
  evaluateCircuitVectors,
  toNetlist,
  validateCircuit,
  type CircuitDocument,
} from './index'

function wirelessCircuit(width = 1): CircuitDocument {
  return {
    ...createCircuitDocument('Wireless AND'),
    nodes: [
      { id: 'input', type: 'input', position: { x: 0, y: 0 }, options: { width } },
      { id: 'tx', type: 'transmitter', position: { x: 140, y: 0 }, options: { channel: '  BUS A  ', width } },
      { id: 'rx-a', type: 'receiver', position: { x: 280, y: 0 }, options: { channel: 'bus-a', width } },
      { id: 'rx-b', type: 'receiver', position: { x: 280, y: 100 }, options: { channel: 'bus-a', width } },
      { id: 'gate', type: 'and', position: { x: 420, y: 50 }, options: { width } },
      { id: 'out', type: 'output', position: { x: 560, y: 50 }, options: { width } },
    ],
    connections: [
      { source: { node: 'input' }, target: { node: 'tx', port: 0 } },
      { source: { node: 'rx-a' }, target: { node: 'gate', port: 0 } },
      { source: { node: 'rx-b' }, target: { node: 'gate', port: 1 } },
      { source: { node: 'gate' }, target: { node: 'out', port: 0 } },
    ],
  }
}

function andCircuit(): CircuitDocument {
  return {
    ...createCircuitDocument('AND de teste'),
    nodes: [
      { id: 'a', type: 'input', position: { x: 0, y: 0 }, label: 'A' },
      { id: 'b', type: 'input', position: { x: 0, y: 100 }, label: 'B' },
      { id: 'gate', type: 'and', position: { x: 180, y: 50 } },
      { id: 'out', type: 'output', position: { x: 360, y: 50 }, label: 'Saída' },
    ],
    connections: [
      { source: { node: 'a' }, target: { node: 'gate', port: 0 } },
      { source: { node: 'b' }, target: { node: 'gate', port: 1 } },
      { source: { node: 'gate' }, target: { node: 'out', port: 0 } },
    ],
  }
}

describe('editorModel', () => {
  it('converte um documento válido em netlist', () => {
    const netlist = toNetlist(andCircuit())

    expect(netlist.components).toEqual([
      expect.objectContaining({ id: 'a', type: 'input' }),
      expect.objectContaining({ id: 'b', type: 'input' }),
      expect.objectContaining({
        id: 'gate',
        type: 'and',
        inputs: [{ node: 'a' }, { node: 'b' }],
      }),
      expect.objectContaining({ id: 'out', type: 'output', inputs: [{ node: 'gate' }] }),
    ])
  })

  it('avalia todas as combinações de uma porta AND', () => {
    const document = andCircuit()

    expect(evaluateCircuit(document, { a: false, b: false }).outputs.out).toBe(false)
    expect(evaluateCircuit(document, { a: false, b: true }).outputs.out).toBe(false)
    expect(evaluateCircuit(document, { a: true, b: false }).outputs.out).toBe(false)
    expect(evaluateCircuit(document, { a: true, b: true }).outputs.out).toBe(true)
  })

  it('mantém NAND, NOR e XNOR no contrato visual e na avaliação', () => {
    const cases = [
      { type: 'nand' as const, expected: [true, true, true, false] },
      { type: 'nor' as const, expected: [true, false, false, false] },
      { type: 'xnor' as const, expected: [true, false, false, true] },
    ]

    for (const { type, expected } of cases) {
      const document = andCircuit()
      document.name = `${type} de teste`
      document.nodes[2].type = type

      expect(EDITOR_COMPONENT_TYPES).toContain(type)
      expect(editorInputCount(type)).toBe(2)
      expect(validateCircuit(document)).toEqual([])
      expect(toNetlist(document).components).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'gate', type, inputs: [{ node: 'a' }, { node: 'b' }] }),
      ]))
      expect([
        evaluateCircuit(document, { a: false, b: false }).outputs.out,
        evaluateCircuit(document, { a: false, b: true }).outputs.out,
        evaluateCircuit(document, { a: true, b: false }).outputs.out,
        evaluateCircuit(document, { a: true, b: true }).outputs.out,
      ]).toEqual(expected)
    }
  })

  it('resolve canal wireless no netlist e propaga para múltiplos receptores', () => {
    const document = wirelessCircuit()

    expect(validateCircuit(document)).toEqual([])
    expect(toNetlist(document).components).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'tx', type: 'transmitter', inputs: [{ node: 'input' }] }),
      expect.objectContaining({ id: 'rx-a', type: 'receiver', inputs: [{ node: 'tx' }] }),
      expect.objectContaining({ id: 'rx-b', type: 'receiver', inputs: [{ node: 'tx' }] }),
    ]))
    expect(evaluateCircuit(document, { input: true }).outputs.out).toBe(true)
  })

  it('aplica o valor inicial quando uma entrada não é informada', () => {
    const document = andCircuit()
    document.nodes[0].options = { initial: true }

    expect(evaluateCircuit(document, { b: true }).outputs.out).toBe(true)
  })

  it('informa entradas desconectadas', () => {
    const document = andCircuit()
    document.connections = document.connections.slice(1)

    expect(validateCircuit(document)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'missing-input', nodeId: 'gate' })]),
    )
    expect(() => toNetlist(document)).toThrow(CircuitValidationError)
  })

  it('recusa ciclos combinacionais', () => {
    const document = andCircuit()
    document.connections = document.connections.filter(
      (connection) => !(connection.target.node === 'gate' && connection.target.port === 0),
    )
    document.connections.push({
      source: { node: 'out' },
      target: { node: 'gate', port: 0 },
    })

    expect(validateCircuit(document)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'cycle' })]),
    )
  })

  it('detecta IDs equivalentes depois de aparar whitespace', () => {
    const document = andCircuit()
    document.nodes[1].id = ' a '

    expect(validateCircuit(document)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'duplicate-node', nodeId: 'a' }),
    ]))
  })

  it('mantém documentos escalares sem options.width compatíveis', () => {
    expect(validateCircuit(andCircuit())).toEqual([])
  })

  it('aceita clock e DFF com portas ordenadas e converte para netlist', () => {
    const document: CircuitDocument = {
      ...createCircuitDocument('DFF de teste'),
      nodes: [
        { id: 'd', type: 'input', position: { x: 0, y: 0 } },
        { id: 'clk', type: 'clock', position: { x: 0, y: 100 }, options: { period: 2 } },
        { id: 'ff', type: 'dff', position: { x: 180, y: 50 } },
        { id: 'out', type: 'output', position: { x: 360, y: 50 } },
      ],
      connections: [
        { source: { node: 'd' }, target: { node: 'ff', port: 0 } },
        { source: { node: 'clk' }, target: { node: 'ff', port: 1 } },
        { source: { node: 'ff' }, target: { node: 'out', port: 0 } },
      ],
    }

    expect(validateCircuit(document)).toEqual([])
    expect(toNetlist(document).components).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'clk', type: 'clock', options: { period: 2 } }),
      expect.objectContaining({ id: 'ff', type: 'dff', inputs: [{ node: 'd' }, { node: 'clk' }] }),
    ]))
  })

  it('aceita JK e SR com portas J/S, K/R, CLK e saídas complementares', () => {
    for (const [type, first, second] of [
      ['jk', 'j', 'k'],
      ['sr', 's', 'r'],
    ] as const) {
      const document: CircuitDocument = {
        ...createCircuitDocument(`${type.toUpperCase()} de teste`),
        nodes: [
          { id: first, type: 'input', position: { x: 0, y: 0 } },
          { id: second, type: 'input', position: { x: 0, y: 100 } },
          { id: 'clk', type: 'input', position: { x: 0, y: 200 } },
          { id: 'ff', type, position: { x: 180, y: 100 } },
          { id: 'q', type: 'output', position: { x: 360, y: 80 } },
          { id: 'nq', type: 'output', position: { x: 360, y: 120 } },
        ],
        connections: [
          { source: { node: first }, target: { node: 'ff', port: 0 } },
          { source: { node: second }, target: { node: 'ff', port: 1 } },
          { source: { node: 'clk' }, target: { node: 'ff', port: 2 } },
          { source: { node: 'ff', port: 0 }, target: { node: 'q', port: 0 } },
          { source: { node: 'ff', port: 1 }, target: { node: 'nq', port: 0 } },
        ],
      }

      expect(EDITOR_COMPONENT_TYPES).toContain(type)
      expect(editorInputCount(type)).toBe(3)
      expect(validateCircuit(document)).toEqual([])
      expect(toNetlist(document).components).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'ff',
          type,
          inputs: [{ node: first }, { node: second }, { node: 'clk' }],
        }),
      ]))
    }
  })

  it('permite feedback quando o ciclo passa por um componente com estado', () => {
    const document: CircuitDocument = {
      ...createCircuitDocument('Contador de teste'),
      nodes: [
        { id: 'clk', type: 'input', position: { x: 0, y: 0 } },
        { id: 'ff', type: 'dff', position: { x: 180, y: 50 } },
        { id: 'out', type: 'output', position: { x: 360, y: 50 } },
      ],
      connections: [
        { source: { node: 'ff', port: 1 }, target: { node: 'ff', port: 0 } },
        { source: { node: 'clk' }, target: { node: 'ff', port: 1 } },
        { source: { node: 'ff' }, target: { node: 'out', port: 0 } },
      ],
    }

    expect(validateCircuit(document)).toEqual([])
    expect(toNetlist(document).components.find((component) => component.id === 'ff')?.inputs).toEqual([
      { node: 'ff', port: 1 },
      { node: 'clk' },
    ])
  })

  it('avalia Splitter e Combiner preservando a ordem MSB → LSB', () => {
    const document: CircuitDocument = {
      ...createCircuitDocument('Splitter de teste'),
      nodes: [
        { id: 'bus', type: 'input', position: { x: 0, y: 0 }, options: { width: 8 } },
        { id: 'split', type: 'splitter', position: { x: 180, y: 0 }, options: { width: 8, widths: [3, 5] } },
        { id: 'combine', type: 'combiner', position: { x: 360, y: 0 }, options: { width: 8, widths: [3, 5] } },
        { id: 'out', type: 'output', position: { x: 540, y: 0 }, options: { width: 8 } },
      ],
      connections: [
        { source: { node: 'bus' }, target: { node: 'split', port: 0 } },
        { source: { node: 'split', port: 0 }, target: { node: 'combine', port: 0 } },
        { source: { node: 'split', port: 1 }, target: { node: 'combine', port: 1 } },
        { source: { node: 'combine' }, target: { node: 'out', port: 0 } },
      ],
    }

    expect(validateCircuit(document, { allowBuses: true })).toEqual([])
    expect(toNetlist(document, { allowBuses: true }).components).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'split', type: 'splitter', options: { width: 8, widths: [3, 5] } }),
      expect.objectContaining({ id: 'combine', type: 'combiner', options: { width: 8, widths: [3, 5] } }),
    ]))
    const evaluation = evaluateCircuitVectors(document, { bus: '0b10100101' })
    const splitPorts = evaluation.ports?.split
    expect(splitPorts).toEqual(expect.any(Array))
    expect((splitPorts as Array<{ bits: readonly boolean[]; width: number }>).map((part) => toBinary(part))).toEqual(['101', '00101'])
    expect(toBinary(evaluation.outputs.out)).toBe('10100101')
  })

  it('rejeita partições de barramento que não fecham a largura declarada', () => {
    const document: CircuitDocument = {
      ...createCircuitDocument('Splitter inválido'),
      nodes: [
        { id: 'bus', type: 'input', position: { x: 0, y: 0 }, options: { width: 8 } },
        { id: 'split', type: 'splitter', position: { x: 180, y: 0 }, options: { width: 8, widths: [3, 4] } },
      ],
      connections: [{ source: { node: 'bus' }, target: { node: 'split', port: 0 } }],
    }

    expect(validateCircuit(document, { allowBuses: true })).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'width-mismatch', nodeId: 'split' }),
    ]))
  })

  it('rejeita width inválido, largura ainda não suportada e conexão incompatível', () => {
    const document = andCircuit()
    document.nodes[0].options = { width: 4 }
    document.nodes[1].options = { width: 2 }
    document.nodes[2].options = { width: 4 }

    expect(validateCircuit(document)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unsupported-width', nodeId: 'a' }),
      expect.objectContaining({ code: 'unsupported-width', nodeId: 'b' }),
      expect.objectContaining({ code: 'unsupported-width', nodeId: 'gate' }),
      expect.objectContaining({ code: 'width-mismatch', nodeId: 'gate' }),
    ]))

    document.nodes[0].options = { width: 0 }
    expect(validateCircuit(document)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid-width', nodeId: 'a' }),
    ]))
  })
})
