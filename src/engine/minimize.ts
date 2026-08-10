import { collectVariables, type AstNode } from './ast'
import { evaluate } from './evaluator'
import { formatAst } from './format'
import { parse } from './parser'
import { assignmentForRow } from './truthTable'
import type { Notation } from './tokens'

/**
 * Um implicante primo: `value` guarda os bits fixos e `mask` marca quais
 * posições viraram "tanto faz" durante a combinação.
 */
export interface Implicant {
  value: number
  mask: number
  /** Índices das linhas (mintermos) que este implicante cobre. */
  covers: number[]
}

/** Acima disso a tabela fica grande demais para minimizar na hora. */
export const MAX_MINIMIZED_VARIABLES = 12

export interface Simplification {
  /** Expressão mínima em soma de produtos, na notação pedida. */
  expression: string
  ast: AstNode
  implicants: Implicant[]
  /** Contagem de operadores antes e depois, para mostrar o ganho. */
  operatorsBefore: number
  operatorsAfter: number
  /** True quando a forma original já era tão curta quanto a mínima. */
  alreadyMinimal: boolean
}

/**
 * Reduz a expressão à soma de produtos mínima.
 *
 * O caminho é indireto de propósito: avaliamos a expressão em todas as linhas,
 * minimizamos a coluna resultante com Quine-McCluskey e reconstruímos o texto,
 * que volta pelo parser. Assim o resultado é sempre uma expressão válida e
 * logicamente idêntica à original, seja ela qual for.
 */
export function simplify(ast: AstNode, notation: Notation = 'math'): Simplification | null {
  const variables = collectVariables(ast)
  if (variables.length > MAX_MINIMIZED_VARIABLES) return null

  const column = truthColumn(ast, variables)
  const { text, implicants } = minimizeColumn(column, variables)

  const simplifiedAst = parse(text)
  const expression = formatAst(simplifiedAst, notation)
  const operatorsBefore = countOperators(ast)
  const operatorsAfter = countOperators(simplifiedAst)

  return {
    expression,
    ast: simplifiedAst,
    implicants,
    operatorsBefore,
    operatorsAfter,
    alreadyMinimal: operatorsAfter >= operatorsBefore,
  }
}

/** Valor da expressão em cada linha da tabela, na ordem canônica. */
export function truthColumn(ast: AstNode, variables: readonly string[]): boolean[] {
  const rows = 2 ** variables.length
  const column: boolean[] = new Array(rows)
  for (let index = 0; index < rows; index += 1) {
    column[index] = evaluate(ast, assignmentForRow(variables, index))
  }
  return column
}

export interface MinimizedColumn {
  /** Texto em notação textual (AND/OR/NOT), pronto para o parser. */
  text: string
  implicants: Implicant[]
}

export function minimizeColumn(
  column: readonly boolean[],
  variables: readonly string[],
): MinimizedColumn {
  const minterms: number[] = []
  column.forEach((value, index) => {
    if (value) minterms.push(index)
  })

  if (minterms.length === 0) return { text: '0', implicants: [] }
  if (minterms.length === column.length) return { text: '1', implicants: [] }

  const primes = primeImplicants(minterms)
  const chosen = coverMinterms(primes, minterms)
  const terms = chosen.map((implicant) => implicantToTerm(implicant, variables))

  return {
    text: terms.length === 1 ? terms[0] : terms.map(wrapTerm).join(' OR '),
    implicants: chosen,
  }
}

function wrapTerm(term: string): string {
  return term.includes(' AND ') ? `(${term})` : term
}

/** Combina mintermos que diferem em um único bit até não sobrar par possível. */
export function primeImplicants(minterms: readonly number[]): Implicant[] {
  let groups: Implicant[] = minterms.map((value) => ({
    value,
    mask: 0,
    covers: [value],
  }))
  const primes: Implicant[] = []
  const seen = new Set<string>()

  while (groups.length > 0) {
    const merged = new Map<string, Implicant>()
    const used = new Set<number>()

    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const a = groups[i]
        const b = groups[j]
        if (a.mask !== b.mask) continue

        const difference = a.value ^ b.value
        // Precisa diferir em exatamente um bit para poder combinar.
        if (difference === 0 || (difference & (difference - 1)) !== 0) continue

        used.add(i)
        used.add(j)
        const mask = a.mask | difference
        const value = a.value & ~mask
        const key = `${value}/${mask}`
        const existing = merged.get(key)
        if (existing) {
          existing.covers = [...new Set([...existing.covers, ...a.covers, ...b.covers])]
        } else {
          merged.set(key, {
            value,
            mask,
            covers: [...new Set([...a.covers, ...b.covers])],
          })
        }
      }
    }

    groups.forEach((group, index) => {
      if (used.has(index)) return
      const key = `${group.value}/${group.mask}`
      if (seen.has(key)) return
      seen.add(key)
      primes.push(group)
    })

    groups = [...merged.values()]
  }

  return primes
}

/** Essenciais primeiro, o resto por escolha gulosa. */
export function coverMinterms(
  primes: readonly Implicant[],
  minterms: readonly number[],
): Implicant[] {
  const remaining = new Set(minterms)
  const chosen: Implicant[] = []

  for (const minterm of minterms) {
    const covering = primes.filter((prime) => prime.covers.includes(minterm))
    if (covering.length === 1 && !chosen.includes(covering[0])) {
      chosen.push(covering[0])
    }
  }
  for (const prime of chosen) {
    for (const covered of prime.covers) remaining.delete(covered)
  }

  while (remaining.size > 0) {
    let best: Implicant | null = null
    let bestScore = 0
    for (const prime of primes) {
      if (chosen.includes(prime)) continue
      let score = 0
      for (const covered of prime.covers) if (remaining.has(covered)) score += 1
      if (score > bestScore) {
        best = prime
        bestScore = score
      }
    }
    if (!best) break
    chosen.push(best)
    for (const covered of best.covers) remaining.delete(covered)
  }

  return chosen
}

export function implicantToTerm(
  implicant: Implicant,
  variables: readonly string[],
): string {
  const size = variables.length
  const literals: string[] = []
  for (let bit = 0; bit < size; bit += 1) {
    const weight = 1 << (size - 1 - bit)
    if (implicant.mask & weight) continue
    literals.push(implicant.value & weight ? variables[bit] : `NOT ${variables[bit]}`)
  }
  return literals.length === 0 ? '1' : literals.join(' AND ')
}

function countOperators(node: AstNode): number {
  switch (node.kind) {
    case 'var':
    case 'const':
      return 0
    case 'not':
      return 1 + countOperators(node.operand)
    case 'binary':
      return 1 + countOperators(node.left) + countOperators(node.right)
  }
}
