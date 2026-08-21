import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Code2, Moon, Sun } from 'lucide-react'
import {
  assignmentForRow,
  buildKarnaughMap,
  buildNormalForms,
  buildTruthTable,
  classifyForm,
  formatAst,
  simplify,
  tryParse,
  type Notation,
  type TruthTable,
} from './engine'
import { ChipLibrary } from './components/ChipLibrary'
import { SegmentedControl, Toggle } from './components/Controls'
import { ExportBar } from './components/ExportBar'
import { ExpressionInput } from './components/ExpressionInput'
import { KarnaughMapView } from './components/KarnaughMapView'
import { ProjectsPanel } from './components/ProjectsPanel'
import { NormalFormsPanel } from './components/NormalFormsPanel'
import { PwaStatus } from './components/PwaStatus'
import { TruthTableView } from './components/TruthTableView'
import { VirtualKeyboard } from './components/VirtualKeyboard'
import { useTheme } from './hooks/useTheme'
import { AuthProvider } from './auth/AuthProvider'
import { AuthPanel } from './components/AuthPanel'
import { AlgorithmWorkspace } from './components/AlgorithmWorkspace'
import { LogicCaseLab } from './components/LogicCaseLab'
import { SequentialWorkspace } from './components/SequentialWorkspace'
import { createImplicationExample } from './algorithms'

// O React Flow e o Dagre pesam mais que todo o resto do aplicativo somado, e
// só fazem falta quando já existe uma expressão válida na tela.
const CircuitView = lazy(() =>
  import('./components/CircuitView').then((module) => ({ default: module.CircuitView })),
)
const CircuitEditor = lazy(() =>
  import('./components/CircuitEditor').then((module) => ({ default: module.CircuitEditor })),
)
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

function AppContent() {
  const [expression, setExpression] = useState(
    () => expressionFromUrl() ?? '(A AND B) OR NOT C',
  )
  const [notation, setNotation] = useState<Notation>('math')
  const [valueStyle, setValueStyle] = useState<ValueStyle>('vf')
  const [showSteps, setShowSteps] = useState(true)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const [theme, toggleTheme] = useTheme()
  const inputRef = useRef<HTMLInputElement>(null)
  const algorithmExample = useMemo(() => createImplicationExample(), [])

  const parsed = useMemo(() => tryParse(expression), [expression])

  const table = useMemo<TruthTable | null>(() => {
    if (!parsed.ok) return null
    try {
      return buildTruthTable(parsed.ast, { includeSteps: showSteps, notation })
    } catch {
      return null
    }
  }, [parsed, showSteps, notation])

  const analysis = useMemo(() => {
    if (!parsed.ok) {
      return { simplification: null, karnaugh: null, forms: null, form: 'nenhuma' as const }
    }
    try {
      return {
        simplification: simplify(parsed.ast, notation),
        karnaugh: buildKarnaughMap(parsed.ast, notation),
        forms: buildNormalForms(parsed.ast, notation),
        form: classifyForm(parsed.ast),
      }
    } catch {
      return { simplification: null, karnaugh: null, forms: null, form: 'nenhuma' as const }
    }
  }, [parsed, notation])

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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Pular para o conteúdo principal
      </a>
      <header className="border-b border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 font-mono text-lg font-black text-white">
              V
            </span>
            <div>
              <h1 id="app-title" className="text-lg leading-tight font-bold">Veritas</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tabelas verdade e circuitos lógicos, direto no navegador
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AuthPanel />
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

      <main id="main-content" tabIndex={-1} aria-labelledby="app-title" className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
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
              <Suspense
                fallback={
                  <div className="grid h-96 w-full place-items-center rounded-xl border border-slate-200 text-sm text-slate-400 dark:border-slate-800">
                    Montando o circuito…
                  </div>
                }
              >
                <CircuitView
                  ast={parsed.ast}
                  notation={notation}
                  assignment={assignment}
                />
              </Suspense>
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

        {table && parsed.ok && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="card p-4 sm:p-6">
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
                Formas normais
              </h2>
              <NormalFormsPanel
                current={table.formula}
                form={analysis.form}
                forms={analysis.forms}
                simplification={analysis.simplification}
                onUse={setExpression}
              />
            </section>

            <section className="card p-4 sm:p-6">
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
                Mapa de Karnaugh
              </h2>
              {analysis.karnaugh ? (
                <KarnaughMapView map={analysis.karnaugh} style={valueStyle} />
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  O mapa cabe até 4 variáveis; acima disso a tabela é mais legível.
                </p>
              )}
            </section>
          </div>
        )}

        <section className="card space-y-5 p-4 sm:p-6">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase dark:text-brand-300">
              Workspace de algoritmos
            </p>
            <h2 className="mt-1 text-lg font-bold">ALGO-002 — lógica observável</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              O mesmo raciocínio dos exercícios didáticos aparece como entrada, branch, Watch e trace.
            </p>
          </div>
          <AlgorithmWorkspace document={algorithmExample} />
          <LogicCaseLab />
        </section>

        <section className="card space-y-5 p-4 sm:p-6">
          <SequentialWorkspace />
        </section>

        <Suspense
          fallback={
            <section className="card p-8 text-center text-sm text-slate-400 dark:text-slate-500">
              Carregando editor visual…
            </section>
          }
        >
          <CircuitEditor />
        </Suspense>

        <ProjectsPanel
          expression={expression}
          notation={notation}
          onOpen={(saved, savedNotation) => {
            setNotation(savedNotation)
            setExpression(saved)
          }}
        />

        <ChipLibrary onUseExpression={setExpression} />
      </main>

      <PwaStatus />

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-center text-xs text-slate-400 dark:text-slate-600">
        Veritas — tudo roda no seu navegador, nenhuma expressão sai do seu
        computador.
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
