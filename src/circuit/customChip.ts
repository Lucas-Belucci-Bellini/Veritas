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

export interface CustomChipLibraryEntry {
  id: number
  definition: CustomChipDefinition
}

export interface CustomChipDefinition {
  format: typeof CUSTOM_CHIP_FORMAT
  version: typeof CUSTOM_CHIP_VERSION
  name: string
  document: CircuitDocument
  inputs: CustomChipPort[]
  outputs: CustomChipPort[]
}

export interface CustomChipDefinitionOptions {
  /** Biblioteca local usada para resolver instâncias já criadas. */
  customChips?: readonly CustomChipLibraryEntry[]
  /** Limite máximo de níveis de chips compostos. */
  maxDepth?: number
}

const STATEFUL_TYPES: readonly EditorComponentType[] = ['clock', 'dff', 'tff', 'jk', 'sr', 'delay']
const DEFAULT_MAX_CUSTOM_CHIP_DEPTH = 8


/**
 * Cria uma definição serializável sem mutar o documento original.
 * Instâncias de chips existentes podem ser compostas, desde que a biblioteca
 * fornecida resolva toda a cadeia sem ciclos ou profundidade insegura.
 */
export function buildCustomChipDefinition(
  document: CircuitDocument,
  name = document.name,
  options: CustomChipDefinitionOptions = {},
): CustomChipDefinition {
  const normalizedDocument = normalizeCircuitDocument(document)
  const normalizedName = name.trim() || normalizedDocument.name
  if (normalizedName.length === 0) throw new Error('O chip customizado precisa ter um nome não vazio.')
  if (normalizedName.length > MAX_CIRCUIT_NAME_LENGTH) {
    throw new Error(`O nome do chip customizado pode ter no máximo ${MAX_CIRCUIT_NAME_LENGTH} caracteres.`)
  }

  const issues = validateCircuit(normalizedDocument, {
    allowBuses: true,
    customChips: options.customChips,
  })
  if (issues.length > 0) throw new CircuitValidationError(issues)
  if (normalizedDocument.nodes.some((node) => STATEFUL_TYPES.includes(node.type))) {
    throw new Error('Chips customizados desta versão precisam ser combinacionais; remova clock, DFF, TFF, JK, SR ou delay.')
  }
  validateNestedDefinitions(normalizedDocument, options.customChips ?? [], options.maxDepth ?? DEFAULT_MAX_CUSTOM_CHIP_DEPTH)

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

function validateNestedDefinitions(
  document: CircuitDocument,
  customChips: readonly CustomChipLibraryEntry[],
  maxDepth: number,
  stack: readonly number[] = [],
  depth = 0,
): void {
  if (!Number.isInteger(maxDepth) || maxDepth < 1) {
    throw new Error('O limite de profundidade da hierarquia precisa ser um inteiro positivo.')
  }

  const definitions = new Map(customChips.map((entry) => [entry.id, entry] as const))
  for (const node of document.nodes) {
    if (node.type !== 'custom-chip') continue
    const id = node.options?.customChipId
    const entry = definitions.get(id ?? NaN)
    if (!entry) continue
    if (stack.includes(entry.id)) {
      throw new Error(`A definição do chip "${entry.definition.name}" contém uma referência recursiva.`)
    }
    if (depth >= maxDepth) {
      throw new Error(`A hierarquia de chips excede o limite seguro de ${maxDepth} níveis.`)
    }
    const childIssues = validateCircuit(entry.definition.document, { allowBuses: true, customChips })
    if (childIssues.length > 0) throw new CircuitValidationError(childIssues)
    if (entry.definition.document.nodes.some((child) => STATEFUL_TYPES.includes(child.type))) {
      throw new Error('Chips customizados desta versão precisam ser combinacionais; remova os componentes sequenciais.')
    }
    validateNestedDefinitions(entry.definition.document, customChips, maxDepth, [...stack, entry.id], depth + 1)
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
