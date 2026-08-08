import { collectSubexpressions, collectVariables, type AstNode, type Span } from './ast'
import { evaluateWithSteps, spanKey, type Assignment } from './evaluator'
import { formatAst } from './format'
import type { Notation } from './tokens'

export type ColumnType = 'variable' | 'step' | 'result'

export interface TruthTableColumn {
  key: string
  label: string
  type: ColumnType
  span?: Span
}

export type Classification = 'tautologia' | 'contradicao' | 'contingencia'

export interface TruthTable {
  /** Nomes das variáveis, em ordem alfabética. */
  variables: string[]
  columns: TruthTableColumn[]
  /** Uma linha por combinação; cada linha está alinhada com `columns`. */
  rows: boolean[][]
  /** Total de combinações (2^n), mesmo quando a exibição foi limitada. */
  totalRows: number
  truncated: boolean
  /** Quantas linhas dão verdadeiro (apenas entre as linhas geradas). */
  trueCount: number
  classification: Classification
  /** A expressão normalizada, já na notação pedida. */
  formula: string
}

export interface TruthTableOptions {
  /** Mostra as colunas das subexpressões intermediárias. */
  includeSteps?: boolean
  /** Teto de linhas geradas, para não travar o navegador. */
  maxRows?: number
  notation?: Notation
}

export const DEFAULT_MAX_ROWS = 4096

/** Limite acima do qual 2^n estoura o `Number.MAX_SAFE_INTEGER` com folga. */
export const MAX_VARIABLES = 24

export function buildTruthTable(
  ast: AstNode,
  options: TruthTableOptions = {},
): TruthTable {
  const {
    includeSteps = true,
    maxRows = DEFAULT_MAX_ROWS,
    notation = 'math',
  } = options

  const variables = collectVariables(ast)
  if (variables.length > MAX_VARIABLES) {
    throw new RangeError(
      `A expressão tem ${variables.length} variáveis; o limite é ${MAX_VARIABLES}.`,
    )
  }

  const totalRows = 2 ** variables.length
  const generatedRows = Math.min(totalRows, maxRows)

  const resultKey = spanKey(ast)

  // Duas ocorrências de "¬A" na mesma fórmula são a mesma função, então elas
  // compartilham uma coluna só — comparar por posição no texto renderia
  // colunas idênticas lado a lado.
  const steps: AstNode[] = []
  if (includeSteps) {
    const seen = new Set([canonicalForm(ast)])
    for (const node of collectSubexpressions(ast)) {
      const form = canonicalForm(node)
      if (seen.has(form)) continue
      seen.add(form)
      steps.push(node)
    }
  }

  const columns: TruthTableColumn[] = [
    ...variables.map((name): TruthTableColumn => ({
      key: `var:${name}`,
      label: name,
      type: 'variable',
    })),
    ...steps.map((node): TruthTableColumn => ({
      key: `step:${canonicalForm(node)}`,
      label: formatAst(node, notation),
      type: 'step',
      span: node.span,
    })),
    {
      key: `result:${resultKey}`,
      label: formatAst(ast, notation),
      type: 'result',
      span: ast.span,
    },
  ]

  const rows: boolean[][] = []
  let trueCount = 0

  for (let index = 0; index < generatedRows; index += 1) {
    const assignment = assignmentForRow(variables, index)
    const { value, steps: stepValues } = evaluateWithSteps(ast, assignment)

    const row: boolean[] = variables.map((name) => assignment[name])
    for (const node of steps) row.push(stepValues.get(spanKey(node)) ?? false)
    row.push(value)

    if (value) trueCount += 1
    rows.push(row)
  }

  return {
    variables,
    columns,
    rows,
    totalRows,
    truncated: generatedRows < totalRows,
    trueCount,
    classification: classify(trueCount, rows.length),
    formula: formatAst(ast, notation),
  }
}

/** Forma canônica de uma subexpressão, independente da notação exibida. */
function canonicalForm(node: AstNode): string {
  return formatAst(node, 'math')
}

/**
 * Combinação da linha `index`, escrita como contagem binária.
 *
 * A primeira variável é o bit mais significativo, então ela alterna a cada
 * metade da tabela (F F F F V V V V) e a última alterna a cada linha — a ordem
 * canônica dos livros de lógica.
 */
export function assignmentForRow(
  variables: readonly string[],
  index: number,
): Record<string, boolean> {
  const assignment: Record<string, boolean> = {}
  const lastBit = variables.length - 1
  for (let i = 0; i < variables.length; i += 1) {
    assignment[variables[i]] = ((index >> (lastBit - i)) & 1) === 1
  }
  return assignment
}

function classify(trueCount: number, rowCount: number): Classification {
  if (rowCount === 0) return 'contingencia'
  if (trueCount === rowCount) return 'tautologia'
  if (trueCount === 0) return 'contradicao'
  return 'contingencia'
}

export const CLASSIFICATION_LABELS: Record<Classification, string> = {
  tautologia: 'Tautologia — verdadeira em todas as linhas',
  contradicao: 'Contradição — falsa em todas as linhas',
  contingencia: 'Contingência — depende dos valores',
}

/** Valores de uma linha específica, útil para acender o circuito. */
export function assignmentAt(
  table: Pick<TruthTable, 'variables'>,
  rowIndex: number,
): Assignment {
  return assignmentForRow(table.variables, rowIndex)
}
