import { describe, expect, it } from 'vitest'
import { VeritasError } from './errors'
import { formatExpressionError } from './expressionErrorPresentation'

describe('apresentação de erro de expressão', () => {
  it('mostra posição, trecho e marcador na primeira linha', () => {
    const result = formatExpressionError('A AND @', new VeritasError('lexical', 'caractere desconhecido', 6, 7))

    expect(result).toEqual({
      location: 'Posição 1:7',
      sourceLine: 'A AND @',
      caret: '      ^',
      excerpt: '@',
    })
  })

  it('calcula a coluna depois de uma quebra de linha', () => {
    const result = formatExpressionError('A AND\n(B OR @)', new VeritasError('lexical', 'caractere desconhecido', 12, 13))

    expect(result.location).toBe('Posição 2:7')
    expect(result.sourceLine).toBe('(B OR @)')
    expect(result.caret).toBe('      ^')
    expect(result.excerpt).toBe('@')
  })

  it('marca o fim quando o erro aponta para EOF', () => {
    const result = formatExpressionError('A AND', new VeritasError('syntax', 'falta o lado direito', 5, 5))

    expect(result.location).toBe('Posição 1:6')
    expect(result.sourceLine).toBe('A AND')
    expect(result.caret).toBe('     ^')
    expect(result.excerpt).toBe('fim da expressão')
  })
})
