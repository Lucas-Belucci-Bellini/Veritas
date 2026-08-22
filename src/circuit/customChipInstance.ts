import { CircuitValidationError, type CircuitNode } from './editorModel'
import type { CustomChipDefinition, CustomChipLibraryEntry } from './customChip'

export const MAX_CUSTOM_CHIP_DEPTH = 8

export interface CustomChipInstanceOptions {
  customChips?: readonly CustomChipLibraryEntry[]
  depth?: number
}

export function resolveCustomChipDefinition(
  node: Pick<CircuitNode, 'id' | 'type' | 'options'>,
  customChips: readonly CustomChipLibraryEntry[] = [],
): CustomChipDefinition {
  const entry = customChips.find((candidate) => candidate.id === node.options?.customChipId)
  if (!entry) {
    throw new CircuitValidationError([{
      code: 'custom-chip-missing-definition',
      nodeId: node.id,
      message: `A instância de chip "${node.id}" não encontrou a definição local solicitada.`,
    }])
  }
  return entry.definition
}

export function assertCustomChipDepth(depth: number): void {
  if (depth >= MAX_CUSTOM_CHIP_DEPTH) {
    throw new Error(`A hierarquia de chips excede o limite seguro de ${MAX_CUSTOM_CHIP_DEPTH} níveis.`)
  }
}
