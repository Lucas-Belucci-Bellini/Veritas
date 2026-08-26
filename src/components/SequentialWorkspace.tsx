import { useMemo, useState } from 'react'
import {
  applySequentialInputs,
  createSequentialSimulator,
  getSequentialDemo,
  outputValue,
  pulseClock,
  signalLabel,
  snapshotSequentialSimulator,
  type SequentialDemoId,
  type SequentialSnapshot,
} from '../simulation/workspace'
import { buildWaveform } from '../simulation/waveform'

const MAX_TIMELINE_ROWS = 24
const RUN_TICKS = 8

function appendSnapshots(
  current: readonly SequentialSnapshot[],
  next: readonly SequentialSnapshot[],
): SequentialSnapshot[] {
  return [...current, ...next].slice(-MAX_TIMELINE_ROWS)
}

export function SequentialWorkspace() {
  const [demoId, setDemoId] = useState<SequentialDemoId>('dff-clock')
  const demo = useMemo(() => getSequentialDemo(demoId), [demoId])
  const [simulator, setSimulator] = useState(() => createSequentialSimulator('dff-clock'))
  const [inputs, setInputs] = useState<Record<string, boolean>>({ d: false })
  const [timeline, setTimeline] = useState<SequentialSnapshot[]>(() => [
    snapshotSequentialSimulator(createSequentialSimulator('dff-clock')),
  ])

  const current = timeline[timeline.length - 1] ?? snapshotSequentialSimulator(simulator)
  const waveform = useMemo(() => buildWaveform(demo.watch, timeline), [demo.watch, timeline])

  function reset(nextDemoId: SequentialDemoId = demoId) {
    const nextDemo = getSequentialDemo(nextDemoId)
    const nextSimulator = createSequentialSimulator(nextDemoId)
    applySequentialInputs(nextSimulator, nextDemo.initialInputs)
    setDemoId(nextDemoId)
    setSimulator(nextSimulator)
    setInputs({ ...nextDemo.initialInputs })
    setTimeline([snapshotSequentialSimulator(nextSimulator)])
  }

  function changeDemo(value: string) {
    if (!['dff-clock', 'tff-clock', 'jk-clock', 'sr-clock', 'register-4bit', 'counter-4bit', 'delay', 'feedback-counter'].includes(value)) return
    reset(value as SequentialDemoId)
  }

  function updateInput(id: string, value: boolean) {
    simulator.setInput(id, value)
    setInputs((currentInputs) => ({ ...currentInputs, [id]: value }))
  }

  function tickOnce() {
    applySequentialInputs(simulator, inputs)
    simulator.tick()
    setTimeline((currentTimeline) => appendSnapshots(currentTimeline, [snapshotSequentialSimulator(simulator)]))
  }

  function runTicks() {
    const nextSnapshots: SequentialSnapshot[] = []
    if (demo.controlMode === 'manual-clock') {
      for (let index = 0; index < RUN_TICKS / 2; index += 1) {
        nextSnapshots.push(...pulseClock(simulator, 'clk', demo.clockSettleTicks))
      }
      setInputs((currentInputs) => ({ ...currentInputs, clk: false }))
    } else {
      applySequentialInputs(simulator, inputs)
      for (let index = 0; index < RUN_TICKS; index += 1) {
        simulator.tick()
        nextSnapshots.push(snapshotSequentialSimulator(simulator))
      }
    }
    setTimeline((currentTimeline) => appendSnapshots(currentTimeline, nextSnapshots))
  }

  function manualPulse() {
    const nextSnapshots = pulseClock(simulator, 'clk', demo.clockSettleTicks)
    setInputs((currentInputs) => ({ ...currentInputs, clk: false }))
    setTimeline((currentTimeline) => appendSnapshots(currentTimeline, nextSnapshots))
  }

  return (
    <section className="space-y-4" aria-label="Workspace sequencial do Veritas">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="min-w-[240px] flex-1">
          <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase dark:text-brand-300">
            v0.9.0 · simulação sequencial
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
            Workspace de clock, memória e tiques
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {demo.description} O motor roda em duas fases e possui limite de execução para não congelar a interface.
          </p>
        </div>
        <label className="min-w-[230px]">
          <span className="mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Circuito de demonstração
          </span>
          <select
            value={demoId}
            onChange={(event) => changeDemo(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            aria-label="Selecionar circuito sequencial"
          >
            <option value="dff-clock">Flip-flop D com clock</option>
            <option value="tff-clock">Flip-flop T com clock</option>
            <option value="jk-clock">Flip-flop JK com clock</option>
            <option value="sr-clock">Flip-flop SR com clock</option>
            <option value="register-4bit">Registrador paralelo de 4 bits</option>
            <option value="counter-4bit">Contador síncrono de 4 bits</option>
            <option value="delay">Atraso de propagação</option>
            <option value="feedback-counter">Contador com feedback</option>
          </select>
        </label>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        {demo.controls.map((id) => (
          <label key={id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={inputs[id] ?? false}
              onChange={(event) => updateInput(id, event.target.checked)}
              aria-label={`Alternar ${id}`}
            />
            {id.toUpperCase()}
          </label>
        ))}
        {demo.controlMode === 'auto-clock' && (
          <span className="text-xs text-slate-500 dark:text-slate-400">CLK alterna automaticamente a cada tique.</span>
        )}
        {demo.controlMode === 'manual-input' && (
          <span className="text-xs text-slate-500 dark:text-slate-400">Altere a entrada e avance um tique para observar o atraso.</span>
        )}
        {demo.controlMode === 'manual-clock' && (
          <button
            type="button"
            onClick={manualPulse}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Pulso de clock
          </button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={tickOnce}
            className="rounded-lg border border-brand-300 px-3 py-2 text-sm font-semibold text-brand-700 hover:border-brand-500 dark:border-brand-700 dark:text-brand-300"
          >
            Step · 1 tique
          </button>
          <button
            type="button"
            onClick={runTicks}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:text-brand-700 dark:border-slate-600 dark:text-slate-200"
          >
            {demo.controlMode === 'manual-clock' ? 'Continue · 4 pulsos' : 'Run · 8 tiques'}
          </button>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:text-brand-700 dark:border-slate-600 dark:text-slate-200"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Watch atual</h3>
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">tique {current.tick}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {demo.watch.map((watch) => (
              <div key={`${watch.nodeId}:${watch.port ?? 0}`} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{watch.label}</div>
                <div className="mt-1 font-mono text-xl font-bold text-brand-700 dark:text-brand-300">
                  {signalLabel(outputValue(current, watch))}
                </div>
                <div className="text-[11px] text-slate-400">{watch.nodeId}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Linha do tempo</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">últimos {MAX_TIMELINE_ROWS} estados</span>
          </div>
          <div className="mt-3 max-h-56 overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-white dark:bg-slate-900">
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-2 py-2 font-semibold">Tique</th>
                  {demo.watch.map((watch) => (
                    <th key={`${watch.nodeId}:${watch.port ?? 0}`} className="px-2 py-2 font-semibold">{watch.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeline.map((snapshot) => (
                  <tr key={`${snapshot.tick}-${snapshot.values[demo.watch[0]?.nodeId ?? '']?.join('')}`} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-2 font-mono text-slate-500">{snapshot.tick}</td>
                    {demo.watch.map((watch) => (
                      <td key={`${watch.nodeId}:${watch.port ?? 0}`} className="px-2 py-2 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {signalLabel(outputValue(snapshot, watch))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label="Forma de onda sequencial">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Forma de onda</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Cada célula representa o nível observado no snapshot correspondente da timeline.</p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">{waveform.length} sinais · {timeline.length} amostras</span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th scope="col" className="sticky left-0 bg-white px-2 py-2 font-semibold dark:bg-slate-900">Sinal</th>
                {timeline.map((snapshot) => (
                  <th scope="col" key={snapshot.tick} className="min-w-12 px-2 py-2 text-center font-mono font-semibold">t{snapshot.tick}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {waveform.map((track) => (
                <tr key={`${track.nodeId}:${track.port ?? 0}:${track.label}`} className="border-b border-slate-100 dark:border-slate-800">
                  <th scope="row" className="sticky left-0 whitespace-nowrap bg-white px-2 py-2 font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">{track.label}</th>
                  {track.samples.map((sample) => (
                    <td key={`${track.nodeId}:${track.port ?? 0}:${sample.tick}`} className="px-1 py-1 text-center">
                      <div
                        className={`rounded px-2 py-1 font-mono font-bold ${sample.value ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
                        aria-label={`${track.label} no tique ${sample.tick}: ${signalLabel(sample.value)}`}
                      >
                        {signalLabel(sample.value)}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}
