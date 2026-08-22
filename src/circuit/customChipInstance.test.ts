import { describe, expect, it } from 'vitest'
import {
  buildCircuitTruthTable,
  buildCustomChipDefinition,
  createCircuitDocument,
  evaluateCircuit,
  evaluateCircuitVectors,
  resolveCustomChipDefinition,
  type CircuitDocument,
  type CustomChipLibraryEntry,
} from './index'
import { toBinary } from '../bus'

function andDefinition(width = 1): CustomChipLibraryEntry {
  const document: CircuitDocument = {
    ...createCircuitDocument('AND interno'),
    nodes: [
      { id: 'a', type: 'input', position: { x: 0, y: 0 }, label: 'A', options: width === 1 ? undefined : { width } },
      { id: 'b', type: 'input', position: { x: 0, y: 100 }, label: 'B', options: width === 1 ? undefined : { width } },
      { id: 'gate', type: 'and', position: { x: 160, y: 50 }, label: 'E', options: width === 1 ? undefined : { width } },
      { id: 'y', type: 'output', position: { x: 320, y: 50 }, label: 'Y', options: width === 1 ? undefined : { width } },
    ],
    connections: [
      { source: { node: 'a' }, target: { node: 'gate', port: 0 } },
      { source: { node: 'b' }, target: { node: 'gate', port: 1 } },
      { source: { node: 'gate' }, target: { node: 'y', port: 0 } },
    ],
  }
  return { id: 7, definition: buildCustomChipDefinition(document, 'AND interno') }
}

function instanceDocument(width = 1): CircuitDocument {
  return {
    ...createCircuitDocument('AND instanciado'),
    nodes: [
      { id: 'x', type: 'input', position: { x: 0, y: 0 }, label: 'X', options: width === 1 ? undefined : { width } },
      { id: 'z', type: 'input', position: { x: 0, y: 100 }, label: 'Z', options: width === 1 ? undefined : { width } },
      { id: 'chip', type: 'custom-chip', position: { x: 180, y: 50 }, label: 'Meu AND', options: { customChipId: 7 } },
      { id: 'out', type: 'output', position: { x: 400, y: 50 }, label: 'Resultado', options: width === 1 ? undefined : { width } },
    ],
    connections: [
      { source: { node: 'x' }, target: { node: 'chip', port: 0 } },
      { source: { node: 'z' }, target: { node: 'chip', port: 1 } },
      { source: { node: 'chip', port: 0 }, target: { node: 'out', port: 0 } },
    ],
  }
}

describe('customChipInstance', () => {
  it('resolve a definição por ID e avalia múltiplas portas hierarquicamente', () => {
    const library = [andDefinition()]
    const document = instanceDocument()
    const definition = resolveCustomChipDefinition(document.nodes[2], library)

    expect(definition.inputs.map((port) => port.id)).toEqual(['a', 'b'])
    expect(definition.outputs.map((port) => port.id)).toEqual(['y'])
    expect(evaluateCircuit(document, { x: true, z: false }, { customChips: library }).outputs).toEqual({ out: false })
    expect(evaluateCircuit(document, { x: true, z: true }, { customChips: library }).outputs).toEqual({ out: true })
  })

  it('mantém a ordem topológica determinística dentro da instância', () => {
    const result = evaluateCircuit(instanceDocument(), { x: true, z: true }, { customChips: [andDefinition()] })
    expect(result.order).toEqual(['x', 'z', 'chip', 'out'])
  })

  it('inclui instâncias na tabela-verdade sem mudar as entradas externas', () => {
    const table = buildCircuitTruthTable(instanceDocument(), { customChips: [andDefinition()] })
    expect(table.variables).toEqual(['x', 'z'])
    expect(table.rows).toEqual([
      [false, false, false],
      [false, true, false],
      [true, false, false],
      [true, true, true],
    ])
  })

  it('avalia uma instância vetorial mantendo a largura da definição', () => {
    const result = evaluateCircuitVectors(instanceDocument(4), { x: '1010', z: '1100' }, { customChips: [andDefinition(4)] })
    expect(toBinary(result.outputs.out)).toBe('1000')
  })

  it('rejeita uma instância quando a definição local não está disponível', () => {
    expect(() => evaluateCircuit(instanceDocument(), { x: true, z: true })).toThrow('definição local')
  })
})
