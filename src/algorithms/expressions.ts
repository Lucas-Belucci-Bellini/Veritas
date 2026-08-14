import type { RuntimeValue } from './model'

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'identifier'; value: string }
  | { kind: 'operator'; value: string }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'eof' }

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let index = 0
  while (index < source.length) {
    const character = source[index]
    if (/\s/.test(character)) {
      index += 1
      continue
    }
    if (character === '(') {
      tokens.push({ kind: 'lparen' })
      index += 1
      continue
    }
    if (character === ')') {
      tokens.push({ kind: 'rparen' })
      index += 1
      continue
    }
    if (character === '"' || character === "'") {
      const quote = character
      let value = ''
      index += 1
      while (index < source.length && source[index] !== quote) {
        if (source[index] === '\\' && index + 1 < source.length) {
          value += source[index + 1]
          index += 2
        } else {
          value += source[index]
          index += 1
        }
      }
      if (source[index] !== quote) throw new Error('A string não foi encerrada.')
      index += 1
      tokens.push({ kind: 'string', value })
      continue
    }
    const number = source.slice(index).match(/^(?:\d+(?:\.\d+)?|\.\d+)/)?.[0]
    if (number) {
      tokens.push({ kind: 'number', value: Number(number) })
      index += number.length
      continue
    }
    const operator = source.slice(index).match(/^(===|!==|==|!=|<=|>=|&&|\|\||[+\-*/<>!])/i)?.[0]
    if (operator) {
      tokens.push({ kind: 'operator', value: operator })
      index += operator.length
      continue
    }
    const identifier = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0]
    if (identifier) {
      const upper = identifier.toUpperCase()
      if (['AND', 'OR', 'NOT', 'XOR'].includes(upper)) {
        tokens.push({ kind: 'operator', value: upper })
      } else if (upper === 'TRUE' || upper === 'VERDADEIRO') {
        tokens.push({ kind: 'number', value: 1 })
        tokens.push({ kind: 'operator', value: 'TRUE_LITERAL' })
      } else if (upper === 'FALSE' || upper === 'FALSO') {
        tokens.push({ kind: 'number', value: 0 })
        tokens.push({ kind: 'operator', value: 'FALSE_LITERAL' })
      } else {
        tokens.push({ kind: 'identifier', value: identifier })
      }
      index += identifier.length
      continue
    }
    throw new Error(`Caractere inesperado na expressão: "${character}".`)
  }
  tokens.push({ kind: 'eof' })
  return tokens
}

class ExpressionParser {
  private index = 0
  private readonly tokens: Token[]

  constructor(
    private readonly source: string,
    private readonly variables: Record<string, RuntimeValue>,
  ) {
    this.tokens = tokenize(source)
  }

  parse(): RuntimeValue {
    const result = this.parseOr()
    if (this.current().kind !== 'eof') throw new Error(`Token inesperado em "${this.source}".`)
    return result
  }

  private current(): Token {
    return this.tokens[this.index]
  }

  private take(): Token {
    const token = this.current()
    this.index += 1
    return token
  }

  private matchOperator(...operators: string[]): boolean {
    const token = this.current()
    if (token.kind !== 'operator' || !operators.includes(token.value)) return false
    this.index += 1
    return true
  }

  private parseOr(): RuntimeValue {
    let left = this.parseXor()
    while (this.matchOperator('OR', '||')) left = this.booleanBinary(left, this.parseXor(), 'OR')
    return left
  }

  private parseXor(): RuntimeValue {
    let left = this.parseAnd()
    while (this.matchOperator('XOR')) left = this.booleanBinary(left, this.parseAnd(), 'XOR')
    return left
  }

  private parseAnd(): RuntimeValue {
    let left = this.parseEquality()
    while (this.matchOperator('AND', '&&')) left = this.booleanBinary(left, this.parseEquality(), 'AND')
    return left
  }

  private parseEquality(): RuntimeValue {
    let left = this.parseRelational()
    while (true) {
      if (this.matchOperator('==', '===')) left = this.compare(left, this.parseRelational(), true)
      else if (this.matchOperator('!=', '!==')) left = this.compare(left, this.parseRelational(), false)
      else return left
    }
  }

  private parseRelational(): RuntimeValue {
    let left = this.parseAdd()
    while (true) {
      if (this.matchOperator('<')) left = this.order(left, this.parseAdd(), (a, b) => a < b)
      else if (this.matchOperator('<=') ) left = this.order(left, this.parseAdd(), (a, b) => a <= b)
      else if (this.matchOperator('>')) left = this.order(left, this.parseAdd(), (a, b) => a > b)
      else if (this.matchOperator('>=')) left = this.order(left, this.parseAdd(), (a, b) => a >= b)
      else return left
    }
  }

