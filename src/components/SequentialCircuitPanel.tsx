import { useEffect, useMemo, useRef, useState } from 'react'
import type { CircuitDocument, CustomChipLibraryEntry } from '../circuit'
import {
  createDocumentRuntime,
  documentInputIds,
  documentWatches,
  runtimeValue,
  snapshotDocumentRuntime,
  type DocumentRuntimeSnapshot,
  type DocumentRuntimeState,
} from '../simulation/documentRuntime'
import { Simulator } from '../simulation/simulator'
import { runtimeFreshness } from '../realtime/runtimeFreshness'
import { runtimeOfferDecision } from '../realtime/runtimeOffer'
import type { RuntimeMetrics } from '../realtime/runtimeMetrics'
import {
  clearRuntimeCheckpoint,
  createRuntimeStorage,
  readRuntimeCheckpoint,
  runtimeDocumentKey,
  RUNTIME_CHECKPOINT_TIMELINE_LIMIT,
  writeRuntimeCheckpoint,
  type CheckpointStorage,
} from '../simulation/runtimeCheckpoint'

const RUN_TICKS = 8

function appendTimeline(
  timeline: readonly DocumentRuntimeSnapshot[],
  next: readonly DocumentRuntimeSnapshot[],
): DocumentRuntimeSnapshot[] {
  return [...timeline, ...next].slice(-RUNTIME_CHECKPOINT_TIMELINE_LIMIT)
}

function signal(value: boolean): string {
  return value ? '1' : '0'
}

function runtimeState(
  simulator: Simulator,
  inputs: Record<string, boolean>,
  clockPeriods: Record<string, number>,
  snapshot: DocumentRuntimeSnapshot,
  timeline: readonly DocumentRuntimeSnapshot[],
): DocumentRuntimeState {
  return {
    inputs: { ...inputs },
    clockPeriods: { ...clockPeriods },
    simulator: simulator.exportState(),
    snapshot,
    timeline: [...timeline].slice(-RUNTIME_CHECKPOINT_TIMELINE_LIMIT),
  }
}

interface SequentialCircuitPanelProps {
  document: CircuitDocument
  /** Definições para expandir instâncias `custom-chip` antes de simular. */
  customChips?: readonly CustomChipLibraryEntry[]
  requestedClockPeriods?: Readonly<Record<string, number>>
  requestedRuntimeState?: DocumentRuntimeState
  requestedRuntimeStateSentAt?: string
  requestedRuntimeStateClientId?: string
  requestedRuntimeStateBaseVersion?: number
  currentBaseVersion?: number
  temporalPresenceCount?: number
  temporalConnectionStatus?: string
  runtimeMetrics?: RuntimeMetrics
  readOnly?: boolean
  onSnapshot?: (snapshot: DocumentRuntimeSnapshot) => void
  onClockPeriodsChange?: (clockPeriods: Readonly<Record<string, number>>) => void
  onRuntimeStateChange?: (state: DocumentRuntimeState) => void
  onRuntimeStateApplied?: () => void
  onRuntimeStateStale?: () => void
  onRuntimeStateApplyFailed?: () => void
}

