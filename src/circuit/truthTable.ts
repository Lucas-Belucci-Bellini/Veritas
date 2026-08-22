import {
  assignmentForRow,
  DEFAULT_MAX_ROWS,
  type TruthTable,
  type TruthTableColumn,
} from '../engine'
import { bitVector, toBinary, type BitVector } from '../bus'
import { evaluateCircuit, evaluateCircuitVectors } from './evaluate'
import { validateCircuit, type CircuitDocument } from './editorModel'
import { normalizeCircuitDocument } from './documentContract'

export interface CircuitTruthTableOptions {
  maxRows?: number
  outputId?: string
}

export const MAX_CIRCUIT_VARIABLES = 16
export const MAX_VECTOR_TRUTH_BITS = 12

export interface CircuitVectorTruthTableOptions {
  maxBits?: number
  maxRows?: number
  outputId?: string
}

export interface CircuitVectorTruthTableColumn {
  key: string
  label: string
  width: number
  type: 'variable' | 'result' | 'step'
}

export interface CircuitVectorTruthTable {
  variables: string[]
  columns: CircuitVectorTruthTableColumn[]
  rows: string[][]
  totalRows: number
  generatedRows: number
  totalInputBits: number
  truncated: boolean
  activeCount: number
  classification: TruthTable['classification']
  formula: string
}

/**
 * Gera a tabela verdade diretamente do grafo visual.
 *
 * Os IDs das entradas são usados como chaves internas das atribuições; os
 * rótulos visuais aparecem nas colunas. Assim, dois componentes com rótulos
 * iguais continuam sendo variáveis distintas e o circuito não fica ambíguo.
 */
export function buildCircuitTruthTable(
  document: CircuitDocument,
  options: CircuitTruthTableOptions = {},
): TruthTable {
  const normalized = normalizeCircuitDocument(document)
  const issues = validateCircuit(normalized)
  if (issues.length > 0) throw new Error(issues[0].message)

  const inputs = normalized.nodes.filter((node) => node.type === 'input')
  const outputs = normalized.nodes.filter((node) => node.type === 'output')
  if (outputs.length === 0) throw new Error('O circuito precisa de pelo menos uma saída.')
  if (inputs.length > MAX_CIRCUIT_VARIABLES) {
    throw new RangeError(
      `O circuito tem ${inputs.length} entradas; o limite da tabela é ${MAX_CIRCUIT_VARIABLES}.`,
    )
  }

  const selectedOutput = outputs.find((node) => node.id === options.outputId) ?? outputs[0]
  const variables = inputs.map((node) => node.id)
  const totalRows = 2 ** variables.length
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS
  const generatedRows = Math.min(totalRows, Math.max(1, maxRows))
  const columns: TruthTableColumn[] = [
    ...inputs.map((node) => ({
      key: `input:${node.id}`,
      label: node.label ?? node.id,
      type: 'variable' as const,
    })),
    ...outputs
      .filter((node) => node.id !== selectedOutput.id)
      .map((node) => ({
        key: `output:${node.id}`,
        label: node.label ?? node.id,
        type: 'step' as const,
      })),
    {
      key: `output:${selectedOutput.id}`,
      label: selectedOutput.label ?? selectedOutput.id,
      type: 'result' as const,
    },
  ]

  const rows: boolean[][] = []
  let trueCount = 0
  for (let index = 0; index < generatedRows; index += 1) {
    const assignment = assignmentForRow(variables, index)
    const evaluation = evaluateCircuit(normalized, assignment)
    const row = [
      ...variables.map((id) => assignment[id]),
      ...outputs
        .filter((node) => node.id !== selectedOutput.id)
        .map((node) => evaluation.outputs[node.id] ?? false),
      evaluation.outputs[selectedOutput.id] ?? false,
    ]
    if (evaluation.outputs[selectedOutput.id]) trueCount += 1
    rows.push(row)
  }

  return {
    variables,
    columns,
    rows,
    totalRows,
    truncated: generatedRows < totalRows,
    trueCount,
    classification:
      generatedRows < totalRows
        ? 'contingencia'
        : classify(trueCount, generatedRows),
    formula: selectedOutput.label ?? selectedOutput.id,
  }
}

