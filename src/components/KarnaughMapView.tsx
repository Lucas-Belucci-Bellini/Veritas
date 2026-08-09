import type { KarnaughMap } from '../engine'
import { renderValue, type ValueStyle } from '../lib/values'

/** Uma cor por agrupamento, escolhidas para se distinguirem nos dois temas. */
const GROUP_COLORS = [
  { ring: 'ring-sky-500', dot: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400' },
  { ring: 'ring-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  { ring: 'ring-fuchsia-500', dot: 'bg-fuchsia-500', text: 'text-fuchsia-600 dark:text-fuchsia-400' },
  { ring: 'ring-amber-500', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { ring: 'ring-rose-500', dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
  { ring: 'ring-violet-500', dot: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400' },
]

interface KarnaughMapViewProps {
  map: KarnaughMap
  style: ValueStyle
}

/**
 * Mapa de Karnaugh com os agrupamentos coloridos.
 *
 * Os grupos são os mesmos implicantes primos que a simplificação escolheu, então
 * dá para ver de onde veio cada termo da expressão mínima. Um grupo pode dar a
 * volta pelas bordas do mapa — por isso os agrupamentos são marcados célula a
 * célula, e não com um retângulo desenhado por cima.
 */
export function KarnaughMapView({ map, style }: KarnaughMapViewProps) {
  const groupsByCell = new Map<string, number[]>()
  map.groups.forEach((group, index) => {
    for (const cell of group.cells) {
      const key = `${cell.row}:${cell.column}`
      groupsByCell.set(key, [...(groupsByCell.get(key) ?? []), index])
    }
  })

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1 text-center text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1 text-xs font-semibold text-slate-400 dark:text-slate-500">
                <span className="expr">
                  {map.rowVariables.join('')}
                  {map.rowVariables.length > 0 && map.columnVariables.length > 0 && ' \\ '}
                  {map.columnVariables.join('')}
                </span>
              </th>
              {map.columnLabels.map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="px-2 py-1 font-mono text-xs font-semibold text-slate-400 dark:text-slate-500"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {map.values.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th
                  scope="row"
                  className="px-2 py-1 font-mono text-xs font-semibold text-slate-400 dark:text-slate-500"
                >
                  {map.rowLabels[rowIndex]}
                </th>
                {row.map((value, columnIndex) => {
                  const groups = groupsByCell.get(`${rowIndex}:${columnIndex}`) ?? []
                  const primary = groups[0]
                  return (
                    <td key={columnIndex} className="p-0">
                      <div
                        title={`Linha ${map.minterms[rowIndex][columnIndex]} da tabela`}
                        className={`relative grid h-12 w-12 place-items-center rounded-lg border font-mono text-base font-bold ${
                          value
                            ? 'border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600'
                        } ${
                          primary === undefined
                            ? ''
                            : `ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-900 ${GROUP_COLORS[primary % GROUP_COLORS.length].ring}`
                        }`}
                      >
                        {renderValue(value, style)}
                        {groups.length > 1 && (
                          <span className="absolute bottom-0.5 flex gap-0.5">
                            {groups.slice(1).map((group) => (
                              <span
                                key={group}
                                className={`h-1.5 w-1.5 rounded-full ${GROUP_COLORS[group % GROUP_COLORS.length].dot}`}
                              />
                            ))}
                          </span>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {map.groups.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {map.groups.map((group, index) => (
            <li key={group.term} className="flex items-center gap-1.5 text-xs">
              <span
                className={`h-2.5 w-2.5 rounded-full ${GROUP_COLORS[index % GROUP_COLORS.length].dot}`}
              />
              <code
                className={`expr font-mono font-semibold ${GROUP_COLORS[index % GROUP_COLORS.length].text}`}
              >
                {group.term}
              </code>
              <span className="text-slate-400 dark:text-slate-500">
                ({group.cells.length} célula{group.cells.length === 1 ? '' : 's'})
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          Sem agrupamentos: a expressão é constante.
        </p>
      )}
    </div>
  )
}
