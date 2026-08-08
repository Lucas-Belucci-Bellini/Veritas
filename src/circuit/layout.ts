import dagre from '@dagrejs/dagre'
import { Position, type Edge } from '@xyflow/react'
import type { CircuitNode } from './graph'

const SIZES: Record<string, { width: number; height: number }> = {
  input: { width: 74, height: 44 },
  constant: { width: 64, height: 44 },
  gate: { width: 104, height: 56 },
  output: { width: 150, height: 52 },
}

export function sizeOf(kind: string) {
  return SIZES[kind] ?? SIZES.gate
}

/**
 * O Dagre calcula as coordenadas para o circuito fluir da esquerda (entradas)
 * para a direita (saída), sem blocos empilhados uns sobre os outros.
 */
export function layoutGraph(nodes: CircuitNode[], edges: Edge[]): CircuitNode[] {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'LR', nodesep: 28, ranksep: 72, marginx: 24, marginy: 24 })

  for (const node of nodes) {
    const { width, height } = sizeOf(node.data.kind)
    graph.setNode(node.id, { width, height })
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target)
  }

  dagre.layout(graph)

  return nodes.map((node) => {
    const positioned = graph.node(node.id)
    const { width, height } = sizeOf(node.data.kind)
    return {
      ...node,
      // O Dagre devolve o centro do bloco; o React Flow quer o canto superior.
      position: { x: positioned.x - width / 2, y: positioned.y - height / 2 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }
  })
}
