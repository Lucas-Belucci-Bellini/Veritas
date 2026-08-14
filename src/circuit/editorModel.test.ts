import { describe, expect, it } from 'vitest'
import {
  CircuitValidationError,
  createCircuitDocument,
  evaluateCircuit,
  toNetlist,
  validateCircuit,
  type CircuitDocument,
} from './index'

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
})
