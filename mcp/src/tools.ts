import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildKarnaughMap,
  buildTruthTable,
  collectVariables,
  evaluateWithSteps,
  formatAst,
  isVeritasError,
  parse,
  simplify,
  spanKey,
  type AstNode,
  type Notation,
} from '../../src/engine/index'
import type { ChipCatalog, ChipEntry } from '../../src/chips/types'

/**
 * Implementação das ferramentas, separada do transporte MCP para poder ser
 * testada direto — sem subir processo nem falar JSON-RPC.
 */

export interface ToolResult {
  text: string
  isError?: boolean
}

const here = dirname(fileURLToPath(import.meta.url))

let catalog: ChipCatalog | null = null

/** O catálogo só é lido do disco quando alguma ferramenta de chip é chamada. */
function loadCatalog(): ChipCatalog {
  if (catalog) return catalog
  for (const candidate of [
    join(here, 'catalog.json'),
    join(here, '..', '..', 'src', 'chips', 'catalog.json'),
  ]) {
    try {
      catalog = JSON.parse(readFileSync(candidate, 'utf8')) as ChipCatalog
      return catalog
    } catch {
      continue
    }
  }
  throw new Error('Catálogo de chips não encontrado.')
}

function parseOrExplain(expression: string): AstNode {
  try {
    return parse(expression)
  } catch (error) {
    if (isVeritasError(error)) {
      const marker = `${' '.repeat(error.start)}${'^'.repeat(Math.max(1, error.end - error.start))}`
      throw new Error(
        `${error.message}\n\n    ${expression}\n    ${marker}${error.hint ? `\n\n${error.hint}` : ''}`,
      )
    }
    throw error
  }
}

export function evaluateExpression(
  expression: string,
  values: Record<string, boolean>,
): ToolResult {
  const ast = parseOrExplain(expression)
  const variables = collectVariables(ast)

  const missing = variables.filter((name) => !(name in values))
  if (missing.length > 0) {
    return {
      isError: true,
      text: `Faltam valores para: ${missing.join(', ')}. A expressão usa ${variables.join(', ')}.`,
    }
  }

  const { value, steps } = evaluateWithSteps(ast, values)
  const lines = [
    `${formatAst(ast)} = ${value ? 'VERDADEIRO' : 'FALSO'}`,
    '',
    'Passos:',
  ]
  for (const step of subexpressions(ast)) {
    lines.push(`  ${formatAst(step)} = ${steps.get(spanKey(step)) ? 'V' : 'F'}`)
  }
  return { text: lines.join('\n') }
}

function subexpressions(node: AstNode): AstNode[] {
  const seen = new Set<string>()
  const result: AstNode[] = []
  const visit = (current: AstNode) => {
    if (current.kind === 'not') visit(current.operand)
    if (current.kind === 'binary') {
      visit(current.left)
      visit(current.right)
    }
    if (current.kind === 'var' || current.kind === 'const') return
    const form = formatAst(current)
    if (seen.has(form)) return
    seen.add(form)
    result.push(current)
  }
  visit(node)
  return result
}

export function truthTable(
  expression: string,
  options: { includeSteps?: boolean; notation?: Notation; maxRows?: number } = {},
): ToolResult {
  const ast = parseOrExplain(expression)
  const table = buildTruthTable(ast, {
    includeSteps: options.includeSteps ?? true,
    notation: options.notation ?? 'math',
    maxRows: options.maxRows ?? 256,
  })

  const header = `| ${table.columns.map((column) => column.label).join(' | ')} |`
  const divider = `| ${table.columns.map(() => '---').join(' | ')} |`
  const body = table.rows.map(
    (row) => `| ${row.map((value) => (value ? '1' : '0')).join(' | ')} |`,
  )

  const notes = [
    `Classificação: ${table.classification}`,
    `${table.trueCount} de ${table.rows.length} linhas verdadeiras`,
  ]
  if (table.truncated) {
    notes.push(`Exibindo ${table.rows.length} de ${table.totalRows} linhas.`)
  }

  return { text: [header, divider, ...body, '', ...notes].join('\n') }
}

