export interface Span {
  start: number
  end: number
}

export type BinaryOp = 'and' | 'nand' | 'or' | 'nor' | 'xor' | 'xnor' | 'implies' | 'iff'

export type AstNode =
  | { kind: 'var'; name: string; span: Span }
  | { kind: 'const'; value: boolean; span: Span }
  | { kind: 'not'; operand: AstNode; span: Span }
  | { kind: 'binary'; op: BinaryOp; left: AstNode; right: AstNode; span: Span }

/** Precedência: número maior "gruda" mais forte. */
export const PRECEDENCE: Record<BinaryOp, number> = {
  iff: 1,
  implies: 2,
  or: 3,
  nor: 3,
  xor: 4,
  xnor: 4,
  and: 5,
  nand: 5,
}

/** Só a implicação associa à direita: A → B → C é A → (B → C). */
export const RIGHT_ASSOCIATIVE: ReadonlySet<BinaryOp> = new Set<BinaryOp>(['implies'])

export const NOT_PRECEDENCE = 6

/** Nomes das variáveis em ordem alfabética, sem repetição. */
export function collectVariables(node: AstNode): string[] {
  const found = new Set<string>()
  walk(node, (current) => {
    if (current.kind === 'var') found.add(current.name)
  })
  return [...found].sort()
}

export function walk(node: AstNode, visit: (node: AstNode) => void): void {
  visit(node)
  if (node.kind === 'not') walk(node.operand, visit)
  if (node.kind === 'binary') {
    walk(node.left, visit)
    walk(node.right, visit)
  }
}

/**
 * Subexpressões em ordem de resolução (pós-ordem): filhos antes dos pais.
 * É exatamente a ordem das colunas intermediárias da tabela verdade.
 */
export function collectSubexpressions(node: AstNode): AstNode[] {
  const result: AstNode[] = []
  const seen = new Set<string>()

  const visit = (current: AstNode) => {
    if (current.kind === 'not') visit(current.operand)
    if (current.kind === 'binary') {
      visit(current.left)
      visit(current.right)
    }
    if (current.kind === 'var' || current.kind === 'const') return
    const key = `${current.span.start}:${current.span.end}`
    if (seen.has(key)) return
    seen.add(key)
    result.push(current)
  }

  visit(node)
  return result
}
