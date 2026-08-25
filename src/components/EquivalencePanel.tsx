import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ScaleIcon, XCircle } from 'lucide-react'
import {
  compareCircuitEquivalence,
  DEFAULT_EQUIVALENCE_INPUT_BITS,
  type CircuitEquivalenceReport,
  type CustomChipLibraryEntry,
} from '../circuit'
import { useCircuitProjects } from '../hooks/useCircuitProjects'
import { useCustomChips } from '../hooks/useCustomChips'
import { CircuitPicker } from './CircuitPicker'

/**
 * Comparação comportamental entre dois circuitos salvos.
 *
 * O painel existe para responder a uma pergunta específica: "eu reescrevi este
 * circuito — ele continua fazendo a mesma coisa?". Quando a resposta é não, o
 * produto útil não é o veredito, é o contraexemplo: a combinação exata de
 * entradas em que os dois discordam.
 */
export function EquivalencePanel() {
  const { projects, ready, unavailable } = useCircuitProjects()
  const customChips = useCustomChips()
  const [idA, setIdA] = useState<number | ''>('')
  const [idB, setIdB] = useState<number | ''>('')
  const [report, setReport] = useState<CircuitEquivalenceReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const chipEntries = useMemo<CustomChipLibraryEntry[]>(
    () => customChips.chips.map((chip) => ({ id: chip.id, definition: chip.definition })),
    [customChips.chips],
  )

  const documentA = projects.find((project) => project.id === idA)
  const documentB = projects.find((project) => project.id === idB)
  const canCompare = Boolean(documentA && documentB)

  const handleCompare = () => {
    if (!documentA || !documentB) return
    setError(null)
    try {
      setReport(
        compareCircuitEquivalence(documentA.document, documentB.document, {
          customChips: chipEntries,
          maxInputBits: DEFAULT_EQUIVALENCE_INPUT_BITS,
        }),
      )
    } catch (cause) {
      setReport(null)
      setError(cause instanceof Error ? cause.message : 'Não foi possível comparar os circuitos.')
    }
  }

  return (
    <section className="card p-4 sm:p-6" aria-labelledby="equivalence-title">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <ScaleIcon size={18} className="text-brand-500" aria-hidden="true" />
        <h2
          id="equivalence-title"
          className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
        >
          Equivalência entre circuitos
        </h2>
      </header>

      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Compara dois circuitos combinacionais salvos em todas as combinações de entrada. As portas
        são pareadas pelo rótulo, então duas implementações diferentes da mesma função contam como
        equivalentes.
      </p>

      {unavailable ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">{unavailable}</p>
      ) : !ready ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Carregando circuitos salvos…</p>
      ) : projects.length < 2 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Salve pelo menos dois circuitos no editor visual para comparar um com o outro. A comparação
          é local: nenhum circuito sai deste navegador.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <CircuitPicker
              id="equivalence-a"
              label="Circuito A (referência)"
              value={idA}
              onChange={setIdA}
              projects={projects}
            />
            <CircuitPicker
              id="equivalence-b"
              label="Circuito B (comparado)"
              value={idB}
              onChange={setIdB}
              projects={projects}
            />
          </div>

          <button
            type="button"
            className="key mt-4 gap-2"
            disabled={!canCompare}
            onClick={handleCompare}
          >
            Comparar comportamento
          </button>

          {error ? (
            <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-400">
              {error}
            </p>
          ) : null}

          {report ? <ReportView report={report} /> : null}
        </>
      )}
    </section>
  )
}

function ReportView({ report }: { report: CircuitEquivalenceReport }) {
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
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          Nenhuma linha foi avaliada — este resultado não afirma nem nega equivalência.
        </p>
      </div>
    )
  }

  if (report.status === 'equivalent') {
    return (
      <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-950/40">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 size={16} aria-hidden="true" />
          Equivalentes
        </p>
        <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
          Os dois circuitos concordam nas {report.comparedRows} combinações possíveis de entrada.
        </p>
      </div>
    )
  }

  const counterexample = report.counterexample
  return (
    <div className="mt-4 rounded-lg border border-rose-300 bg-rose-50 p-4 dark:border-rose-700 dark:bg-rose-950/40">
      <p className="flex items-center gap-2 text-sm font-semibold text-rose-800 dark:text-rose-300">
        <XCircle size={16} aria-hidden="true" />
        Não equivalentes
      </p>
      <p className="mt-1 text-sm text-rose-800 dark:text-rose-300">
        {report.divergentRows} de {report.comparedRows} combinações divergem
        {report.divergentOutputs.length > 0 ? ` em: ${report.divergentOutputs.join(', ')}` : ''}.
      </p>

      {counterexample ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-rose-700 uppercase dark:text-rose-400">
              Entradas do contraexemplo
            </h3>
            <table className="mt-2 w-full text-left text-sm">
              <caption className="sr-only">
                Combinação de entradas em que os dois circuitos discordam
              </caption>
              <thead>
                <tr className="text-xs text-rose-700 uppercase dark:text-rose-400">
                  <th scope="col" className="py-1 pr-4">Entrada</th>
                  <th scope="col" className="py-1">Valor</th>
                </tr>
              </thead>
              <tbody className="text-rose-900 dark:text-rose-200">
                {counterexample.inputs.map((input) => (
                  <tr key={`in-${input.name}`} className="border-t border-rose-200 dark:border-rose-800">
                    <th scope="row" className="py-1 pr-4 font-medium">{input.name}</th>
                    <td className="py-1 font-mono">{input.value}</td>
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
              <caption className="sr-only">
                Valores produzidos por cada circuito para essa combinação de entradas
              </caption>
              <thead>
                <tr className="text-xs text-rose-700 uppercase dark:text-rose-400">
                  <th scope="col" className="py-1 pr-4">Saída</th>
                  <th scope="col" className="py-1 pr-4">Circuito A</th>
                  <th scope="col" className="py-1">Circuito B</th>
                </tr>
              </thead>
              <tbody className="text-rose-900 dark:text-rose-200">
                {counterexample.divergences.map((divergence) => (
                  <tr key={`out-${divergence.output}`} className="border-t border-rose-200 dark:border-rose-800">
                    <th scope="row" className="py-1 pr-4 font-medium">{divergence.output}</th>
                    <td className="py-1 pr-4 font-mono font-semibold">{divergence.a}</td>
                    <td className="py-1 font-mono font-semibold">{divergence.b}</td>
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
