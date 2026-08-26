import {
  createDocumentRuntime,
  diagnoseDocumentRuntimePreview,
} from '../simulation/documentRuntime'
import type { SettleDiagnostic } from '../simulation/simulator'
import { evaluateCircuit } from './evaluate'
import { CircuitValidationError, type CircuitDocument } from './editorModel'
import { normalizeCircuitDocument } from './documentContract'
import {
  collectCircuitPorts,
  compareCircuitText,
  duplicatePortMessage,
} from './portIdentity'
import type { CustomChipLibraryEntry } from './customChip'

export const TESTBENCH_FORMAT = 'veritas-testbench'
export const TESTBENCH_VERSION = 1

export type TestbenchCaseDiagnostic = SettleDiagnostic

/** Teto de casos em um documento de teste. */
export const MAX_TESTBENCH_CASES = 512
/** Teto de tiques somados em todos os casos sequenciais. */
export const MAX_TESTBENCH_TICKS = 1000
/** Teto da janela diagnóstica adicional por caso sequencial. */
export const MAX_TESTBENCH_DIAGNOSTIC_TICKS = 64

/**
 * Um passo de um caso sequencial: aplica entradas, roda tiques e — quando há
 * `expect` — confere as saídas **depois** dos tiques.
 */
export interface TestbenchStep {
  set?: Readonly<Record<string, boolean>>
  ticks?: number
  expect?: Readonly<Record<string, boolean>>
}

/**
 * Um caso de teste. Ou é combinacional (`inputs` + `expect`) ou é sequencial
 * (`steps`); misturar os dois torna a intenção ambígua e é recusado.
 */
export interface TestbenchCase {
  name?: string
  inputs?: Readonly<Record<string, boolean>>
  expect?: Readonly<Record<string, boolean>>
  steps?: readonly TestbenchStep[]
}

export interface TestbenchDocument {
  format: typeof TESTBENCH_FORMAT
  version: typeof TESTBENCH_VERSION
  name: string
  cases: TestbenchCase[]
}

export type TestbenchStatus = 'passed' | 'failed' | 'invalid'

export type TestbenchIssueCode =
  | 'invalid-document'
  | 'empty-cases'
  | 'mixed-case-mode'
  | 'missing-expectation'
  | 'unknown-input'
  | 'unknown-output'
  | 'duplicate-port-name'
  | 'cases-exceeded'
  | 'ticks-exceeded'
  | 'diagnostic-budget-invalid'

export interface TestbenchIssue {
  code: TestbenchIssueCode
  message: string
  /** Índice do caso, quando o problema é de um caso específico. */
  caseIndex?: number
}

export interface TestbenchMismatch {
  output: string
  expected: boolean
  actual: boolean
  /** Tique em que a expectativa falhou; ausente no modo combinacional. */
  tick?: number
  /** Passo do roteiro; ausente no modo combinacional. */
  step?: number
}

export interface TestbenchCaseResult {
  index: number
  name: string
  mode: 'combinational' | 'sequential'
  status: 'passed' | 'failed'
  /** Somente as saídas que não bateram, em ordem canônica. */
  mismatches: TestbenchMismatch[]
  /** Diagnóstico bounded do estado final, somente para casos sequenciais. */
  diagnostic?: SettleDiagnostic
}

export interface TestbenchReport {
  status: TestbenchStatus
  total: number
  passed: number
  failed: number
  cases: TestbenchCaseResult[]
  issues: TestbenchIssue[]
}

export interface TestbenchOptions {
  customChips?: readonly CustomChipLibraryEntry[]
  /** Janela bounded usada para diagnosticar o estado final de cada caso sequencial. */
  diagnosticTicks?: number
}

/**
 * Roda um documento de teste contra um circuito.
 *
 * O testbench é **dado, não código**: um conjunto de vetores e expectativas.
 * Nenhuma expressão do usuário é avaliada, nada é compilado e nada é executado
 * fora do avaliador do próprio Veritas — a fronteira de segurança do formato
 * `.veritas` vale igual aqui.
 *
 * Todos os casos rodam, mesmo depois do primeiro que falha: o produto útil de
 * um testbench é saber **quantos e quais** falharam, não parar no primeiro.
 */
export function runTestbench(
  document: CircuitDocument,
  testbench: TestbenchDocument,
  options: TestbenchOptions = {},
): TestbenchReport {
  const optionIssues = validateTestbenchOptions(options)
  if (optionIssues.length > 0) return invalid(optionIssues)

  const normalized = normalizeCircuitDocument(document)
  const identity = collectCircuitPorts(normalized)

  if (identity.duplicates.length > 0) {
    return invalid(
      identity.duplicates.map((duplicate) => ({
        code: 'duplicate-port-name' as const,
        message: duplicatePortMessage(duplicate),
      })),
    )
  }

  const shapeIssues = validateTestbenchShape(testbench)
  if (shapeIssues.length > 0) return invalid(shapeIssues)

  const referenceIssues = validateReferences(testbench, identity.inputIds, identity.outputIds)
  if (referenceIssues.length > 0) return invalid(referenceIssues)

  const results: TestbenchCaseResult[] = []
  for (const [index, testCase] of testbench.cases.entries()) {
    results.push(
      testCase.steps
        ? runSequentialCase(normalized, testCase, index, identity, options)
        : runCombinationalCase(normalized, testCase, index, identity, options),
    )
  }

  const passed = results.filter((result) => result.status === 'passed').length
  return {
    status: passed === results.length ? 'passed' : 'failed',
    total: results.length,
    passed,
    failed: results.length - passed,
    cases: results,
    issues: [],
  }
}

