import { PRECEDENCE, RIGHT_ASSOCIATIVE, type AstNode, type BinaryOp } from './ast'
import { OPERATOR_GLYPHS, type Notation } from './tokens'

/**
 * Reescreve a árvore como texto na notação escolhida, colocando apenas os
 * parênteses realmente necessários. O resultado sempre volta a ser analisável
 * pelo lexer — é o que permite trocar de notação sem perder a expressão.
 */
export function formatAst(node: AstNode, notation: Notation = 'math'): string {
  return render(node, notation, 0, 'left')
}

function render(
  node: AstNode,
  notation: Notation,
  parentPrecedence: number,
  side: 'left' | 'right',
): string {
  switch (node.kind) {
    case 'var':
      return node.name
    case 'const':
      return node.value ? '1' : '0'
    case 'not': {
      const glyph = OPERATOR_GLYPHS.not[notation]
      const operand = render(node.operand, notation, 6, 'right')
      const separator = notation === 'text' ? ' ' : ''
      return `${glyph}${separator}${operand}`
    }
    case 'binary': {
      const precedence = PRECEDENCE[node.op]
      const glyph = OPERATOR_GLYPHS[node.op][notation]
      const left = render(node.left, notation, precedence, 'left')
      const right = render(node.right, notation, precedence, 'right')
      const text = `${left} ${glyph} ${right}`
      return needsParens(node.op, precedence, parentPrecedence, side)
        ? `(${text})`
        : text
    }
  }
}

function needsParens(
  op: BinaryOp,
  precedence: number,
  parentPrecedence: number,
  side: 'left' | 'right',
): boolean {
  if (precedence > parentPrecedence) return false
  if (precedence < parentPrecedence) return true
  // Mesma precedência: o lado "errado" da associatividade precisa de parênteses.
  return RIGHT_ASSOCIATIVE.has(op) ? side === 'left' : side === 'right'
}

/** Converte a expressão digitada para outra notação, preservando o significado. */
export function convertNotation(
  source: string,
  notation: Notation,
  parse: (input: string) => AstNode,
): string {
  return formatAst(parse(source), notation)
}
