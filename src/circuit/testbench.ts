import { bitVector, BitVectorError, toBinary, type BitVector } from '../bus'
import {
  createDocumentRuntime,
  diagnoseDocumentRuntimePreview,
  snapshotDocumentRuntime,
} from '../simulation/documentRuntime'
import type { SettleDiagnostic } from '../simulation/simulator'
import { evaluateCircuit, evaluateCircuitVectors } from './evaluate'
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

/** Caso combinacional com entradas e expectativas em barramentos. */
export interface TestbenchVectorCase {
  inputs?: Readonly<Record<string, string | number>>
  expect?: Readonly<Record<string, string | number>>
}

/**
 * Um caso de teste. Pode ser combinacional escalar (`inputs` + `expect`),
 * combinacional multi-bit (`vectors`) ou sequencial (`steps`); misturar modos
 * torna a intenção ambígua e é recusado.
 */
export interface TestbenchCase {
  name?: string
  inputs?: Readonly<Record<string, boolean>>
  expect?: Readonly<Record<string, boolean>>
  vectors?: TestbenchVectorCase
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
  | 'vector-invalid'

export interface TestbenchIssue {
  code: TestbenchIssueCode
  message: string
  /** Índice do caso, quando o problema é de um caso específico. */
  caseIndex?: number
}

export interface TestbenchMismatch {
  output: string
  /** Valores escalares; ficam ausentes quando `vector` descreve a divergência. */
  expected?: boolean
  actual?: boolean
  /** Valores canônicos MSB → LSB de uma divergência multi-bit. */
  vector?: {
    width: number
    expected: string
    actual: string
  }
  /** Tique em que a expectativa falhou; ausente no modo combinacional. */
  tick?: number
  /** Passo do roteiro; ausente no modo combinacional. */
  step?: number
}

/** Estado observável capturado em uma expectativa do testbench. */
export interface TestbenchSnapshot {
  caseIndex: number
  /** Para casos combinacionais, o tique 0 representa a avaliação instantânea. */
  tick: number
  /** Passo do roteiro que produziu a observação; ausente no modo combinacional. */
  step?: number
  /** Valores de saída dos componentes, em ordem canônica por ID. */
  values: Record<string, boolean[]>
}

/** Primeiro sinal que divergiu na ordem de execução e na ordem canônica de saídas. */
export interface TestbenchFirstDivergence {
  caseIndex: number
  signal: string
  expected?: boolean
  actual?: boolean
  vector?: {
    width: number
    expected: string
    actual: string
  }
  tick: number
  step?: number
}

/** Contraexemplo mínimo reproduzível para a primeira divergência de um caso. */
export interface TestbenchCounterexample {
  caseIndex: number
  inputs: Record<string, boolean>
  vectorInputs?: Record<string, string>
  snapshot: TestbenchSnapshot
  divergence: TestbenchFirstDivergence
}

export interface TestbenchCaseResult {
  index: number
  name: string
  mode: 'combinational' | 'sequential'
  status: 'passed' | 'failed'
  /** Somente as saídas que não bateram, em ordem canônica. */
  mismatches: TestbenchMismatch[]
  /** Snapshots das etapas que declararam expectativas. */
  snapshots: TestbenchSnapshot[]
  /** Primeira divergência deste caso, ou nulo quando o caso passou. */
  firstDivergence: TestbenchFirstDivergence | null
  /** Contraexemplo deste caso, ou nulo quando o caso passou. */
  counterexample: TestbenchCounterexample | null
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
  /** Todos os snapshots observados, preservando o índice do caso. */
  snapshots: TestbenchSnapshot[]
  /** Um contraexemplo por caso que falhou. */
  counterexamples: TestbenchCounterexample[]
  /** Primeira divergência global na ordem dos casos. */
  firstDivergence: TestbenchFirstDivergence | null
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

  const vectorIssues = validateVectorValues(testbench, identity)
  if (vectorIssues.length > 0) return invalid(vectorIssues)

