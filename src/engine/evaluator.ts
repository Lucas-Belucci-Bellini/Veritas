import type { AstNode, BinaryOp } from './ast'

export type Assignment = Readonly<Record<string, boolean>>

const BINARY_OPS: Record<BinaryOp, (a: boolean, b: boolean) => boolean> = {
  and: (a, b) => a && b,
  nand: (a, b) => !(a && b),
  or: (a, b) => a || b,
  nor: (a, b) => !(a || b),
  xor: (a, b) => a !== b,
  xnor: (a, b) => a === b,
  implies: (a, b) => !a || b,
  iff: (a, b) => a === b,
}

export function applyBinary(op: BinaryOp, left: boolean, right: boolean): boolean {
  return BINARY_OPS[op](left, right)
}

/** Resolve a árvore para um conjunto de valores das variáveis. */
export function evaluate(node: AstNode, assignment: Assignment): boolean {
  switch (node.kind) {
    case 'const':
      return node.value
    case 'var':
      return assignment[node.name] ?? false
    case 'not':
      return !evaluate(node.operand, assignment)
    case 'binary':
      return applyBinary(
        node.op,
        evaluate(node.left, assignment),
        evaluate(node.right, assignment),
      )
  }
}

export function spanKey(node: AstNode): string {
  return `${node.span.start}:${node.span.end}`
}

/**
 * Resolve a árvore guardando o valor de cada subexpressão.
 * É o que alimenta as colunas de "passo a passo" da tabela.
 */
export function evaluateWithSteps(
  node: AstNode,
  assignment: Assignment,
  steps: Map<string, boolean> = new Map(),
): { value: boolean; steps: Map<string, boolean> } {
  const value = compute(node, assignment, steps)
  return { value, steps }
}

function compute(
  node: AstNode,
  assignment: Assignment,
  steps: Map<string, boolean>,
): boolean {
  let value: boolean

  switch (node.kind) {
    case 'const':
      return node.value
    case 'var':
      return assignment[node.name] ?? false
    case 'not':
      value = !compute(node.operand, assignment, steps)
      break
    case 'binary':
      value = applyBinary(
        node.op,
        compute(node.left, assignment, steps),
        compute(node.right, assignment, steps),
      )
      break
  }

  steps.set(spanKey(node), value)
  return value
}
