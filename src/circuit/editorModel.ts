import { MAX_BUS_WIDTH } from '../bus'
import {
  outputCount,
  type ComponentOptions,
  type ComponentSpec,
  type ComponentType,
  type Netlist,
  type PortRef,
} from '../simulation/components'
import { getCircuitDocumentBoundIssues, normalizeCircuitDocument } from './documentContract'
import type { CustomChipLibraryEntry } from './customChip'
import { resolveWirelessChannels } from './wirelessChannels'

export const CIRCUIT_DOCUMENT_FORMAT = 'veritas-circuit'
export const CIRCUIT_DOCUMENT_VERSION = 1 as const

export type EditorComponentType = Extract<
  ComponentType,
  | 'input'
  | 'output'
  | 'constant'
  | 'and'
  | 'nand'
  | 'or'
  | 'nor'
  | 'not'
  | 'xor'
  | 'xnor'
  | 'clock'
  | 'dff'
  | 'tff'
  | 'delay'
  | 'transmitter'
  | 'receiver'
  | 'custom-chip'
>

export const EDITOR_COMPONENT_TYPES: readonly EditorComponentType[] = [
  'input',
  'output',
  'constant',
  'and',
  'nand',
  'or',
  'nor',
  'not',
  'xor',
  'xnor',
  'clock',
  'dff',
  'tff',
  'delay',
  'transmitter',
  'receiver',
  'custom-chip',
]

export interface CircuitPosition {
  x: number
  y: number
}

export interface CircuitNode {
  id: string
  type: EditorComponentType
  position: CircuitPosition
  label?: string
  options?: ComponentOptions
}

export interface CircuitConnection {
  source: PortRef
  target: {
    node: string
    port: number
  }
}

export interface CircuitDocument {
  format: typeof CIRCUIT_DOCUMENT_FORMAT
  version: typeof CIRCUIT_DOCUMENT_VERSION
  name: string
  nodes: CircuitNode[]
  connections: CircuitConnection[]
}

export interface CircuitValidationOptions {
  /** Permite widths 2–64 para o avaliador vetorial; a API escalar mantém false. */
  allowBuses?: boolean
  /** Definições locais disponíveis para validar instâncias `custom-chip`. */
  customChips?: readonly CustomChipLibraryEntry[]
}

export interface CircuitIssue {
  code:
  | 'duplicate-node'
  | 'invalid-node'
  | 'missing-node'
  | 'invalid-source-port'
  | 'invalid-target-port'
  | 'duplicate-target-port'
  | 'self-connection'
  | 'missing-input'
  | 'cycle'
  | 'invalid-width'
  | 'unsupported-width'
  | 'width-mismatch'
  | 'invalid-document-name'
  | 'document-too-many-nodes'
  | 'document-too-many-connections'
  | 'node-label-too-long'
  | 'document-too-large'
  | 'wireless-empty-channel'
  | 'wireless-duplicate-transmitter'
  | 'wireless-missing-transmitter'
  | 'wireless-channel-too-long'
  | 'custom-chip-missing-definition'
  message: string
  nodeId?: string
}

export class CircuitValidationError extends Error {
  readonly issues: readonly CircuitIssue[]

  constructor(issues: readonly CircuitIssue[]) {
    super(issues.map((issue) => issue.message).join(' '))
    this.name = 'CircuitValidationError'
    this.issues = issues
  }
}

/** Número de entradas que o editor da v0.7.0 espera em cada componente. */
export function editorInputCount(type: EditorComponentType): number {
  switch (type) {
    case 'input':
    case 'constant':
    case 'clock':
      return 0
    case 'not':
    case 'output':
    case 'delay':
    case 'transmitter':
      return 1
    case 'receiver':
    case 'custom-chip':
      return 0
    case 'and':
    case 'nand':
    case 'or':
    case 'nor':
    case 'xor':
    case 'xnor':
    case 'dff':
    case 'tff':
      return 2
  }
}

export function isStatefulEditorType(type: EditorComponentType): boolean {
  return type === 'clock' || type === 'dff' || type === 'tff' || type === 'delay'
}

export function createCircuitDocument(name = 'Circuito sem título'): CircuitDocument {
  return {
    format: CIRCUIT_DOCUMENT_FORMAT,
    version: CIRCUIT_DOCUMENT_VERSION,
    name,
    nodes: [],
    connections: [],
  }
}

