import { CircuitValidationError, validateCircuit, type CircuitDocument, type CircuitNode } from './editorModel'
import type { CustomChipLibraryEntry } from './customChip'
import { orderCustomChipPins } from './customChipPorts'
import { normalizeCircuitDocument } from './documentContract'
import { MAX_WIRELESS_CHANNEL_LENGTH } from './documentLimits'
import { normalizeWirelessChannel } from './wirelessChannels'

export const MAX_CUSTOM_CHIP_ELABORATION_DEPTH = 8

export interface CustomChipElaborationOptions {
  customChips?: readonly CustomChipLibraryEntry[]
  maxDepth?: number
}

interface ElaborationContext {
  definitions: ReadonlyMap<number, CustomChipLibraryEntry>
  usedIds: Set<string>
  maxDepth: number
}

interface Boundary {
  inputs: string[]
  outputs: string[]
}

interface ElaboratedDocument {
  document: CircuitDocument
  boundary: Boundary
}

/**
 * Converte um documento com nós `custom-chip` em um documento HDL-ready sem
 * instâncias hierárquicas. Portas internas continuam como sinais nomeados e
 * recebem uma marca de fronteira para não virarem portas externas do módulo.
 */
export function elaborateCustomChipDocument(
  document: CircuitDocument,
  options: CustomChipElaborationOptions = {},
): CircuitDocument {
  const normalized = normalizeCircuitDocument(document)
  const definitions = new Map((options.customChips ?? []).map((entry) => [entry.id, entry] as const))
  const issues = validateCircuit(normalized, { allowBuses: true, customChips: [...definitions.values()] })
  if (issues.length > 0) throw new CircuitValidationError(issues)

  const context: ElaborationContext = {
    definitions,
    usedIds: new Set(),
    maxDepth: options.maxDepth ?? MAX_CUSTOM_CHIP_ELABORATION_DEPTH,
  }
  const result = elaborate(normalized, context, '', [])
  const elaboratedIssues = validateCircuit(result.document, { allowBuses: true })
  if (elaboratedIssues.length > 0) throw new CircuitValidationError(elaboratedIssues)
  return result.document
}

function elaborate(
  document: CircuitDocument,
  context: ElaborationContext,
  prefix: string,
  stack: readonly number[],
): ElaboratedDocument {
  const normalized = normalizeCircuitDocument(document)
  const customNodes = normalized.nodes.filter((node) => node.type === 'custom-chip')
  const nativeNodes = normalized.nodes.filter((node) => node.type !== 'custom-chip')
  const idMap = new Map<string, string>()
  for (const node of nativeNodes) idMap.set(node.id, allocateId(context, `${prefix}${node.id}`))

  const nodes: CircuitNode[] = nativeNodes.map((node) => ({
    ...node,
    id: idMap.get(node.id)!,
    position: { x: node.position.x, y: node.position.y },
    options: markInternalBoundary(node, prefix),
  }))
  const boundaries = new Map<string, Boundary>()
  const nestedConnections: CircuitDocument['connections'] = []

  for (const node of customNodes) {
    const entry = getDefinition(node, context.definitions)
    if (stack.includes(entry.id)) {
      throw new Error(`A definição do chip "${entry.definition.name}" contém uma referência recursiva.`)
    }
    if (stack.length >= context.maxDepth) {
      throw new Error(`A hierarquia de chips excede o limite seguro de ${context.maxDepth} níveis.`)
    }

    const child = elaborate(entry.definition.document, context, `${prefix}${node.id}__`, [...stack, entry.id])
    nodes.push(...child.document.nodes)
    nestedConnections.push(...child.document.connections)
    boundaries.set(node.id, child.boundary)
  }

  const connections = [
    ...normalized.connections.flatMap((connection) => {
      const source = resolveSource(connection.source.node, connection.source.port ?? 0, idMap, boundaries)
      const target = resolveTarget(connection.target.node, connection.target.port, idMap, boundaries)
      if (!source || !target) return []
      return [{ source, target }]
    }),
    ...nestedConnections,
  ]

  return {
    document: { ...normalized, nodes, connections },
    // A fronteira precisa sair na mesma ordem que `definition.inputs`, senão a
    // porta k da instância liga num pino e a validação conta outro.
    boundary: {
      inputs: orderCustomChipPins(normalized.nodes.filter((node) => node.type === 'input')).map((node) => idMap.get(node.id)!),
      outputs: orderCustomChipPins(normalized.nodes.filter((node) => node.type === 'output')).map((node) => idMap.get(node.id)!),
    },
  }
}

function getDefinition(node: CircuitNode, definitions: ReadonlyMap<number, CustomChipLibraryEntry>): CustomChipLibraryEntry {
  const entry = definitions.get(node.options?.customChipId ?? NaN)
  if (!entry) {
    throw new CircuitValidationError([{
      code: 'custom-chip-missing-definition',
      nodeId: node.id,
      message: `A instância de chip "${node.id}" não encontrou a definição local solicitada.`,
    }])
  }
  return entry
}

function resolveSource(
  nodeId: string,
  port: number,
  idMap: ReadonlyMap<string, string>,
  boundaries: ReadonlyMap<string, Boundary>,
): { node: string; port?: number } | null {
  const boundary = boundaries.get(nodeId)
  if (boundary) {
    const output = boundary.outputs[port]
    return output ? { node: output } : null
  }
  const node = idMap.get(nodeId)
  return node ? { node, ...(port === 0 ? {} : { port }) } : null
}

function resolveTarget(
  nodeId: string,
  port: number,
  idMap: ReadonlyMap<string, string>,
  boundaries: ReadonlyMap<string, Boundary>,
): { node: string; port: number } | null {
  const boundary = boundaries.get(nodeId)
  if (boundary) {
    const input = boundary.inputs[port]
    return input ? { node: input, port: 0 } : null
  }
  const node = idMap.get(nodeId)
  return node ? { node, port } : null
}

function markInternalBoundary(node: CircuitNode, prefix: string): CircuitNode['options'] {
  if (!prefix) return node.options
  const options = { ...node.options }
  if (node.type === 'input' || node.type === 'output') options.customChipBoundary = 'internal'
  if ((node.type === 'transmitter' || node.type === 'receiver') && options.channel) {
    const channel = normalizeWirelessChannel(`${prefix}${options.channel}`)
    if (channel.length > MAX_WIRELESS_CHANNEL_LENGTH) {
      throw new Error(`O canal wireless interno da instância "${prefix}" excede ${MAX_WIRELESS_CHANNEL_LENGTH} caracteres após a elaboração.`)
    }
    options.channel = channel
  }
  return Object.keys(options).length > 0 ? options : undefined
}

function allocateId(context: ElaborationContext, candidate: string): string {
  let id = candidate
  let suffix = 2
  while (context.usedIds.has(id)) id = `${candidate}_${suffix++}`
  context.usedIds.add(id)
  return id
}
