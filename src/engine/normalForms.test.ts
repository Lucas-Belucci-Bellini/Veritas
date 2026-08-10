import { describe, expect, it } from 'vitest'
import { collectVariables } from './ast'
import { evaluate } from './evaluator'
import { buildNormalForms, classifyForm } from './normalForms'
import { parse } from './parser'
import { assignmentForRow } from './truthTable'

/** Confere que duas expressões dão a mesma coluna para as mesmas variáveis. */
function equivalent(a: string, b: string, variables: string[]): boolean {
  const left = parse(a)
  const right = parse(b)
  return Array.from({ length: 2 ** variables.length }, (_, row) => {
    const assignment = assignmentForRow(variables, row)
    return evaluate(left, assignment) === evaluate(right, assignment)
  }).every(Boolean)
}

describe('formas normais', () => {
  it('monta SOP e POS canônicas a partir dos mintermos e maxtermos', () => {
    const forms = buildNormalForms(parse('A XOR B'))!
    expect(forms.minterms).toEqual([1, 2])
    expect(forms.maxterms).toEqual([0, 3])
    expect(forms.canonicalSop).toBe('¬A ∧ B ∨ A ∧ ¬B')
    expect(forms.canonicalPos).toBe('(A ∨ B) ∧ (¬A ∨ ¬B)')
  })

  it('minimiza a POS pelo complemento', () => {
    // F = A + B: só a linha 00 dá zero, então a POS mínima é (A + B).
    const forms = buildNormalForms(parse('A OR B'))!
    expect(forms.minimalPos).toBe('A ∨ B')
    expect(forms.minimalSop).toBe('B ∨ A')
  })

  it('mantém as quatro formas equivalentes à expressão original', () => {
    const cases = [
      'A XOR B',
      '(A AND B) OR C',
      "A' B C + B C",
      "(A + B + C)(A + B')(A' + C)",
      'A -> (B -> C)',
    ]
    for (const source of cases) {
      const ast = parse(source)
      const variables = collectVariables(ast)
      const forms = buildNormalForms(ast)!
      for (const form of [
        forms.canonicalSop,
        forms.canonicalPos,
        forms.minimalSop,
        forms.minimalPos,
      ]) {
        expect(equivalent(form, source, variables), `${source} → ${form}`).toBe(true)
      }
    }
  })

  it('lida com tautologia e contradição', () => {
    const tautology = buildNormalForms(parse('A OR NOT A'))!
    expect(tautology.minimalSop).toBe('1')
    expect(tautology.canonicalPos).toBe('1')

    const contradiction = buildNormalForms(parse('A AND NOT A'))!
    expect(contradiction.canonicalSop).toBe('0')
    expect(contradiction.minimalPos).toBe('0')
  })

  it('conta os operadores das duas formas para dar o que comparar', () => {
    const forms = buildNormalForms(parse('A XOR B'))!
    expect(forms.sopOperators).toBeGreaterThan(0)
    expect(forms.posOperators).toBeGreaterThan(0)
  })

  it('desiste quando tem variáveis demais', () => {
    const many = 'A B C D E G H I J K L M N'
    expect(buildNormalForms(parse(many))).toBeNull()
  })

  it('confere a questão 7 da atividade', () => {
    // Saída 1 nas linhas 1, 2, 4 e 7.
    const source = "A' B' C + A' B C' + A B' C' + A B C"
    const forms = buildNormalForms(parse(source))!
    expect(forms.minterms).toEqual([1, 2, 4, 7])
    expect(forms.maxterms).toEqual([0, 3, 5, 6])
    // Nenhum par de mintermos difere em um bit só: não há o que agrupar.
    expect(forms.minimalSop).toBe(forms.canonicalSop)
  })
})

describe('classificação da forma', () => {
  const cases: Array<[string, string]> = [
    ["(B + C' + D)(A' + B)", 'pos'],
    ["A' B C + A B C", 'sop'],
    ["(X + Y' + Z')(Y' + Z)(X' + Y)", 'pos'],
    ["A B C + A B C' + A B' C", 'sop'],
    ['A', 'sop'],
    ["A'", 'sop'],
  ]

  it.each(cases)('classifica %s', (source, expected) => {
    expect(classifyForm(parse(source))).toBe(expected)
  })

  it('recusa negação de um grupo inteiro', () => {
    // (A B)' não é literal, então quebra a soma de produtos.
    expect(classifyForm(parse("(A B)' + C"))).toBe('nenhuma')
    expect(classifyForm(parse("(A + B)' (C + D)"))).toBe('nenhuma')
  })

  it('aceita literal solto como termo degenerado', () => {
    // A (B + C) é um produto de dois termos-soma, sendo "A" um de um literal só.
    expect(classifyForm(parse('A (B + C)'))).toBe('pos')
    expect(classifyForm(parse('A + B C'))).toBe('sop')
  })

  it('recusa aninhamento fora do padrão', () => {
    // B (C + D) não é produto de literais, então a soma toda não é SOP.
    expect(classifyForm(parse('A + B (C + D)'))).toBe('nenhuma')
    expect(classifyForm(parse('(A B + C) (D + E)'))).toBe('nenhuma')
  })

  it('não confunde XOR e implicação com SOP', () => {
    expect(classifyForm(parse('A XOR B'))).toBe('nenhuma')
    expect(classifyForm(parse('A -> B'))).toBe('nenhuma')
  })
})
