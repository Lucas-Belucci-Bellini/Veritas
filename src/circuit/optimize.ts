import { validateCircuit, type CircuitDocument } from './editorModel'

export interface CircuitOptimization {
  document: CircuitDocument
  removedNodeIds: string[]
  suggestions: string[]
}

/**
 * Otimização conservadora: mantém somente os componentes que alimentam alguma
 * saída. Não reescreve portas nem altera a função lógica do circuito.
 */
export function optimizeCircuitDocument(document: CircuitDocument): CircuitOptimization {
  const issues = validateCircuit(document)
  if (issues.length > 0) throw new Error(issues[0].message)

  const incoming = new Map<string, string[]>()
  for (const connection of document.connections) {
    const sources = incoming.get(connection.target.node) ?? []
    sources.push(connection.source.node)
    incoming.set(connection.target.node, sources)
  }

  const reachable = new Set<string>()
  const visit = (nodeId: string): void => {
    if (reachable.has(nodeId)) return
    reachable.add(nodeId)
    for (const sourceId of incoming.get(nodeId) ?? []) visit(sourceId)
  }

  for (const node of document.nodes) {
    if (node.type === 'output') visit(node.id)
  }

  const removedNodeIds = document.nodes
    .filter((node) => !reachable.has(node.id))
    .map((node) => node.id)

  if (removedNodeIds.length === 0) {
    return { document, removedNodeIds, suggestions: ['O circuito já está enxuto: todos os componentes alimentam uma saída.'] }
  }

  const optimizedNodes = document.nodes.filter((node) => reachable.has(node.id))
  const optimizedConnections = document.connections.filter(
    (connection) => reachable.has(connection.source.node) && reachable.has(connection.target.node),
  )

  return {
    document: { ...document, nodes: optimizedNodes, connections: optimizedConnections },
    removedNodeIds,
    suggestions: [`${removedNodeIds.length} componente(s) inalcançável(is) removido(s) sem alterar as saídas.`],
  }
}
