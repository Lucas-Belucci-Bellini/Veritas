import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react'
import {
  collectCircuitPorts,
  runTestbench,
  type CircuitDocument,
  type CustomChipLibraryEntry,
  type TestbenchReport,
} from '../circuit'
import { useCircuitProjects } from '../hooks/useCircuitProjects'
import { useCustomChips } from '../hooks/useCustomChips'
import { useTestbenchProjects } from '../hooks/useTestbenchProjects'
import { download } from '../lib/export'
import { serializeTestbenchProjects } from '../storage/testbenches'
import { CircuitPicker } from './CircuitPicker'
import {
  clampStepTicks,
  createCombinationalCase,
  createSequentialCase,
  createStep,
  cycleStepInput as cycleStepInputDraft,
  draftCasesFromDocument,
  type DraftCase,
  type DraftPortNames,
  toTestbenchDocument,
  toggleExpectedOutput as toggleExpectedOutputDraft,
} from './testbenchDraft'

type CaseResult = TestbenchReport['cases'][number]

/**
 * Testbench declarativo sobre um circuito salvo.
 *
 * A tabela **é** o documento de teste: cada linha é um caso, as colunas de
 * entrada são o estímulo e as de saída são o que o autor afirma que deveria
 * acontecer. Nada aqui é código — é dado, e é por isso que rodar um teste não
 * abre nenhuma porta de execução.
 *
 * Casos combinacionais usam uma linha de vetores. Casos sequenciais usam um
 * roteiro de passos com entradas definidas, tiques e expectativas por passo;
 * ambos são enviados ao mesmo runner declarativo do domínio.
 */