type PortIdentity = ReturnType<typeof collectCircuitPorts>

function runCombinationalCase(
  document: CircuitDocument,
  testCase: TestbenchCase,
  index: number,
  identity: PortIdentity,
  options: TestbenchOptions,
): TestbenchCaseResult {
  const inputs: Record<string, boolean> = {}
  for (const [name, value] of Object.entries(testCase.inputs ?? {})) {
    inputs[identity.inputIds.get(name)!] = value
  }

  const evaluation = evaluate(document, inputs, options)
  const mismatches: TestbenchMismatch[] = []
  for (const output of sortedNames(testCase.expect ?? {})) {
    const expected = testCase.expect![output]
    const actual = evaluation.outputs[identity.outputIds.get(output)!] ?? false
    if (actual !== expected) mismatches.push({ output, expected, actual })
  }

  return {
    index,
    name: caseName(testCase, index),
    mode: 'combinational',
    status: mismatches.length === 0 ? 'passed' : 'failed',
    mismatches,
  }
}

function runSequentialCase(
  document: CircuitDocument,
  testCase: TestbenchCase,
  index: number,
  identity: PortIdentity,
  options: TestbenchOptions,
): TestbenchCaseResult {
  const runtime = buildRuntime(document, options)
  const mismatches: TestbenchMismatch[] = []

  ;(testCase.steps ?? []).forEach((step, stepIndex) => {
    for (const [name, value] of Object.entries(step.set ?? {})) {
      runtime.setInput(identity.inputIds.get(name)!, value)
    }
    runtime.tick(normalizeTicks(step.ticks))

    for (const output of sortedNames(step.expect ?? {})) {
      const expected = step.expect![output]
      const actual = runtime.read(identity.outputIds.get(output)!)
      if (actual !== expected) {
        mismatches.push({ output, expected, actual, tick: runtime.tickCount, step: stepIndex })
      }
    }
  })

  const diagnostic = diagnoseSequentialCase(document, runtime, options)
  return {
    index,
    name: caseName(testCase, index),
    mode: 'sequential',
    status: mismatches.length === 0 ? 'passed' : 'failed',
    mismatches,
    diagnostic,
  }
}

function evaluate(
  document: CircuitDocument,
  inputs: Record<string, boolean>,
  options: TestbenchOptions,
) {
  try {
    return evaluateCircuit(document, inputs, { customChips: options.customChips })
  } catch (error) {
    throw new Error(`Circuito inválido: ${describe(error)}`)
  }
}

function buildRuntime(document: CircuitDocument, options: TestbenchOptions) {
  try {
    return createDocumentRuntime(document, {
      customChips: options.customChips,
      maxTotalTicks: MAX_TESTBENCH_TICKS + diagnosticTicks(options),
    })
  } catch (error) {
    throw new Error(`Circuito inválido: ${describe(error)}`)
  }
}

function diagnoseSequentialCase(
  document: CircuitDocument,
  runtime: ReturnType<typeof createDocumentRuntime>,
  options: TestbenchOptions,
): SettleDiagnostic {
  try {
    return diagnoseDocumentRuntimePreview(document, {
      customChips: options.customChips,
      maxTotalTicks: MAX_TESTBENCH_TICKS + diagnosticTicks(options),
      maxTicks: diagnosticTicks(options),
      simulatorState: runtime.exportState(),
    }).diagnostic
  } catch (error) {
    throw new Error(`Não foi possível diagnosticar o caso sequencial: ${describe(error)}`)
  }
}

function describe(error: unknown): string {
  if (error instanceof CircuitValidationError) return error.issues[0]?.message ?? error.message
  return error instanceof Error ? error.message : 'motivo desconhecido'
}

function validateTestbenchOptions(options: TestbenchOptions): TestbenchIssue[] {
  if (options.diagnosticTicks === undefined) return []
  if (
    !Number.isInteger(options.diagnosticTicks) ||
    options.diagnosticTicks < 1 ||
    options.diagnosticTicks > MAX_TESTBENCH_DIAGNOSTIC_TICKS
  ) {
    return [
      {
        code: 'diagnostic-budget-invalid',
        message:
          `O budget diagnóstico precisa ser um inteiro entre 1 e ${MAX_TESTBENCH_DIAGNOSTIC_TICKS} tiques.`,
      },
    ]
  }
  return []
}

function diagnosticTicks(options: TestbenchOptions): number {
  return options.diagnosticTicks ?? MAX_TESTBENCH_DIAGNOSTIC_TICKS
}