export function buildCircuitVectorTruthTable(
  document: CircuitDocument,
  options: CircuitVectorTruthTableOptions = {},
): CircuitVectorTruthTable {
  const normalized = normalizeCircuitDocument(document)
  const issues = validateCircuit(normalized, { allowBuses: true })
  if (issues.length > 0) throw new Error(issues[0].message)

  const inputs = normalized.nodes.filter((node) => node.type === 'input')
  const outputs = normalized.nodes.filter((node) => node.type === 'output')
  if (outputs.length === 0) throw new Error('O circuito precisa de pelo menos uma saída.')
  const widths = inputs.map((node) => node.options?.width ?? 1)
  const totalInputBits = widths.reduce((total, width) => total + width, 0)
  const maxBits = options.maxBits ?? MAX_VECTOR_TRUTH_BITS
  if (totalInputBits > maxBits) {
    throw new RangeError(`A tabela vetorial teria ${totalInputBits} bits de entrada; o limite seguro é ${maxBits}.`)
  }

  const selectedOutput = outputs.find((node) => node.id === options.outputId) ?? outputs[0]
  const totalRows = 2 ** totalInputBits
  const maxRows = Math.max(1, Math.min(options.maxRows ?? DEFAULT_MAX_ROWS, 2 ** maxBits))
  const generatedRows = Math.min(totalRows, maxRows)
  const columns: CircuitVectorTruthTableColumn[] = [
    ...inputs.map((node) => ({
      key: `input:${node.id}`,
      label: node.label ?? node.id,
      width: node.options?.width ?? 1,
      type: 'variable' as const,
    })),
    ...outputs
      .filter((node) => node.id !== selectedOutput.id)
      .map((node) => ({
        key: `output:${node.id}`,
        label: node.label ?? node.id,
        width: node.options?.width ?? 1,
        type: 'step' as const,
      })),
    {
      key: `output:${selectedOutput.id}`,
      label: selectedOutput.label ?? selectedOutput.id,
      width: selectedOutput.options?.width ?? 1,
      type: 'result' as const,
    },
  ]

  const rows: string[][] = []
  let activeCount = 0
  let allZero = true
  let allOnes = true
  for (let index = 0; index < generatedRows; index += 1) {
    const assignment = vectorAssignment(inputs, index, totalInputBits)
    const evaluation = evaluateCircuitVectors(normalized, assignment)
    const selectedValue = evaluation.outputs[selectedOutput.id] ?? bitVector(selectedOutput.options?.width ?? 1, 0)
    const active = selectedValue.bits.some(Boolean)
    const maximum = selectedValue.bits.every(Boolean)
    if (active) activeCount += 1
    if (active) allZero = false
    if (!maximum) allOnes = false
    rows.push([
      ...inputs.map((node) => toBinary(assignment[node.id])),
      ...outputs
        .filter((node) => node.id !== selectedOutput.id)
        .map((node) => toBinary(evaluation.outputs[node.id] ?? bitVector(node.options?.width ?? 1, 0))),
      toBinary(selectedValue),
    ])
  }

  return {
    variables: inputs.map((node) => node.id),
    columns,
    rows,
    totalRows,
    generatedRows,
    totalInputBits,
    truncated: generatedRows < totalRows,
    activeCount,
    classification: generatedRows < totalRows ? 'contingencia' : allOnes ? 'tautologia' : allZero ? 'contradicao' : 'contingencia',
    formula: selectedOutput.label ?? selectedOutput.id,
  }
}

function vectorAssignment(nodes: CircuitDocument['nodes'], index: number, totalBits: number): Record<string, BitVector> {
  const assignment: Record<string, BitVector> = {}
  let consumed = 0
  for (const node of nodes.filter((candidate) => candidate.type === 'input')) {
    const width = node.options?.width ?? 1
    const shift = totalBits - consumed - width
    const mask = (1n << BigInt(width)) - 1n
    const value = (BigInt(index) >> BigInt(Math.max(0, shift))) & mask
    assignment[node.id] = bitVector(width, value)
    consumed += width
  }
  return assignment
}

function classify(trueCount: number, rowCount: number): TruthTable['classification'] {
  if (trueCount === rowCount) return 'tautologia'
  if (trueCount === 0) return 'contradicao'
  return 'contingencia'
}
