interface CircuitPickerProps {
  id: string
  label: string
  value: number | ''
  onChange: (value: number | '') => void
  projects: readonly { id: number; name: string }[]
}

/** Seletor de um circuito salvo, compartilhado pelos painéis de verificação. */
export function CircuitPicker({ id, label, value, onChange, projects }: CircuitPickerProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <select
        id={id}
        className="rounded-lg border border-slate-200 bg-transparent px-2 py-2 text-sm dark:border-slate-700"
        value={value}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : '')}
      >
        <option value="">Selecione…</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  )
}
