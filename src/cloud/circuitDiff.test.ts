import { describe, expect, it } from 'vitest'
import { createCircuitDocument, type CircuitDocument } from '../circuit'
import { compareCircuitDocuments, summarizeCircuitDiff } from './circuitDiff'

function documentWithGate(): CircuitDocument {
  return {
    ...createCircuitDocument('Base'),
    nodes: [
      { id: 'a', type: 'input', position: { x: 0, y: 0 }, label: 'A' },
      { id: 'out', type: 'output', position: { x: 360, y: 0 }, label: 'Saída' },
    ],
    connections: [{ source: { node: 'a' }, target: { node: 'out', port: 0 } }],
  }
}

describe('compareCircuitDocuments', () => {
  it('detecta adições, remoções, alterações e conexões em ordem determinística', () => {
    const before = documentWithGate()
    const after = {
      ...before,
      name: 'Atualizado',
      nodes: [
        ...before.nodes.map((node) => node.id === 'a' ? { ...node, position: { x: 40, y: 10 } } : node),
        { id: 'gate', type: 'not' as const, position: { x: 180, y: 0 } },
      ],
      connections: [
        { source: { node: 'a' }, target: { node: 'gate', port: 0 } },
        { source: { node: 'gate' }, target: { node: 'out', port: 0 } },
      ],
    }

    const diff = compareCircuitDocuments(before, after)

    expect(diff.nameChanged).toBe(true)
    expect(diff.addedNodeIds).toEqual(['gate'])
    expect(diff.changedNodeIds).toEqual(['a'])
    expect(diff.removedNodeIds).toEqual([])
    expect(diff.connectionsAdded).toBe(2)
    expect(diff.connectionsRemoved).toBe(1)
    expect(summarizeCircuitDiff(diff)).toContain('+1 componente(s)')
  })

  it('ignora whitespace quando compara documentos semanticamente iguais', () => {
    const before = documentWithGate()
    const after = {
      ...before,
      name: '  Base  ',
      nodes: before.nodes.map((node) => ({ ...node, id: `  ${node.id}  `, label: node.label ? `  ${node.label}  ` : node.label })),
      connections: before.connections.map((connection) => ({
        source: { ...connection.source, node: `  ${connection.source.node}  ` },
        target: { ...connection.target, node: `  ${connection.target.node}  ` },
      })),
    }

    const diff = compareCircuitDocuments(before, after)

    expect(diff.nameChanged).toBe(false)
    expect(diff.nodesAdded).toBe(0)
    expect(diff.nodesChanged).toBe(0)
    expect(diff.connectionsAdded).toBe(0)
    expect(diff.connectionsRemoved).toBe(0)
  })

  it('compara a primeira versão contra um estado vazio', () => {
    const diff = compareCircuitDocuments(null, documentWithGate())

    expect(diff.nodesAdded).toBe(2)
    expect(diff.connectionsAdded).toBe(1)
    expect(diff.totalNodesBefore).toBe(0)
    expect(summarizeCircuitDiff(diff)).toContain('+2 componente(s)')
  })
})