  private parseAdd(): RuntimeValue {
    let left = this.parseMultiply()
    while (true) {
      if (this.matchOperator('+')) left = this.add(left, this.parseMultiply())
      else if (this.matchOperator('-')) left = this.numeric(left, this.parseMultiply(), (a, b) => a - b, '-')
      else return left
    }
  }

  private parseMultiply(): RuntimeValue {
    let left = this.parseUnary()
    while (true) {
      if (this.matchOperator('*')) left = this.numeric(left, this.parseUnary(), (a, b) => a * b, '*')
      else if (this.matchOperator('/')) {
        const right = this.parseUnary()
        if (right === 0) throw new Error('Divisão por zero não é permitida.')
        left = this.numeric(left, right, (a, b) => a / b, '/')
      } else return left
    }
  }

  private parseUnary(): RuntimeValue {
    if (this.matchOperator('!', 'NOT')) {
      const value = this.parseUnary()
      if (typeof value !== 'boolean') throw new Error('NOT exige uma expressão booleana.')
      return !value
    }
    if (this.matchOperator('-')) {
      const value = this.parseUnary()
      if (typeof value !== 'number') throw new Error('O sinal - exige um número.')
      return -value
    }
    return this.parsePrimary()
  }

  private parsePrimary(): RuntimeValue {
    const token = this.take()
    if (token.kind === 'number') {
      const marker = this.current()
      if (marker.kind === 'operator' && (marker.value === 'TRUE_LITERAL' || marker.value === 'FALSE_LITERAL')) {
        this.take()
        return marker.value === 'TRUE_LITERAL'
      }
      return token.value
    }
    if (token.kind === 'string') return token.value
    if (token.kind === 'identifier') {
      if (!(token.value in this.variables)) throw new Error(`A variável "${token.value}" não foi declarada.`)
      return this.variables[token.value]
    }
    if (token.kind === 'lparen') {
      const value = this.parseOr()
      if (this.current().kind !== 'rparen') throw new Error('Parêntese de fechamento ausente.')
      this.take()
      return value
    }
    throw new Error('Era esperada uma constante, variável ou parêntese.')
  }

  private booleanBinary(left: RuntimeValue, right: RuntimeValue, operator: string): boolean {
    if (typeof left !== 'boolean' || typeof right !== 'boolean') {
      throw new Error(`${operator} exige operandos booleanos.`)
    }
    if (operator === 'AND') return left && right
    if (operator === 'OR') return left || right
    return left !== right
  }

  private compare(left: RuntimeValue, right: RuntimeValue, equal: boolean): boolean {
    const result = left === right
    return equal ? result : !result
  }

  private order(
    left: RuntimeValue,
    right: RuntimeValue,
    operation: (left: number | string, right: number | string) => boolean,
  ): boolean {
    if ((typeof left !== 'number' && typeof left !== 'string')
      || (typeof right !== 'number' && typeof right !== 'string')
      || typeof left !== typeof right) {
      throw new Error('Comparações relacionais exigem dois números ou duas strings.')
    }
    if (typeof left === 'number' && typeof right === 'number') return operation(left, right)
    if (typeof left === 'string' && typeof right === 'string') return operation(left, right)
    throw new Error('Comparação relacional incompatível.')
  }

  private add(left: RuntimeValue, right: RuntimeValue): RuntimeValue {
    if (typeof left === 'number' && typeof right === 'number') return left + right
    if (typeof left === 'string' || typeof right === 'string') return String(left) + String(right)
    throw new Error('O operador + exige números ou strings.')
  }

  private numeric(
    left: RuntimeValue,
    right: RuntimeValue,
    operation: (left: number, right: number) => number,
    operator: string,
  ): number {
    if (typeof left !== 'number' || typeof right !== 'number') {
      throw new Error(`O operador ${operator} exige operandos numéricos.`)
    }
    const result = operation(left, right)
    if (!Number.isFinite(result)) throw new Error('O resultado numérico não é finito.')
    return result
  }
}

export function evaluateExpression(
  source: string,
  variables: Record<string, RuntimeValue>,
): RuntimeValue {
  if (!source.trim()) throw new Error('A expressão não pode ser vazia.')
  return new ExpressionParser(source, variables).parse()
}
