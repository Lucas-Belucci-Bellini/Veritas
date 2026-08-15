import type { CircuitVectorTruthTable } from '../circuit'

interface VectorTruthTableViewProps {
  table: CircuitVectorTruthTable
  selectedRow: number | null
  onSelectRow: (row: number) => void
}

export function VectorTruthTableView({ table, selectedRow, onSelectRow }: VectorTruthTableViewProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="min-w-full border-collapse text-left text-xs">
        <caption className="border-b border-slate-200 px-3 py-2 text-left text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {table.generatedRows} de {table.totalRows} linhas · {table.totalInputBits} bits de entrada
          {table.truncated ? ' · tabela truncada por segurança' : ''}
        </caption>
        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
          <tr>
            {table.columns.map((column) => (
              <th key={column.key} scope="col" className={`whitespace-nowrap px-3 py-2 font-semibold ${column.type === 'result' ? 'text-brand-600 dark:text-brand-300' : ''}`}>
                {column.label} <span className="font-normal">[{column.width}b]</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr
              key={`vector-row-${rowIndex}`}
              tabIndex={0}
              aria-selected={selectedRow === rowIndex}
              onClick={() => onSelectRow(rowIndex)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectRow(rowIndex)
                }
              }}
              className={`cursor-pointer border-t border-slate-100 outline-none focus:bg-brand-50 dark:border-slate-800 dark:focus:bg-brand-950/30 ${selectedRow === rowIndex ? 'bg-brand-50 dark:bg-brand-950/40' : ''}`}
            >
              {row.map((value, columnIndex) => {
                const column = table.columns[columnIndex]
                return (
                  <td key={`${rowIndex}-${column?.key ?? columnIndex}`} className={`whitespace-nowrap px-3 py-2 font-mono ${column?.type === 'result' ? 'font-bold text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-200'}`}>
                    {value}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
