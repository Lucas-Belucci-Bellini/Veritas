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
