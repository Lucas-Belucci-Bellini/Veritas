import {
  elaborateCustomChipDocument,
  toNetlist,
  type CircuitDocument,
  type CustomChipLibraryEntry,
} from '../circuit'
import { Simulator, type SimulatorState } from './simulator'

export interface DocumentRuntimeSnapshot {
  tick: number
  values: Record<string, boolean[]>
}

export interface DocumentRuntimeWatch {
  nodeId: string
  label: string
  port?: number
}

export interface DocumentRuntimeOptions {
  clockPeriods?: Readonly<Record<string, number>>
  /** Definições locais usadas para expandir chips em circuitos sequenciais. */
  customChips?: readonly CustomChipLibraryEntry[]
}

export interface DocumentRuntimeState {
  inputs: Record<string, boolean>
  clockPeriods: Record<string, number>
  simulator: SimulatorState
  snapshot: DocumentRuntimeSnapshot
  timeline: DocumentRuntimeSnapshot[]
}

export function createDocumentRuntime(document: CircuitDocument, options: DocumentRuntimeOptions = {}): Simulator {
  const runtimeDocument = applyClockPeriods(document, options.clockPeriods)
  const executableDocument = runtimeDocument.nodes.some((node) => node.type === 'custom-chip')
    ? elaborateCustomChipDocument(runtimeDocument, { customChips: options.customChips })
    : runtimeDocument
  const simulator = new Simulator(toNetlist(executableDocument))
  for (const node of runtimeDocument.nodes) {
    if (node.type === 'input' && node.options?.initial !== undefined) {
      simulator.setInput(node.id, node.options.initial)
    }
  }
  return simulator
}

function applyClockPeriods(
  document: CircuitDocument,
  clockPeriods: Readonly<Record<string, number>> | undefined,
): CircuitDocument {
  if (!clockPeriods) return document
  return {
    ...document,
    nodes: document.nodes.map((node) => {
      const period = clockPeriods[node.id]
      if (node.type !== 'clock' || period === undefined) return node
      return { ...node, options: { ...node.options, period: Math.max(1, Math.min(64, Math.floor(period))) } }
    }),
  }
}

export function snapshotDocumentRuntime(
  simulator: Simulator,
  document?: CircuitDocument,
  customChips: readonly CustomChipLibraryEntry[] = [],
): DocumentRuntimeSnapshot {
  const values = simulator.snapshot()
  if (document) projectCustomChipValues(values, document, customChips)
  return {
    tick: simulator.tickCount,
    values,
  }
}

function projectCustomChipValues(
  values: Record<string, boolean[]>,
  document: CircuitDocument,
  customChips: readonly CustomChipLibraryEntry[],
): void {
  const definitions = new Map(customChips.map((entry) => [entry.id, entry] as const))
  for (const node of document.nodes) {
    if (node.type !== 'custom-chip') continue
    const definition = definitions.get(node.options?.customChipId ?? NaN)?.definition
    if (!definition) continue
    const outputNodes = definition.document.nodes
      .filter((child) => child.type === 'output')
      .sort((left, right) => left.id.localeCompare(right.id))
    values[node.id] = outputNodes.map((output) => values[`${node.id}__${output.id}`]?.[0] ?? false)
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