  const results: TestbenchCaseResult[] = []
  for (const [index, testCase] of testbench.cases.entries()) {
    results.push(
      testCase.steps
        ? runSequentialCase(normalized, testCase, index, identity, options)
        : testCase.vectors
          ? runVectorCase(normalized, testCase, index, identity, options)
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
    snapshots: results.flatMap((result) => result.snapshots),
    counterexamples: results.flatMap((result) => result.counterexample ? [result.counterexample] : []),
    firstDivergence: results.find((result) => result.firstDivergence)?.firstDivergence ?? null,
  }
}

type PortIdentity = ReturnType<typeof collectCircuitPorts>

function runVectorCase(
  document: CircuitDocument,
  testCase: TestbenchCase,
  index: number,
  identity: PortIdentity,
  options: TestbenchOptions,
): TestbenchCaseResult {
  const vectorCase = testCase.vectors!
  const inputs: Record<string, string | number> = {}
  for (const [name, value] of Object.entries(vectorCase.inputs ?? {})) {
    inputs[identity.inputIds.get(name)!] = value
  }

  const evaluation = evaluateCircuitVectors(document, inputs, { customChips: options.customChips })
  const snapshot: TestbenchSnapshot = {
    caseIndex: index,
    tick: 0,
    values: canonicalVectorValues(evaluation.values),
  }
  const mismatches: TestbenchMismatch[] = []
  let firstDivergence: TestbenchFirstDivergence | null = null
  for (const output of sortedNames(vectorCase.expect ?? {})) {
    const width = portWidth(identity, output, 'output')
    const expected = toBinary(bitVector(width, vectorCase.expect![output]))
    const actual = toBinary(evaluation.outputs[identity.outputIds.get(output)!] ?? bitVector(width, 0))
    if (actual !== expected) {
      const vector = { width, expected, actual }
      mismatches.push({ output, vector })
      firstDivergence ??= { caseIndex: index, signal: output, vector, tick: 0 }
    }
  }

  return {
    index,
    name: caseName(testCase, index),
    mode: 'combinational',
    status: mismatches.length === 0 ? 'passed' : 'failed',
    mismatches,
    snapshots: [snapshot],
    firstDivergence,
    counterexample: firstDivergence
      ? {
          caseIndex: index,
          inputs: {},
          vectorInputs: vectorInputValuesFromSnapshot(snapshot, identity),
          snapshot,
          divergence: firstDivergence,
        }
      : null,
  }
}

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
  const snapshot: TestbenchSnapshot = {
    caseIndex: index,
    tick: 0,
    values: canonicalValues(evaluation.values),
  }
  const mismatches: TestbenchMismatch[] = []
  let firstDivergence: TestbenchFirstDivergence | null = null
  for (const output of sortedNames(testCase.expect ?? {})) {
    const expected = testCase.expect![output]
    const actual = evaluation.outputs[identity.outputIds.get(output)!] ?? false
    if (actual !== expected) {
      mismatches.push({ output, expected, actual })
      firstDivergence ??= { caseIndex: index, signal: output, expected, actual, tick: 0 }
    }
  }

