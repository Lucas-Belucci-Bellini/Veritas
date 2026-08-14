import type { BranchTraceEntry, RuntimeValue } from '../algorithms'

interface AlgorithmBranchTraceProps {
  entries: readonly BranchTraceEntry[]
  selectedNodeId?: string | null
  onSelectNode?: (nodeId: string) => void
}

function formatValue(value: RuntimeValue): string {
  if (value === null) return '—'
  if (typeof value === 'boolean') return value ? 'verdadeiro' : 'falso'
  return String(value)
}

export function AlgorithmBranchTrace({
  entries,
  selectedNodeId,
  onSelectNode,
}: AlgorithmBranchTraceProps) {
  return (
    <section
      aria-labelledby="algorithm-branch-trace-title"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-3">
        <h2 id="algorithm-branch-trace-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
          BranchTrace
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Decisões condicionais registradas durante o replay.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          Nenhuma condição foi avaliada ainda.
        </p>
      ) : (
        <ol className="space-y-2">
          {entries.map((entry, index) => {
            const isSelected = selectedNodeId === entry.nodeId
            return (
              <li key={`${entry.nodeId}-${entry.step}-${index}`}>
                <button
                  type="button"
                  onClick={() => onSelectNode?.(entry.nodeId)}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-950/40'
                      : 'border-slate-200 bg-slate-50 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      passo {entry.step} · nó {entry.nodeId}
                    </span>
                    <span
                      className={`font-mono text-xs font-bold uppercase ${
                        entry.result
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {entry.result ? 'verdadeiro' : 'falso'} · {entry.selectedBranch}
                    </span>
                  </div>
                  <code className="mt-2 block text-sm text-slate-900 dark:text-slate-100">
                    {entry.expression}
                  </code>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {Object.entries(entry.operands).map(([name, value]) => (
                      <span key={name} className="font-mono">
                        {name}={formatValue(value)}
                      </span>
                    ))}
                  </div>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
