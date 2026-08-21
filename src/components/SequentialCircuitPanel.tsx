import { useEffect, useMemo, useRef, useState } from 'react'
import type { CircuitDocument } from '../circuit'
import {
  createDocumentRuntime,
  documentInputIds,
  documentWatches,
  runtimeValue,
  snapshotDocumentRuntime,
  type DocumentRuntimeSnapshot,
} from '../simulation/documentRuntime'
import { Simulator } from '../simulation/simulator'

const MAX_TIMELINE_ROWS = 32
const RUN_TICKS = 8

function appendTimeline(
  timeline: readonly DocumentRuntimeSnapshot[],
  next: readonly DocumentRuntimeSnapshot[],
): DocumentRuntimeSnapshot[] {
  return [...timeline, ...next].slice(-MAX_TIMELINE_ROWS)
}

function signal(value: boolean): string {
  return value ? '1' : '0'
}

interface SequentialCircuitPanelProps {
  document: CircuitDocument
  onSnapshot?: (snapshot: DocumentRuntimeSnapshot) => void
}

export function SequentialCircuitPanel({ document, onSnapshot }: SequentialCircuitPanelProps) {
  const simulatorRef = useRef<Simulator | null>(null)
  const [inputs, setInputs] = useState<Record<string, boolean>>({})
  const [timeline, setTimeline] = useState<DocumentRuntimeSnapshot[]>([])
  const [error, setError] = useState('')
  const inputIds = useMemo(() => documentInputIds(document), [document])
  const watches = useMemo(() => documentWatches(document), [document])
  const current = timeline[timeline.length - 1]

  function resetRuntime() {
    try {
      const simulator = createDocumentRuntime(document)
      simulatorRef.current = simulator
      const initialInputs = Object.fromEntries(
        inputIds.map((id) => [id, document.nodes.find((node) => node.id === id)?.options?.initial ?? false]),
      )
      setInputs(initialInputs)
      const snapshot = snapshotDocumentRuntime(simulator)
      setTimeline([snapshot])
      setError('')
      onSnapshot?.(snapshot)
    } catch (cause) {
      simulatorRef.current = null
      setTimeline([])
      setError(cause instanceof Error ? cause.message : 'Não foi possível preparar a simulação.')
    }
  }

  useEffect(() => {
    resetRuntime()
    // O runtime deve reiniciar quando o documento visual mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document])

  function ensureSimulator(): Simulator | null {
    if (simulatorRef.current) return simulatorRef.current
    resetRuntime()
    return simulatorRef.current
  }

  function step(): void {
    const simulator = ensureSimulator()
    if (!simulator) return
    try {
      for (const [id, value] of Object.entries(inputs)) simulator.setInput(id, value)
      simulator.tick()
      const snapshot = snapshotDocumentRuntime(simulator)
      setTimeline((currentTimeline) => appendTimeline(currentTimeline, [snapshot]))
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
      setTimeline((currentTimeline) => appendTimeline(currentTimeline, next))
      onSnapshot?.(next[next.length - 1])
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível executar a simulação.')
    }
  }

  const statusText = error ? 'erro' : current ? `tique ${current.tick}` : 'preparando'

  return (
    <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/20" aria-label="Simulação temporal do circuito sequencial">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-300">Simulação temporal</p>
          <h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">Circuito do canvas conectado ao Simulator</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{statusText} · o estado é publicado em duas fases para suportar feedback sem laço infinito.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="key text-xs" onClick={step} disabled={Boolean(error)}>Step · 1 tique</button>
          <button type="button" className="key text-xs" onClick={run} disabled={Boolean(error)}>Run · {RUN_TICKS} tiques</button>
          <button type="button" className="key text-xs" onClick={resetRuntime}>Reset</button>
        </div>
      </div>

      {inputIds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {inputIds.map((id) => (
            <label key={id} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-emerald-900 dark:bg-slate-900 dark:text-slate-200">
              <input
                type="checkbox"
                checked={inputs[id] ?? false}
                onChange={(event) => setInputs((currentInputs) => ({ ...currentInputs, [id]: event.target.checked }))}
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
              <span className="text-[11px] text-slate-500 dark:text-slate-400">últimos {MAX_TIMELINE_ROWS} estados</span>
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
