import { MAX_CIRCUIT_NAME_LENGTH } from './documentLimits'
import {
  CircuitValidationError,
  validateCircuit,
  type CircuitDocument,
  type CircuitNode,
  type EditorComponentType,
} from './editorModel'
import { normalizeCircuitDocument } from './documentContract'

export const CUSTOM_CHIP_FORMAT = 'veritas-custom-chip' as const
export const CUSTOM_CHIP_VERSION = 1 as const

export interface CustomChipPort {
  id: string
  name: string
  width: number
}

export interface CustomChipDefinition {
  format: typeof CUSTOM_CHIP_FORMAT
  version: typeof CUSTOM_CHIP_VERSION
  name: string
  document: CircuitDocument
  inputs: CustomChipPort[]
  outputs: CustomChipPort[]
}

const STATEFUL_TYPES: readonly EditorComponentType[] = ['clock', 'dff', 'tff', 'delay']

/**
 * Cria uma definição serializável sem mutar o documento original.
 * A execução hierárquica e a instanciação no canvas ficam para CHIP-002.
 */
export function buildCustomChipDefinition(
  document: CircuitDocument,
  name = document.name,
): CustomChipDefinition {
  const normalizedDocument = normalizeCircuitDocument(document)
  const normalizedName = name.trim() || normalizedDocument.name
  if (normalizedName.length === 0) throw new Error('O chip customizado precisa ter um nome não vazio.')
  if (normalizedName.length > MAX_CIRCUIT_NAME_LENGTH) {
    throw new Error(`O nome do chip customizado pode ter no máximo ${MAX_CIRCUIT_NAME_LENGTH} caracteres.`)
  }

  const issues = validateCircuit(normalizedDocument, { allowBuses: true })
  if (issues.length > 0) throw new CircuitValidationError(issues)
  if (normalizedDocument.nodes.some((node) => STATEFUL_TYPES.includes(node.type))) {
    throw new Error('Chips customizados desta versão precisam ser combinacionais; remova clock, DFF, TFF ou delay.')
  }

  const inputs = buildPorts(normalizedDocument.nodes.filter((node) => node.type === 'input'))
  const outputs = buildPorts(normalizedDocument.nodes.filter((node) => node.type === 'output'))
  if (inputs.length === 0) throw new Error('O chip customizado precisa ter pelo menos uma entrada.')
  if (outputs.length === 0) throw new Error('O chip customizado precisa ter pelo menos uma saída.')

  return {
    format: CUSTOM_CHIP_FORMAT,
    version: CUSTOM_CHIP_VERSION,
    name: normalizedName,
    document: normalizedDocument,
    inputs,
    outputs,
  }
}

function buildPorts(nodes: readonly CircuitNode[]): CustomChipPort[] {
  const used = new Map<string, number>()
  return [...nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((node) => {
      const baseName = (node.label?.trim() || node.id).replace(/\s+/g, ' ')
      const key = baseName.toLocaleLowerCase('pt-BR')
      const occurrence = (used.get(key) ?? 0) + 1
      used.set(key, occurrence)
      return {
        id: node.id,
        name: occurrence === 1 ? baseName : `${baseName}_${occurrence}`,
        width: node.options?.width ?? 1,
      }
    })
}
