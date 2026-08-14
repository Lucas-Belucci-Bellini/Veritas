import {
  assignmentForRow,
  DEFAULT_MAX_ROWS,
  type TruthTable,
  type TruthTableColumn,
} from '../engine'
import { evaluateCircuit } from './evaluate'
import { validateCircuit, type CircuitDocument } from './editorModel'

export interface CircuitTruthTableOptions {
  maxRows?: number
  outputId?: string
}

export const MAX_CIRCUIT_VARIABLES = 16

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
  const issues = validateCircuit(document)
  if (issues.length > 0) throw new Error(issues[0].message)

  const inputs = document.nodes.filter((node) => node.type === 'input')
  const outputs = document.nodes.filter((node) => node.type === 'output')
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
    const evaluation = evaluateCircuit(document, assignment)
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

function classify(trueCount: number, rowCount: number): TruthTable['classification'] {
  if (trueCount === rowCount) return 'tautologia'
  if (trueCount === 0) return 'contradicao'
  return 'contingencia'
}
