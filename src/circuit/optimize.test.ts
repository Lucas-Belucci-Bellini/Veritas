import { describe, expect, it } from 'vitest'
import { createCircuitDocument, type CircuitDocument } from './editorModel'
import { optimizeCircuitDocument } from './optimize'

function circuitWithUnusedGate(): CircuitDocument {
  return {
    ...createCircuitDocument('Otimização'),
    nodes: [
      { id: 'a', type: 'input', position: { x: 0, y: 0 }, label: 'A' },
      { id: 'gate', type: 'not', position: { x: 180, y: 0 } },
      { id: 'out', type: 'output', position: { x: 360, y: 0 }, label: 'Saída' },
      { id: 'unused', type: 'input', position: { x: 180, y: 160 }, label: 'Unused' },
    ],
    connections: [
      { source: { node: 'a' }, target: { node: 'gate', port: 0 } },
      { source: { node: 'gate' }, target: { node: 'out', port: 0 } },
    ],
  }
}

describe('optimizeCircuitDocument', () => {
  it('remove componentes que não alcançam nenhuma saída', () => {
    const result = optimizeCircuitDocument(circuitWithUnusedGate())

    expect(result.removedNodeIds).toEqual(['unused'])
    expect(result.document.nodes.map((node) => node.id)).toEqual(['a', 'gate', 'out'])
    expect(result.document.connections).toHaveLength(2)
  })

  it('não altera um circuito já enxuto', () => {
    const document = circuitWithUnusedGate()
    document.nodes = document.nodes.filter((node) => node.id !== 'unused')

    const result = optimizeCircuitDocument(document)

    expect(result.removedNodeIds).toEqual([])
    expect(result.document).toBe(document)
    expect(result.suggestions[0]).toContain('já está enxuto')
  })
})
