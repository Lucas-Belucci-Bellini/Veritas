export interface TopologyNode {
  id: string
  inputs?: readonly TopologyInput[]
}

export interface TopologyInput {
  node: string
}

export function topologicalOrder(nodes: readonly TopologyNode[]): string[] {
  const byId = new Map<string, TopologyNode>()
  for (const node of nodes) {
    if (byId.has(node.id)) throw new Error(`Componente duplicado: "${node.id}".`)
    byId.set(node.id, node)
  }

  const dependencies = new Map<string, number>()
  const dependents = new Map<string, string[]>()
  for (const node of nodes) dependencies.set(node.id, 0)

  for (const node of nodes) {
    for (const input of node.inputs ?? []) {
      if (!byId.has(input.node)) {
        throw new Error(`O componente "${node.id}" está ligado em "${input.node}", que não existe.`)
      }
      dependencies.set(node.id, (dependencies.get(node.id) ?? 0) + 1)
      const targets = dependents.get(input.node) ?? []
      targets.push(node.id)
      dependents.set(input.node, targets)
    }
  }

  const queue = [...nodes]
    .filter((node) => dependencies.get(node.id) === 0)
    .map((node) => node.id)
    .sort(compareIds)
  const order: string[] = []

  while (queue.length > 0) {
    const id = queue.shift()!
    order.push(id)
    for (const target of (dependents.get(id) ?? []).sort(compareIds)) {
      const remaining = (dependencies.get(target) ?? 0) - 1
      dependencies.set(target, remaining)
      if (remaining === 0) insertSorted(queue, target)
    }
  }

  if (order.length !== nodes.length) {
    throw new Error('O circuito contém um ciclo e não pode ser avaliado como combinacional.')
  }
  return order
}

function insertSorted(values: string[], value: string): void {
  let index = 0
  while (index < values.length && compareIds(values[index], value) <= 0) index += 1
  values.splice(index, 0, value)
}

function compareIds(left: string, right: string): number {
  return left.localeCompare(right)
}
