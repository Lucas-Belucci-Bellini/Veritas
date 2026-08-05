import { useEffect, useMemo, useState } from 'react'
import { Moon, Sun, X } from 'lucide-react'
import {
  analyzeExpression,
  formatValue,
  type OutputFormat,
} from './lib/truthTable'

const KEYBOARD_ROWS = [
  { label: 'Variáveis', keys: ['A', 'B', 'C', 'P', 'Q', 'R'] },
  { label: 'Operadores', keys: ['NOT ', ' AND ', ' OR ', ' XOR '] },
  { label: 'Avançados', keys: [' IMPLIES ', ' EQUIV '] },
  { label: 'Agrupamento', keys: ['(', ')'] },
  { label: 'Constantes', keys: ['TRUE', 'FALSE'] },
] as const

function useDarkMode() {
  const [dark, setDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return { dark, toggle: () => setDark((value) => !value) }
}

function App() {
  const [expression, setExpression] = useState('(A AND B) OR NOT C')
  const [format, setFormat] = useState<OutputFormat>('vf')
  const { dark, toggle: toggleDark } = useDarkMode()

  const analysis = useMemo(
    () => analyzeExpression(expression, format),
    [expression, format],
  )

  const insertAtCursor = (value: string) => {
    setExpression((current) => current + value)
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Veritas</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Calculadora de tabela verdade
            </p>
          </div>
          <button
            type="button"
            onClick={toggleDark}
            className="rounded-lg border border-zinc-200 p-2 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            aria-label="Alternar tema"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <section className="space-y-3">
          <label htmlFor="expression" className="text-sm font-medium">
            Expressão lógica
          </label>
          <div className="relative">
            <input
              id="expression"
              type="text"
              value={expression}
              onChange={(event) => setExpression(event.target.value)}
              placeholder="Ex: (A AND B) OR NOT C"
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 pr-12 font-mono text-lg shadow-sm outline-none ring-violet-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
              spellCheck={false}
            />
            {expression && (
              <button
                type="button"
                onClick={() => setExpression('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Limpar expressão"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <p
            className={`text-sm ${
              analysis.ok
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {analysis.ok
              ? `Expressão válida${analysis.variables.length ? ` · ${analysis.variables.length} variável(is)` : ''}`
              : analysis.message}
          </p>
        </section>

        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-medium">Teclado virtual</h2>
          <div className="space-y-3">
            {KEYBOARD_ROWS.map((row) => (
              <div key={row.label} className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  {row.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {row.keys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => insertAtCursor(key)}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm hover:bg-violet-50 hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-violet-950 dark:hover:border-violet-700"
                    >
                      {key.trim()}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center gap-3">
          <span className="text-sm font-medium">Formato:</span>
          <button
            type="button"
            onClick={() => setFormat('vf')}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              format === 'vf'
                ? 'bg-violet-600 text-white'
                : 'border border-zinc-200 dark:border-zinc-700'
            }`}
          >
            V / F
          </button>
          <button
            type="button"
            onClick={() => setFormat('binary')}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              format === 'binary'
                ? 'bg-violet-600 text-white'
                : 'border border-zinc-200 dark:border-zinc-700'
            }`}
          >
            1 / 0
          </button>
        </section>

        {analysis.ok && (
          <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {analysis.truncated && (
              <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Tabela grande — exibindo apenas as primeiras {analysis.rowCount}{' '}
                linhas.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800">
                  <tr>
                    {analysis.variables.map((variable) => (
                      <th
                        key={variable}
                        className="border-b border-zinc-200 px-4 py-3 text-left font-semibold dark:border-zinc-700"
                      >
                        {variable}
                      </th>
                    ))}
                    <th className="border-b border-l-2 border-violet-400 bg-violet-50 px-4 py-3 text-left font-semibold dark:border-violet-600 dark:bg-violet-950/40">
                      Resultado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.rows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className={
                        rowIndex % 2 === 0
                          ? 'bg-white dark:bg-zinc-900'
                          : 'bg-zinc-50 dark:bg-zinc-950/50'
                      }
                    >
                      {row.slice(0, -1).map((value, colIndex) => (
                        <td
                          key={colIndex}
                          className="border-b border-zinc-100 px-4 py-2 font-mono dark:border-zinc-800"
                        >
                          {formatValue(value, format)}
                        </td>
                      ))}
                      <td className="border-b border-l-2 border-violet-300 bg-violet-50/60 px-4 py-2 font-mono font-semibold dark:border-violet-700 dark:bg-violet-950/30">
                        {formatValue(row[row.length - 1], format)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
