import { useEffect, useMemo, useState } from 'react'
import { compareCircuitDocuments, summarizeCircuitDiff, type CircuitDiff } from '../cloud/circuitDiff'
import type { CloudCircuitVersion } from '../cloud/circuitVersions'

interface CircuitVersionHistoryProps {
  versions: CloudCircuitVersion[]
  loading: boolean
  onRefresh: () => void
  onOpenVersion: (version: CloudCircuitVersion) => void
}

export function CircuitVersionHistory({ versions, loading, onRefresh, onOpenVersion }: CircuitVersionHistoryProps) {
  const [beforeId, setBeforeId] = useState<string | null>(null)
  const [afterId, setAfterId] = useState<string | null>(null)

  useEffect(() => {
    setAfterId(versions[0]?.id ?? null)
    setBeforeId(versions[1]?.id ?? null)
  }, [versions])

  const before = versions.find((version) => version.id === beforeId) ?? null
  const after = versions.find((version) => version.id === afterId) ?? versions[0] ?? null
  const diff = useMemo<CircuitDiff | null>(() => {
    if (!after) return null
    return compareCircuitDocuments(before?.document ?? null, after.document)
  }, [after, before])

  if (versions.length === 0 && !loading) return null

  return (
    <section className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Histórico remoto</h3>
          <p className="mt-1 text-xs text-slate-400">Cada sincronização cria uma versão imutável e comparável.</p>
        </div>
        <button type="button" className="text-xs text-brand-700 hover:underline dark:text-brand-300" onClick={onRefresh} disabled={loading}>
          {loading ? 'Carregando…' : 'Atualizar histórico'}
        </button>
      </div>

      {versions.length > 0 && (
        <>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <VersionSelect label="Versão anterior" value={beforeId} versions={versions} onChange={setBeforeId} />
            <VersionSelect label="Versão atual" value={afterId} versions={versions} onChange={setAfterId} />
            {after && <button type="button" className="key text-xs" onClick={() => onOpenVersion(after)}>Abrir versão {after.versionNumber}</button>}
          </div>

          {diff && (
            <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-950/60">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{summarizeCircuitDiff(diff)}</p>
              <div className="mt-2 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4 dark:text-slate-400">
                <Metric label="Componentes" value={`${diff.totalNodesBefore} → ${diff.totalNodesAfter}`} />
                <Metric label="Conexões" value={`${diff.totalConnectionsBefore} → ${diff.totalConnectionsAfter}`} />
                <Metric label="Adicionados" value={`+${diff.nodesAdded} nós · +${diff.connectionsAdded} fios`} />
                <Metric label="Removidos" value={`−${diff.nodesRemoved} nós · −${diff.connectionsRemoved} fios`} />
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <ChangeList title="Nós adicionados" values={diff.addedNodeIds} tone="positive" />
                <ChangeList title="Nós removidos" values={diff.removedNodeIds} tone="negative" />
                <ChangeList title="Nós alterados" values={diff.changedNodeIds} tone="neutral" />
                <ChangeList title="Conexões alteradas" values={[...diff.addedConnections.map((value) => `+ ${value}`), ...diff.removedConnections.map((value) => `− ${value}`)]} tone="neutral" />
              </div>
            </div>
          )}

          <div className="mt-3 grid gap-1">
            {versions.map((version) => (
              <button key={version.id} type="button" className="flex items-center justify-between rounded-lg px-2 py-2 text-left text-xs transition hover:bg-slate-50 dark:hover:bg-slate-800/70" onClick={() => setAfterId(version.id)}>
                <span className="flex items-center gap-2"><strong>v{version.versionNumber}</strong><span className="text-slate-500 dark:text-slate-400">{version.name}</span></span>
                <span className="text-slate-400">{formatDate(version.createdAt)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function VersionSelect({ label, value, versions, onChange }: { label: string; value: string | null; versions: CloudCircuitVersion[]; onChange: (value: string | null) => void }) {
  return (
    <label className="grid gap-1 text-xs text-slate-500 dark:text-slate-400">
      {label}
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value || null)} className="rounded-lg border border-slate-200 bg-transparent px-2 py-2 text-xs dark:border-slate-700">
        <option value="">Nenhuma</option>
        {versions.map((version) => <option key={version.id} value={version.id}>v{version.versionNumber} — {formatDate(version.createdAt)}</option>)}
      </select>
    </label>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-[10px] uppercase">{label}</span><strong className="text-slate-700 dark:text-slate-200">{value}</strong></div>
}

function ChangeList({ title, values, tone }: { title: string; values: string[]; tone: 'positive' | 'negative' | 'neutral' }) {
  const color = tone === 'positive' ? 'text-emerald-700 dark:text-emerald-300' : tone === 'negative' ? 'text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-slate-300'
  return <div><h4 className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{title}</h4><p className={`mt-1 break-all text-xs ${color}`}>{values.length > 0 ? values.join(', ') : 'Nenhum'}</p></div>
}

function formatDate(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return 'data desconhecida'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(timestamp)
}