export function simplifyExpression(
  expression: string,
  notation: Notation = 'math',
): ToolResult {
  const ast = parseOrExplain(expression)
  const result = simplify(ast, notation)
  if (!result) {
    return {
      isError: true,
      text: 'A expressão tem variáveis demais para minimizar (limite de 12).',
    }
  }

  return {
    text: [
      `Original: ${formatAst(ast, notation)}`,
      `Mínima:   ${result.expression}`,
      '',
      `Operadores: ${result.operatorsBefore} → ${result.operatorsAfter}`,
      result.alreadyMinimal
        ? 'A forma original já era mínima.'
        : `Economia de ${result.operatorsBefore - result.operatorsAfter} operador(es).`,
    ].join('\n'),
  }
}

export function karnaugh(expression: string, notation: Notation = 'math'): ToolResult {
  const ast = parseOrExplain(expression)
  const map = buildKarnaughMap(ast, notation)
  if (!map) {
    return {
      isError: true,
      text: 'O mapa de Karnaugh só cabe de 1 a 4 variáveis.',
    }
  }

  const head = `| ${map.rowVariables.join('')}\\${map.columnVariables.join('')} | ${map.columnLabels.join(' | ')} |`
  const divider = `| --- | ${map.columnLabels.map(() => '---').join(' | ')} |`
  const rows = map.values.map(
    (row, index) =>
      `| ${map.rowLabels[index]} | ${row.map((value) => (value ? '1' : '0')).join(' | ')} |`,
  )
  const groups = map.groups.map(
    (group) => `  ${group.term}  (${group.cells.length} células)`,
  )

  return {
    text: [
      head,
      divider,
      ...rows,
      '',
      groups.length > 0 ? 'Agrupamentos:' : 'Sem agrupamentos: a função é constante.',
      ...groups,
    ].join('\n'),
  }
}

export interface ChipQuery {
  query?: string
  category?: string
  onlyDerived?: boolean
  limit?: number
}

export function listChips(options: ChipQuery = {}): ToolResult {
  const { chips } = loadCatalog()
  const needle = options.query?.trim().toLowerCase()
  const limit = Math.min(options.limit ?? 30, 200)

  const matches = chips.filter((chip) => {
    if (options.onlyDerived && !chip.derivedOutputs) return false
    if (options.category && chip.category !== options.category) return false
    if (needle && !chip.name.toLowerCase().includes(needle)) return false
    return true
  })

  if (matches.length === 0) return { text: 'Nenhum chip encontrado com esses filtros.' }

  const lines = matches
    .slice(0, limit)
    .map(
      (chip) =>
        `${chip.name} — ${chip.category}, ${chip.in} entradas, ${chip.out} saídas${
          chip.derivedOutputs ? ' (com expressão)' : ''
        }`,
    )

  if (matches.length > limit) {
    lines.push(`… e mais ${matches.length - limit} chips.`)
  }
  return { text: lines.join('\n') }
}

export function getChip(name: string): ToolResult {
  const { chips } = loadCatalog()
  const chip =
    chips.find((entry) => entry.name === name) ??
    chips.find((entry) => entry.name.toLowerCase() === name.toLowerCase())

  if (!chip) {
    const near = chips
      .filter((entry) => entry.name.toLowerCase().includes(name.toLowerCase()))
      .slice(0, 5)
      .map((entry) => entry.name)
    return {
      isError: true,
      text: near.length
        ? `Chip "${name}" não encontrado. Parecidos: ${near.join(', ')}.`
        : `Chip "${name}" não encontrado.`,
    }
  }

  return { text: describeChip(chip) }
}

function describeChip(chip: ChipEntry): string {
  const lines = [
    `${chip.name} — ${chip.category}`,
    `${chip.in} entradas, ${chip.out} saídas, ${chip.partCount} componentes, ${chip.wireCount} fios`,
  ]

  if (chip.pins) {
    lines.push(`Entradas: ${chip.pins.in.join(', ')}`)
    lines.push(`Saídas: ${chip.pins.out.join(', ')}`)
  }
  if (chip.widths) lines.push(`Larguras de barramento: ${chip.widths.join(', ')} bits`)

  const parts = Object.entries(chip.parts)
  if (parts.length > 0) {
    lines.push(`Composto por: ${parts.map(([n, c]) => `${c}× ${n}`).join(', ')}`)
  }

  if (chip.derivedOutputs && chip.variables) {
    lines.push('', `Variáveis: ${chip.variables.join(', ')}`)
    for (const output of chip.derivedOutputs) {
      lines.push(`  ${output.name} = ${output.expression ?? '(expressão longa demais)'}`)
    }
  } else {
    lines.push('', 'Sequencial ou multi-bit: não tem expressão booleana equivalente.')
  }

  return lines.join('\n')
}
