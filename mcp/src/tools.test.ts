import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  evaluateExpression,
  getChip,
  karnaugh,
  listChips,
  simplifyExpression,
  truthTable,
} from './tools'

describe('truth_table', () => {
  it('devolve a tabela em markdown com a classificação', () => {
    const { text } = truthTable('A XOR B')
    expect(text).toContain('| A | B | A ⊕ B |')
    expect(text).toContain('| 0 | 1 | 1 |')
    expect(text).toContain('Classificação: contingencia')
  })

  it('respeita o pedido de esconder os passos', () => {
    const withSteps = truthTable('(A AND B) OR C').text
    const without = truthTable('(A AND B) OR C', { includeSteps: false }).text
    expect(withSteps).toContain('A ∧ B |')
    expect(without.split('\n')[0]).toBe('| A | B | C | A ∧ B ∨ C |')
  })

  it('avisa quando corta a tabela', () => {
    const { text } = truthTable('A AND B AND C AND D AND E', { maxRows: 4 })
    expect(text).toContain('Exibindo 4 de 32 linhas')
  })

  it('explica o erro de sintaxe apontando a posição', () => {
    expect(() => truthTable('(A AND')).toThrow('Falta fechar 1 parêntese')
    try {
      truthTable('A AND OR B')
    } catch (error) {
      expect((error as Error).message).toContain('Dois operadores seguidos')
      expect((error as Error).message).toContain('^')
    }
  })
})

describe('evaluate_expression', () => {
  it('resolve e mostra os passos', () => {
    const { text } = evaluateExpression('(A AND B) OR NOT C', {
      A: true,
      B: false,
      C: false,
    })
    expect(text).toContain('= VERDADEIRO')
    expect(text).toContain('A ∧ B = F')
    expect(text).toContain('¬C = V')
  })

  it('reclama de variável sem valor em vez de assumir falso', () => {
    const result = evaluateExpression('A AND B', { A: true })
    expect(result.isError).toBe(true)
    expect(result.text).toContain('Faltam valores para: B')
  })
})

describe('simplify_expression', () => {
  it('minimiza e conta a economia', () => {
    const { text } = simplifyExpression('(A AND B) OR (A AND NOT B)')
    expect(text).toContain('Mínima:   A')
    expect(text).toContain('Operadores: 4 → 0')
  })

  it('recusa expressões grandes demais', () => {
    const many = 'A AND B AND C AND D AND E AND G AND H AND I AND J AND K AND L AND M AND N'
    expect(simplifyExpression(many).isError).toBe(true)
  })
})

describe('karnaugh_map', () => {
  it('desenha o mapa e lista os agrupamentos', () => {
    const { text } = karnaugh('(NOT B AND NOT D) OR (A AND C)')
    expect(text).toContain('| AB\\CD | 00 | 01 | 11 | 10 |')
    expect(text).toContain('¬B ∧ ¬D  (4 células)')
    expect(text).toContain('A ∧ C  (4 células)')
  })

  it('recusa acima de quatro variáveis', () => {
    expect(karnaugh('A AND B AND C AND D AND E').isError).toBe(true)
  })
})

// O catálogo é lido do disco; sem ele estes testes não fazem sentido.
const hasCatalog = existsSync(new URL('../../src/chips/catalog.json', import.meta.url))

describe.skipIf(!hasCatalog)('biblioteca de chips', () => {
  it('filtra por nome e por expressão derivada', () => {
    const { text } = listChips({ query: 'Full Adder', onlyDerived: true, limit: 5 })
    expect(text).toContain('Full Adder')
    expect(text).toContain('(com expressão)')
  })

  it('avisa quando nada casa', () => {
    expect(listChips({ query: 'chip-que-nao-existe' }).text).toContain(
      'Nenhum chip encontrado',
    )
  })

  it('descreve um chip com as expressões de cada saída', () => {
    const { text } = getChip('Full Adder')
    expect(text).toContain('Entradas: Carry In, IN A, IN B')
    expect(text).toContain('Carry Out = (B AND C) OR (A AND C) OR (A AND B)')
  })

  it('sugere nomes parecidos quando erra o chip', () => {
    const result = getChip('Full Add')
    expect(result.isError).toBe(true)
    expect(result.text).toContain('Parecidos:')
  })
})
