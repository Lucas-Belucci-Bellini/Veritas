import type { AstNode } from './ast'

export type Assignment = Record<string, boolean>

export function evaluate(node: AstNode, assignment: Assignment): boolean {
  switch (node.type) {
    case 'variable':
      if (!(node.name in assignment)) {
        throw new Error(`Variável "${node.name}" não definida`)
      }
      return assignment[node.name]
    case 'constant':
      return node.value
    case 'not':
      return !evaluate(node.operand, assignment)
    case 'binary': {
      const left = evaluate(node.left, assignment)
      const right = evaluate(node.right, assignment)
      switch (node.op) {
        case 'AND':
          return left && right
        case 'OR':
          return left || right
        case 'XOR':
          return left !== right
        case 'IMPLIES':
          return !left || right
        case 'EQUIV':
          return left === right
      }
    }
  }
}
