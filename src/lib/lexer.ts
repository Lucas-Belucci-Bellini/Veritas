export type TokenType =
  | 'IDENT'
  | 'TRUE'
  | 'FALSE'
  | 'LPAREN'
  | 'RPAREN'
  | 'NOT'
  | 'AND'
  | 'OR'
  | 'XOR'
  | 'IMPLIES'
  | 'EQUIV'
  | 'EOF'

export interface Token {
  type: TokenType
  value: string
  position: number
}

export class LexerError extends Error {
  position: number

  constructor(message: string, position: number) {
    super(message)
    this.name = 'LexerError'
    this.position = position
  }
}

const KEYWORDS: Record<string, TokenType> = {
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
  XOR: 'XOR',
  IMPLIES: 'IMPLIES',
  EQUIV: 'EQUIV',
  TRUE: 'TRUE',
  FALSE: 'FALSE',
  V: 'TRUE',
  F: 'FALSE',
}

function normalizeInput(input: string): string {
  return input
    .replace(/<=>/g, ' EQUIV ')
    .replace(/<->/g, ' EQUIV ')
    .replace(/↔/g, ' EQUIV ')
    .replace(/=>/g, ' IMPLIES ')
    .replace(/->/g, ' IMPLIES ')
    .replace(/→/g, ' IMPLIES ')
    .replace(/&&/g, ' AND ')
    .replace(/∧/g, ' AND ')
    .replace(/\|\|/g, ' OR ')
    .replace(/∨/g, ' OR ')
    .replace(/⊕/g, ' XOR ')
    .replace(/!/g, ' NOT ')
    .replace(/¬/g, ' NOT ')
    .replace(/\^/g, ' XOR ')
}

export function tokenize(input: string): Token[] {
  const normalized = normalizeInput(input.trim())
  const tokens: Token[] = []
  let i = 0

  while (i < normalized.length) {
    const char = normalized[i]

    if (/\s/.test(char)) {
      i++
      continue
    }

    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(', position: i })
      i++
      continue
    }

    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')', position: i })
      i++
      continue
    }

    if (char === '&') {
      tokens.push({ type: 'AND', value: 'AND', position: i })
      i++
      continue
    }

    if (char === '|') {
      tokens.push({ type: 'OR', value: 'OR', position: i })
      i++
      continue
    }

    if (char === '0') {
      tokens.push({ type: 'FALSE', value: '0', position: i })
      i++
      continue
    }

    if (char === '1') {
      tokens.push({ type: 'TRUE', value: '1', position: i })
      i++
      continue
    }

    if (/[A-Za-z]/.test(char)) {
      let word = ''
      const start = i
      while (i < normalized.length && /[A-Za-z]/.test(normalized[i])) {
        word += normalized[i]
        i++
      }
      const upper = word.toUpperCase()
      const keyword = KEYWORDS[upper]
      if (keyword) {
        tokens.push({ type: keyword, value: upper, position: start })
      } else if (word.length === 1 && /[A-Z]/i.test(word)) {
        tokens.push({ type: 'IDENT', value: upper, position: start })
      } else {
        throw new LexerError(`Identificador desconhecido: "${word}"`, start)
      }
      continue
    }

    throw new LexerError(`Caractere desconhecido: "${char}"`, i)
  }

  tokens.push({ type: 'EOF', value: '', position: i })
  return tokens
}

export function validateParentheses(input: string): string | null {
  let depth = 0
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '(') depth++
    if (input[i] === ')') {
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
