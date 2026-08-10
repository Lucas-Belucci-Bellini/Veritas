import { useRef, useState } from 'react'
import { Check, Download, FolderOpen, Pencil, Save, Trash2, Upload } from 'lucide-react'
import type { Notation } from '../engine'
import { useProjects } from '../hooks/useProjects'
import { download } from '../lib/export'
import { serializeProjects } from '../storage/projects'

interface ProjectsPanelProps {
  expression: string
  notation: Notation
  onOpen: (expression: string, notation: Notation) => void
}

/**
 * Projetos salvos no próprio navegador (IndexedDB via Dexie).
 *
 * Nenhuma expressão sai da máquina do usuário — e é essa mesma base que faz o
 * aplicativo continuar inteiro quando a v0.5.0 rodar sem internet.
 */
export function ProjectsPanel({ expression, notation, onOpen }: ProjectsPanelProps) {
  const { projects, ready, unavailable, save, update, remove, importFile } =
    useProjects()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [draftName, setDraftName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const canSave = expression.trim().length > 0 && !unavailable

  const flash = (text: string) => {
    setMessage(text)
    window.setTimeout(() => setMessage(null), 3000)
  }

  const handleSave = async () => {
    if (!canSave) return
    await save({ name: name.trim() || expression.trim(), expression, notation })
    setName('')
    flash('Projeto salvo neste navegador.')
  }

  const handleImport = async (file: File) => {
    try {
      const count = await importFile(await file.text())
      flash(`${count} projeto${count === 1 ? '' : 's'} importado${count === 1 ? '' : 's'}.`)
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Não foi possível importar.')
    }
  }

  return (
    <section className="card p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FolderOpen size={18} className="text-brand-500" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Projetos salvos
          </h2>
          <span className="chip-tag">{projects.length}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="key gap-2"
            disabled={projects.length === 0}
            onClick={() =>
              download(
                'projetos.veritas',
                new Blob([serializeProjects(projects)], { type: 'application/json' }),
              )
            }
          >
            <Download size={16} />
            Exportar
          </button>
          <button
            type="button"
            className="key gap-2"
            disabled={Boolean(unavailable)}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={16} />
            Importar
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".veritas,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleImport(file)
              event.target.value = ''
            }}
          />
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void handleSave()}
          placeholder="Nome do projeto (opcional)"
          aria-label="Nome do projeto"
          disabled={Boolean(unavailable)}
          className="h-10 min-w-56 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
        />
        <button type="button" className="key gap-2" disabled={!canSave} onClick={handleSave}>
          <Save size={16} />
          Salvar expressão atual
        </button>
      </div>

      {message && (
        <p className="mt-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <Check size={15} />
          {message}
        </p>
      )}

      {unavailable ? (
        <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">{unavailable}</p>
      ) : !ready ? (
        <p className="mt-4 text-sm text-slate-400">Abrindo o banco local…</p>
      ) : projects.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">
          Nenhum projeto salvo ainda. Tudo fica só neste navegador.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
          {projects.map((project) => (
            <li key={project.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                {editing === project.id ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onBlur={() => setEditing(null)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setEditing(null)
                      if (event.key !== 'Enter') return
                      void update(project.id, { name: draftName })
                      setEditing(null)
                    }}
                    aria-label="Novo nome"
                    className="h-8 w-full rounded-md border border-brand-400 bg-white px-2 text-sm outline-none dark:bg-slate-900"
                  />
                ) : (
                  <p className="truncate text-sm font-medium">{project.name}</p>
                )}
                <p className="expr truncate font-mono text-xs text-slate-400 dark:text-slate-500">
                  {project.expression}
                </p>
              </div>

              <span className="hidden shrink-0 text-xs text-slate-400 sm:block dark:text-slate-600">
                {new Date(project.updatedAt).toLocaleDateString('pt-BR')}
              </span>

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="key h-8 px-2"
                  onClick={() => onOpen(project.expression, project.notation)}
                >
                  Abrir
                </button>
                <button
                  type="button"
                  className="key h-8 px-2"
                  aria-label={`Renomear ${project.name}`}
                  onClick={() => {
                    setEditing(project.id)
                    setDraftName(project.name)
                  }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="key h-8 px-2 hover:border-rose-400 hover:text-rose-600"
                  aria-label={`Excluir ${project.name}`}
                  onClick={() => void remove(project.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
