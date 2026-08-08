import { useEffect, useMemo, useState } from 'react'
import { Cpu, Search } from 'lucide-react'
import { loadCatalog, type ChipCatalog, type ChipEntry } from '../chips/types'

interface ChipLibraryProps {
  onUseExpression: (expression: string) => void
}

const PAGE_SIZE = 24

/**
 * Biblioteca de chips importada do Digital Logic Sim.
 *
 * Cada chip combinacional foi simulado durante o build e destilado em uma
 * expressão booleana mínima, então dá para levar qualquer um deles direto para
 * a calculadora e ver a tabela verdade e o circuito equivalente.
 */
export function ChipLibrary({ onUseExpression }: ChipLibraryProps) {
  const [catalog, setCatalog] = useState<ChipCatalog | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todas')
  const [onlyDerived, setOnlyDerived] = useState(true)
  const [limit, setLimit] = useState(PAGE_SIZE)

  useEffect(() => {
    let alive = true
    loadCatalog().then(
      (loaded) => alive && setCatalog(loaded),
      () => alive && setFailed(true),
    )
    return () => {
      alive = false
    }
  }, [])

  const categories = useMemo(() => {
    if (!catalog) return ['Todas']
    return ['Todas', ...new Set(catalog.chips.map((chip) => chip.category))].sort()
  }, [catalog])

  const matches = useMemo(() => {
    if (!catalog) return []
    const needle = query.trim().toLowerCase()
    return catalog.chips.filter((chip) => {
      if (onlyDerived && !chip.derivedOutputs) return false
      if (category !== 'Todas' && chip.category !== category) return false
      if (needle && !chip.name.toLowerCase().includes(needle)) return false
      return true
    })
  }, [catalog, query, category, onlyDerived])

  useEffect(() => {
    setLimit(PAGE_SIZE)
  }, [query, category, onlyDerived])

  return (
    <section className="card p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Cpu size={18} className="text-brand-500" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Biblioteca de chips
          </h2>
          {catalog && (
            <span className="chip-tag">
              {catalog.derived} de {catalog.total} com expressão
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar chip…"
              aria-label="Buscar chip"
              className="h-9 w-44 rounded-lg border border-slate-200 bg-white pr-3 pl-8 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Categoria"
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900"
          >
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={onlyDerived}
              onChange={(event) => setOnlyDerived(event.target.checked)}
              className="accent-brand-500"
            />
            Só com expressão
          </label>
        </div>
      </header>

      {failed ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Não foi possível carregar o catálogo de chips.
        </p>
      ) : !catalog ? (
        <p className="py-6 text-center text-sm text-slate-400">Carregando chips…</p>
      ) : matches.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Nenhum chip encontrado com esses filtros.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {matches.slice(0, limit).map((chip) => (
              <ChipCard key={chip.name} chip={chip} onUse={onUseExpression} />
            ))}
          </div>

          {matches.length > limit && (
            <div className="mt-4 text-center">
              <button
                type="button"
                className="key"
                onClick={() => setLimit((current) => current + PAGE_SIZE * 2)}
              >
                Mostrar mais ({matches.length - limit} restantes)
              </button>
            </div>
          )}
        </>
      )}

      {catalog && (
        <p className="mt-4 text-xs text-slate-400 dark:text-slate-600">
          Origem: {catalog.source}. As expressões foram derivadas simulando cada
          netlist e minimizando o resultado com Quine-McCluskey.
        </p>
      )}
    </section>
  )
}

function ChipCard({
  chip,
  onUse,
}: {
  chip: ChipEntry
  onUse: (expression: string) => void
}) {
  const parts = Object.entries(chip.parts)

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-brand-700">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-mono text-sm font-bold">{chip.name}</h3>
        <span className="chip-tag shrink-0">{chip.category}</span>
      </div>

      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {chip.in} entrada{chip.in === 1 ? '' : 's'} · {chip.out} saída
        {chip.out === 1 ? '' : 's'} · {chip.partCount} componente
        {chip.partCount === 1 ? '' : 's'}
        {chip.widths && ` · barramentos de ${chip.widths.join(', ')} bits`}
      </p>

      {parts.length > 0 && (
        <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
          {parts.map(([name, count]) => `${count}× ${name}`).join(', ')}
        </p>
      )}

      {chip.derivedOutputs ? (
        <ul className="mt-2 space-y-1.5">
          {chip.derivedOutputs.map((output) => (
            <li key={output.name} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-500 dark:text-slate-400">
                  {output.name}
                </span>
                {output.expression && (
                  <button
                    type="button"
                    onClick={() => onUse(output.expression!)}
                    className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-brand-600 transition hover:border-brand-400 dark:border-slate-700 dark:text-brand-300"
                  >
                    Abrir na calculadora
                  </button>
                )}
              </div>
              <code className="expr mt-0.5 block truncate font-mono text-[11px] text-slate-600 dark:text-slate-300">
                {output.expression ?? 'expressão longa demais para exibir'}
              </code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-600">
          Sequencial ou multi-bit — sem expressão booleana equivalente.
        </p>
      )}
    </article>
  )
}
