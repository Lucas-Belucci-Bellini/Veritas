export const ALGORITHM_DOCUMENT_FORMAT = 'veritas-algorithm'
export const ALGORITHM_DOCUMENT_VERSION = 1 as const

export type AlgorithmValueType = 'boolean' | 'number' | 'string'
export type RuntimeValue = boolean | number | string | null

export interface AlgorithmPosition {
  x: number
  y: number
}

interface AlgorithmNodeBase {
  id: string
  position: AlgorithmPosition
  label?: string
}

export type AlgorithmNode =
  | (AlgorithmNodeBase & { type: 'start'; next: string })
  | (AlgorithmNodeBase & { type: 'end' })
  | (AlgorithmNodeBase & {
      type: 'declare'
      variable: string
      valueType: AlgorithmValueType
      initialValue?: RuntimeValue
      next: string
    })
  | (AlgorithmNodeBase & {
      type: 'assign'
      variable: string
      expression: string
      next: string
    })
  | (AlgorithmNodeBase & {
      type: 'if'
      condition: string
      thenNext: string
      elseNext: string
    })
  | (AlgorithmNodeBase & {
      type: 'input'
      variable: string
      prompt?: string
      next: string
    })
  | (AlgorithmNodeBase & {
      type: 'output'
      expression: string
      next: string
    })

export interface AlgorithmDocument {
  format: typeof ALGORITHM_DOCUMENT_FORMAT
  version: typeof ALGORITHM_DOCUMENT_VERSION
  name: string
  entryNodeId: string
  nodes: AlgorithmNode[]
}

export type AlgorithmExecutionStatus =
  | 'ready'
  | 'paused'
  | 'awaiting-input'
  | 'finished'
  | 'error'

export interface AlgorithmTraceEntry {
  step: number
  nodeId: string
  nodeType: AlgorithmNode['type']
  status: AlgorithmExecutionStatus
  outputLength: number
}

export interface VariableWatchEntry {
  name: string
  type: AlgorithmValueType
  value: RuntimeValue
  previousValue: RuntimeValue | undefined
  changedAtStep: number | null
  scope: 'global' | 'function'
}

export interface BranchTraceEntry {
  nodeId: string
  expression: string
  operands: Record<string, RuntimeValue>
  result: boolean
  selectedBranch: 'then' | 'else'
  step: number
}

export interface ExecutionState {
  status: AlgorithmExecutionStatus
  activeNodeId: string | null
  variables: Record<string, RuntimeValue>
  variableTypes: Record<string, AlgorithmValueType>
  inputQueues: Record<string, RuntimeValue[]>
  inputCursors: Record<string, number>
  output: RuntimeValue[]
  trace: AlgorithmTraceEntry[]
  watch: VariableWatchEntry[]
  branches: BranchTraceEntry[]
  stepIndex: number
  error: string | null
}

export interface AlgorithmValidationIssue {
  code:
    | 'invalid-format'
    | 'unsupported-version'
    | 'missing-entry'
    | 'duplicate-node'
    | 'invalid-position'
    | 'missing-target'
    | 'missing-branch'
    | 'duplicate-variable'
    | 'invalid-initial-value'
    | 'unreachable-node'
  message: string
  nodeId?: string
  severity: 'error' | 'warning'
}

export function createAlgorithmDocument(
  name = 'Algoritmo sem título',
): AlgorithmDocument {
  return {
    format: ALGORITHM_DOCUMENT_FORMAT,
    version: ALGORITHM_DOCUMENT_VERSION,
    name,
    entryNodeId: 'start',
    nodes: [
      { id: 'start', type: 'start', position: { x: 0, y: 0 }, next: 'end' },
      { id: 'end', type: 'end', position: { x: 240, y: 0 } },
    ],
  }
}

export function isRuntimeValueOfType(
  value: RuntimeValue,
  valueType: AlgorithmValueType,
): boolean {
  if (value === null) return true
  if (valueType === 'boolean') return typeof value === 'boolean'
  if (valueType === 'number') return typeof value === 'number' && Number.isFinite(value)
  return typeof value === 'string'
}