function validateTestbenchShape(testbench: TestbenchDocument): TestbenchIssue[] {
  if (
    testbench?.format !== TESTBENCH_FORMAT ||
    testbench.version !== TESTBENCH_VERSION ||
    !Array.isArray(testbench.cases)
  ) {
    return [
      {
        code: 'invalid-document',
        message: `O documento de teste precisa ser um ${TESTBENCH_FORMAT} versão ${TESTBENCH_VERSION} com uma lista de casos.`,
      },
    ]
  }

  if (testbench.cases.length === 0) {
    return [{ code: 'empty-cases', message: 'O documento de teste precisa ter pelo menos um caso.' }]
  }

  if (testbench.cases.length > MAX_TESTBENCH_CASES) {
    return [
      {
        code: 'cases-exceeded',
        message: `O documento tem ${testbench.cases.length} casos; o limite é ${MAX_TESTBENCH_CASES}.`,
      },
    ]
  }

  const issues: TestbenchIssue[] = []
  let totalTicks = 0

  for (const [index, testCase] of testbench.cases.entries()) {
    const hasSteps = Array.isArray(testCase.steps)
    const hasVector = testCase.inputs !== undefined || testCase.expect !== undefined

    if (hasSteps && hasVector) {
      issues.push({
        code: 'mixed-case-mode',
        caseIndex: index,
        message:
          `O caso ${caseName(testCase, index)} usa "steps" e também "inputs"/"expect". ` +
          'Um caso é combinacional ou sequencial, nunca os dois.',
      })
      continue
    }

    if (hasSteps) {
      const steps = testCase.steps ?? []
      if (steps.length === 0) {
        issues.push({
          code: 'missing-expectation',
          caseIndex: index,
          message: `O caso sequencial ${caseName(testCase, index)} não tem nenhum passo.`,
        })
        continue
      }
      if (!steps.some((step) => step.expect && Object.keys(step.expect).length > 0)) {
        issues.push({
          code: 'missing-expectation',
          caseIndex: index,
          message:
            `O caso sequencial ${caseName(testCase, index)} não confere nenhuma saída. ` +
            'Um caso sem expectativa não pode falhar, então não testa nada.',
        })
        continue
      }
      for (const step of steps) totalTicks += normalizeTicks(step.ticks)
      continue
    }

    if (!testCase.expect || Object.keys(testCase.expect).length === 0) {
      issues.push({
        code: 'missing-expectation',
        caseIndex: index,
        message:
          `O caso ${caseName(testCase, index)} não declara nenhuma saída esperada. ` +
          'Um caso sem expectativa não pode falhar, então não testa nada.',
      })
    }
  }

  if (totalTicks > MAX_TESTBENCH_TICKS) {
    issues.push({
      code: 'ticks-exceeded',
      message:
        `Os casos sequenciais somam ${totalTicks} tiques; o limite é ${MAX_TESTBENCH_TICKS}. ` +
        'Nenhum caso foi executado.',
    })
  }

  return issues
}

function validateReferences(
  testbench: TestbenchDocument,
  inputIds: ReadonlyMap<string, string>,
  outputIds: ReadonlyMap<string, string>,
): TestbenchIssue[] {
  const unknownInputs = new Set<string>()
  const unknownOutputs = new Set<string>()

  const checkInputs = (record: Readonly<Record<string, boolean>> | undefined) => {
    for (const name of Object.keys(record ?? {})) if (!inputIds.has(name)) unknownInputs.add(name)
  }
  const checkOutputs = (record: Readonly<Record<string, boolean>> | undefined) => {
    for (const name of Object.keys(record ?? {})) if (!outputIds.has(name)) unknownOutputs.add(name)
  }

  for (const testCase of testbench.cases) {
    checkInputs(testCase.inputs)
    checkOutputs(testCase.expect)
    for (const step of testCase.steps ?? []) {
      checkInputs(step.set)
      checkOutputs(step.expect)
    }
  }

  const issues: TestbenchIssue[] = []
  if (unknownInputs.size > 0) {
    issues.push({
      code: 'unknown-input',
      message: `O teste usa entradas que não existem no circuito: ${[...unknownInputs].sort(compareCircuitText).join(', ')}.`,
    })
  }
  if (unknownOutputs.size > 0) {
    issues.push({
      code: 'unknown-output',
      message: `O teste espera saídas que não existem no circuito: ${[...unknownOutputs].sort(compareCircuitText).join(', ')}.`,
    })
  }
  return issues
}

function sortedNames(record: Readonly<Record<string, boolean>>): string[] {
  return Object.keys(record).sort(compareCircuitText)
}

function caseName(testCase: TestbenchCase, index: number): string {
  const name = testCase.name?.trim()
  return name && name.length > 0 ? name : `#${index + 1}`
}

function normalizeTicks(ticks: number | undefined): number {
  if (ticks === undefined || !Number.isFinite(ticks)) return 1
  return Math.max(1, Math.floor(ticks))
}

function invalid(issues: TestbenchIssue[]): TestbenchReport {
  return { status: 'invalid', total: 0, passed: 0, failed: 0, cases: [], issues }
}
