import dagre from '@dagrejs/dagre'
import { Position, type Edge } from '@xyflow/react'
import type { CircuitNode } from './graph'

/** Precisa bater com o desenho de cada nó, senão o Dagre erra o espaçamento. */
const SIZES: Record<string, { width: number; height: number }> = {
  input: { width: 60, height: 32 },
  constant: { width: 60, height: 32 },
  gate: { width: 76, height: 44 },
  output: { width: 190, height: 40 },
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
  graph.setGraph({ rankdir: 'LR', nodesep: 22, ranksep: 52, marginx: 20, marginy: 20 })

  for (const node of nodes) {
    const { width, height } = sizeOf(node.data.kind)
    graph.setNode(node.id, { width, height })
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target)
  }

  dagre.layout(graph)

  // O Dagre empurra uma entrada para a direita quando ela só é usada lá no
  // fundo do circuito. Num esquemático todas as entradas ficam na mesma
  // coluna à esquerda, então trazemos todas para a borda.
  const inputXs = nodes
    .filter((node) => node.data.kind === 'input')
    .map((node) => graph.node(node.id).x)
  const inputX = inputXs.length > 0 ? Math.min(...inputXs) : null

  return nodes.map((node) => {
    const positioned = graph.node(node.id)
    const { width, height } = sizeOf(node.data.kind)
    const x = node.data.kind === 'input' && inputX !== null ? inputX : positioned.x
    return {
      ...node,
      // O Dagre devolve o centro do bloco; o React Flow quer o canto superior.
      position: { x: x - width / 2, y: positioned.y - height / 2 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }
  })
}
