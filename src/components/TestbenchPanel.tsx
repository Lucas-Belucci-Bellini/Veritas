import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCheck, Plus, Trash2, XCircle } from 'lucide-react'
import {
  collectCircuitPorts,
  runTestbench,
  TESTBENCH_FORMAT,
  TESTBENCH_VERSION,
  type CircuitDocument,
  type CustomChipLibraryEntry,
  type TestbenchReport,
} from '../circuit'
import { useCircuitProjects } from '../hooks/useCircuitProjects'
import { useCustomChips } from '../hooks/useCustomChips'
import { CircuitPicker } from './CircuitPicker'

interface DraftCase {
  inputs: Record<string, boolean>
  expect: Record<string, boolean>
}

/**
 * Testbench declarativo sobre um circuito salvo.
 *
 * A tabela **é** o documento de teste: cada linha é um caso, as colunas de
 * entrada são o estímulo e as de saída são o que o autor afirma que deveria
 * acontecer. Nada aqui é código — é dado, e é por isso que rodar um teste não
 * abre nenhuma porta de execução.
 *
 * O painel cobre o modo combinacional. Casos sequenciais existem no domínio e
 * na ferramenta MCP `run_testbench`; a interface deles depende de um editor de
 * roteiro com expectativas, que ainda não existe.
 */
