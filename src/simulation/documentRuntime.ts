import { toNetlist, type CircuitDocument } from '../circuit'
import { Simulator } from './simulator'

export interface DocumentRuntimeSnapshot {
  tick: number
  values: Record<string, boolean[]>
}

export interface DocumentRuntimeWatch {
  nodeId: string
  label: string
  port?: number
}

export function createDocumentRuntime(document: CircuitDocument): Simulator {
  const simulator = new Simulator(toNetlist(document))
  for (const node of document.nodes) {
    if (node.type === 'input' && node.options?.initial !== undefined) {
      simulator.setInput(node.id, node.options.initial)
    }
  }
  return simulator
}

export function snapshotDocumentRuntime(simulator: Simulator): DocumentRuntimeSnapshot {
  return {
    tick: simulator.tickCount,
    values: simulator.snapshot(),
  }
}

export function documentInputIds(document: CircuitDocument): readonly string[] {
  return document.nodes.filter((node) => node.type === 'input').map((node) => node.id)
}

export function documentWatches(document: CircuitDocument): readonly DocumentRuntimeWatch[] {
  return document.nodes.flatMap((node) => {
    const label = node.label ?? node.id
    if (node.type === 'dff' || node.type === 'tff') {
      return [
        { nodeId: node.id, label: `${label} · Q` },
        { nodeId: node.id, label: `${label} · Q̄`, port: 1 },
      ]
    }
    if (node.type === 'input' || node.type === 'clock' || node.type === 'delay' || node.type === 'output') {
      return [{ nodeId: node.id, label }]
    }
    return []
  })
}

export function runtimeValue(
  snapshot: DocumentRuntimeSnapshot,
  nodeId: string,
  port = 0,
): boolean {
  return snapshot.values[nodeId]?.[port] ?? false
}
