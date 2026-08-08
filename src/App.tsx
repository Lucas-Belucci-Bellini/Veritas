import { useEffect, useMemo, useRef, useState } from 'react'
import { Code2, Moon, Sun } from 'lucide-react'
import {
  assignmentForRow,
  buildTruthTable,
  formatAst,
  tryParse,
  type Notation,
  type TruthTable,
} from './engine'
import { ChipLibrary } from './components/ChipLibrary'
import { CircuitView } from './components/CircuitView'
import { SegmentedControl, Toggle } from './components/Controls'
import { ExportBar } from './components/ExportBar'
import { ExpressionInput } from './components/ExpressionInput'
import { TruthTableView } from './components/TruthTableView'
import { VirtualKeyboard } from './components/VirtualKeyboard'
import { useTheme } from './hooks/useTheme'
import { expressionFromUrl, syncUrl } from './lib/url'
import type { ValueStyle } from './lib/values'

const EXAMPLES = [
  '(A AND B) OR NOT C',
  'A -> B',
  'NOT (A OR B) <-> (NOT A AND NOT B)',
  'A XOR B XOR C',
  '(P AND Q) OR (P AND NOT Q)',
]

const NOTATIONS: ReadonlyArray<{ value: Notation; label: string; title: string }> = [
  { value: 'math', label: '∧ ∨ ¬', title: 'Notação matemática' },
  { value: 'programming', label: '&& || !', title: 'Notação de programação' },
  { value: 'text', label: 'AND OR', title: 'Notação textual' },
]

export default function App() {
  const [expression, setExpression] = useState(
    () => expressionFromUrl() ?? '(A AND B) OR NOT C',
  )
  const [notation, setNotation] = useState<Notation>('math')
  const [valueStyle, setValueStyle] = useState<ValueStyle>('vf')
  const [showSteps, setShowSteps] = useState(true)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const [theme, toggleTheme] = useTheme()
  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => tryParse(expression), [expression])

  const table = useMemo<TruthTable | null>(() => {
    if (!parsed.ok) return null
    try {
      return buildTruthTable(parsed.ast, { includeSteps: showSteps, notation })
    } catch {
      return null
    }
  }, [parsed, showSteps, notation])

  useEffect(() => {
    syncUrl(expression)
  }, [expression])

  // Trocar de expressão invalida a linha destacada no circuito.
  useEffect(() => {
    setSelectedRow(null)
  }, [expression])

  const assignment = useMemo(() => {
    if (!table || selectedRow === null) return null
    return assignmentForRow(table.variables, selectedRow)
  }, [table, selectedRow])

  const insert = (text: string) => {
    const input = inputRef.current
    if (!input) {
      setExpression((current) => current + text)
      return
    }
    const start = input.selectionStart ?? expression.length
    const end = input.selectionEnd ?? start
    setExpression(expression.slice(0, start) + text + expression.slice(end))
    requestAnimationFrame(() => {
      input.focus()
      const caret = start + text.length
      input.setSelectionRange(caret, caret)
    })
  }

  const backspace = () => {
    const input = inputRef.current
    if (!input) {
      setExpression((current) => current.slice(0, -1))
      return
    }
    const start = input.selectionStart ?? expression.length
    const end = input.selectionEnd ?? start
    const from = start === end ? Math.max(0, start - 1) : start
    setExpression(expression.slice(0, from) + expression.slice(end))
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(from, from)
    })
  }

  /** Ao trocar de notação, reescrevemos a expressão em vez de só trocar os botões. */
  const changeNotation = (next: Notation) => {
    setNotation(next)
    if (parsed.ok) setExpression(formatAst(parsed.ast, next))
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="border-b border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 font-mono text-lg font-black text-white">
              V
            </span>
            <div>
              <h1 className="text-lg leading-tight font-bold">Veritas</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tabelas verdade e circuitos lógicos, direto no navegador
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/Lucas-Belucci-Bellini/Veritas"
              target="_blank"
              rel="noreferrer"
              className="key"
              aria-label="Repositório no GitHub"
            >
              <Code2 size={18} />
            </a>
            <button
              type="button"
              onClick={toggleTheme}
              className="key"
              aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <section className="card p-4 sm:p-6">
          <ExpressionInput
            value={expression}
            onChange={setExpression}
            inputRef={inputRef}
            error={parsed.ok ? null : parsed.error}
            summary={
              table
                ? `${table.variables.length} variáveis, ${table.totalRows} linhas`
                : null
            }
          />

          <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">
            <VirtualKeyboard
              notation={notation}
              onInsert={insert}
              onBackspace={backspace}
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
              Exemplos
            </span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setExpression(example)}
                className="expr rounded-full border border-slate-200 px-3 py-1 font-mono text-xs text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-brand-300"
              >
                {example}
              </button>
            ))}
          </div>
        </section>

        <section className="card flex flex-wrap items-end justify-between gap-6 p-4 sm:p-6">
          <SegmentedControl
            label="Notação"
            value={notation}
            options={NOTATIONS}
            onChange={changeNotation}
          />
          <SegmentedControl
            label="Valores"
            value={valueStyle}
            options={[
              { value: 'vf', label: 'V / F' },
              { value: 'binary', label: '1 / 0' },
            ]}
            onChange={setValueStyle}
          />
          <Toggle
            label="Passos intermediários"
            description="Mostra uma coluna por subexpressão"
            checked={showSteps}
            onChange={setShowSteps}
          />
          {table && (
            <ExportBar
              table={table}
              expression={expression}
              style={valueStyle}
              theme={theme}
            />
          )}
        </section>

        {table && parsed.ok ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="card p-4 sm:p-6">
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
                Tabela verdade
              </h2>
              <TruthTableView
                table={table}
                style={valueStyle}
                selectedRow={selectedRow}
                onSelectRow={setSelectedRow}
              />
            </section>

            <section className="card p-4 sm:p-6">
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
                Circuito equivalente
              </h2>
              <CircuitView
                ast={parsed.ast}
                notation={notation}
                assignment={assignment}
              />
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                {selectedRow === null
                  ? 'Nenhuma linha selecionada — o circuito está desligado.'
                  : `Linha ${selectedRow + 1} da tabela ligada no circuito.`}
              </p>
            </section>
          </div>
        ) : (
          <section className="card p-10 text-center text-slate-400 dark:text-slate-500">
            Corrija a expressão para ver a tabela e o circuito.
          </section>
        )}

        <ChipLibrary onUseExpression={setExpression} />
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-center text-xs text-slate-400 dark:text-slate-600">
        Veritas — tudo roda no seu navegador, nenhuma expressão sai do seu
        computador.
      </footer>
    </div>
  )
}
