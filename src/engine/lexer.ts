import { VeritasError } from './errors'
import { CONSTANTS, KEYWORDS, SYMBOL_OPERATORS, type Token } from './tokens'

const WHITESPACE = /\s/
const LETTER = /\p{L}/u
const DIGIT = /[0-9]/

/**
 * Transforma o texto digitado em uma lista de tokens.
 *
 * É aqui que mora o "filtro de intrusos": qualquer caractere fora do
 * dicionário (letras, dígitos, símbolos lógicos, parênteses e espaços) trava a
 * análise imediatamente, com a posição exata do caractere ofensor.
 */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < source.length) {
    const char = source[i]

    if (WHITESPACE.test(char)) {
      i += 1
      continue
    }

    const symbol = matchSymbol(source, i)
    if (symbol) {
      tokens.push({
        type: symbol.type,
        lexeme: symbol.text,
        start: i,
        end: i + symbol.text.length,
      })
      i += symbol.text.length
      continue
    }

    if (DIGIT.test(char)) {
      // Dígitos soltos só existem como constantes 0 e 1.
      const start = i
      while (i < source.length && DIGIT.test(source[i])) i += 1
      const lexeme = source.slice(start, i)
      if (lexeme in CONSTANTS) {
        tokens.push({
          type: 'const',
          lexeme,
          value: CONSTANTS[lexeme],
          start,
          end: i,
        })
        continue
      }
      throw new VeritasError(
        'lexical',
        `"${lexeme}" não é um valor lógico.`,
        start,
        i,
        'As únicas constantes são 1 (verdadeiro) e 0 (falso).',
      )
    }

    if (LETTER.test(char)) {
      const start = i
      while (i < source.length && LETTER.test(source[i])) i += 1
      const word = source.slice(start, i)

      // Uma letra seguida de dígitos ainda é uma variável: A1, Q2, X10.
      let subscriptEnd = i
      while (subscriptEnd < source.length && DIGIT.test(source[subscriptEnd])) {
        subscriptEnd += 1
      }
      const hasSubscript = subscriptEnd > i

      const upper = word.toUpperCase()

      if (!hasSubscript && upper in KEYWORDS) {
        tokens.push({ type: KEYWORDS[upper], lexeme: word, start, end: i })
        continue
      }

      if (!hasSubscript && upper in CONSTANTS) {
        tokens.push({
          type: 'const',
          lexeme: word,
          value: CONSTANTS[upper],
          start,
          end: i,
        })
        continue
      }

      if (word.length === 1) {
        const name = hasSubscript ? source.slice(start, subscriptEnd) : word
        i = subscriptEnd
        tokens.push({
          type: 'var',
          lexeme: name,
          name: name.toUpperCase(),
          start,
          end: i,
        })
        continue
      }

      throw new VeritasError(
        'lexical',
        `"${word}" não é um operador conhecido.`,
        start,
        i,
        `Variáveis têm uma letra só. Separe com espaço (${word.split('').join(' ')}) ` +
          `ou use um operador (${word.split('').join(' AND ')}).`,
      )
    }

    throw new VeritasError(
      'lexical',
      `Caractere desconhecido: "${char}".`,
      i,
      i + 1,
    )
  }

  tokens.push({ type: 'eof', lexeme: '', start: source.length, end: source.length })
  return tokens
}

function matchSymbol(
  source: string,
  index: number,
): { text: string; type: Token['type'] } | null {
  for (const [text, type] of SYMBOL_OPERATORS) {
    if (source.startsWith(text, index)) return { text, type }
  }
  return null
}
