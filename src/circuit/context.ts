import { buildCircuitTruthTable } from './truthTable'
import { validateCircuit, type CircuitDocument } from './editorModel'

export interface CircuitContextRecord {
  sourceRef: string
  contextType: 'circuit'
  circuitName: string
  summary: string
  tags: string[]
  contentHash: string
  payload: {
    format: 'veritas-circuit-context'
    version: 1
    document: CircuitDocument
    inputs: string[]
    outputs: string[]
    truthTable: {
      columns: string[]
      rows: boolean[][]
      totalRows: number
      truncated: boolean
    }
  }
}

/**
 * Produz um pacote seguro para a futura API autenticada do Veritas.
 * Não envia tokens, credenciais ou conteúdo arbitrário de prompts.
 */
export function buildCircuitContext(
  document: CircuitDocument,
  outputId?: string,
): CircuitContextRecord {
  const issues = validateCircuit(document)
  if (issues.length > 0) throw new Error(issues[0].message)

  const truthTable = buildCircuitTruthTable(document, { outputId, maxRows: 256 })
  const inputs = document.nodes.filter((node) => node.type === 'input').map((node) => node.label ?? node.id)
  const outputs = document.nodes.filter((node) => node.type === 'output').map((node) => node.label ?? node.id)
  const content = stableStringify({ document, outputId })

  return {
    sourceRef: `veritas:circuit:${document.name}`,
    contextType: 'circuit',
    circuitName: document.name,
    summary: `Circuito combinacional com ${inputs.length} entrada(s), ${outputs.length} saída(s) e ${truthTable.totalRows} combinação(ões) possíveis.`,
    tags: ['veritas', 'circuit', 'combinational'],
    contentHash: hashText(content),
    payload: {
      format: 'veritas-circuit-context',
      version: 1,
      document,
      inputs,
      outputs,
      truthTable: {
        columns: truthTable.columns.map((column) => column.label),
        rows: truthTable.rows,
        totalRows: truthTable.totalRows,
        truncated: truthTable.truncated,
      },
    },
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}

function hashText(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}