export function validateCircuit(document: CircuitDocument, options: CircuitValidationOptions = {}): CircuitIssue[] {
  document = normalizeCircuitDocument(document)
  const customChips = new Map((options.customChips ?? []).map((entry) => [entry.id, entry] as const))
  const issues: CircuitIssue[] = getCircuitDocumentBoundIssues(document).map((issue) => ({
    code: issue.code,
    nodeId: issue.nodeId,
    message: issue.message,
  }))
  const nodes = new Map<string, CircuitNode>()

  for (const node of document.nodes) {
    if (!node.id.trim() || nodes.has(node.id)) {
      issues.push({
        code: 'duplicate-node',
        nodeId: node.id,
        message: `O identificador do componente "${node.id}" está vazio ou duplicado.`,
      })
      continue
    }
    if (!EDITOR_COMPONENT_TYPES.includes(node.type)) {
      issues.push({
        code: 'invalid-node',
        nodeId: node.id,
        message: `O componente "${node.id}" usa um tipo que o editor visual não suporta.`,
      })
      continue
    }
    if (node.type === 'custom-chip' && !customChips.has(node.options?.customChipId ?? NaN)) {
      issues.push({
        code: 'custom-chip-missing-definition',
        nodeId: node.id,
        message: `A instância de chip "${node.id}" não encontrou a definição local solicitada.`,
      })
    }
    const width = circuitNodeWidth(node)
    if (!isValidCircuitWidth(width)) {
      issues.push({
        code: 'invalid-width',
        nodeId: node.id,
        message: `A largura do componente "${node.id}" precisa ser um inteiro entre 1 e ${MAX_BUS_WIDTH}.`,
      })
    } else if (width !== 1 && (!options.allowBuses || isStatefulEditorType(node.type))) {
      issues.push({
        code: 'unsupported-width',
        nodeId: node.id,
        message: isStatefulEditorType(node.type)
          ? `O componente sequencial "${node.id}" ainda aceita somente sinais escalares de 1 bit.`
          : `O componente "${node.id}" usa ${width} bits, mas a avaliação visual atual ainda aceita somente sinais escalares de 1 bit.`,
      })
    }
    nodes.set(node.id, node)
  }

  const wirelessResolution = resolveWirelessChannels(
    document.nodes
      .filter((node) => node.type === 'transmitter' || node.type === 'receiver')
      .map((node) => ({
        nodeId: node.id,
        channel: node.options?.channel ?? '',
        kind: node.type as 'transmitter' | 'receiver',
        width: circuitNodeWidth(node),
      })),
  )
  for (const issue of wirelessResolution.issues) {
    if (issue.code === 'duplicate-node') continue
    const code = issue.code === 'empty-channel'
      ? 'wireless-empty-channel'
      : issue.code === 'duplicate-transmitter'
        ? 'wireless-duplicate-transmitter'
        : issue.code === 'missing-transmitter'
          ? 'wireless-missing-transmitter'
          : issue.code === 'invalid-width'
              ? 'invalid-width'
              : 'width-mismatch'
    issues.push({ code, nodeId: issue.nodeId, message: issue.message })
  }

  const occupiedInputs = new Set<string>()
  const outgoing = new Map<string, string[]>()

  for (const connection of document.connections) {
    const source = nodes.get(connection.source.node)
    const target = nodes.get(connection.target.node)

    if (!source || !target) {
      issues.push({
        code: 'missing-node',
        nodeId: target?.id ?? source?.id,
        message: 'A conexão aponta para um componente que não existe no documento.',
      })
      continue
    }

    const sourcePort = connection.source.port ?? 0
    const sourceOutputCount = nodeOutputCount(source, customChips)
    if (sourcePort < 0 || sourcePort >= sourceOutputCount) {
      issues.push({
        code: 'invalid-source-port',
        nodeId: source.id,
        message: `O componente "${source.id}" não possui a saída ${sourcePort}.`,
      })
    }

    const inputCount = nodeInputCount(target, customChips)
    if (connection.target.port < 0 || connection.target.port >= inputCount) {
      issues.push({
        code: 'invalid-target-port',
        nodeId: target.id,
        message: `A entrada ${connection.target.port} não existe no componente "${target.id}".`,
      })
      continue
    }

    const sourceWidth = nodeOutputWidth(source, sourcePort, customChips)
    const targetWidth = nodeInputWidth(target, connection.target.port, customChips)
    if (isValidCircuitWidth(sourceWidth) && isValidCircuitWidth(targetWidth) && sourceWidth !== targetWidth) {
      issues.push({
        code: 'width-mismatch',
        nodeId: target.id,
        message: `A conexão entre "${source.id}" (${sourceWidth} bits) e "${target.id}" (${targetWidth} bits) exige larguras iguais.`,
      })
    }

    const inputKey = `${target.id}:${connection.target.port}`
    if (occupiedInputs.has(inputKey)) {
      issues.push({
        code: 'duplicate-target-port',
        nodeId: target.id,
        message: `A entrada ${connection.target.port} do componente "${target.id}" recebeu mais de uma conexão.`,
      })
    }
    occupiedInputs.add(inputKey)

    if (source.id === target.id && !isStatefulEditorType(target.type)) {
      issues.push({
        code: 'self-connection',
        nodeId: target.id,
        message: `O componente "${target.id}" não pode se conectar a si mesmo na lógica combinacional.`,
      })
    }

    const targets = outgoing.get(source.id) ?? []
    targets.push(target.id)
    outgoing.set(source.id, targets)
  }

  for (const node of nodes.values()) {
    const expected = nodeInputCount(node, customChips)
    for (let port = 0; port < expected; port += 1) {
      if (!occupiedInputs.has(`${node.id}:${port}`)) {
        issues.push({
          code: 'missing-input',
          nodeId: node.id,
          message: `A entrada ${port + 1} do componente "${node.label ?? node.id}" está desconectada.`,
        })
      }
    }
  }

  const visiting = new Set<string>()
  const stack: string[] = []
  const visited = new Set<string>()
  const visit = (id: string): void => {
    if (visiting.has(id)) {
      const cycleStart = stack.indexOf(id)
      const cycleIds = cycleStart >= 0 ? stack.slice(cycleStart) : [id]
      const hasSequentialState = cycleIds.some((cycleId) => {
        const cycleNode = nodes.get(cycleId)
        return cycleNode ? isStatefulEditorType(cycleNode.type) : false
      })
      if (!hasSequentialState) {
        issues.push({
          code: 'cycle',
          nodeId: id,
          message: `O circuito contém um ciclo combinacional envolvendo "${id}".`,
        })
      }
      return
    }
    if (visited.has(id)) return

    visiting.add(id)
    stack.push(id)
    for (const target of outgoing.get(id) ?? []) visit(target)
    stack.pop()
    visiting.delete(id)
    visited.add(id)
  }

  for (const node of nodes.values()) visit(node.id)

  return issues
}

