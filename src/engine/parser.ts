import {
  NOT_PRECEDENCE,
  PRECEDENCE,
  RIGHT_ASSOCIATIVE,
  type AstNode,
  type BinaryOp,
} from './ast'
import { VeritasError } from './errors'
import { tokenize } from './lexer'
import { describeToken, isOperatorToken, OPERATOR_LABELS, type Token } from './tokens'

/**
 * Analisador sintático descendente com escalada de precedência.
 *
 * Antes de montar a árvore ele roda o "teste da pilha" nos parênteses, porque
 * esse é o erro mais comum e merece uma mensagem própria — dizer "esperava uma
 * variável" quando o usuário só esqueceu de fechar um parêntese é confuso.
 */
export function parse(source: string): AstNode {
  const tokens = tokenize(source)

  if (tokens.length === 1) {
    throw new VeritasError('empty', 'Digite uma expressão para começar.', 0, 0)
  }

  checkParentheses(tokens)

  const parser = new Parser(tokens)
  const node = parser.parseExpression(0)
  parser.expectEnd()
  return node
}

/** Faz o parse mas devolve o erro em vez de lançá-lo. */
export function tryParse(
  source: string,
): { ok: true; ast: AstNode } | { ok: false; error: VeritasError } {
  try {
    return { ok: true, ast: parse(source) }
  } catch (error) {
    if (error instanceof VeritasError) return { ok: false, error }
    throw error
  }
}

function checkParentheses(tokens: Token[]): void {
  const stack: Token[] = []

  for (const token of tokens) {
    if (token.type === 'lparen') stack.push(token)
    if (token.type === 'rparen') {
      if (stack.length === 0) {
        throw new VeritasError(
          'paren',
          'Você fechou um parêntese que nunca foi aberto.',
          token.start,
          token.end,
        )
      }
      stack.pop()
    }
  }

  if (stack.length > 0) {
    const first = stack[0]
    const message =
      stack.length === 1
        ? 'Falta fechar 1 parêntese.'
        : `Faltam fechar ${stack.length} parênteses.`
    throw new VeritasError('paren', message, first.start, first.end)
  }
}

class Parser {
  private index = 0

  constructor(private readonly tokens: Token[]) {}

  private get current(): Token {
    return this.tokens[this.index]
  }

  private get previous(): Token | undefined {
    return this.index > 0 ? this.tokens[this.index - 1] : undefined
  }

  private advance(): Token {
    return this.tokens[this.index++]
  }

  /** Escalada de precedência: consome operadores com força >= `minPrecedence`. */
  parseExpression(minPrecedence: number): AstNode {
    let left = this.parseUnary()

    while (true) {
      // Justaposição vale AND, como nos livros: `A B`, `(A + B)(A + C)`, `A B'`.
      const explicit = isBinaryOp(this.current.type)
      if (!explicit && !startsOperand(this.current.type)) break

      const op = explicit ? (this.current.type as BinaryOp) : 'and'
      const precedence = PRECEDENCE[op]
      if (precedence < minPrecedence) break

      if (explicit) this.advance()
      const nextMin = RIGHT_ASSOCIATIVE.has(op) ? precedence : precedence + 1
      const right = this.parseExpression(nextMin)

      left = {
        kind: 'binary',
        op,
        left,
        right,
        span: { start: left.span.start, end: right.span.end },
      }
    }

    return left
  }

