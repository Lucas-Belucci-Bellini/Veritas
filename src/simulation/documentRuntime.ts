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
  /** Definições para expandir instâncias `custom-chip` antes de simular. */
  customChips?: readonly CustomChipLibraryEntry[]
}

export interface DocumentRuntimeState {
  inputs: Record<string, boolean>
  clockPeriods: Record<string, number>
  simulator: SimulatorState
  snapshot: DocumentRuntimeSnapshot
  timeline: DocumentRuntimeSnapshot[]
}

/**
 * Monta o simulador temporal de um documento.
 *
 * Instâncias `custom-chip` são **achatadas antes** de virar netlist, em vez de
 * ensinar o simulador a recursar. Chips são combinacionais por contrato, então
 * achatar preserva o comportamento — e reusa a elaboração que já serve à
 * exportação HDL, com sua detecção de ciclo e limite de profundidade.
 *
 * A elaboração preserva os IDs do nível de topo, então `setInput`, o watch e a
 * linha do tempo continuam falando dos mesmos nós que o autor vê no canvas.
 */
export function createDocumentRuntime(document: CircuitDocument, options: DocumentRuntimeOptions = {}): Simulator {
  const runtimeDocument = applyClockPeriods(document, options.clockPeriods)
  const flattened = runtimeDocument.nodes.some((node) => node.type === 'custom-chip')
    ? elaborateCustomChipDocument(runtimeDocument, { customChips: options.customChips })
    : runtimeDocument
  const simulator = new Simulator(toNetlist(flattened))
  // Os valores iniciais vêm do documento original: são os pinos que o autor
  // declarou, e a elaboração não os renomeia no topo.
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