export function TestbenchPanel() {
  const { projects, ready, unavailable } = useCircuitProjects()
  const customChips = useCustomChips()
  const [circuitId, setCircuitId] = useState<number | ''>('')
  const [cases, setCases] = useState<DraftCase[]>([])
  const [savedTestbenchId, setSavedTestbenchId] = useState<number | null>(null)
  const [testbenchName, setTestbenchName] = useState('')
  const [storageMessage, setStorageMessage] = useState<string | null>(null)
  const [report, setReport] = useState<TestbenchReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const testbenchFileInput = useRef<HTMLInputElement>(null)
  const project = projects.find((item) => item.id === circuitId)
  const savedTestbenches = useTestbenchProjects(circuitId, project?.name)
  const ports = useMemo(
    () => (project ? readPorts(project.document) : null),
    [project],
  )

  const chipEntries = useMemo<CustomChipLibraryEntry[]>(
    () =>
      customChips.chips.map((chip) => ({
        id: chip.id,
        definition: chip.definition,
      })),
    [customChips.chips],
  )

  const combinationalCases = cases.flatMap((item, index) =>
    item.mode === 'combinational' ? [{ item, index }] : [],
  )
  const sequentialCases = cases.flatMap((item, index) =>
    item.mode === 'sequential' ? [{ item, index }] : [],
  )

  // Trocar de circuito invalida o rascunho: as portas e testbenches mudam.
  useEffect(() => {
    setCases([])
    setSavedTestbenchId(null)
    setTestbenchName('')
    setStorageMessage(null)
    setReport(null)
    setError(null)
  }, [circuitId])

  const addCase = () => {
    if (!ports) return
    setReport(null)
    setCases((current) => [...current, createCombinationalCase(ports)])
  }

  const addSequentialCase = () => {
    if (!ports) return
    setReport(null)
    setCases((current) => [...current, createSequentialCase(ports)])
  }

  const toggle = (index: number, name: string) => {
    setReport(null)
    setCases((current) =>
      current.map((item, position) =>
        position === index && item.mode === 'combinational'
          ? { ...item, inputs: { ...item.inputs, [name]: !item.inputs[name] } }
          : item,
      ),
    )
  }

  const toggleExpectedOutput = (index: number, name: string) => {
    setReport(null)
    setCases((current) =>
      current.map((item, position) =>
        position === index && item.mode === 'combinational'
          ? { ...item, expect: { ...item.expect, [name]: !item.expect[name] } }
          : item,
      ),
    )
  }

  const cycleStepInput = (
    caseIndex: number,
    stepIndex: number,
    name: string,
  ) => {
    setReport(null)
    setCases((current) =>
      current.map((item, position) => {
        if (position !== caseIndex || item.mode !== 'sequential') return item
        const steps = item.steps.map((step, index) => {
          if (index !== stepIndex) return step
          return cycleStepInputDraft(step, name)
        })
        return { ...item, steps }
      }),
    )
  }

  const toggleStepExpectedOutput = (
    caseIndex: number,
    stepIndex: number,
    name: string,
  ) => {
    setReport(null)
    setCases((current) =>
      current.map((item, position) => {
        if (position !== caseIndex || item.mode !== 'sequential') return item
        const steps = item.steps.map((step, index) =>
          index === stepIndex ? toggleExpectedOutputDraft(step, name) : step,
        )
        return { ...item, steps }
      }),
    )
  }

  const updateStepTicks = (
    caseIndex: number,
    stepIndex: number,
    value: string,
  ) => {
    setReport(null)
    setCases((current) =>
      current.map((item, position) => {
        if (position !== caseIndex || item.mode !== 'sequential') return item
        const ticks = clampStepTicks(value)
        const steps = item.steps.map((step, index) =>
          index === stepIndex ? { ...step, ticks } : step,
        )
        return { ...item, steps }
      }),
    )
  }

  const addStep = (caseIndex: number) => {
    if (!ports) return
    setReport(null)
    setCases((current) =>
      current.map((item, position) =>
        position === caseIndex && item.mode === 'sequential'
          ? { ...item, steps: [...item.steps, createStep(ports)] }
          : item,
      ),
    )
  }

  const removeStep = (caseIndex: number, stepIndex: number) => {
    setReport(null)
    setCases((current) =>
      current.map((item, position) =>
        position === caseIndex &&
        item.mode === 'sequential' &&
        item.steps.length > 1
          ? {
              ...item,
              steps: item.steps.filter((_, index) => index !== stepIndex),
            }
          : item,
      ),
    )
  }

  const startNew = () => {
    setSavedTestbenchId(null)
    setTestbenchName('')
    setCases([])
    setReport(null)
    setStorageMessage(null)
    setError(null)
  }

  const handleSave = async () => {
    if (!project || cases.length === 0 || savedTestbenches.unavailable) return
    setError(null)
    try {
      const document = toTestbenchDocument(
        testbenchName || `Testes de ${project.name}`,
        cases,
      )
      const input = { name: document.name, document }
      if (savedTestbenchId === null) {
        const id = await savedTestbenches.save(input)
        setSavedTestbenchId(id)
      } else {
        await savedTestbenches.update(savedTestbenchId, input)
      }
      setTestbenchName(document.name)
      setStorageMessage('Testbench salvo neste navegador.')
    } catch (cause) {
      setStorageMessage(null)
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível salvar o testbench.',
      )
    }
  }

  const handleLoad = (id: number) => {
    const saved = savedTestbenches.projects.find((item) => item.id === id)
    if (!saved) return
    setSavedTestbenchId(saved.id)
    setTestbenchName(saved.name)
    setCases(draftCasesFromDocument(saved.document))
    setReport(null)
    setError(null)
    setStorageMessage(`Testbench “${saved.name}” carregado.`)
  }

  const handleRemove = async (id: number) => {
    setError(null)
    try {
      await savedTestbenches.remove(id)
      if (savedTestbenchId === id) startNew()
      else setStorageMessage('Testbench removido deste navegador.')
    } catch (cause) {
      setStorageMessage(null)
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível remover o testbench.',
      )
    }
  }

  const handleImport = async (file: File) => {
    setError(null)
    try {
      const count = await savedTestbenches.importFile(await file.text())
      setStorageMessage(
        `${count} testbench${count === 1 ? '' : 's'} importado${count === 1 ? '' : 's'}.`,
      )
    } catch (cause) {
      setStorageMessage(null)
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível importar o testbench.',
      )
    }
  }

  const handleExport = () => {
    if (!project || savedTestbenches.projects.length === 0) return
    download(
      'testbenches.veritas-testbench',
      new Blob(
        [serializeTestbenchProjects(savedTestbenches.projects, project.name)],
        {
          type: 'application/json',
        },
      ),
    )
    setStorageMessage('Testbenches exportados para este dispositivo.')
  }

  const handleRun = () => {
    if (!project || cases.length === 0) return
    setError(null)
    try {
      setReport(
        runTestbench(
          project.document,
          toTestbenchDocument(
            testbenchName || `Testes de ${project.name}`,
            cases,
          ),
          { customChips: chipEntries },
        ),
      )
    } catch (cause) {
      setReport(null)
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível rodar os testes.',
      )
    }
  }

  return (
    <section className="card p-4 sm:p-6" aria-labelledby="testbench-title">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <ClipboardCheck
          size={18}
          className="text-brand-500"
          aria-hidden="true"
        />
        <h2
          id="testbench-title"
          className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
        >
          Testes do circuito
        </h2>
      </header>

      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Declare o que o circuito deveria fazer. Use vetores para lógica
        combinacional ou um roteiro de passos para circuitos com clock, estado e
        atraso; o Veritas roda todos e mostra quais não bateram.
      </p>

      {unavailable ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {unavailable}
        </p>
      ) : !ready ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Carregando circuitos salvos…
        </p>
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

          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <label className="min-w-56 flex-1 text-xs text-slate-500 dark:text-slate-400">
              Nome do testbench
              <input
                value={testbenchName}
                onChange={(event) => setTestbenchName(event.target.value)}
                placeholder={
                  project ? `Testes de ${project.name}` : 'Nome do testbench'
                }
                disabled={!project || Boolean(savedTestbenches.unavailable)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                aria-label="Nome do testbench"
              />
            </label>
            <button
              type="button"
              className="key"
              disabled={!project}
              onClick={startNew}
            >
              Novo
            </button>
            <button
              type="button"
              className="key gap-2"
              disabled={
                cases.length === 0 || Boolean(savedTestbenches.unavailable)
              }
              onClick={() => void handleSave()}
            >
              {savedTestbenchId === null ? 'Salvar' : 'Atualizar'}
            </button>
            <button
              type="button"
              className="key gap-2"
              disabled={savedTestbenches.projects.length === 0}
              onClick={handleExport}
            >
              Exportar
            </button>
            <button
              type="button"
              className="key gap-2"
              disabled={!project || Boolean(savedTestbenches.unavailable)}
              onClick={() => testbenchFileInput.current?.click()}
            >
              Importar
            </button>
            <input
              ref={testbenchFileInput}
              type="file"
              accept=".veritas-testbench,application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleImport(file)
                event.target.value = ''
              }}
            />
          </div>

          {savedTestbenches.unavailable ? (
            <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
              {savedTestbenches.unavailable}
            </p>
          ) : null}
          {savedTestbenches.error ? (
            <p
              role="alert"
              className="mt-3 text-sm text-rose-600 dark:text-rose-400"
            >
              {savedTestbenches.error}
            </p>
          ) : null}
          {savedTestbenches.projects.length > 0 ? (
            <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                Testbenches salvos neste circuito
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {savedTestbenches.projects.map((saved) => (
                  <li key={saved.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      className={`chip-tag max-w-64 truncate ${savedTestbenchId === saved.id ? 'border-brand-400 text-brand-600 dark:text-brand-300' : ''}`}
                      aria-pressed={savedTestbenchId === saved.id}
                      onClick={() => handleLoad(saved.id)}
                    >
                      {saved.name}
                    </button>
                    <button
                      type="button"
                      className="key h-7 px-2 hover:border-rose-400 hover:text-rose-600"
                      aria-label={`Excluir testbench ${saved.name}`}
                      onClick={() => void handleRemove(saved.id)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {storageMessage ? (
            <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
              {storageMessage}
            </p>
          ) : null}

          {ports && ports.outputs.length === 0 ? (
            <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
              Este circuito não tem saídas, então não há o que conferir.
            </p>
          ) : ports ? (
            <>
              {cases.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  Nenhum caso ainda. Adicione um vetor combinacional ou um
                  roteiro sequencial.
                </p>
              ) : null}

              {combinationalCases.length > 0 ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">
                      Casos combinacionais: entradas aplicadas e saídas
                      esperadas
                    </caption>
                    <thead>
                      <tr className="text-xs text-slate-500 uppercase dark:text-slate-400">
                        <th scope="col" className="py-2 pr-3">
                          Caso
                        </th>
                        {ports.inputs.map((name) => (
                          <th
                            key={`in-${name}`}
                            scope="col"
                            className="py-2 pr-3"
                          >
                            {name}
                          </th>
                        ))}
                        {ports.outputs.map((name) => (
                          <th
                            key={`out-${name}`}
                            scope="col"
                            className="py-2 pr-3 text-brand-600 dark:text-brand-400"
                          >
                            {name}{' '}
                            <span className="font-normal normal-case">
                              esperado
                            </span>
                          </th>
                        ))}
                        <th scope="col" className="py-2">
                          Resultado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {combinationalCases.map(({ item, index }) => {
                        const result = report?.cases[index]
                        return (
                          <tr
                            key={index}
                            className="border-t border-slate-200 dark:border-slate-700"
                          >
                            <th
                              scope="row"
                              className="py-2 pr-3 font-medium text-slate-500 dark:text-slate-400"
                            >
                              #{index + 1}
                            </th>

                            {ports.inputs.map((name) => (
                              <td key={`in-${name}`} className="py-2 pr-3">
                                <BitButton
                                  value={item.inputs[name] ?? false}
                                  onClick={() => toggle(index, name)}
                                  label={`Entrada ${name} do caso ${index + 1}`}
                                />
                              </td>
                            ))}

                            {ports.outputs.map((name) => {
                              const mismatch = result?.mismatches.find(
                                (entry) => entry.output === name,
                              )
                              return (
                                <td key={`out-${name}`} className="py-2 pr-3">
                                  <span className="flex items-center gap-1">
                                    <BitButton
                                      value={item.expect[name] ?? false}
                                      onClick={() =>
                                        toggleExpectedOutput(index, name)
                                      }
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
                              <CaseResultBadge result={result} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {sequentialCases.length > 0 ? (
                <div className="mt-5 space-y-3">
                  <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    Roteiros sequenciais
                  </h3>
                  {sequentialCases.map(({ item, index }) => {
                    const result = report?.cases[index]
                    return (
                      <article
                        key={index}
                        className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                        aria-labelledby={`sequential-case-${index}`}
                      >
                        <header className="flex flex-wrap items-center justify-between gap-2">
                          <h4
                            id={`sequential-case-${index}`}
                            className="text-sm font-medium text-slate-700 dark:text-slate-200"
                          >
                            #{index + 1} · roteiro sequencial
                          </h4>
                          <CaseResultBadge result={result} />
                        </header>
                        {result?.diagnostic ? (
                          <DiagnosticStatus diagnostic={result.diagnostic} />
                        ) : null}

                        <ol className="mt-3 space-y-2">
                          {item.steps.map((step, stepIndex) => {
                            const mismatches =
                              result?.mismatches.filter(
                                (entry) => entry.step === stepIndex,
                              ) ?? []
                            return (
                              <li
                                key={stepIndex}
                                className="rounded-lg border border-slate-100 p-3 dark:border-slate-800"
                              >
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                                    Passo {stepIndex + 1}
                                  </span>

                                  {ports.inputs.map((name) => (
                                    <span
                                      key={name}
                                      className="flex items-center gap-1"
                                    >
                                      <span className="text-xs text-slate-500 dark:text-slate-400">
                                        {name}
                                      </span>
                                      <StepValueButton
                                        value={
                                          name in step.set
                                            ? step.set[name]
                                            : undefined
                                        }
                                        onClick={() =>
                                          cycleStepInput(index, stepIndex, name)
                                        }
                                        label={`Entrada ${name} no passo ${stepIndex + 1}`}
                                      />
                                    </span>
                                  ))}

                                  {ports.outputs.map((name) => {
                                    const mismatch = mismatches.find(
                                      (entry) => entry.output === name,
                                    )
                                    return (
                                      <span
                                        key={name}
                                        className="flex items-center gap-1"
                                      >
                                        <span className="text-xs text-brand-600 dark:text-brand-400">
                                          {name}
                                        </span>
                                        <BitButton
                                          value={step.expect[name] ?? false}
                                          onClick={() =>
                                            toggleStepExpectedOutput(
                                              index,
                                              stepIndex,
                                              name,
                                            )
                                          }
                                          label={`Saída esperada ${name} no passo ${stepIndex + 1}`}
                                        />
                                        {mismatch ? (
                                          <span className="font-mono text-xs text-rose-600 dark:text-rose-400">
                                            obtido {mismatch.actual ? '1' : '0'}
                                          </span>
                                        ) : null}
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
                                        updateStepTicks(
                                          index,
                                          stepIndex,
                                          event.target.value,
                                        )
                                      }
                                      className="w-16 rounded-lg border border-slate-200 bg-transparent px-2 py-1 text-sm dark:border-slate-700"
                                      aria-label={`Tiques do passo ${stepIndex + 1}`}
                                    />
                                  </label>

                                  <button
                                    type="button"
                                    className="key h-8 px-2"
                                    disabled={item.steps.length === 1}
                                    onClick={() => removeStep(index, stepIndex)}
                                    aria-label={`Remover o passo ${stepIndex + 1} do caso ${index + 1}`}
                                  >
                                    <Trash2 size={14} aria-hidden="true" />
                                  </button>
                                </div>
                                {mismatches.length > 0 ? (
                                  <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                                    Divergências neste passo:{' '}
                                    {mismatches
                                      .map((entry) => entry.output)
                                      .join(', ')}
                                    .
                                  </p>
                                ) : null}
                              </li>
                            )
                          })}
                        </ol>

                        <button
                          type="button"
                          className="key mt-2 gap-2 text-xs"
                          onClick={() => addStep(index)}
                        >
                          <Plus size={14} aria-hidden="true" />
                          Adicionar passo
                        </button>
                      </article>
                    )
                  })}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="key gap-2 text-xs"
                  onClick={addCase}
                >
                  <Plus size={14} aria-hidden="true" />
                  Adicionar caso combinacional
                </button>
                <button
                  type="button"
                  className="key gap-2 text-xs"
                  onClick={addSequentialCase}
                >
                  <Plus size={14} aria-hidden="true" />
                  Adicionar caso sequencial
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
                <p
                  role="alert"
                  className="mt-4 text-sm text-rose-600 dark:text-rose-400"
                >
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

function BitButton({
  value,
  onClick,
  label,
}: {
  value: boolean
  onClick: () => void
  label: string
}) {
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

function StepValueButton({
  value,
  onClick,
  label,
}: {
  value: boolean | undefined
  onClick: () => void
  label: string
}) {
  const display = value === undefined ? '—' : value ? '1' : '0'
  return (
    <button
      type="button"
      className="chip-tag w-8 justify-center font-mono"
      onClick={onClick}
      aria-label={`${label}: ${value === undefined ? 'mantém' : value ? 1 : 0}`}
    >
      {display}
    </button>
  )
}

function CaseResultBadge({ result }: { result: CaseResult | undefined }) {
  if (!result)
    return <span className="text-slate-400 dark:text-slate-500">—</span>
  return result.status === 'passed' ? (
    <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 size={14} aria-hidden="true" /> passou
    </span>
  ) : (
    <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400">
      <XCircle size={14} aria-hidden="true" /> falhou
    </span>
  )
}

function DiagnosticStatus({
  diagnostic,
}: {
  diagnostic: NonNullable<CaseResult['diagnostic']>
}) {
  const warning = diagnostic.status !== 'stabilized'
  return (
    <p
      role="status"
      className={
        `mt-2 text-xs ${warning ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`
      }
    >
      {formatDiagnostic(diagnostic)}
    </p>
  )
}

function ObservationSummary({ report }: { report: TestbenchReport }) {
  if (!report.firstDivergence) {
    return (
      <p className="mt-3 text-xs text-slate-600 dark:text-slate-300" role="status">
        Snapshots observados: {report.snapshots.length}.
      </p>
    )
  }

  const divergence = report.firstDivergence
  const expected = divergence.vector?.expected ?? (divergence.expected === undefined ? '—' : divergence.expected ? '1' : '0')
  const actual = divergence.vector?.actual ?? (divergence.actual === undefined ? '—' : divergence.actual ? '1' : '0')
  return (
    <div className="mt-3 rounded-lg border border-rose-200 bg-white/60 p-3 text-xs text-rose-800 dark:border-rose-800 dark:bg-slate-950/20 dark:text-rose-200" role="status">
      <p>
        Snapshots observados: {report.snapshots.length}. Primeiro sinal divergente:{' '}
        <strong>{divergence.signal}</strong> no tique {divergence.tick}
        {divergence.step === undefined ? '' : `, passo ${divergence.step + 1}`}
        {' '}({expected} esperado, {actual} obtido).
      </p>
    </div>
  )
}

function DiagnosticSummary({ report }: { report: TestbenchReport }) {
  const diagnostics = report.cases.filter((item) => item.diagnostic && item.diagnostic.status !== 'stabilized')
  if (diagnostics.length === 0) return null
  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30" role="status">
      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
        Diagnóstico bounded: {diagnostics.length} caso(s) não estabilizaram na janela de diagnóstico.
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-800 dark:text-amber-300">
        {diagnostics.map((item) => (
          <li key={item.index}>
            {item.name}: {formatDiagnostic(item.diagnostic!)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatDiagnostic(diagnostic: NonNullable<CaseResult['diagnostic']>): string {
  if (diagnostic.status === 'stabilized') {
    return `Diagnóstico: estabilizado após ${diagnostic.ticksExecuted} tique(s).`
  }
  if (diagnostic.status === 'cycle-detected') {
    const cycle = diagnostic.cyclePeriod === undefined
      ? 'período desconhecido'
      : `período ${diagnostic.cyclePeriod}`
    const start = diagnostic.cycleStartTick === undefined
      ? 'início desconhecido'
      : `início no tique ${diagnostic.cycleStartTick}`
    return `Diagnóstico: ciclo detectado (${start}, ${cycle}; ${diagnostic.ticksExecuted} tique(s) observados).`
  }
  return `Diagnóstico: budget esgotado após ${diagnostic.ticksExecuted} tique(s), sem estabilização observada.`
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
            <li key={`${issue.code}-${issue.caseIndex ?? 'geral'}`}>
              {issue.message}
            </li>
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
          O circuito satisfez todos os casos que você escreveu. Isso cobre esses
          casos — para uma prova sobre todas as combinações possíveis, use a
          equivalência entre circuitos.
        </p>
        <ObservationSummary report={report} />
        <DiagnosticSummary report={report} />
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
        As linhas e passos marcados mostram, ao lado da saída esperada, o valor
        que o circuito realmente produziu.
      </p>
      <ObservationSummary report={report} />
      <DiagnosticSummary report={report} />
    </div>
  )
}

function readPorts(document: CircuitDocument): DraftPortNames {
  const identity = collectCircuitPorts(document)
  return {
    inputs: identity.inputs.map((port) => port.name),
    outputs: identity.outputs.map((port) => port.name),
  }
}