  private parseUnary(): AstNode {
    if (this.current.type === 'not') {
      const operator = this.advance()
      const operand = this.parseExpression(NOT_PRECEDENCE)
      return {
        kind: 'not',
        operand,
        span: { start: operator.start, end: operand.span.end },
      }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): AstNode {
    return this.applyPrimes(this.parseOperand())
  }

  /** `A''` nega duas vezes; o apóstrofo gruda no operando à esquerda. */
  private applyPrimes(node: AstNode): AstNode {
    let result = node
    while (this.current.type === 'prime') {
      const prime = this.advance()
      result = {
        kind: 'not',
        operand: result,
        span: { start: result.span.start, end: prime.end },
      }
    }
    return result
  }

  private parseOperand(): AstNode {
    const token = this.current

    if (token.type === 'var') {
      this.advance()
      return {
        kind: 'var',
        name: token.name!,
        span: { start: token.start, end: token.end },
      }
    }

    if (token.type === 'const') {
      this.advance()
      return {
        kind: 'const',
        value: token.value!,
        span: { start: token.start, end: token.end },
      }
    }

    if (token.type === 'lparen') {
      const open = this.advance()
      if (this.current.type === 'rparen') {
        throw new VeritasError(
          'syntax',
          'Parênteses vazios — coloque uma expressão entre eles.',
          open.start,
          this.current.end,
        )
      }
      const inner = this.parseExpression(0)
      const closing: Token = this.current
      if (closing.type !== 'rparen') {
        // O teste da pilha garante que o ")" existe em algum lugar; se ele não
        // está aqui, é porque sobrou alguma coisa dentro dos parênteses.
        this.expectEnd()
      }
      const close = this.advance()
      return { ...inner, span: { start: open.start, end: close.end } }
    }

    throw this.missingOperand(token)
  }

  /** Erro de "faltou um operando", com a mensagem mais específica possível. */
  private missingOperand(token: Token): VeritasError {
    const previous = this.previous

    if (token.type === 'eof') {
      if (previous && isOperatorToken(previous.type)) {
        return new VeritasError(
          'syntax',
          `A expressão termina em "${OPERATOR_LABELS[previous.type]}" e falta o lado direito.`,
          previous.start,
          previous.end,
        )
      }
      return new VeritasError(
        'syntax',
        'A expressão está incompleta.',
        token.start,
        token.end,
      )
    }

    if (isOperatorToken(token.type) && previous && isOperatorToken(previous.type)) {
      return new VeritasError(
        'syntax',
        `Dois operadores seguidos: "${OPERATOR_LABELS[previous.type]}" e "${OPERATOR_LABELS[token.type]}".`,
        previous.start,
        token.end,
      )
    }

    if (isOperatorToken(token.type)) {
      return new VeritasError(
        'syntax',
        `Falta uma variável antes de "${OPERATOR_LABELS[token.type]}".`,
        token.start,
        token.end,
      )
    }

    if (token.type === 'rparen') {
      return new VeritasError(
        'syntax',
        'Falta uma expressão antes de fechar o parêntese.',
        token.start,
        token.end,
      )
    }

    if (token.type === 'prime') {
      return new VeritasError(
        'syntax',
        'O apóstrofo nega o que vem antes dele, e aqui não há nada antes.',
        token.start,
        token.end,
        'Escreva A\u2019 para negar A.',
      )
    }

    return new VeritasError(
      'syntax',
      `Não esperava ${describeToken(token)} aqui.`,
      token.start,
      token.end,
    )
  }

  expectEnd(): void {
    const token = this.current
    if (token.type === 'eof') return

    if (token.type === 'var' || token.type === 'const' || token.type === 'lparen') {
      const previous = this.previous
      const left = previous ? previous.lexeme : ''
      throw new VeritasError(
        'syntax',
        `Falta um operador entre "${left}" e "${token.lexeme}".`,
        previous ? previous.start : token.start,
        token.end,
        'Use AND, OR, XOR, → ou ↔ para ligar as duas partes.',
      )
    }

    throw new VeritasError(
      'syntax',
      `Não esperava ${describeToken(token)} aqui.`,
      token.start,
      token.end,
    )
  }
}

function isBinaryOp(type: Token['type']): boolean {
  return type in PRECEDENCE
}

/** Tokens que podem abrir um operando — e portanto disparar o AND implícito. */
function startsOperand(type: Token['type']): boolean {
  return type === 'var' || type === 'const' || type === 'lparen' || type === 'not'
}
