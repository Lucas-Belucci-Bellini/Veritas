import { describe, expect, it } from 'vitest'
import { buildCircuitTruthTable } from './truthTable'
import { createCircuitDocument, type CircuitDocument } from './editorModel'

function andCircuit(): CircuitDocument {
  return {
    ...createCircuitDocument('AND'),
    nodes: [
      { id: 'a', type: 'input', position: { x: 0, y: 0 }, label: 'A' },
      { id: 'b', type: 'input', position: { x: 0, y: 100 }, label: 'B' },
      { id: 'gate', type: 'and', position: { x: 180, y: 50 } },
      { id: 'out', type: 'output', position: { x: 360, y: 50 }, label: 'A AND B' },
    ],
    connections: [
      { source: { node: 'a' }, target: { node: 'gate', port: 0 } },
      { source: { node: 'b' }, target: { node: 'gate', port: 1 } },
      { source: { node: 'gate' }, target: { node: 'out', port: 0 } },
    ],
  }
}

describe('buildCircuitTruthTable', () => {
  it('gera as quatro combinações e destaca a saída do circuito', () => {
    const table = buildCircuitTruthTable(andCircuit())

    expect(table.variables).toEqual(['a', 'b'])
    expect(table.columns.map((column) => column.label)).toEqual(['A', 'B', 'A AND B'])
    expect(table.rows).toEqual([
      [false, false, false],
      [false, true, false],
      [true, false, false],
      [true, true, true],
    ])
    expect(table.classification).toBe('contingencia')
    expect(table.trueCount).toBe(1)
  })

  it('permite escolher uma saída entre várias saídas do mesmo circuito', () => {
    const document = andCircuit()
    document.nodes.push({ id: 'constant', type: 'constant', position: { x: 180, y: 180 }, label: 'Sempre', options: { value: true } })
    document.nodes.push({ id: 'out2', type: 'output', position: { x: 360, y: 180 }, label: 'Constante' })
    document.connections.push({ source: { node: 'constant' }, target: { node: 'out2', port: 0 } })

    const table = buildCircuitTruthTable(document, { outputId: 'out2' })

    expect(table.columns.map((column) => column.label)).toEqual(['A', 'B', 'A AND B', 'Constante'])
    expect(table.rows.every((row) => row.at(-1) === true)).toBe(true)
    expect(table.classification).toBe('tautologia')
  })

  it('marca tabelas truncadas como contingência e respeita maxRows', () => {
    const document: CircuitDocument = {
      ...createCircuitDocument('XOR'),
      nodes: [
        ...Array.from({ length: 3 }, (_, index) => ({ id: `i${index}`, type: 'input' as const, position: { x: 0, y: index * 80 }, label: String.fromCharCode(65 + index) })),
        { id: 'xor', type: 'xor', position: { x: 180, y: 80 } },
        { id: 'out', type: 'output', position: { x: 360, y: 80 }, label: 'Resultado' },
      ],
      connections: [
        { source: { node: 'i0' }, target: { node: 'xor', port: 0 } },
        { source: { node: 'i1' }, target: { node: 'xor', port: 1 } },
        { source: { node: 'xor' }, target: { node: 'out', port: 0 } },
      ],
    }

    const table = buildCircuitTruthTable(document, { maxRows: 2 })

    expect(table.totalRows).toBe(8)
    expect(table.rows).toHaveLength(2)
    expect(table.truncated).toBe(true)
    expect(table.classification).toBe('contingencia')
  })

  it('recusa circuitos com entradas demais para enumeração segura', () => {
    const document: CircuitDocument = {
      ...createCircuitDocument('Grande'),
      nodes: [
        ...Array.from({ length: 17 }, (_, index) => ({ id: `i${index}`, type: 'input' as const, position: { x: 0, y: index * 20 }, label: `I${index}` })),
        { id: 'out', type: 'output', position: { x: 360, y: 0 }, label: 'Saída' },
      ],
      connections: [{ source: { node: 'i0' }, target: { node: 'out', port: 0 } }],
    }

    expect(() => buildCircuitTruthTable(document)).toThrow('limite da tabela')
  })

  it('gera uma tabela constante para um circuito sem entradas', () => {
    const document: CircuitDocument = {
      ...createCircuitDocument('Constante'),
      nodes: [
        {
          id: 'one',
          type: 'constant',
          position: { x: 0, y: 0 },
          label: 'Verdadeiro',
          options: { value: true },
        },
        { id: 'out', type: 'output', position: { x: 180, y: 0 }, label: 'Resultado' },
      ],
      connections: [{ source: { node: 'one' }, target: { node: 'out', port: 0 } }],
    }

    const table = buildCircuitTruthTable(document)

    expect(table.totalRows).toBe(1)
    expect(table.rows).toEqual([[true]])
    expect(table.classification).toBe('tautologia')
  })
})
