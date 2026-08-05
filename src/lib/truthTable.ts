import { collectVariables, type AstNode } from './ast'
import { evaluate } from './evaluator'
import { ParserError, parseExpression } from './parser'
import { validateParentheses } from './lexer'

export type OutputFormat = 'vf' | 'binary'

export interface TruthTableResult {
  ok: true
  variables: string[]
  rows: boolean[][]
  rowCount: number
  truncated: boolean
}

export interface TruthTableError {
  ok: false
  message: string
}

export type ParseResult = TruthTableResult | TruthTableError

const MAX_VARIABLES = 8
const MAX_ROWS = 256

export function analyzeExpression(
  input: string,
  format: OutputFormat = 'vf',
): ParseResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, message: 'Digite uma expressão lógica' }
  }

  const parenError = validateParentheses(trimmed)
  if (parenError) {
    return { ok: false, message: parenError }
  }

  let ast: AstNode
  try {
    ast = parseExpression(trimmed)
  } catch (error) {
    const message =
      error instanceof ParserError
        ? error.message
        : 'Expressão inválida'
    return { ok: false, message }
  }

  const variables = collectVariables(ast)
  if (variables.length === 0) {
    const value = evaluate(ast, {})
    return {
      ok: true,
      variables: [],
      rows: [[value]],
      rowCount: 1,
      truncated: false,
    }
  }

  if (variables.length > MAX_VARIABLES) {
    return {
      ok: false,
      message: `Muitas variáveis (${variables.length}). Máximo: ${MAX_VARIABLES}`,
    }
  }

  const totalRows = 2 ** variables.length
  const truncated = totalRows > MAX_ROWS
  const rowCount = truncated ? MAX_ROWS : totalRows
  const rows: boolean[][] = []

  for (let i = 0; i < rowCount; i++) {
    const assignment: Record<string, boolean> = {}
    const bits = i.toString(2).padStart(variables.length, '0')

    variables.forEach((variable, index) => {
      assignment[variable] = bits[index] === '1'
    })

    const result = evaluate(ast, assignment)
    rows.push([...variables.map((v) => assignment[v]), result])
  }

  return {
    ok: true,
    variables,
    rows,
    rowCount,
    truncated,
  }
}

export function formatValue(value: boolean, format: OutputFormat): string {
  if (format === 'binary') return value ? '1' : '0'
  return value ? 'V' : 'F'
}
