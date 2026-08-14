import type { RuntimeValue, VariableWatchEntry } from '../algorithms'

interface AlgorithmVariableWatchProps {
  entries: readonly VariableWatchEntry[]
  activeStep?: number
}

function formatValue(value: RuntimeValue): string {
  if (value === null) return '—'
  if (typeof value === 'boolean') return value ? 'verdadeiro' : 'falso'
  return String(value)
}

export function AlgorithmVariableWatch({
  entries,
  activeStep,
}: AlgorithmVariableWatchProps) {
  return (
    <section
      aria-labelledby="algorithm-variable-watch-title"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 id="algorithm-variable-watch-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Watch de variáveis
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Estado observável do último passo executado.
          </p>
        </div>
        {activeStep !== undefined && (
          <span className="font-mono text-xs text-brand-600 dark:text-brand-300">
            passo {activeStep}
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          Nenhuma variável foi declarada ainda.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <tr>
                <th className="px-2 py-2 font-semibold">Variável</th>
                <th className="px-2 py-2 font-semibold">Tipo</th>
                <th className="px-2 py-2 font-semibold">Atual</th>
                <th className="px-2 py-2 font-semibold">Anterior</th>
                <th className="px-2 py-2 font-semibold">Alterada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {entries.map((entry) => (
                <tr key={entry.name}>
                  <th className="px-2 py-2 font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {entry.name}
                  </th>
                  <td className="px-2 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {entry.type}
                  </td>
                  <td className="px-2 py-2 font-mono text-brand-700 dark:text-brand-300">
                    {formatValue(entry.value)}
                  </td>
                  <td className="px-2 py-2 font-mono text-slate-500 dark:text-slate-400">
                    {formatValue(entry.previousValue ?? null)}
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">
                    {entry.changedAtStep === null ? '—' : `passo ${entry.changedAtStep}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
