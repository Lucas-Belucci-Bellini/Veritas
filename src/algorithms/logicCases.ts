import { evaluateExpression } from './expressions'
import type { RuntimeValue } from './model'

export type LogicCaseKind = 'tautology' | 'equivalence' | 'implication' | 'argument'

export interface LogicTestCase {
  id: string
  title: string
  source: 'Algebra de Boole' | 'Argumentos'
  kind: LogicCaseKind
  variables: string[]
  expression?: string
  equivalentExpression?: string
  premises?: string[]
  conclusion?: string
}

export interface LogicEvaluationRow {
  assignment: Record<string, boolean>
  expressionValue?: boolean
  equivalentValue?: boolean
  premiseValues?: boolean[]
  conclusionValue?: boolean
  passes: boolean
}

export const LOGIC_TEST_CASES: readonly LogicTestCase[] = [
  {
    id: 'tautology-excluded-middle',
    title: 'Lei do terceiro excluído',
    source: 'Algebra de Boole',
    kind: 'tautology',
    variables: ['P'],
    expression: 'P OR NOT P',
  },
  {
    id: 'equivalence-de-morgan',
    title: 'De Morgan: negação da conjunção',
    source: 'Algebra de Boole',
    kind: 'equivalence',
    variables: ['P', 'Q'],
    expression: 'NOT (P AND Q)',
    equivalentExpression: 'NOT P OR NOT Q',
  },
  {
    id: 'equivalence-contrapositive',
    title: 'Implicação e contrapositiva',
    source: 'Algebra de Boole',
    kind: 'equivalence',
    variables: ['P', 'Q'],
    expression: 'NOT P OR Q',
    equivalentExpression: 'Q OR NOT P',
  },
  {
    id: 'implication-counterexample',
    title: 'Implicação material',
    source: 'Algebra de Boole',
    kind: 'implication',
    variables: ['P', 'Q'],
    expression: 'NOT P OR Q',
  },
  {
    id: 'modus-ponens',
    title: 'Modus Ponens',
    source: 'Argumentos',
    kind: 'argument',
    variables: ['P', 'Q'],
    premises: ['NOT P OR Q', 'P'],
    conclusion: 'Q',
  },
  {
    id: 'modus-tollens',
    title: 'Modus Tollens',
    source: 'Argumentos',
    kind: 'argument',
    variables: ['P', 'Q'],
    premises: ['NOT P OR Q', 'NOT Q'],
    conclusion: 'NOT P',
  },
]

function booleanValue(value: RuntimeValue, expression: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`A expressão "${expression}" não produziu booleano.`)
  }
  return value
}

export function enumerateBooleanAssignments(
  variables: readonly string[],
): Record<string, boolean>[] {
  return Array.from({ length: 2 ** variables.length }, (_, index) =>
    Object.fromEntries(
      variables.map((variable, variableIndex) => [
        variable,
        Boolean(index & (1 << (variables.length - variableIndex - 1))),
      ]),
    ),
  )
}

export function evaluateLogicTestCase(testCase: LogicTestCase): LogicEvaluationRow[] {
  return enumerateBooleanAssignments(testCase.variables).map((assignment) => {
    const values = (expressions: readonly string[]) =>
      expressions.map((expression) => booleanValue(evaluateExpression(expression, assignment), expression))

    if (testCase.kind === 'equivalence') {
      const [expressionValue, equivalentValue] = values([
        testCase.expression!,
        testCase.equivalentExpression!,
      ])
      return {
        assignment,
        expressionValue,
        equivalentValue,
        passes: expressionValue === equivalentValue,
      }
    }

    if (testCase.kind === 'argument') {
      const premiseValues = values(testCase.premises ?? [])
      const conclusionValue = booleanValue(
        evaluateExpression(testCase.conclusion!, assignment),
        testCase.conclusion!,
      )
      return {
        assignment,
        premiseValues,
        conclusionValue,
        // Um argumento é violado quando todas as premissas são verdadeiras e a conclusão é falsa.
        passes: !premiseValues.every(Boolean) || conclusionValue,
      }
    }

    const expressionValue = booleanValue(evaluateExpression(testCase.expression!, assignment), testCase.expression!)
    return {
      assignment,
      expressionValue,
      passes: testCase.kind === 'tautology' || testCase.kind === 'implication'
        ? expressionValue
        : true,
    }
  })
}

export function logicCaseIsValid(testCase: LogicTestCase): boolean {
  return evaluateLogicTestCase(testCase).every((row) => row.passes)
}
