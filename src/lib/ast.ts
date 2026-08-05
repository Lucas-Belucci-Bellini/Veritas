export type BinaryOp = 'AND' | 'OR' | 'XOR' | 'IMPLIES' | 'EQUIV'

export type AstNode =
  | { type: 'variable'; name: string }
  | { type: 'constant'; value: boolean }
  | { type: 'not'; operand: AstNode }
  | { type: 'binary'; op: BinaryOp; left: AstNode; right: AstNode }

export function collectVariables(node: AstNode, set = new Set<string>()): string[] {
  switch (node.type) {
    case 'variable':
      set.add(node.name)
      break
    case 'constant':
      break
    case 'not':
      collectVariables(node.operand, set)
      break
    case 'binary':
      collectVariables(node.left, set)
      collectVariables(node.right, set)
      break
  }
  return [...set].sort()
}
