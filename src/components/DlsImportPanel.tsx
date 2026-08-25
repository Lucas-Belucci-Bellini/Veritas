import { useRef, useState } from 'react'
import { FolderInput, Loader2 } from 'lucide-react'
import type { DlsImportRefusal, DlsImportReport } from '../circuit'
import { importDlsChipProjects } from '../storage/customChips'

interface DlsImportPanelProps {
  disabled?: boolean
  /** Chamado depois da importação para a biblioteca em tela recarregar. */
  onImported: () => Promise<void> | void
}

/** De quantos em quantos chips a barra de progresso se mexe. */
const PROGRESS_STRIDE = 20

/**
 * Traz os chips de um projeto do Digital Logic Sim para a biblioteca local.
 *
 * A leitura acontece no navegador, sobre os arquivos que o operador escolhe —
 * nada sai da máquina. Cada chip vira um documento de verdade, com os sub-chips
 * como instâncias, então a hierarquia que ele montou no DLS continua aberta
 * para inspecionar e editar aqui dentro.
 */
export function DlsImportPanel({ disabled = false, onImported }: DlsImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [report, setReport] = useState<DlsImportReport | null>(null)
  const [fileErrors, setFileErrors] = useState<DlsImportRefusal[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showRefusals, setShowRefusals] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    setError(null)
    setReport(null)
    setShowRefusals(false)
    setProgress({ done: 0, total: files.length })

    try {
      // Ler aqui, e não dentro do importador, é o que permite dizer *qual
      // arquivo* estava quebrado: o importador só conhece a posição na lista.
      const sources: unknown[] = []
      const broken: DlsImportRefusal[] = []
      for (const file of Array.from(files)) {
        try {
          sources.push(JSON.parse(await file.text()))
        } catch {
          broken.push({ name: file.name, reason: 'O arquivo não é um JSON válido.' })
        }
      }
      setFileErrors(broken)

      const result = await importDlsChipProjects(sources, ({ done, total }) => {
        if (done % PROGRESS_STRIDE === 0 || done === total) setProgress({ done, total })
      })
      setReport(result)
      await onImported()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível importar os chips.')
    } finally {
      setBusy(false)
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const refusals = [...fileErrors, ...(report?.refused ?? [])]

  return (
    <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <FolderInput size={13} aria-hidden="true" />
          Digital Logic Sim
        </span>
        <button
          type="button"
          className="shrink-0 text-[11px] text-brand-600 underline disabled:text-slate-400 dark:text-brand-300"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
        >
          {busy ? 'Importando…' : 'Escolher arquivos'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        multiple
        className="hidden"
        aria-label="Arquivos de chip do Digital Logic Sim"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-600">
        Selecione os arquivos da pasta <code className="font-mono">Chips</code> do projeto. Os chips
        entram com os sub-chips como instâncias, não achatados.
      </p>

      <p className="sr-only" role="status" aria-live="polite">
        {busy && progress ? `Importando chip ${progress.done} de ${progress.total}.` : ''}
      </p>

      {busy && progress && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <Loader2 size={12} className="animate-spin" aria-hidden="true" />
          {progress.done} de {progress.total}
        </p>
      )}

      {error && <p className="mt-2 text-[11px] text-rose-700 dark:text-rose-300">{error}</p>}

      {report && (
        <div className="mt-2 text-[11px]">
          <p className="text-slate-600 dark:text-slate-300">
            <strong>{report.imported.length}</strong> chip{report.imported.length === 1 ? '' : 's'} importado
            {report.imported.length === 1 ? '' : 's'}
            {report.reused.length > 0 && (
              <> · <strong>{report.reused.length}</strong> já estava{report.reused.length === 1 ? '' : 'm'} na biblioteca</>
            )}
            {refusals.length > 0 && <> · <strong>{refusals.length}</strong> recusado{refusals.length === 1 ? '' : 's'}</>}
          </p>

          {refusals.length > 0 && (
            <>
              <button
                type="button"
                className="mt-1 text-brand-600 underline dark:text-brand-300"
                onClick={() => setShowRefusals((current) => !current)}
                aria-expanded={showRefusals}
              >
                {showRefusals ? 'Ocultar' : 'Ver'} o que ficou de fora
              </button>
              {showRefusals && (
                <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-800">
                  {refusals.map((refusal) => (
                    <li key={`${refusal.name}:${refusal.reason}`} className="text-slate-500 dark:text-slate-400">
                      <strong className="text-slate-700 dark:text-slate-200">{refusal.name}</strong> — {refusal.reason}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
