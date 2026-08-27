import {
  type CircuitConnection,
  type CircuitDocument,
  type CircuitIssue,
  type CircuitNode,
  type CircuitValidationOptions,
  isStatefulEditorType,
  validateCircuit,
} from './editorModel'
import { normalizeCircuitDocument } from './documentContract'

export type CircuitCycleKind = 'combinational-cycle' | 'temporal-feedback' | 'unclassified-cycle'

export interface CircuitCycleComponent {
  kind: CircuitCycleKind
  nodeIds: readonly string[]
}

export type CircuitExecutionSafetyStatus = 'acyclic' | 'temporal-feedback' | 'combinational-cycle' | 'unclassified-cycle' | 'invalid'

export interface CircuitExecutionSafetyReport {
  status: CircuitExecutionSafetyStatus
  issues: readonly CircuitIssue[]
  cycles: readonly CircuitCycleComponent[]
  nodeCount: number
  connectionCount: number
}

/**
 * Classifica ciclos da topologia antes de construir o runtime.
 *
 * A análise usa componentes fortemente conectados com ordem estável de IDs.
 * Um SCC unitário só é ciclo quando possui uma aresta para si mesmo. Um ciclo
 * que contém clock/flip-flop/delay é feedback temporal; custom-chip é tratado
 * como não classificável porque seu conteúdo pode conter estado oculto.
 */
export function analyzeCircuitExecutionSafety(
  document: CircuitDocument,
  options: CircuitValidationOptions = {},
): CircuitExecutionSafetyReport {
  const normalized = normalizeCircuitDocument(document)
  const issues = validateCircuit(normalized, options)
  const nodes = [...normalized.nodes].sort(compareNodes)
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const))
  const adjacency = buildAdjacency(nodes, normalized.connections, nodeById)
  const components = stronglyConnectedComponents(nodes.map((node) => node.id), adjacency)
  const cycles = components
    .filter((component) => component.length > 1 || hasSelfEdge(component[0]!, adjacency))
    .map((component) => classifyCycle(component, nodeById))
    .sort(compareCycles)

  const status = determineStatus(issues, cycles)
  return {
    status,
    issues,
    cycles,
    nodeCount: normalized.nodes.length,
    connectionCount: normalized.connections.length,
  }
}

function determineStatus(
  issues: readonly CircuitIssue[],
  cycles: readonly CircuitCycleComponent[],
): CircuitExecutionSafetyStatus {
  if (issues.some((issue) => issue.code !== 'cycle')) return 'invalid'
  if (cycles.some((cycle) => cycle.kind === 'unclassified-cycle')) return 'unclassified-cycle'
  if (cycles.some((cycle) => cycle.kind === 'combinational-cycle')) return 'combinational-cycle'
  if (cycles.some((cycle) => cycle.kind === 'temporal-feedback')) return 'temporal-feedback'
  return 'acyclic'
}

function classifyCycle(
  nodeIds: readonly string[],
  nodeById: ReadonlyMap<string, CircuitNode>,
): CircuitCycleComponent {
  const nodes = nodeIds.map((id) => nodeById.get(id)).filter((node): node is CircuitNode => node !== undefined)
  if (nodes.some((node) => node.type === 'custom-chip')) {
    return { kind: 'unclassified-cycle', nodeIds }
  }
  if (nodes.some((node) => isStatefulEditorType(node.type))) {
    return { kind: 'temporal-feedback', nodeIds }
  }
  return { kind: 'combinational-cycle', nodeIds }
}

function buildAdjacency(
  nodes: readonly CircuitNode[],
  connections: readonly CircuitConnection[],
  nodeById: ReadonlyMap<string, CircuitNode>,
): ReadonlyMap<string, readonly string[]> {
  const outgoing = new Map<string, Set<string>>(nodes.map((node) => [node.id, new Set<string>()] as const))
  for (const connection of connections) {
    if (!nodeById.has(connection.source.node) || !nodeById.has(connection.target.node)) continue
    outgoing.get(connection.source.node)?.add(connection.target.node)
  }
  return new Map([...outgoing.entries()].map(([id, targets]) => [id, [...targets].sort()] as const))
}

/** Kosaraju iterativo: evita recursão no caminho que futuramente receberá grafos grandes. */
function stronglyConnectedComponents(
  nodeIds: readonly string[],
  adjacency: ReadonlyMap<string, readonly string[]>,
): readonly string[][] {
  const reverse = reverseAdjacency(nodeIds, adjacency)
  const visited = new Set<string>()
  const finishOrder: string[] = []

  for (const start of nodeIds) {
    if (visited.has(start)) continue
    const stack: Array<{ id: string; nextIndex: number }> = [{ id: start, nextIndex: 0 }]
    visited.add(start)
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!
      const targets = adjacency.get(frame.id) ?? []
      if (frame.nextIndex < targets.length) {
        const target = targets[frame.nextIndex++]!
        if (visited.has(target)) continue
        visited.add(target)
        stack.push({ id: target, nextIndex: 0 })
      } else {
        finishOrder.push(frame.id)
        stack.pop()
      }
    }
  }

  const components: string[][] = []
  const assigned = new Set<string>()
  for (let index = finishOrder.length - 1; index >= 0; index -= 1) {
    const start = finishOrder[index]!
    if (assigned.has(start)) continue
    const component: string[] = []
    const stack = [start]
    assigned.add(start)
    while (stack.length > 0) {
      const id = stack.pop()!
      component.push(id)
      for (const target of reverse.get(id) ?? []) {
        if (assigned.has(target)) continue
        assigned.add(target)
        stack.push(target)
      }
    }
    component.sort()
    components.push(component)
  }
  return components
}

function reverseAdjacency(
  nodeIds: readonly string[],
  adjacency: ReadonlyMap<string, readonly string[]>,
): ReadonlyMap<string, readonly string[]> {
  const reverse = new Map<string, string[]>(nodeIds.map((id) => [id, []] as const))
  for (const [source, targets] of adjacency) {
    for (const target of targets) reverse.get(target)?.push(source)
  }
  for (const targets of reverse.values()) targets.sort()
  return reverse
}

function hasSelfEdge(id: string, adjacency: ReadonlyMap<string, readonly string[]>): boolean {
  return (adjacency.get(id) ?? []).includes(id)
}

function compareNodes(left: CircuitNode, right: CircuitNode): number {
  return left.id.localeCompare(right.id)
}

function compareCycles(left: CircuitCycleComponent, right: CircuitCycleComponent): number {
  const kindOrder: Record<CircuitCycleKind, number> = {
    'combinational-cycle': 0,
    'temporal-feedback': 1,
    'unclassified-cycle': 2,
  }
  return kindOrder[left.kind] - kindOrder[right.kind]
    || (left.nodeIds[0] ?? '').localeCompare(right.nodeIds[0] ?? '')
}
