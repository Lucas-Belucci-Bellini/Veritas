import type { AstNode } from './ast'
import { LexerError, tokenize, type Token, type TokenType } from './lexer'

export class ParserError extends Error {
  position: number

  constructor(message: string, position: number) {
    super(message)
    this.name = 'ParserError'
    this.position = position
  }
}

class Parser {
  private index = 0
  private tokens: Token[]

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  parse(): AstNode {
    if (this.peek().type === 'EOF') {
      throw new ParserError('Digite uma expressão lógica', 0)
    }
    const ast = this.parseImplies()
    if (this.peek().type !== 'EOF') {
      const token = this.peek()
      throw new ParserError(
        `Token inesperado "${token.value || token.type}"`,
        token.position,
      )
    }
    return ast
  }

  private parseImplies(): AstNode {
    let left = this.parseEquiv()
    while (this.match('IMPLIES')) {
      const right = this.parseImplies()
      left = { type: 'binary', op: 'IMPLIES', left, right }
    }
    return left
  }

  private parseEquiv(): AstNode {
    let left = this.parseOr()
    while (this.match('EQUIV')) {
      const right = this.parseEquiv()
      left = { type: 'binary', op: 'EQUIV', left, right }
    }
    return left
  }

  private parseOr(): AstNode {
    let left = this.parseXor()
    while (this.match('OR')) {
      const right = this.parseXor()
      left = { type: 'binary', op: 'OR', left, right }
    }
    return left
  }

  private parseXor(): AstNode {
    let left = this.parseAnd()
    while (this.match('XOR')) {
      const right = this.parseAnd()
      left = { type: 'binary', op: 'XOR', left, right }
    }
    return left
  }

  private parseAnd(): AstNode {
    let left = this.parseUnary()
    while (this.match('AND')) {
      const right = this.parseUnary()
      left = { type: 'binary', op: 'AND', left, right }
    }
    return left
  }

  private parseUnary(): AstNode {
    if (this.match('NOT')) {
      return { type: 'not', operand: this.parseUnary() }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): AstNode {
    const token = this.peek()

    if (this.match('TRUE')) {
      return { type: 'constant', value: true }
    }

    if (this.match('FALSE')) {
      return { type: 'constant', value: false }
    }

    if (this.match('IDENT')) {
      return { type: 'variable', name: this.previous().value }
    }

    if (this.match('LPAREN')) {
      const expr = this.parseImplies()
      if (!this.match('RPAREN')) {
        throw new ParserError('Falta fechar parêntese', token.position)
      }
      return expr
    }

    if (token.type === 'EOF') {
      throw new ParserError('Expressão incompleta', token.position)
    }

    if (['AND', 'OR', 'XOR', 'IMPLIES', 'EQUIV', 'RPAREN'].includes(token.type)) {
      throw new ParserError(
        `Esperava variável ou "(", encontrou operador`,
        token.position,
      )
    }

    throw new ParserError(`Token inesperado`, token.position)
  }

  private match(type: TokenType): boolean {
    if (this.peek().type === type) {
      this.index++
      return true
    }
    return false
  }

  private peek(): Token {
    return this.tokens[this.index]
  }

  private previous(): Token {
    return this.tokens[this.index - 1]
  }
}

export function parseExpression(input: string): AstNode {
  const parenError = validateBeforeParse(input)
  if (parenError) {
    throw new ParserError(parenError, 0)
  }

  let tokens: Token[]
  try {
    tokens = tokenize(input)
  } catch (error) {
    if (error instanceof LexerError) {
      throw new ParserError(error.message, error.position)
    }
    throw error
  }

  return new Parser(tokens).parse()
}

function validateBeforeParse(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  let depth = 0
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '(') depth++
    if (trimmed[i] === ')') {
      depth--
      if (depth < 0) return 'Parêntese fechado sem abertura correspondente'
    }
  }
  if (depth > 0) {
    return depth === 1
      ? 'Falta fechar 1 parêntese'
      : `Faltam fechar ${depth} parênteses`
  }
  return null
}