  return {
    index,
    name: caseName(testCase, index),
    mode: 'combinational',
    status: mismatches.length === 0 ? 'passed' : 'failed',
    mismatches,
    snapshots: [snapshot],
    firstDivergence,
    counterexample: firstDivergence
      ? {
          caseIndex: index,
          inputs: inputValuesFromSnapshot(snapshot, identity),
          snapshot,
          divergence: firstDivergence,
        }
      : null,
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
  const snapshots: TestbenchSnapshot[] = []
  let firstDivergence: TestbenchFirstDivergence | null = null
  let counterexample: TestbenchCounterexample | null = null

  ;(testCase.steps ?? []).forEach((step, stepIndex) => {
    for (const [name, value] of Object.entries(step.set ?? {})) {
      runtime.setInput(identity.inputIds.get(name)!, value)
    }
    runtime.tick(normalizeTicks(step.ticks))

    const expectedNames = sortedNames(step.expect ?? {})
    const runtimeSnapshot = snapshotDocumentRuntime(runtime, document, options.customChips)
    const snapshot: TestbenchSnapshot = {
      caseIndex: index,
      tick: runtimeSnapshot.tick,
      step: stepIndex,
      values: canonicalValues(runtimeSnapshot.values),
    }
    if (expectedNames.length > 0) snapshots.push(snapshot)

    for (const output of expectedNames) {
      const expected = step.expect![output]
      const actual = runtime.read(identity.outputIds.get(output)!)
      if (actual !== expected) {
        const mismatch = { output, expected, actual, tick: runtime.tickCount, step: stepIndex }
        mismatches.push(mismatch)
        firstDivergence ??= {
          caseIndex: index,
          signal: output,
          expected,
          actual,
          tick: runtime.tickCount,
          step: stepIndex,
        }
        if (!counterexample) {
          counterexample = {
            caseIndex: index,
            inputs: inputValuesFromSnapshot(snapshot, identity),
            snapshot,
            divergence: firstDivergence,
          }
        }
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
    snapshots,
    firstDivergence,
    counterexample,
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

function canonicalValues(
  values: Readonly<Record<string, readonly boolean[]>>,
): Record<string, boolean[]> {
  const result: Record<string, boolean[]> = {}
  for (const id of Object.keys(values).sort(compareCircuitText)) result[id] = [...(values[id] ?? [])]
  return result
}

function canonicalVectorValues(
  values: Readonly<Record<string, BitVector>>,
): Record<string, boolean[]> {
  const result: Record<string, boolean[]> = {}
  for (const id of Object.keys(values).sort(compareCircuitText)) result[id] = [...(values[id]?.bits ?? [])]
  return result
}

function inputValuesFromSnapshot(
  snapshot: TestbenchSnapshot,
  identity: PortIdentity,
): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const name of [...identity.inputIds.keys()].sort(compareCircuitText)) {
    const id = identity.inputIds.get(name)!
    result[name] = snapshot.values[id]?.[0] ?? false
  }
  return result
}

function vectorInputValuesFromSnapshot(
  snapshot: TestbenchSnapshot,
  identity: PortIdentity,
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const port of identity.inputs) {
    const id = identity.inputIds.get(port.name)!
    result[port.name] = toBinary(bitVector(port.width, snapshot.values[id] ?? []))
  }
  return result
}

function portWidth(identity: PortIdentity, name: string, direction: 'input' | 'output'): number {
  const port = (direction === 'input' ? identity.inputs : identity.outputs).find((item) => item.name === name)
  return port?.width ?? 1
}

function describe(error: unknown): string {
  if (error instanceof CircuitValidationError) return error.issues[0]?.message ?? error.message
  return error instanceof Error ? error.message : 'motivo desconhecido'
}

function validateVectorValues(testbench: TestbenchDocument, identity: PortIdentity): TestbenchIssue[] {
  const issues: TestbenchIssue[] = []
  for (const [caseIndex, testCase] of testbench.cases.entries()) {
    if (!testCase.vectors) continue
    for (const [direction, values] of [
      ['entrada', testCase.vectors.inputs],
      ['saída', testCase.vectors.expect],
    ] as const) {
      for (const [name, value] of Object.entries(values ?? {})) {
        const width = portWidth(identity, name, direction === 'entrada' ? 'input' : 'output')
        try {
          bitVector(width, value as string | number)
        } catch (error) {
          issues.push({
            code: 'vector-invalid',
            caseIndex,
            message:
              `O valor da ${direction} vetorial "${name}" no caso ${caseName(testCase, caseIndex)} é inválido: ` +
              `${error instanceof BitVectorError || error instanceof Error ? error.message : 'motivo desconhecido'}`,
          })
        }
      }
    }
  }
  return issues
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
    const hasScalar = testCase.inputs !== undefined || testCase.expect !== undefined
    const hasVectors = testCase.vectors !== undefined

    if ((hasSteps && (hasScalar || hasVectors)) || (hasScalar && hasVectors)) {
      issues.push({
        code: 'mixed-case-mode',
        caseIndex: index,
        message:
          `O caso ${caseName(testCase, index)} mistura modos de execução ("steps", "inputs"/"expect" ou "vectors"). ` +
          'Um caso é escalar, multi-bit ou sequencial, nunca mais de um.',
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

    if (hasVectors) {
      if (!testCase.vectors?.expect || Object.keys(testCase.vectors.expect).length === 0) {
        issues.push({
          code: 'missing-expectation',
          caseIndex: index,
          message:
            `O caso multi-bit ${caseName(testCase, index)} não declara nenhuma saída esperada. ` +
            'Um caso sem expectativa não pode falhar, então não testa nada.',
        })
      }
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

  const checkInputs = (record: Readonly<Record<string, unknown>> | undefined) => {
    for (const name of Object.keys(record ?? {})) if (!inputIds.has(name)) unknownInputs.add(name)
  }
  const checkOutputs = (record: Readonly<Record<string, unknown>> | undefined) => {
    for (const name of Object.keys(record ?? {})) if (!outputIds.has(name)) unknownOutputs.add(name)
  }

  for (const testCase of testbench.cases) {
    checkInputs(testCase.inputs)
    checkOutputs(testCase.expect)
    checkInputs(testCase.vectors?.inputs)
    checkOutputs(testCase.vectors?.expect)
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

function sortedNames(record: Readonly<Record<string, unknown>>): string[] {
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
  return {
    status: 'invalid',
    total: 0,
    passed: 0,
    failed: 0,
    cases: [],
    issues,
    snapshots: [],
    counterexamples: [],
    firstDivergence: null,
  }
}
