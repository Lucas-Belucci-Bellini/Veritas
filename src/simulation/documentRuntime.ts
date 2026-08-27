import {
  analyzeCircuitExecutionSafety,
  elaborateCustomChipDocument,
  toNetlist,
  type CircuitDocument,
  type CircuitExecutionSafetyReport,
  type CustomChipLibraryEntry,
} from '../circuit'
import { Simulator, type SettleDiagnostic, type SimulatorState } from './simulator'

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
  /** Teto por chamada de settle para este runtime de documento. */
  maxSettleTicks?: number
  /** Teto acumulado de tiques para este runtime de documento. */
  maxTotalTicks?: number
  /** Teto de operações de componentes dentro de um tique. */
  maxOperationsPerTick?: number
  /** Teto acumulado de operações para este runtime de documento. */
  maxTotalOperations?: number
  /** Sinal externo para cancelar a execução cooperativa. */
  signal?: AbortSignal
}

export interface DocumentRuntimeState {
  inputs: Record<string, boolean>
  clockPeriods: Record<string, number>
  simulator: SimulatorState
  snapshot: DocumentRuntimeSnapshot
  timeline: DocumentRuntimeSnapshot[]
}

export interface DocumentRuntimeDiagnosticPreviewOptions extends DocumentRuntimeOptions {
  /** Entradas a aplicar na cópia antes do diagnóstico. */
  inputs?: Readonly<Record<string, boolean>>
  /** Estado a restaurar na cópia antes de aplicar as entradas. */
  simulatorState?: SimulatorState
  /** Budget explícito desta execução diagnóstica. */
  maxTicks?: number
}

export interface DocumentRuntimeDiagnosticPreview {
  diagnostic: SettleDiagnostic
  snapshot: DocumentRuntimeSnapshot
  simulatorState: SimulatorState
}

/**
 * Faz a classificação estática de segurança sem criar ou avançar um Simulator.
 * Larguras são aceitas aqui para que o preflight não confunda topologia com o
 * contrato posterior de execução vetorial.
 */
export function preflightDocumentRuntime(
  document: CircuitDocument,
  options: Pick<DocumentRuntimeOptions, 'customChips'> = {},
): CircuitExecutionSafetyReport {
  return analyzeCircuitExecutionSafety(document, {
    allowBuses: true,
    customChips: options.customChips,
  })
}

export function createDocumentRuntime(document: CircuitDocument, options: DocumentRuntimeOptions = {}): Simulator {
  const runtimeDocument = applyClockPeriods(document, options.clockPeriods)
  const executableDocument = runtimeDocument.nodes.some((node) => node.type === 'custom-chip')
    ? elaborateCustomChipDocument(runtimeDocument, { customChips: options.customChips })
    : runtimeDocument
  const simulator = new Simulator(toNetlist(executableDocument), {
    maxSettleTicks: options.maxSettleTicks,
    maxTotalTicks: options.maxTotalTicks,
    maxOperationsPerTick: options.maxOperationsPerTick,
    maxTotalOperations: options.maxTotalOperations,
    signal: options.signal,
  })
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

export function diagnoseDocumentRuntime(
  simulator: Simulator,
  maxTicks?: number,
): SettleDiagnostic {
  return simulator.diagnoseSettle(maxTicks)
}

export function diagnoseDocumentRuntimePreview(
  document: CircuitDocument,
  options: DocumentRuntimeDiagnosticPreviewOptions = {},
): DocumentRuntimeDiagnosticPreview {
  const { inputs, simulatorState, maxTicks, ...runtimeOptions } = options
  const simulator = createDocumentRuntime(document, runtimeOptions)
  if (simulatorState) simulator.restoreState(simulatorState)
  for (const [id, value] of Object.entries(inputs ?? {})) simulator.setInput(id, value)

  const diagnostic = diagnoseDocumentRuntime(simulator, maxTicks)
  return {
    diagnostic,
    snapshot: snapshotDocumentRuntime(simulator, document, options.customChips),
    simulatorState: simulator.exportState(),
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
    if (node.type === 'dff' || node.type === 'tff' || node.type === 'jk' || node.type === 'sr') {
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