export function TestbenchPanel() {
  const { projects, ready, unavailable } = useCircuitProjects()
  const customChips = useCustomChips()
  const [circuitId, setCircuitId] = useState<number | ''>('')
  const [cases, setCases] = useState<DraftCase[]>([])
  const [report, setReport] = useState<TestbenchReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const project = projects.find((item) => item.id === circuitId)
  const ports = useMemo(() => (project ? readPorts(project.document) : null), [project])

  const chipEntries = useMemo<CustomChipLibraryEntry[]>(
    () => customChips.chips.map((chip) => ({ id: chip.id, definition: chip.definition })),
    [customChips.chips],
  )

  // Trocar de circuito invalida os casos: as colunas mudam.
  useEffect(() => {
    setCases([])
    setReport(null)
    setError(null)
  }, [circuitId])

  const addCase = () => {
    if (!ports) return
    setReport(null)
    setCases((current) => [
      ...current,
      {
        inputs: Object.fromEntries(ports.inputs.map((name) => [name, false])),
        expect: Object.fromEntries(ports.outputs.map((name) => [name, false])),
      },
    ])
  }

  const toggle = (index: number, kind: 'inputs' | 'expect', name: string) => {
    setReport(null)
    setCases((current) =>
      current.map((item, position) =>
        position === index ? { ...item, [kind]: { ...item[kind], [name]: !item[kind][name] } } : item,
      ),
    )
  }

  const handleRun = () => {
    if (!project || cases.length === 0) return
    setError(null)
    try {
      setReport(
        runTestbench(
          project.document,
          {
            format: TESTBENCH_FORMAT,
            version: TESTBENCH_VERSION,
            name: `Testes de ${project.name}`,
            cases: cases.map((item, index) => ({
              name: `#${index + 1}`,
              inputs: item.inputs,
              expect: item.expect,
            })),
          },
          { customChips: chipEntries },
        ),
      )
    } catch (cause) {
      setReport(null)
      setError(cause instanceof Error ? cause.message : 'Não foi possível rodar os testes.')
    }
  }

  return (
    <section className="card p-4 sm:p-6" aria-labelledby="testbench-title">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <ClipboardCheck size={18} className="text-brand-500" aria-hidden="true" />
        <h2
          id="testbench-title"
          className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
        >
          Testes do circuito
        </h2>
      </header>

      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Declare o que o circuito deveria fazer: cada linha é um caso, com as entradas do estímulo e as
        saídas que você espera. O Veritas roda todos e mostra quais não bateram.
      </p>

      {unavailable ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">{unavailable}</p>
      ) : !ready ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Carregando circuitos salvos…</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Salve um circuito no editor visual para escrever testes sobre ele.
        </p>
      ) : (
        <>
          <div className="max-w-md">
            <CircuitPicker
              id="testbench-circuit"
              label="Circuito sob teste"
              value={circuitId}
              onChange={setCircuitId}
              projects={projects}
            />
          </div>

          {ports && ports.outputs.length === 0 ? (
            <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
              Este circuito não tem saídas, então não há o que conferir.
            </p>
          ) : ports ? (
            <>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    Casos de teste: entradas aplicadas e saídas esperadas
                  </caption>
                  <thead>
                    <tr className="text-xs text-slate-500 uppercase dark:text-slate-400">
                      <th scope="col" className="py-2 pr-3">Caso</th>
                      {ports.inputs.map((name) => (
                        <th key={`in-${name}`} scope="col" className="py-2 pr-3">{name}</th>
                      ))}
                      {ports.outputs.map((name) => (
                        <th key={`out-${name}`} scope="col" className="py-2 pr-3 text-brand-600 dark:text-brand-400">
                          {name} <span className="font-normal normal-case">esperado</span>
                        </th>
                      ))}
                      <th scope="col" className="py-2">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((item, index) => {
                      const result = report?.cases[index]
                      return (
                        <tr key={index} className="border-t border-slate-200 dark:border-slate-700">
                          <th scope="row" className="py-2 pr-3 font-medium text-slate-500 dark:text-slate-400">
                            #{index + 1}
                          </th>

                          {ports.inputs.map((name) => (
                            <td key={`in-${name}`} className="py-2 pr-3">
                              <BitButton
                                value={item.inputs[name] ?? false}
                                onClick={() => toggle(index, 'inputs', name)}
                                label={`Entrada ${name} do caso ${index + 1}`}
                              />
                            </td>
                          ))}

                          {ports.outputs.map((name) => {
                            const mismatch = result?.mismatches.find((entry) => entry.output === name)
                            return (
                              <td key={`out-${name}`} className="py-2 pr-3">
                                <span className="flex items-center gap-1">
                                  <BitButton
                                    value={item.expect[name] ?? false}
                                    onClick={() => toggle(index, 'expect', name)}
                                    label={`Saída esperada ${name} do caso ${index + 1}`}
                                  />
                                  {mismatch ? (
                                    <span className="font-mono text-xs text-rose-600 dark:text-rose-400">
                                      obtido {mismatch.actual ? '1' : '0'}
                                    </span>
                                  ) : null}
                                </span>
                              </td>
                            )
                          })}

                          <td className="py-2">
                            {result ? (
                              result.status === 'passed' ? (
                                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                                  <CheckCircle2 size={14} aria-hidden="true" /> passou
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400">
                                  <XCircle size={14} aria-hidden="true" /> falhou
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {cases.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Nenhum caso ainda. Adicione um e defina o que espera das saídas.
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="key gap-2 text-xs" onClick={addCase}>
                  <Plus size={14} aria-hidden="true" />
                  Adicionar caso
                </button>
                <button
                  type="button"
                  className="key gap-2 text-xs"
                  disabled={cases.length === 0}
                  onClick={() => {
                    setCases((current) => current.slice(0, -1))
                    setReport(null)
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Remover último
                </button>
                <button
                  type="button"
                  className="key ml-auto gap-2"
                  disabled={cases.length === 0}
                  onClick={handleRun}
                >
                  Rodar testes
                </button>
              </div>

              {error ? (
                <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-400">
                  {error}
                </p>
              ) : null}

              {report ? <TestbenchSummary report={report} /> : null}
            </>
          ) : null}
        </>
      )}
    </section>
  )
}

function BitButton({ value, onClick, label }: { value: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className="chip-tag w-8 justify-center font-mono"
      onClick={onClick}
      aria-label={`${label}: ${value ? 1 : 0}`}
    >
      {value ? '1' : '0'}
    </button>
  )
}

function TestbenchSummary({ report }: { report: TestbenchReport }) {
  if (report.status === 'invalid') {
    return (
      <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
          <AlertTriangle size={16} aria-hidden="true" />
          Teste inválido
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-300">
          {report.issues.map((issue) => (
            <li key={`${issue.code}-${issue.caseIndex ?? 'geral'}`}>{issue.message}</li>
          ))}
        </ul>
      </div>
    )
  }

  if (report.status === 'passed') {
    return (
      <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-950/40">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 size={16} aria-hidden="true" />
          {report.total} de {report.total} passaram
        </p>
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
          O circuito satisfez todos os casos que você escreveu. Isso cobre esses casos — para uma prova
          sobre todas as combinações possíveis, use a equivalência entre circuitos.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-lg border border-rose-300 bg-rose-50 p-4 dark:border-rose-700 dark:bg-rose-950/40">
      <p className="flex items-center gap-2 text-sm font-semibold text-rose-800 dark:text-rose-300">
        <XCircle size={16} aria-hidden="true" />
        {report.failed} de {report.total} falharam
      </p>
      <p className="mt-1 text-sm text-rose-800 dark:text-rose-300">
        As linhas marcadas mostram, ao lado da saída esperada, o valor que o circuito realmente produziu.
      </p>
    </div>
  )
}

function readPorts(document: CircuitDocument): { inputs: string[]; outputs: string[] } {
  const identity = collectCircuitPorts(document)
  return {
    inputs: identity.inputs.map((port) => port.name),
    outputs: identity.outputs.map((port) => port.name),
  }
}
