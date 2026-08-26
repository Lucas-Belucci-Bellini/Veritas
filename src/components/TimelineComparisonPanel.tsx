import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Plus, Timer, Trash2, XCircle } from 'lucide-react'
import {
  compareCircuitTimelines,
  type CircuitDifferentialReport,
  type CircuitDifferentialStep,
  type CircuitDocument,
} from '../circuit'
import { useCircuitProjects } from '../hooks/useCircuitProjects'
import { useCustomChips } from '../hooks/useCustomChips'
import { CircuitPicker } from './CircuitPicker'

interface DraftStep {
  /** Valores por nome de entrada; ausente significa "mantém o valor anterior". */
  set: Record<string, boolean>
  ticks: number
}

const INITIAL_STEPS: DraftStep[] = [{ set: {}, ticks: 4 }]

/**
 * Comparação temporal entre dois circuitos sequenciais.
 *
 * A contraparte do painel de equivalência: aqui o usuário escreve um roteiro e
 * o Veritas responde em que tique os dois circuitos passaram a discordar.
 * Concordar no roteiro não é prova de equivalência, e o painel diz isso na
 * própria resposta — a força da conclusão faz parte da conclusão.
 */
export function TimelineComparisonPanel() {
  const { projects, ready, unavailable } = useCircuitProjects()
  const customChips = useCustomChips()
  const customChipEntries = useMemo(
    () => customChips.chips.map((chip) => ({ id: chip.id, definition: chip.definition })),
    [customChips.chips],
  )
  const [idA, setIdA] = useState<number | ''>('')
  const [idB, setIdB] = useState<number | ''>('')
  const [steps, setSteps] = useState<DraftStep[]>(INITIAL_STEPS)
  const [report, setReport] = useState<CircuitDifferentialReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const documentA = projects.find((project) => project.id === idA)
  const documentB = projects.find((project) => project.id === idB)

  const inputNames = useMemo(
    () => (documentA ? inputLabels(documentA.document) : []),
    [documentA],
  )

  const handleCompare = () => {
    if (!documentA || !documentB) return
    setError(null)
    try {
      const script: CircuitDifferentialStep[] = steps.map((step) => ({
        set: step.set,
        ticks: step.ticks,
      }))
      setReport(compareCircuitTimelines(documentA.document, documentB.document, script, { customChips: customChipEntries }))
    } catch (cause) {
      setReport(null)
      setError(cause instanceof Error ? cause.message : 'Não foi possível comparar os circuitos.')
    }
  }

  const updateStep = (index: number, patch: Partial<DraftStep>) => {
    setSteps((current) => current.map((step, position) => (position === index ? { ...step, ...patch } : step)))
  }

  const toggleInput = (index: number, name: string) => {
    setSteps((current) =>
      current.map((step, position) => {
        if (position !== index) return step
        const set = { ...step.set }
        if (name in set) delete set[name]
        else set[name] = true
        return { ...step, set }
      }),
    )
  }

  const cycleValue = (index: number, name: string) => {
    setSteps((current) =>
      current.map((step, position) =>
        position === index ? { ...step, set: { ...step.set, [name]: !step.set[name] } } : step,
      ),
    )
  }

  return (
    <section className="card p-4 sm:p-6" aria-labelledby="timeline-title">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <Timer size={18} className="text-brand-500" aria-hidden="true" />
        <h2
          id="timeline-title"
          className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
        >
          Comparação temporal
        </h2>
      </header>

      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Roda a mesma sequência de entradas em dois circuitos e aponta o primeiro tique em que eles
        discordam. É aqui que entram clock, flip-flops e atrasos — os componentes cujo resultado
        depende do que aconteceu antes, e que a comparação exaustiva recusa.
      </p>

      {unavailable ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">{unavailable}</p>
      ) : !ready ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Carregando circuitos salvos…</p>
      ) : projects.length < 2 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Salve pelo menos dois circuitos no editor visual para comparar as linhas do tempo.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <CircuitPicker
              id="timeline-a"
              label="Circuito A (referência)"
              value={idA}
              onChange={setIdA}
              projects={projects}
            />
            <CircuitPicker
              id="timeline-b"
              label="Circuito B (comparado)"
              value={idB}
              onChange={setIdB}
              projects={projects}
            />
          </div>

          {documentA ? (
            <div className="mt-4">
              <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                Roteiro
              </h3>
              {inputNames.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  O circuito A não tem entradas; o roteiro só controla quantos tiques rodar.
                </p>
              ) : null}

              <ul className="mt-2 space-y-2">
                {steps.map((step, index) => (
                  <li
                    key={index}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                      Passo {index + 1}
                    </span>

                    {inputNames.map((name) => {
                      const active = name in step.set
                      return (
                        <span key={name} className="flex items-center gap-1">
                          <button
                            type="button"
                            className="chip-tag"
                            aria-pressed={active}
                            onClick={() => toggleInput(index, name)}
                            title={active ? `Parar de definir ${name} neste passo` : `Definir ${name} neste passo`}
                          >
                            {name}
                          </button>
                          {active ? (
                            <button
                              type="button"
                              className="chip-tag font-mono"
                              onClick={() => cycleValue(index, name)}
                              aria-label={`Valor de ${name} no passo ${index + 1}: ${step.set[name] ? 1 : 0}`}
                            >
                              {step.set[name] ? '1' : '0'}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-500">mantém</span>
                          )}
                        </span>
                      )
                    })}

                    <label className="ml-auto flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      tiques
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={step.ticks}
                        onChange={(event) =>
                          updateStep(index, { ticks: Math.max(1, Number(event.target.value) || 1) })
                        }
                        className="w-16 rounded-lg border border-slate-200 bg-transparent px-2 py-1 text-sm dark:border-slate-700"
                        aria-label={`Tiques do passo ${index + 1}`}
                      />
                    </label>

                    <button
                      type="button"
                      className="key h-8 px-2"
                      disabled={steps.length === 1}
                      onClick={() => setSteps((current) => current.filter((_, position) => position !== index))}
                      aria-label={`Remover o passo ${index + 1}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="key mt-2 gap-2 text-xs"
                onClick={() => setSteps((current) => [...current, { set: {}, ticks: 4 }])}
              >
                <Plus size={14} aria-hidden="true" />
                Adicionar passo
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className="key mt-4 gap-2"
            disabled={!documentA || !documentB}
            onClick={handleCompare}
          >
            Comparar linha do tempo
          </button>

          {error ? (
            <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-400">
              {error}
            </p>
          ) : null}

          {report ? <TimelineReportView report={report} /> : null}
        </>
      )}
    </section>
  )
}

function inputLabels(document: CircuitDocument): string[] {
  const names = document.nodes
    .filter((node) => node.type === 'input')
    .map((node) => node.label?.trim() || node.id)
  return [...new Set(names)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

function TimelineReportView({ report }: { report: CircuitDifferentialReport }) {
  if (report.status === 'incomparable') {
    return (
      <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
          <AlertTriangle size={16} aria-hidden="true" />
          Não comparável
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-300">
          {report.issues.map((issue) => (
            <li key={issue.code}>{issue.message}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Nenhum tique foi simulado.</p>
      </div>
    )
  }

  if (report.status === 'identical') {
    return (
      <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-950/40">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 size={16} aria-hidden="true" />
          Idênticos neste roteiro
        </p>
        <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
          Os dois circuitos concordaram nos {report.comparedTicks} tiques simulados.
        </p>
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
          Isso não é prova de equivalência: outro roteiro ainda pode separá-los. A prova exaustiva
          existe para circuitos combinacionais, no painel de equivalência.
        </p>
      </div>
    )
  }

  const first = report.firstDivergence
  return (
    <div className="mt-4 rounded-lg border border-rose-300 bg-rose-50 p-4 dark:border-rose-700 dark:bg-rose-950/40">
      <p className="flex items-center gap-2 text-sm font-semibold text-rose-800 dark:text-rose-300">
        <XCircle size={16} aria-hidden="true" />
        Divergem
      </p>
      <p className="mt-1 text-sm text-rose-800 dark:text-rose-300">
        {report.divergentTicks} de {report.comparedTicks} tiques divergem
        {report.divergentOutputs.length > 0 ? ` em: ${report.divergentOutputs.join(', ')}` : ''}.
      </p>

      {first ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-rose-700 uppercase dark:text-rose-400">
              Primeira divergência · tique {first.tick}
            </h3>
            <table className="mt-2 w-full text-left text-sm">
              <caption className="sr-only">Entradas em vigor no primeiro tique divergente</caption>
              <thead>
                <tr className="text-xs text-rose-700 uppercase dark:text-rose-400">
                  <th scope="col" className="py-1 pr-4">Entrada</th>
                  <th scope="col" className="py-1">Valor</th>
                </tr>
              </thead>
              <tbody className="text-rose-900 dark:text-rose-200">
                {first.inputs.map((input) => (
                  <tr key={input.name} className="border-t border-rose-200 dark:border-rose-800">
                    <th scope="row" className="py-1 pr-4 font-medium">{input.name}</th>
                    <td className="py-1 font-mono">{input.value ? '1' : '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-wide text-rose-700 uppercase dark:text-rose-400">
              Saídas divergentes
            </h3>
            <table className="mt-2 w-full text-left text-sm">
              <caption className="sr-only">Valor de cada circuito no primeiro tique divergente</caption>
              <thead>
                <tr className="text-xs text-rose-700 uppercase dark:text-rose-400">
                  <th scope="col" className="py-1 pr-4">Saída</th>
                  <th scope="col" className="py-1 pr-4">Circuito A</th>
                  <th scope="col" className="py-1">Circuito B</th>
                </tr>
              </thead>
              <tbody className="text-rose-900 dark:text-rose-200">
                {first.signals.map((signal) => (
                  <tr key={signal.signal} className="border-t border-rose-200 dark:border-rose-800">
                    <th scope="row" className="py-1 pr-4 font-medium">{signal.signal}</th>
                    <td className="py-1 pr-4 font-mono font-semibold">{signal.a ? '1' : '0'}</td>
                    <td className="py-1 font-mono font-semibold">{signal.b ? '1' : '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
