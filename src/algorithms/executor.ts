import {
  isRuntimeValueOfType,
  type AlgorithmDocument,
  type AlgorithmNode,
  type ExecutionState,
  type RuntimeValue,
} from './model'
import { evaluateExpression } from './expressions'
import { hasValidationErrors, validateAlgorithmDocument } from './validate'

export interface ExecutionOptions {
  maxSteps?: number
  inputQueues?: Record<string, RuntimeValue[]>
}

export class AlgorithmExecutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AlgorithmExecutionError'
  }
}

const DEFAULT_MAX_STEPS = 10_000

function cloneState(state: ExecutionState): ExecutionState {
  return {
    ...state,
    variables: { ...state.variables },
    variableTypes: { ...state.variableTypes },
    inputQueues: Object.fromEntries(
      Object.entries(state.inputQueues).map(([key, values]) => [key, [...values]]),
    ),
    inputCursors: { ...state.inputCursors },
    output: [...state.output],
    trace: [...state.trace],
  }
}

function fail(state: ExecutionState, message: string): ExecutionState {
  const next = cloneState(state)
  next.status = 'error'
  next.error = message
  return next
}

function requireNext(node: AlgorithmNode): string {
  if (node.type === 'if') throw new AlgorithmExecutionError('O nó condicional exige uma branch escolhida.')
  if (node.type === 'end') throw new AlgorithmExecutionError('O nó final não possui sucessor.')
  return node.next
}

function ensureDeclared(state: ExecutionState, variable: string): void {
  if (!(variable in state.variableTypes)) {
    throw new AlgorithmExecutionError(`A variável "${variable}" não foi declarada.`)
  }
}

function executeNode(state: ExecutionState, node: AlgorithmNode): void {
  switch (node.type) {
    case 'start':
      state.activeNodeId = requireNext(node)
      return
    case 'end':
      state.activeNodeId = null
      state.status = 'finished'
      return
    case 'declare': {
      if (node.variable in state.variableTypes) {
        throw new AlgorithmExecutionError(`A variável "${node.variable}" já foi declarada.`)
      }
      const value = node.initialValue ?? null
      if (!isRuntimeValueOfType(value, node.valueType)) {
        throw new AlgorithmExecutionError(`O valor inicial de "${node.variable}" é incompatível com ${node.valueType}.`)
      }
      state.variableTypes[node.variable] = node.valueType
      state.variables[node.variable] = value
      state.activeNodeId = node.next
      return
    }
    case 'assign': {
      ensureDeclared(state, node.variable)
      const value = evaluateExpression(node.expression, state.variables)
      const valueType = state.variableTypes[node.variable]
      if (!isRuntimeValueOfType(value, valueType)) {
        throw new AlgorithmExecutionError(`A atribuição para "${node.variable}" exige ${valueType}.`)
      }
      state.variables[node.variable] = value
      state.activeNodeId = node.next
      return
    }
    case 'if': {
      const condition = evaluateExpression(node.condition, state.variables)
      if (typeof condition !== 'boolean') {
        throw new AlgorithmExecutionError('A condição do IF precisa produzir verdadeiro ou falso.')
      }
      state.activeNodeId = condition ? node.thenNext : node.elseNext
      return
    }
    case 'input': {
      ensureDeclared(state, node.variable)
      const cursor = state.inputCursors[node.variable] ?? 0
      const queue = state.inputQueues[node.variable] ?? []
      if (cursor >= queue.length) {
        state.status = 'awaiting-input'
        return
      }
      const value = queue[cursor]
      const valueType = state.variableTypes[node.variable]
      if (!isRuntimeValueOfType(value, valueType)) {
        throw new AlgorithmExecutionError(`A entrada para "${node.variable}" exige ${valueType}.`)
      }
      state.inputCursors[node.variable] = cursor + 1
      state.variables[node.variable] = value
      state.activeNodeId = node.next
      return
    }
    case 'output':
      state.output.push(evaluateExpression(node.expression, state.variables))
      state.activeNodeId = node.next
      return
  }
}

export function createExecutionState(
  document: AlgorithmDocument,
  options: ExecutionOptions = {},
): ExecutionState {
  const issues = validateAlgorithmDocument(document)
  if (hasValidationErrors(issues)) {
    throw new AlgorithmExecutionError(issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message).join(' '))
  }
  return {
    status: 'ready',
    activeNodeId: document.entryNodeId,
    variables: {},
    variableTypes: {},
    inputQueues: Object.fromEntries(
      Object.entries(options.inputQueues ?? {}).map(([key, values]) => [key, [...values]]),
    ),
    inputCursors: {},
    output: [],
    trace: [],
    stepIndex: 0,
    error: null,
  }
}

export function provideInput(
  state: ExecutionState,
  variable: string,
  value: RuntimeValue,
): ExecutionState {
  const next = cloneState(state)
  next.inputQueues[variable] = [...(next.inputQueues[variable] ?? []), value]
  if (next.status === 'awaiting-input') next.status = 'paused'
  return next
}

export function stepAlgorithm(
  document: AlgorithmDocument,
  state: ExecutionState,
  options: ExecutionOptions = {},
): ExecutionState {
  if (state.status === 'finished' || state.status === 'error') return cloneState(state)
  if (state.status === 'awaiting-input') return cloneState(state)
  if (!state.activeNodeId) return fail(state, 'O estado não possui um nó ativo.')

  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS
  if (state.stepIndex >= maxSteps) {
    return fail(state, `O algoritmo excedeu o limite de ${maxSteps} passos.`)
  }

  const node = document.nodes.find((candidate) => candidate.id === state.activeNodeId)
  if (!node) return fail(state, `O nó ativo "${state.activeNodeId}" não existe.`)

  const next = cloneState(state)
  try {
    executeNode(next, node)
    if (next.status === 'awaiting-input') return next
    next.stepIndex += 1
    next.trace.push({
      step: next.stepIndex,
      nodeId: node.id,
      nodeType: node.type,
      status: next.status,
      outputLength: next.output.length,
    })
    if (next.status !== 'finished') next.status = 'paused'
    return next
  } catch (error) {
    return fail(next, error instanceof Error ? error.message : 'Falha desconhecida na execução.')
  }
}

export function runAlgorithm(
  document: AlgorithmDocument,
  initialState?: ExecutionState,
  options: ExecutionOptions = {},
): ExecutionState {
  let state = initialState
    ? (initialState.status === 'ready' ? initialState : cloneState(initialState))
    : createExecutionState(document, options)
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS
  while (state.status !== 'finished' && state.status !== 'error' && state.status !== 'awaiting-input') {
    state = stepAlgorithm(document, state, { ...options, maxSteps })
  }
  return state
}
