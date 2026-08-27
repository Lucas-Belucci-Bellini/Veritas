import {
  documentInputIds,
  documentWatches,
  preflightDocumentRuntime,
  buildDocumentRuntimeNetlist,
  type DocumentRuntimeOptions,
} from './documentRuntime'
import type { CircuitDocument, CustomChipLibraryEntry } from '../circuit'
import {
  MAX_WORKER_TICKS,
  parseSimulationWorkerRequest,
  type SimulationWorkerBudget,
  type SimulationWorkerRunRequest,
} from './workerProtocol'

export interface DocumentWorkerRequestOptions {
  requestId: string
  inputs?: Readonly<Record<string, boolean>>
  ticks?: number
  watch?: readonly string[]
  budget?: SimulationWorkerBudget
  yieldEvery?: number
  timeoutMs?: number
  clockPeriods?: Readonly<Record<string, number>>
  customChips?: readonly CustomChipLibraryEntry[]
}

export interface DocumentWorkerRequestBuild {
  request: SimulationWorkerRunRequest
  preflight: ReturnType<typeof preflightDocumentRuntime>
}

/**
 * Prepara um request Worker a partir do mesmo caminho de documento usado pelo
 * runtime direto. A função é pura em relação ao documento recebido.
 */
export function buildDocumentWorkerRequest(
  document: CircuitDocument,
  options: DocumentWorkerRequestOptions,
): DocumentWorkerRequestBuild {
  const preflight = preflightDocumentRuntime(document, { customChips: options.customChips })
  if (preflight.status === 'invalid') {
    throw new Error(`O documento foi rejeitado pelo preflight: ${preflight.issues.map((issue) => issue.message).join(' ')}`)
  }

  const runtimeOptions: Pick<DocumentRuntimeOptions, 'clockPeriods' | 'customChips'> = {
    clockPeriods: options.clockPeriods,
    customChips: options.customChips,
  }
  const netlist = buildDocumentRuntimeNetlist(document, runtimeOptions)
  const inputIds = new Set(documentInputIds(document))
  const inputs = options.inputs ?? {}
  const unknownInputs = Object.keys(inputs).filter((id) => !inputIds.has(id))
  if (unknownInputs.length > 0) throw new RangeError(`Entradas inexistentes: ${unknownInputs.join(', ')}.`)

  const ticks = options.ticks ?? 1
  if (!Number.isInteger(ticks) || ticks < 0 || ticks > MAX_WORKER_TICKS) {
    throw new RangeError(`ticks deve ser um inteiro entre 0 e ${MAX_WORKER_TICKS}.`)
  }
  const watch = options.watch ?? documentWatches(document).map((entry) => entry.nodeId)
  const request: SimulationWorkerRunRequest = {
    type: 'run',
    protocolVersion: 1,
    requestId: options.requestId,
    components: netlist.components,
    steps: [{ set: inputs, ticks }],
    watch,
    budget: options.budget,
    yieldEvery: options.yieldEvery,
    timeoutMs: options.timeoutMs,
  }
  const parsed = parseSimulationWorkerRequest(request)
  if ('message' in parsed) throw new RangeError(`O request documental foi rejeitado pelo Worker: ${parsed.message}`)
  return { preflight, request }
}
