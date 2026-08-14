import { describe, expect, it } from 'vitest'
import { buildCircuitContext } from './context'
import { createCircuitDocument, type CircuitDocument } from './editorModel'

function circuit(): CircuitDocument {
  return {
    ...createCircuitDocument('Contexto AND'),
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

describe('buildCircuitContext', () => {
  it('gera contexto determinístico com tabela e fingerprint', () => {
    const first = buildCircuitContext(circuit())
    const second = buildCircuitContext(circuit())

    expect(first.contentHash).toBe(second.contentHash)
    expect(first.payload.truthTable.rows).toHaveLength(4)
    expect(first.payload.inputs).toEqual(['A', 'B'])
    expect(first.payload.outputs).toEqual(['Saída'])
    expect(first.tags).toContain('veritas')
  })

  it('recusa circuito inválido', () => {
    const document = circuit()
    document.connections = []

    expect(() => buildCircuitContext(document)).toThrow('desconectada')
  })
})