export function SequentialCircuitPanel({ document, customChips, requestedClockPeriods, requestedRuntimeState, requestedRuntimeStateSentAt, requestedRuntimeStateClientId, requestedRuntimeStateBaseVersion, currentBaseVersion, temporalPresenceCount = 0, temporalConnectionStatus = 'disabled', runtimeMetrics, readOnly = false, onSnapshot, onClockPeriodsChange, onRuntimeStateChange, onRuntimeStateApplied, onRuntimeStateStale, onRuntimeStateApplyFailed }: SequentialCircuitPanelProps) {
  const simulatorRef = useRef<Simulator | null>(null)
  const appliedRemotePeriodsRef = useRef<string | null>(null)
  const storage = useMemo<CheckpointStorage | null>(() => createRuntimeStorage(), [])
  const documentKey = useMemo(() => runtimeDocumentKey(document), [document])
  const [inputs, setInputs] = useState<Record<string, boolean>>({})
  const [clockPeriods, setClockPeriods] = useState<Record<string, number>>({})
  const [timeline, setTimeline] = useState<DocumentRuntimeSnapshot[]>([])
  const [error, setError] = useState('')
  const [persistenceStatus, setPersistenceStatus] = useState('inicializando')
  const inputIds = useMemo(() => documentInputIds(document), [document])
  const clockIds = useMemo(() => document.nodes.filter((node) => node.type === 'clock').map((node) => node.id), [document])
  const watches = useMemo(() => documentWatches(document), [document])
  const current = timeline[timeline.length - 1]

  function persist(
    simulator: Simulator,
    nextInputs: Record<string, boolean>,
    nextClockPeriods: Record<string, number>,
    nextTimeline: readonly DocumentRuntimeSnapshot[],
  ): void {
    const saved = writeRuntimeCheckpoint({
      version: 1,
      documentKey,
      savedAt: new Date().toISOString(),
      inputs: nextInputs,
      clockPeriods: nextClockPeriods,
      simulator: simulator.exportState(),
      timeline: [...nextTimeline],
    }, storage)
    setPersistenceStatus(saved ? 'salvo localmente' : 'somente memória')
  }

  function initializeRuntime(clearSaved: boolean, overrideClockPeriods?: Record<string, number>): void {
    if (clearSaved) clearRuntimeCheckpoint(documentKey, storage)
    try {
      const saved = clearSaved ? null : readRuntimeCheckpoint(documentKey, storage)
      const defaultClockPeriods = Object.fromEntries(clockIds.map((id) => [id, document.nodes.find((node) => node.id === id)?.options?.period ?? 1]))
      const nextClockPeriods = { ...defaultClockPeriods, ...(saved?.clockPeriods ?? {}), ...(overrideClockPeriods ?? {}) }
      const simulator = createDocumentRuntime(document, { clockPeriods: nextClockPeriods, customChips })
      let restored = false
      if (saved) {
        try {
          simulator.restoreState(saved.simulator)
          restored = true
        } catch {
          clearRuntimeCheckpoint(documentKey, storage)
        }
      }
      simulatorRef.current = simulator
      const nextInputs = Object.fromEntries(
        inputIds.map((id) => [id, saved?.inputs[id] ?? document.nodes.find((node) => node.id === id)?.options?.initial ?? false]),
      )
      const snapshot = snapshotDocumentRuntime(simulator)
      const nextTimeline = restored && saved?.timeline.length ? saved.timeline : [snapshot]
      setInputs(nextInputs)
      setClockPeriods(nextClockPeriods)
      setTimeline(nextTimeline)
      setError('')
      setPersistenceStatus(restored ? 'checkpoint restaurado' : storage ? 'pronto para salvar localmente' : 'somente memória')
      if (overrideClockPeriods) persist(simulator, nextInputs, nextClockPeriods, nextTimeline)
      onSnapshot?.(snapshot)
    } catch (cause) {
      simulatorRef.current = null
      setTimeline([])
      setError(cause instanceof Error ? cause.message : 'Não foi possível preparar a simulação.')
      setPersistenceStatus('não disponível')
    }
  }

  useEffect(() => {
    initializeRuntime(false)
    appliedRemotePeriodsRef.current = null
    // O runtime deve reiniciar quando o documento visual mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentKey])

  useEffect(() => {
    if (!requestedClockPeriods) {
      appliedRemotePeriodsRef.current = null
      return
    }
    const signature = JSON.stringify(Object.entries(requestedClockPeriods).sort(([left], [right]) => left.localeCompare(right)))
    if (signature === appliedRemotePeriodsRef.current) return
    appliedRemotePeriodsRef.current = signature
    initializeRuntime(true, { ...requestedClockPeriods })
    // A configuração remota aprovada reinicia o runtime sem alterar o documento canônico.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedClockPeriods])

  function ensureSimulator(): Simulator | null {
    if (simulatorRef.current) return simulatorRef.current
    initializeRuntime(false)
    return simulatorRef.current
  }

  function step(): void {
    const simulator = ensureSimulator()
    if (!simulator) return
    try {
      for (const [id, value] of Object.entries(inputs)) simulator.setInput(id, value)
      simulator.tick()
      const snapshot = snapshotDocumentRuntime(simulator)
      const nextTimeline = appendTimeline(timeline, [snapshot])
      setTimeline(nextTimeline)
      persist(simulator, inputs, clockPeriods, nextTimeline)
      onRuntimeStateChange?.(runtimeState(simulator, inputs, clockPeriods, snapshot, nextTimeline))
      onSnapshot?.(snapshot)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível avançar a simulação.')
    }
  }

  function run(): void {
    const simulator = ensureSimulator()
    if (!simulator) return
    try {
      for (const [id, value] of Object.entries(inputs)) simulator.setInput(id, value)
      const next: DocumentRuntimeSnapshot[] = []
      for (let index = 0; index < RUN_TICKS; index += 1) {
        simulator.tick()
        next.push(snapshotDocumentRuntime(simulator))
      }
      const nextTimeline = appendTimeline(timeline, next)
      setTimeline(nextTimeline)
      persist(simulator, inputs, clockPeriods, nextTimeline)
      onRuntimeStateChange?.(runtimeState(simulator, inputs, clockPeriods, next[next.length - 1], nextTimeline))
      onSnapshot?.(next[next.length - 1])
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível executar a simulação.')
    }
  }

  function applyRemoteRuntimeState(state: DocumentRuntimeState): void {
    if (requestedRuntimeStateBaseVersion === undefined || currentBaseVersion === undefined || runtimeOfferDecision(requestedRuntimeStateBaseVersion, currentBaseVersion) === 'stale') {
      setPersistenceStatus('oferta obsoleta')
      setError('A versão-base da oferta remota não é mais atual. Receba um novo estado antes de aplicar.')
      onRuntimeStateStale?.()
      return
    }
    try {
      const simulator = createDocumentRuntime(document, { clockPeriods: state.clockPeriods, customChips })
      simulator.restoreState(state.simulator)
      const snapshot = snapshotDocumentRuntime(simulator)
      simulatorRef.current = simulator
      setInputs({ ...state.inputs })
      setClockPeriods({ ...state.clockPeriods })
      setTimeline(state.timeline.length ? state.timeline.slice(-RUNTIME_CHECKPOINT_TIMELINE_LIMIT) : [snapshot])
      persist(simulator, state.inputs, state.clockPeriods, state.timeline)
      setPersistenceStatus('estado remoto aplicado')
      setError('')
      onSnapshot?.(snapshot)
      onRuntimeStateApplied?.()
    } catch (cause) {
      setPersistenceStatus('falha ao aplicar')
      onRuntimeStateApplyFailed?.()
      setError(cause instanceof Error ? cause.message : 'Não foi possível aplicar o estado remoto.')
    }
  }

  function changeInput(id: string, value: boolean): void {
    const simulator = ensureSimulator()
    if (!simulator) return
    try {
      simulator.setInput(id, value)
      const nextInputs = { ...inputs, [id]: value }
      const snapshot = snapshotDocumentRuntime(simulator)
      const nextTimeline = timeline.length ? [...timeline.slice(0, -1), snapshot] : [snapshot]
      setInputs(nextInputs)
      setTimeline(nextTimeline)
      persist(simulator, nextInputs, clockPeriods, nextTimeline)
      onRuntimeStateChange?.(runtimeState(simulator, nextInputs, clockPeriods, snapshot, nextTimeline))
      onSnapshot?.(snapshot)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível alterar a entrada.')
    }
  }

  function changeClockPeriod(id: string, period: number): void {
    const nextClockPeriods = { ...clockPeriods, [id]: Math.max(1, Math.min(64, Math.floor(period))) }
    setClockPeriods(nextClockPeriods)
    initializeRuntime(true, nextClockPeriods)
    onClockPeriodsChange?.(nextClockPeriods)
  }

  const statusText = error ? 'erro' : current ? `tique ${current.tick}` : 'preparando'
  const remoteStateTick = requestedRuntimeState?.snapshot.tick
  const remoteStateAge = requestedRuntimeStateSentAt ? runtimeFreshness(requestedRuntimeStateSentAt)?.ageMs ?? null : null
  const remoteStateIsCurrent = requestedRuntimeStateBaseVersion !== undefined && currentBaseVersion !== undefined && runtimeOfferDecision(requestedRuntimeStateBaseVersion, currentBaseVersion) === 'current'
  const presenceText = temporalConnectionStatus === 'connected' ? `${temporalPresenceCount} participante${temporalPresenceCount === 1 ? '' : 's'} online` : 'colaboração temporal desconectada'

  return (
    <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/20" aria-label="Simulação temporal do circuito sequencial">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-300">Simulação temporal</p>
          <h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">Circuito do canvas conectado ao Simulator</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{statusText} · {persistenceStatus} · {presenceText} · duas fases preservam feedback sem laço infinito.</p>
          {runtimeMetrics && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">local: {runtimeMetrics.received} recebidos · {runtimeMetrics.applied} aplicados · {runtimeMetrics.versionConflicts} conflitos · {runtimeMetrics.expired + runtimeMetrics.invalidOrStale} expirados/rejeitados · {runtimeMetrics.publishFailures} falhas</p>}
          {runtimeMetrics && runtimeMetrics.events.length > 0 && <details className="mt-1 text-[11px] text-slate-500 dark:text-slate-400"><summary className="cursor-pointer">histórico local ({runtimeMetrics.events.length})</summary><div className="mt-1 max-h-24 overflow-auto space-y-0.5">{[...runtimeMetrics.events].reverse().map((event) => <div key={event.id}><span className="font-mono">{new Date(event.at).toLocaleTimeString('pt-BR')}</span> · {event.message}</div>)}</div></details>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="key text-xs" onClick={step} disabled={Boolean(error)}>Step · 1 tique</button>
          <button type="button" className="key text-xs" onClick={run} disabled={Boolean(error)}>Run · {RUN_TICKS} tiques</button>
          <button type="button" className="key text-xs" onClick={() => initializeRuntime(true)}>Reset</button>
        </div>
      </div>

      {clockIds.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Período do clock:</span>
          {clockIds.map((id) => (
            <label key={id} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-emerald-900 dark:bg-slate-900 dark:text-slate-200">
              {id}
              <select value={clockPeriods[id] ?? 1} onChange={(event) => changeClockPeriod(id, Number(event.target.value))} disabled={readOnly} className="rounded border border-slate-200 bg-transparent px-1.5 py-1 text-xs dark:border-slate-700 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Período do clock ${id}`}>
                {[1, 2, 3, 4, 8, 16, 32, 64].map((period) => <option key={period} value={period}>{period} tique{period === 1 ? '' : 's'}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}

      {requestedRuntimeState && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100" role="status">
          <span>Estado remoto disponível no tique {remoteStateTick ?? 0}{requestedRuntimeStateClientId ? `, enviado por ${requestedRuntimeStateClientId.slice(0, 8)}` : ''}{remoteStateAge !== null ? ` há ${Math.max(0, Math.round(remoteStateAge / 1000))}s` : ''}; o runtime local não foi substituído.</span>
          <button type="button" className="key text-xs" onClick={() => applyRemoteRuntimeState(requestedRuntimeState)} disabled={!remoteStateIsCurrent}>Aplicar estado remoto</button>
        </div>
      )}

      {inputIds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {inputIds.map((id) => (
            <label key={id} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-emerald-900 dark:bg-slate-900 dark:text-slate-200">
              <input
                type="checkbox"
                checked={inputs[id] ?? false}
                onChange={(event) => changeInput(id, event.target.checked)}
                aria-label={`Alternar ${id}`}
                disabled={Boolean(error)}
              />
              {id}
            </label>
          ))}
        </div>
      )}

      {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">{error}</p>}

      {current && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <div>
            <h4 className="text-xs font-bold tracking-wide text-slate-600 uppercase dark:text-slate-300">Watch</h4>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {watches.map((watch) => (
                <div key={`${watch.nodeId}:${watch.port ?? 0}`} className="rounded-lg border border-emerald-100 bg-white px-3 py-2 dark:border-emerald-900/70 dark:bg-slate-900">
                  <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">{watch.label}</div>
                  <div className="mt-1 font-mono text-lg font-black text-emerald-700 dark:text-emerald-300">{signal(runtimeValue(current, watch.nodeId, watch.port))}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold tracking-wide text-slate-600 uppercase dark:text-slate-300">Timeline</h4>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">últimos {RUNTIME_CHECKPOINT_TIMELINE_LIMIT} estados</span>
            </div>
            <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-emerald-100 bg-white dark:border-emerald-900/70 dark:bg-slate-900">
              <table className="w-full border-collapse text-left text-[11px]">
                <thead className="sticky top-0 bg-white dark:bg-slate-900">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-2 py-2 font-semibold text-slate-500">tique</th>
                    {watches.map((watch) => <th key={`${watch.nodeId}:${watch.port ?? 0}`} className="px-2 py-2 font-semibold text-slate-500">{watch.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((snapshot) => (
                    <tr key={snapshot.tick} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-1.5 font-mono text-slate-500">{snapshot.tick}</td>
                      {watches.map((watch) => <td key={`${watch.nodeId}:${watch.port ?? 0}`} className="px-2 py-1.5 font-mono font-bold text-slate-800 dark:text-slate-200">{signal(runtimeValue(snapshot, watch.nodeId, watch.port))}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
