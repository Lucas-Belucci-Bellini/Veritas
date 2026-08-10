import { collectVariables, type AstNode } from './ast'
import { formatAst } from './format'
import { coverMinterms, implicantToTerm, primeImplicants, truthColumn } from './minimize'
import { parse } from './parser'
import type { Notation } from './tokens'

/**
 * Formas normais: soma de produtos e produto de somas.
 *
 * A SOP sai direto dos mintermos (as linhas onde a função dá 1). A POS sai
 * pelo caminho inverso: minimiza-se o complemento da função e aplica-se De
 * Morgan no resultado — o mesmo Quine-McCluskey serve às duas.
 */

export const MAX_NORMAL_FORM_VARIABLES = 12

export interface NormalForms {
  variables: string[]
  /** Soma de todos os mintermos, sem simplificar. */
  canonicalSop: string
  /** Produto de todos os maxtermos, sem simplificar. */
  canonicalPos: string
  /** Forma mínima em soma de produtos. */
  minimalSop: string
  /** Forma mínima em produto de somas. */
  minimalPos: string
  /** Índices das linhas onde a função vale 1 e 0. */
  minterms: number[]
  maxterms: number[]
  /** Quantos operadores cada forma mínima gasta, para comparar as duas. */
  sopOperators: number
  posOperators: number
}

export function buildNormalForms(
  ast: AstNode,
  notation: Notation = 'math',
): NormalForms | null {
  const variables = collectVariables(ast)
  if (variables.length === 0 || variables.length > MAX_NORMAL_FORM_VARIABLES) return null

  const column = truthColumn(ast, variables)
  const minterms: number[] = []
  const maxterms: number[] = []
  column.forEach((value, index) => (value ? minterms : maxterms).push(index))

  const canonicalSop = renderSop(
    minterms.map((minterm) => mintermTerm(minterm, variables)),
    notation,
  )
  const canonicalPos = renderPos(
    maxterms.map((maxterm) => maxtermTerm(maxterm, variables)),
    notation,
  )

  const minimalSop = renderSop(minimalSopTerms(minterms, column.length, variables), notation)
  const minimalPos = renderPos(minimalPosTerms(maxterms, column.length, variables), notation)

  return {
    variables,
    canonicalSop,
    canonicalPos,
    minimalSop,
    minimalPos,
    minterms,
    maxterms,
    sopOperators: countOperators(minimalSop, notation),
    posOperators: countOperators(minimalPos, notation),
  }
}

/** Produto que vale 1 só na linha `minterm`. */
function mintermTerm(minterm: number, variables: readonly string[]): string[] {
  return variables.map((name, index) => {
    const bit = (minterm >> (variables.length - 1 - index)) & 1
    return bit ? name : `NOT ${name}`
  })
}

/** Soma que vale 0 só na linha `maxterm` — os literais saem invertidos. */
function maxtermTerm(maxterm: number, variables: readonly string[]): string[] {
  return variables.map((name, index) => {
    const bit = (maxterm >> (variables.length - 1 - index)) & 1
    return bit ? `NOT ${name}` : name
  })
}

function minimalSopTerms(
  minterms: readonly number[],
  rows: number,
  variables: readonly string[],
): string[][] {
  if (minterms.length === 0) return []
  if (minterms.length === rows) return [['1']]
  const chosen = coverMinterms(primeImplicants(minterms), minterms)
  return chosen.map((implicant) => implicantToTerm(implicant, variables).split(' AND '))
}

/**
 * POS mínima pelo complemento: minimiza-se a função invertida como soma de
 * produtos e nega-se o resultado, que por De Morgan vira produto de somas com
 * cada literal trocado.
 */
function minimalPosTerms(
  maxterms: readonly number[],
  rows: number,
  variables: readonly string[],
): string[][] {
  if (maxterms.length === 0) return []
  if (maxterms.length === rows) return [['0']]

  const chosen = coverMinterms(primeImplicants(maxterms), maxterms)
  return chosen.map((implicant) =>
    implicantToTerm(implicant, variables)
      .split(' AND ')
      .map((literal) =>
        literal.startsWith('NOT ') ? literal.slice(4) : `NOT ${literal}`,
      ),
  )
}

function renderSop(terms: string[][], notation: Notation): string {
  if (terms.length === 0) return '0'
  const text = terms
    .map((literals) => (literals.length > 1 ? `(${literals.join(' AND ')})` : literals[0]))
    .join(' OR ')
  return formatAst(parse(text), notation)
}

function renderPos(terms: string[][], notation: Notation): string {
  if (terms.length === 0) return '1'
  const text = terms
    .map((literals) => (literals.length > 1 ? `(${literals.join(' OR ')})` : literals[0]))
    .join(' AND ')
  return formatAst(parse(text), notation)
}

function countOperators(expression: string, notation: Notation): number {
  void notation
  return count(parse(expression))
}

function count(node: AstNode): number {
  switch (node.kind) {
    case 'var':
    case 'const':
      return 0
    case 'not':
      return 1 + count(node.operand)
    case 'binary':
      return 1 + count(node.left) + count(node.right)
  }
}

export type ExpressionForm = 'sop' | 'pos' | 'nenhuma'

export const FORM_LABELS: Record<ExpressionForm, string> = {
  sop: 'Soma de produtos (SOP)',
  pos: 'Produto de somas (POS)',
  nenhuma: 'Nem SOP nem POS',
}

/**
 * Diz se a expressão *já está escrita* como soma de produtos ou produto de
 * somas — é uma pergunta sobre a forma do texto, não sobre o valor lógico.
 *
 * SOP é um OR de termos onde cada termo é um AND de literais; POS é o
 * espelho. Negação só pode aparecer grudada numa variável: `(A B)'` quebra a
 * forma, `A' B` não.
 */
export function classifyForm(ast: AstNode): ExpressionForm {
  if (isProductTerm(ast) && isSumTerm(ast)) return 'sop' // literal solto conta como as duas
  if (isSumOfProducts(ast)) return 'sop'
  if (isProductOfSums(ast)) return 'pos'
  return 'nenhuma'
}

function isLiteral(node: AstNode): boolean {
  if (node.kind === 'var' || node.kind === 'const') return true
  return node.kind === 'not' && isLiteral(node.operand)
}

/** Um AND de literais, ou um literal sozinho. */
function isProductTerm(node: AstNode): boolean {
  if (isLiteral(node)) return true
  return node.kind === 'binary' && node.op === 'and'
    ? isProductTerm(node.left) && isProductTerm(node.right)
    : false
}

/** Um OR de literais, ou um literal sozinho. */
function isSumTerm(node: AstNode): boolean {
  if (isLiteral(node)) return true
  return node.kind === 'binary' && node.op === 'or'
    ? isSumTerm(node.left) && isSumTerm(node.right)
    : false
}

function isSumOfProducts(node: AstNode): boolean {
  if (node.kind === 'binary' && node.op === 'or') {
    return isSumOfProducts(node.left) && isSumOfProducts(node.right)
  }
  return isProductTerm(node)
}

function isProductOfSums(node: AstNode): boolean {
  if (node.kind === 'binary' && node.op === 'and') {
    return isProductOfSums(node.left) && isProductOfSums(node.right)
  }
  return isSumTerm(node)
}
