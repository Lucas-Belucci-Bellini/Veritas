import type { CircuitDocument } from '../circuit'

export interface CircuitChangeSummary {
  nameChanged: boolean
  nodesAdded: number
  nodesRemoved: number
  nodesChanged: number
  connectionsAdded: number
  connectionsRemoved: number
  totalNodesBefore: number
  totalNodesAfter: number
  totalConnectionsBefore: number
  totalConnectionsAfter: number
}

export interface CircuitDiff extends CircuitChangeSummary {
  addedNodeIds: string[]
  removedNodeIds: string[]
  changedNodeIds: string[]
  addedConnections: string[]
  removedConnections: string[]
}

export function compareCircuitDocuments(
  before: CircuitDocument | null,
  after: CircuitDocument,
): CircuitDiff {
  const beforeNodes = new Map((before?.nodes ?? []).map((node) => [node.id, stableNode(node)]))
  const afterNodes = new Map(after.nodes.map((node) => [node.id, stableNode(node)]))
  const addedNodeIds = [...afterNodes.keys()].filter((id) => !beforeNodes.has(id)).sort()
  const removedNodeIds = [...beforeNodes.keys()].filter((id) => !afterNodes.has(id)).sort()
  const changedNodeIds = [...afterNodes.keys()]
    .filter((id) => beforeNodes.has(id) && beforeNodes.get(id) !== afterNodes.get(id))
    .sort()

  const beforeConnections = new Set((before?.connections ?? []).map(connectionKey))
  const afterConnections = new Set(after.connections.map(connectionKey))
  const addedConnections = [...afterConnections].filter((key) => !beforeConnections.has(key)).sort()
  const removedConnections = [...beforeConnections].filter((key) => !afterConnections.has(key)).sort()

  return {
    nameChanged: before === null ? false : before.name !== after.name,
    nodesAdded: addedNodeIds.length,
    nodesRemoved: removedNodeIds.length,
    nodesChanged: changedNodeIds.length,
    connectionsAdded: addedConnections.length,
    connectionsRemoved: removedConnections.length,
    totalNodesBefore: before?.nodes.length ?? 0,
    totalNodesAfter: after.nodes.length,
    totalConnectionsBefore: before?.connections.length ?? 0,
    totalConnectionsAfter: after.connections.length,
    addedNodeIds,
    removedNodeIds,
    changedNodeIds,
    addedConnections,
    removedConnections,
  }
}

export function summarizeCircuitDiff(diff: CircuitDiff): string {
  const parts: string[] = []
  if (diff.nameChanged) parts.push('nome alterado')
  if (diff.nodesAdded) parts.push(`+${diff.nodesAdded} componente(s)`)
  if (diff.nodesRemoved) parts.push(`−${diff.nodesRemoved} componente(s)`)
  if (diff.nodesChanged) parts.push(`${diff.nodesChanged} componente(s) editado(s)`)
  if (diff.connectionsAdded) parts.push(`+${diff.connectionsAdded} conexão(ões)`)
  if (diff.connectionsRemoved) parts.push(`−${diff.connectionsRemoved} conexão(ões)`)
  return parts.length > 0 ? parts.join(' · ') : 'Sem alterações estruturais'
}

function stableNode(node: CircuitDocument['nodes'][number]): string {
  return JSON.stringify({
    id: node.id,
    type: node.type,
    position: node.position,
    label: node.label,
    options: node.options,
  })
}

function connectionKey(connection: CircuitDocument['connections'][number]): string {
  return `${connection.source.node}:${connection.source.port ?? 0}->${connection.target.node}:${connection.target.port}`
}
