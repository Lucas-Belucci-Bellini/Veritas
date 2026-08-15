import { describe, expect, it } from 'vitest'
import { bitVector, toBinary } from '../bus'
import { buildCircuitVectorTruthTable, createCircuitDocument, evaluateCircuit, evaluateCircuitVectors, type CircuitDocument } from './index'

function vectorAndCircuit(width = 4): CircuitDocument {
  return {
    ...createCircuitDocument('AND vetorial'),
    nodes: [
      { id: 'a', type: 'input', position: { x: 0, y: 0 }, options: { width } },
      { id: 'b', type: 'input', position: { x: 0, y: 100 }, options: { width } },
      { id: 'gate', type: 'and', position: { x: 180, y: 50 }, options: { width } },
      { id: 'out', type: 'output', position: { x: 360, y: 50 }, options: { width } },
    ],
    connections: [
      { source: { node: 'a' }, target: { node: 'gate', port: 0 } },
      { source: { node: 'b' }, target: { node: 'gate', port: 1 } },
      { source: { node: 'gate' }, target: { node: 'out', port: 0 } },
    ],
  }
}

describe('evaluateCircuitVectors', () => {
  it('avalia operações bitwise com largura explícita', () => {
    const result = evaluateCircuitVectors(vectorAndCircuit(), { a: '0b1010', b: '0b0110' })

    expect(toBinary(result.values.gate)).toBe('0010')
    expect(toBinary(result.outputs.out)).toBe('0010')
    expect(result.order).toEqual(['a', 'b', 'gate', 'out'])
  })

  it('aceita literais hexadecimais, bigint e defaults vetorizados', () => {
    const result = evaluateCircuitVectors(vectorAndCircuit(8), { a: '0xF0', b: 0x0Fn }, { defaultInput: '0x00' })

    expect(toBinary(result.outputs.out)).toBe('00000000')
    expect(toBinary(result.values.a)).toBe('11110000')
    expect(toBinary(result.values.b)).toBe('00001111')
  })

  it('rejeita input com largura incompatível e preserva a API escalar', () => {
    expect(() => evaluateCircuitVectors(vectorAndCircuit(4), { a: bitVector(2, 1), b: '0b0001' })).toThrow('espera 4 bits')

    const scalar = { ...vectorAndCircuit(1), nodes: vectorAndCircuit(1).nodes.map((node) => ({ ...node, options: undefined })) }
    expect(evaluateCircuit(scalar, { a: true, b: true }).outputs.out).toBe(true)
  })

  it('rejeita largura acima do limite antes de avaliar', () => {
    expect(() => evaluateCircuitVectors(vectorAndCircuit(65), { a: 1, b: 1 })).toThrow('entre 1 e 64')
  })

  it('gera tabela vetorial determinística com cardinalidade e truncamento explícitos', () => {
    const table = buildCircuitVectorTruthTable(vectorAndCircuit(), { maxRows: 4 })

    expect(table.totalInputBits).toBe(8)
    expect(table.totalRows).toBe(256)
    expect(table.generatedRows).toBe(4)
    expect(table.truncated).toBe(true)
    expect(table.columns.map((column) => [column.label, column.width])).toEqual([
      ['a', 4],
      ['b', 4],
      ['out', 4],
    ])
    expect(table.rows[0]).toEqual(['0000', '0000', '0000'])
    expect(table.rows[3]).toEqual(['0000', '0011', '0000'])
  })

  it('bloqueia tabela vetorial acima do limite de bits', () => {
    expect(() => buildCircuitVectorTruthTable(vectorAndCircuit(8))).toThrow('limite seguro é 12')
  })
})