function nodeInputCount(node: CircuitNode, customChips: ReadonlyMap<number, CustomChipLibraryEntry>): number {
  if (node.type === 'input' && node.options?.customChipBoundary === 'internal') return 1
  if (node.type === 'custom-chip') return customChips.get(node.options?.customChipId ?? NaN)?.definition.inputs.length ?? 0
  return editorInputCount(node.type)
}

function nodeOutputCount(node: CircuitNode, customChips: ReadonlyMap<number, CustomChipLibraryEntry>): number {
  if (node.type === 'custom-chip') return customChips.get(node.options?.customChipId ?? NaN)?.definition.outputs.length ?? 0
  return outputCount(node.type)
}

function nodeInputWidth(node: CircuitNode, port: number, customChips: ReadonlyMap<number, CustomChipLibraryEntry>): number {
  if (node.type === 'custom-chip') return customChips.get(node.options?.customChipId ?? NaN)?.definition.inputs[port]?.width ?? 1
  return circuitNodeWidth(node)
}

function nodeOutputWidth(node: CircuitNode, port: number, customChips: ReadonlyMap<number, CustomChipLibraryEntry>): number {
  if (node.type === 'custom-chip') return customChips.get(node.options?.customChipId ?? NaN)?.definition.outputs[port]?.width ?? 1
  return circuitNodeWidth(node)
}

export function circuitNodeWidth(node: CircuitNode): number {
  return node.options?.width ?? 1
}

export function isValidCircuitWidth(width: number): boolean {
  return Number.isInteger(width) && width >= 1 && width <= MAX_BUS_WIDTH
}

/** Converte o documento visual para o netlist consumido pelo simulador. */
export function toNetlist(document: CircuitDocument, options: CircuitValidationOptions = {}): Netlist {
  const normalized = normalizeCircuitDocument(document)
  const issues = validateCircuit(normalized, options)
  if (issues.length > 0) throw new CircuitValidationError(issues)

  const inputsByNode = new Map<string, PortRef[]>()
  for (const connection of normalized.connections) {
    const inputs = inputsByNode.get(connection.target.node) ?? []
    inputs[connection.target.port] = connection.source
    inputsByNode.set(connection.target.node, inputs)
  }
  const wirelessResolution = resolveWirelessChannels(
    normalized.nodes
      .filter((node) => node.type === 'transmitter' || node.type === 'receiver')
      .map((node) => ({
        nodeId: node.id,
        channel: node.options?.channel ?? '',
        kind: node.type as 'transmitter' | 'receiver',
        width: circuitNodeWidth(node),
      })),
  )
  if (wirelessResolution.issues.length > 0) {
    throw new CircuitValidationError(validateCircuit(normalized, options))
  }
  const wirelessByReceiver = new Map(
    wirelessResolution.channels.flatMap((channel) => channel.receivers.map((receiver) => [
      receiver.nodeId,
      { node: channel.transmitter.nodeId },
    ] as const)),
  )

  const components: ComponentSpec[] = normalized.nodes.map((node) => {
    const inputs = node.type === 'receiver'
      ? [wirelessByReceiver.get(node.id)!]
      : inputsByNode.get(node.id)
    return {
      id: node.id,
      type: node.type,
      label: node.label,
      options: node.options,
      inputs: inputs && inputs.length > 0 ? inputs : undefined,
    }
  })

  return { components }
}

/** Compatibilidade explícita para consumidores que validam tipos fixos. */
export function isEditorComponentType(type: ComponentType): type is EditorComponentType {
  return EDITOR_COMPONENT_TYPES.includes(type as EditorComponentType)
}
