import { TriangleAlert } from 'lucide-react'
import { CLASSIFICATION_LABELS, type TruthTable } from '../engine'
import { renderValue, type ValueStyle } from '../lib/values'

interface TruthTableViewProps {
  table: TruthTable
  style: ValueStyle
  selectedRow: number | null
  onSelectRow: (index: number | null) => void
}

const CLASSIFICATION_TONES: Record<TruthTable['classification'], string> = {
  tautologia:
    'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  contradicao:
    'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300',
  contingencia:
    'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export function TruthTableView({
  table,
  style,
  selectedRow,
  onSelectRow,
}: TruthTableViewProps) {
  const resultIndex = table.columns.length - 1

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${CLASSIFICATION_TONES[table.classification]}`}
        >
          {CLASSIFICATION_LABELS[table.classification]}
        </span>
        <span className="chip-tag">
          {table.variables.length} variáve{table.variables.length === 1 ? 'l' : 'is'}
        </span>
        <span className="chip-tag">{table.totalRows} linhas</span>
        <span className="chip-tag">
          {table.trueCount} verdadeira{table.trueCount === 1 ? '' : 's'}
        </span>
      </div>

      {table.truncated && (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          Tabela muito grande: exibindo as {table.rows.length} primeiras de{' '}
          {table.totalRows} linhas para não travar o navegador.
        </p>
      )}

      <div className="max-h-[32rem] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-center text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              {table.columns.map((column, index) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`expr border-b border-slate-200 px-4 py-2.5 font-semibold whitespace-nowrap dark:border-slate-700 ${
                    index === resultIndex
                      ? 'border-l-2 border-l-brand-400 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100'
                      : column.type === 'variable'
                        ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        : 'bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400'
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                onClick={() => onSelectRow(selectedRow === rowIndex ? null : rowIndex)}
                className={`cursor-pointer transition-colors ${
                  selectedRow === rowIndex
                    ? 'bg-amber-100 dark:bg-amber-500/15'
                    : rowIndex % 2 === 1
                      ? 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-800/60'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                {row.map((value, columnIndex) => (
                  <td
                    key={columnIndex}
                    className={`px-4 py-1.5 font-mono font-semibold ${
                      columnIndex === resultIndex
                        ? 'border-l-2 border-l-brand-400 bg-brand-50/60 dark:bg-brand-900/20'
                        : ''
                    } ${value ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                  >
                    {renderValue(value, style)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
        Clique em uma linha para acender o circuito com aqueles valores.
      </p>
    </div>
  )
}
