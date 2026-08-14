import { describe, expect, it } from 'vitest'
import {
  LOGIC_TEST_CASES,
  enumerateBooleanAssignments,
  evaluateLogicTestCase,
  logicCaseIsValid,
} from './logicCases'

describe('casos interativos de lógica dos materiais', () => {
  it('enumera todas as combinações booleanas em ordem determinística', () => {
    expect(enumerateBooleanAssignments(['P', 'Q'])).toEqual([
      { P: false, Q: false },
      { P: false, Q: true },
      { P: true, Q: false },
      { P: true, Q: true },
    ])
  })

  it('reconhece a lei do terceiro excluído como tautologia', () => {
    const testCase = LOGIC_TEST_CASES.find((item) => item.id === 'tautology-excluded-middle')!
    expect(logicCaseIsValid(testCase)).toBe(true)
    expect(evaluateLogicTestCase(testCase).every((row) => row.expressionValue)).toBe(true)
  })

  it('confirma De Morgan e contrapositiva por equivalência linha a linha', () => {
    for (const id of ['equivalence-de-morgan', 'equivalence-contrapositive']) {
      const testCase = LOGIC_TEST_CASES.find((item) => item.id === id)!
      expect(logicCaseIsValid(testCase)).toBe(true)
      expect(evaluateLogicTestCase(testCase)).toHaveLength(4)
    }
  })

  it('preserva o único contraexemplo da implicação material', () => {
    const testCase = LOGIC_TEST_CASES.find((item) => item.id === 'implication-counterexample')!
    const rows = evaluateLogicTestCase(testCase)
    expect(rows.filter((row) => !row.passes).map((row) => row.assignment)).toEqual([
      { P: true, Q: false },
    ])
  })

  it('valida Modus Ponens e Modus Tollens como argumentos', () => {
    expect(logicCaseIsValid(LOGIC_TEST_CASES.find((item) => item.id === 'modus-ponens')!)).toBe(true)
    expect(logicCaseIsValid(LOGIC_TEST_CASES.find((item) => item.id === 'modus-tollens')!)).toBe(true)
  })
})
