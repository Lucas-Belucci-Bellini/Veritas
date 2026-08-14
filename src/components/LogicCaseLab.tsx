import { useMemo, useState } from 'react'
import {
  evaluateLogicTestCase,
  LOGIC_TEST_CASES,
  type LogicEvaluationRow,
} from '../algorithms'

function formatBoolean(value: boolean | undefined): string {
  if (value === undefined) return '—'
  return value ? 'V' : 'F'
}

function rowMatchesAssignment(row: LogicEvaluationRow, assignment: Record<string, boolean>) {
  return Object.entries(assignment).every(([name, value]) => row.assignment[name] === value)
}

export function LogicCaseLab() {
  const [selectedId, setSelectedId] = useState(LOGIC_TEST_CASES[0].id)
  const [assignment, setAssignment] = useState<Record<string, boolean>>({ P: false, Q: false })
  const testCase = LOGIC_TEST_CASES.find((item) => item.id === selectedId) ?? LOGIC_TEST_CASES[0]
  const rows = useMemo(() => evaluateLogicTestCase(testCase), [testCase])
  const selectedRow = rows.find((row) => rowMatchesAssignment(row, assignment)) ?? rows[0]

  function selectCase(id: string) {
    const nextCase = LOGIC_TEST_CASES.find((item) => item.id === id) ?? LOGIC_TEST_CASES[0]
    setSelectedId(nextCase.id)
    setAssignment(Object.fromEntries(nextCase.variables.map((variable) => [variable, false])))
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label="Laboratório de lógica booleana">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase dark:text-brand-300">
            PDFs · caso interativo
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">Laboratório de lógica</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Alterne as premissas e observe o contraexemplo ou a equivalência.
          </p>
        </div>
        <label className="min-w-[260px]">
          <span className="mb-1 block text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">
            Caso didático
          </span>
          <select
            value={selectedId}
            onChange={(event) => selectCase(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
          >
            {LOGIC_TEST_CASES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.source} · {item.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
        {testCase.variables.map((variable) => (
          <button
            key={variable}
            type="button"
            role="switch"
            aria-checked={assignment[variable]}
            onClick={() => setAssignment((current) => ({ ...current, [variable]: !current[variable] }))}
            className={`rounded-lg px-4 py-2 font-mono text-sm font-bold ${
              assignment[variable]
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            {variable} = {assignment[variable] ? 'V' : 'F'}
          </button>
        ))}
        <span className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${
          selectedRow.passes
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
        }`}>
          {selectedRow.passes ? 'caso satisfeito' : 'contraexemplo'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <tr>
              {testCase.variables.map((variable) => <th key={variable} className="px-2 py-2">{variable}</th>)}
              {testCase.kind === 'equivalence' && <><th className="px-2 py-2">Expressão</th><th className="px-2 py-2">Equivalente</th></>}
              {testCase.kind !== 'equivalence' && <th className="px-2 py-2">Resultado</th>}
              {testCase.kind === 'argument' && <th className="px-2 py-2">Conclusão</th>}
              <th className="px-2 py-2">Teste</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => {
              const selected = rowMatchesAssignment(row, assignment)
              return (
                <tr key={JSON.stringify(row.assignment)} className={selected ? 'bg-brand-50 dark:bg-brand-950/30' : undefined}>
                  {testCase.variables.map((variable) => <td key={variable} className="px-2 py-2 font-mono">{formatBoolean(row.assignment[variable])}</td>)}
                  {testCase.kind === 'equivalence' && <><td className="px-2 py-2 font-mono">{formatBoolean(row.expressionValue)}</td><td className="px-2 py-2 font-mono">{formatBoolean(row.equivalentValue)}</td></>}
                  {testCase.kind !== 'equivalence' && <td className="px-2 py-2 font-mono">{formatBoolean(row.expressionValue ?? row.premiseValues?.every(Boolean))}</td>}
                  {testCase.kind === 'argument' && <td className="px-2 py-2 font-mono">{formatBoolean(row.conclusionValue)}</td>}
                  <td className={`px-2 py-2 font-semibold ${row.passes ? 'text-emerald-600' : 'text-rose-600'}`}>{row.passes ? 'passa' : 'falha'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
