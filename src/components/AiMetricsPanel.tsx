import { useAiMetrics } from '../hooks/useAiMetrics'

export function AiMetricsPanel() {
  const { events, summary, status, error, refresh } = useAiMetrics()
  const statusLabel = status === 'connected' ? 'ao vivo' : status === 'connecting' ? 'conectando…' : status === 'error' ? 'erro' : 'indisponível'

  return (
    <section className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50/60 p-3 dark:border-cyan-900/70 dark:bg-cyan-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-cyan-700 uppercase dark:text-cyan-300">Monitoramento da IA</h3>
          <p className="mt-1 text-xs text-cyan-800/80 dark:text-cyan-200/80">Performance e uso da análise do Veritas por usuário autenticado.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-cyan-700 dark:text-cyan-300">
          <span className={`h-2 w-2 rounded-full ${status === 'connected' ? 'bg-emerald-500' : status === 'error' ? 'bg-rose-500' : 'bg-amber-500'}`} />
          {statusLabel}
          <button type="button" className="ml-1 hover:underline" onClick={() => void refresh()}>Atualizar</button>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">{error}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Chamadas" value={String(summary.totalCalls)} />
        <Metric label="Sucesso" value={`${Math.round(summary.successRate * 100)}%`} />
        <Metric label="Latência média" value={`${Math.round(summary.averageLatencyMs)} ms`} />
        <Metric label="Confiança média" value={summary.averageConfidence > 0 ? `${Math.round(summary.averageConfidence * 100)}%` : '—'} />
      </div>

      <div className="mt-3 grid gap-2 text-xs text-cyan-900/80 sm:grid-cols-3 dark:text-cyan-100/80">
        <span>LLM: <strong>{summary.llmCalls}</strong></span>
        <span>Fallback heurístico: <strong>{summary.heuristicCalls}</strong></span>
        <span>Última chamada: <strong>{summary.lastCallAt ? formatDate(summary.lastCallAt) : '—'}</strong></span>
      </div>

      {events.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-cyan-200/70 bg-white/60 dark:border-cyan-900/60 dark:bg-slate-900/40">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-cyan-200/70 text-cyan-700 dark:border-cyan-900/60 dark:text-cyan-300">
              <tr><th className="px-2 py-2">Ação</th><th className="px-2 py-2">Provedor</th><th className="px-2 py-2">Latência</th><th className="px-2 py-2">Estado</th><th className="px-2 py-2">Quando</th></tr>
            </thead>
            <tbody>
              {events.slice(0, 8).map((event) => (
                <tr key={event.id} className="border-b border-cyan-100/70 last:border-0 dark:border-cyan-950/60">
                  <td className="px-2 py-2 font-semibold">{event.action === 'analyze' ? 'Análise' : 'Otimização'}</td>
                  <td className="px-2 py-2">{event.provider === 'llm' ? 'LLM' : event.provider === 'heuristic' ? 'Heurística' : '—'}</td>
                  <td className="px-2 py-2">{event.latencyMs} ms</td>
                  <td className={`px-2 py-2 ${event.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{event.success ? 'Sucesso' : 'Falha'}</td>
                  <td className="px-2 py-2 text-slate-500 dark:text-slate-400">{formatDate(event.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-cyan-200/70 bg-white/60 px-2 py-2 dark:border-cyan-900/60 dark:bg-slate-900/40"><span className="block text-[10px] uppercase text-cyan-700/70 dark:text-cyan-300/70">{label}</span><strong className="text-sm text-cyan-950 dark:text-cyan-50">{value}</strong></div>
}

function formatDate(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(timestamp)
}
