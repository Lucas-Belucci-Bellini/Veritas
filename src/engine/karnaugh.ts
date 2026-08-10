import { collectVariables, type AstNode } from './ast'
import { formatAst } from './format'
import { coverMinterms, implicantToTerm, primeImplicants, truthColumn } from './minimize'
import { parse } from './parser'
import type { Notation } from './tokens'

/** O mapa fica ilegível acima de 4 variáveis — aí o lugar certo é a tabela. */
export const KARNAUGH_MAX_VARIABLES = 4

export interface KarnaughCell {
  row: number
  column: number
}

export interface KarnaughGroup {
  /** O termo que este agrupamento representa, já na notação escolhida. */
  term: string
  cells: KarnaughCell[]
}

export interface KarnaughMap {
  variables: string[]
  rowVariables: string[]
  columnVariables: string[]
  /** Códigos das linhas e colunas em código Gray, como "01" e "11". */
  rowLabels: string[]
  columnLabels: string[]
  /** values[linha][coluna] */
  values: boolean[][]
  /** Índice do mintermo em cada célula, útil para depurar e para tooltips. */
  minterms: number[][]
  groups: KarnaughGroup[]
}

/**
 * Monta o mapa de Karnaugh da expressão.
 *
 * Linhas e colunas seguem o código Gray, que é o que faz células vizinhas
 * diferirem em um único bit — sem isso os agrupamentos não seriam retângulos.
 * Os grupos destacados são exatamente os implicantes primos que a
 * simplificação escolheu, então mapa e expressão mínima contam a mesma história.
 */
export function buildKarnaughMap(
  ast: AstNode,
  notation: Notation = 'math',
): KarnaughMap | null {
  const variables = collectVariables(ast)
  if (variables.length === 0 || variables.length > KARNAUGH_MAX_VARIABLES) return null

  const rowBits = variables.length >= 4 ? 2 : variables.length >= 2 ? 1 : 0
  const columnBits = variables.length - rowBits

  const rowVariables = variables.slice(0, rowBits)
  const columnVariables = variables.slice(rowBits)
  const rowCodes = grayCode(rowBits)
  const columnCodes = grayCode(columnBits)

  const column = truthColumn(ast, variables)

  const values: boolean[][] = []
  const minterms: number[][] = []
  const positionOf = new Map<number, KarnaughCell>()

  rowCodes.forEach((rowCode, row) => {
    const valueRow: boolean[] = []
    const mintermRow: number[] = []
    columnCodes.forEach((columnCode, columnIndex) => {
      const minterm = (rowCode << columnBits) | columnCode
      valueRow.push(column[minterm])
      mintermRow.push(minterm)
      positionOf.set(minterm, { row, column: columnIndex })
    })
    values.push(valueRow)
    minterms.push(mintermRow)
  })

  return {
    variables,
    rowVariables,
    columnVariables,
    rowLabels: rowCodes.map((code) => toBinary(code, rowBits)),
    columnLabels: columnCodes.map((code) => toBinary(code, columnBits)),
    values,
    minterms,
    groups: buildGroups(column, variables, positionOf, notation),
  }
}

function buildGroups(
  column: readonly boolean[],
  variables: readonly string[],
  positionOf: ReadonlyMap<number, KarnaughCell>,
  notation: Notation,
): KarnaughGroup[] {
  const ones: number[] = []
  column.forEach((value, index) => {
    if (value) ones.push(index)
  })
  // Tudo zero ou tudo um não tem agrupamento para destacar.
  if (ones.length === 0 || ones.length === column.length) return []

  const chosen = coverMinterms(primeImplicants(ones), ones)

  return chosen.map((implicant) => ({
    term: formatAst(parse(implicantToTerm(implicant, variables)), notation),
    cells: implicant.covers
      .map((minterm) => positionOf.get(minterm))
      .filter((cell): cell is KarnaughCell => cell !== undefined),
  }))
}

/** Código Gray: cada passo muda exatamente um bit (00, 01, 11, 10). */
export function grayCode(bits: number): number[] {
  return Array.from({ length: 2 ** bits }, (_, index) => index ^ (index >> 1))
}

function toBinary(value: number, bits: number): string {
  return bits === 0 ? '' : value.toString(2).padStart(bits, '0')
}
