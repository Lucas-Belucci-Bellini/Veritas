import { describe, expect, it } from 'vitest'
import { collectVariables } from './ast'
import { evaluate } from './evaluator'
import { assignmentForRow } from './truthTable'
import { parse } from './parser'

function allAssignments(source: string): Record<string, boolean>[] {
  const variables = collectVariables(parse(source))
  return Array.from({ length: 2 ** variables.length }, (_, row) => assignmentForRow(variables, row))
}

function isTautology(source: string): boolean {
  return allAssignments(source).every((assignment) => evaluate(parse(source), assignment))
}

function equivalent(left: string, right: string): boolean {
  return allAssignments(`${left} AND ${right}`).every((assignment) => (
    evaluate(parse(left), assignment) === evaluate(parse(right), assignment)
  ))
}

describe('regressões derivadas dos materiais didáticos', () => {
  it('reconhece tautologias clássicas das tabelas verdade', () => {
    expect(isTautology('P OR NOT P')).toBe(true)
    expect(isTautology('P -> (Q -> P)')).toBe(true)
    expect(isTautology('(P -> Q) -> (NOT Q -> NOT P)')).toBe(true)
  })

  it('confirma equivalências de implicação, bicondicional e De Morgan', () => {
    expect(equivalent('P -> Q', 'NOT P OR Q')).toBe(true)
    expect(equivalent('P IFF Q', '(P -> Q) AND (Q -> P)')).toBe(true)
    expect(equivalent('NOT (P AND Q)', 'NOT P OR NOT Q')).toBe(true)
    expect(equivalent('NOT (P OR Q)', 'NOT P AND NOT Q')).toBe(true)
  })

  it('confirma que a contrapositiva é equivalente, mas a recíproca não', () => {
    expect(equivalent('P -> Q', 'NOT Q -> NOT P')).toBe(true)
    expect(equivalent('P -> Q', 'Q -> P')).toBe(false)
    expect(evaluate(parse('Q -> P'), { P: false, Q: true })).toBe(false)
  })

  it('valida regras de inferência como condicionais associadas', () => {
    expect(isTautology('(P -> Q) AND P -> Q')).toBe(true)
    expect(isTautology('(P -> Q) AND NOT Q -> NOT P')).toBe(true)
    expect(isTautology('(P -> Q) AND (Q -> R) -> (P -> R)')).toBe(true)
  })

  it('classifica uma contradição e preserva o caso falso da condicional', () => {
    expect(isTautology('NOT (P OR NOT P)')).toBe(false)
    expect(evaluate(parse('P -> Q'), { P: true, Q: false })).toBe(false)
    expect(evaluate(parse('P -> Q'), { P: false, Q: false })).toBe(true)
  })
})
