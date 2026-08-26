import { MAX_CIRCUIT_NAME_LENGTH } from './documentLimits'
import {
  CircuitValidationError,
  validateCircuit,
  type CircuitDocument,
  type CircuitNode,
  type EditorComponentType,
} from './editorModel'
import { normalizeCircuitDocument } from './documentContract'
import { MAX_CUSTOM_CHIP_DEPTH } from './customChipInstance'
import { orderCustomChipPins } from './customChipPorts'

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

const STATEFUL_TYPES: readonly EditorComponentType[] = ['clock', 'dff', 'tff', 'jk', 'sr', 'delay']

export interface CustomChipBuildOptions {
  /** Definições disponíveis para resolver instâncias aninhadas dentro do chip. */
  customChips?: readonly CustomChipLibraryEntry[]
  /** Limite opcional de profundidade usado ao validar uma definição. */
  maxDepth?: number
  /**
   * ID do próprio chip quando ele está sendo atualizado.
   *
   * Só faz sentido em atualização: um chip novo ainda não tem ID, então nada
   * pode apontar de volta para ele. Na atualização, apontar é possível — e é
   * exatamente aí que nasce um ciclo.
   */
  selfId?: number
}

/** Nome histórico mantido para consumidores do contrato de definição. */
export type CustomChipDefinitionOptions = CustomChipBuildOptions

/**
 * Cria uma definição serializável sem mutar o documento original.
 *
 * O documento pode conter instâncias `custom-chip`, contanto que as definições
 * correspondentes venham em `options.customChips`. A hierarquia é por
 * referência: o chip guarda o `customChipId` do filho, não uma cópia dele.
 */
export function buildCustomChipDefinition(
  document: CircuitDocument,
  name = document.name,
  options: CustomChipBuildOptions = {},
): CustomChipDefinition {
  const normalizedDocument = normalizeCircuitDocument(document)
  const normalizedName = name.trim() || normalizedDocument.name
  if (normalizedName.length === 0) throw new Error('O chip customizado precisa ter um nome não vazio.')
  if (normalizedName.length > MAX_CIRCUIT_NAME_LENGTH) {
    throw new Error(`O nome do chip customizado pode ter no máximo ${MAX_CIRCUIT_NAME_LENGTH} caracteres.`)
  }

  const customChips = options.customChips ?? []
  const issues = validateCircuit(normalizedDocument, { allowBuses: true, customChips })
  if (issues.length > 0) throw new CircuitValidationError(issues)

  // Um chip pode conter outros chips: é o que permite subir de meio somador
  // para somador completo, e daí para uma ALU. O motor (avaliação e
  // elaboração) já recursava; o que faltava era deixar construir.
  validateNestedDefinitions(normalizedDocument, customChips, options.maxDepth ?? MAX_CUSTOM_CHIP_DEPTH)
  if (options.selfId !== undefined) assertNoCustomChipCycle(normalizedDocument, customChips, options.selfId)
  assertCustomChipDepthWithinLimit(normalizedDocument, customChips, options.maxDepth)
  if (normalizedDocument.nodes.some((node) => STATEFUL_TYPES.includes(node.type))) {
    throw new Error('Chips customizados desta versão precisam ser combinacionais; remova clock, DFF, TFF, JK, SR ou delay.')
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

/**
 * Recusa uma atualização que faria o chip conter a si mesmo, direta ou
 * indiretamente. Sem isso, a avaliação só perceberia o problema ao estourar o
 * limite de profundidade, com uma mensagem que não explica a causa.
 */
function assertNoCustomChipCycle(
  document: CircuitDocument,
  customChips: readonly CustomChipLibraryEntry[],
  selfId: number,
): void {
  const byId = new Map(customChips.map((entry) => [entry.id, entry]))
  const visited = new Set<number>()

  const reaches = (doc: CircuitDocument): boolean => {
    for (const node of doc.nodes) {
      if (node.type !== 'custom-chip') continue
      const childId = node.options?.customChipId
      if (childId === undefined) continue
      if (childId === selfId) return true
      if (visited.has(childId)) continue
      visited.add(childId)
      const child = byId.get(childId)
      if (child && reaches(child.definition.document)) return true
    }
    return false
  }

  if (reaches(document)) {
    throw new Error(
      'Este chip passaria a conter a si mesmo, direta ou indiretamente. ' +
      'Uma hierarquia circular não pode ser avaliada.',
    )
  }
}

/**
 * Recusa na criação uma hierarquia que estouraria o limite na avaliação.
 *
 * Falhar aqui é melhor que falhar depois: o autor descobre ao salvar, e não na
 * primeira vez que tentar simular o chip.
 */
function assertCustomChipDepthWithinLimit(
  document: CircuitDocument,
  customChips: readonly CustomChipLibraryEntry[],
  maxDepth = MAX_CUSTOM_CHIP_DEPTH,
): void {
  if (!Number.isInteger(maxDepth) || maxDepth < 1) {
    throw new Error('O limite de profundidade da hierarquia precisa ser um inteiro positivo.')
  }
  const byId = new Map(customChips.map((entry) => [entry.id, entry]))
  const cache = new Map<number, number>()

  const depthOf = (doc: CircuitDocument, seen: ReadonlySet<number>): number => {
    let deepest = 0
    for (const node of doc.nodes) {
      if (node.type !== 'custom-chip') continue
      const childId = node.options?.customChipId
      if (childId === undefined || seen.has(childId)) continue
      const cached = cache.get(childId)
      if (cached !== undefined) {
        deepest = Math.max(deepest, cached)
        continue
      }
      const child = byId.get(childId)
      const childDepth = child ? 1 + depthOf(child.definition.document, new Set([...seen, childId])) : 1
      cache.set(childId, childDepth)
      deepest = Math.max(deepest, childDepth)
    }
    return deepest
  }

  // O chip em construção é mais um nível acima da hierarquia que ele contém.
  const depth = depthOf(document, new Set()) + 1
  if (depth > maxDepth) {
    throw new Error(
      `A hierarquia deste chip teria ${depth} níveis; o limite seguro é ${maxDepth}.`,
    )
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
  return orderCustomChipPins(nodes)
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
