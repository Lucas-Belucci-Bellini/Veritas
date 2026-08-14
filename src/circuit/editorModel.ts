import {
  outputCount,
  type ComponentOptions,
  type ComponentSpec,
  type ComponentType,
  type Netlist,
  type PortRef,
} from '../simulation/components'

export const CIRCUIT_DOCUMENT_FORMAT = 'veritas-circuit'
export const CIRCUIT_DOCUMENT_VERSION = 1 as const

export type EditorComponentType = Extract<
  ComponentType,
  'input' | 'output' | 'constant' | 'and' | 'or' | 'not' | 'xor'
>

export const EDITOR_COMPONENT_TYPES: readonly EditorComponentType[] = [
  'input',
  'output',
  'constant',
  'and',
  'or',
  'not',
  'xor',
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
      return 0
    case 'not':
    case 'output':
      return 1
    case 'and':
    case 'or':
    case 'xor':
      return 2
  }
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

export function validateCircuit(document: CircuitDocument): CircuitIssue[] {
  const issues: CircuitIssue[] = []
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
        message: `O componente "${node.id}" usa um tipo que o editor combinacional não suporta.`,
      })
      continue
    }
    nodes.set(node.id, node)
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
    if (sourcePort < 0 || sourcePort >= outputCount(source.type)) {
      issues.push({
        code: 'invalid-source-port',
        nodeId: source.id,
        message: `O componente "${source.id}" não possui a saída ${sourcePort}.`,
      })
    }

    const inputCount = editorInputCount(target.type)
    if (connection.target.port < 0 || connection.target.port >= inputCount) {
      issues.push({
        code: 'invalid-target-port',
        nodeId: target.id,
        message: `A entrada ${connection.target.port} não existe no componente "${target.id}".`,
      })
      continue
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

    if (source.id === target.id) {
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
    const expected = editorInputCount(node.type)
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
  const visited = new Set<string>()
  const visit = (id: string): void => {
    if (visiting.has(id)) {
      issues.push({
        code: 'cycle',
        nodeId: id,
        message: `O circuito contém um ciclo combinacional envolvendo "${id}".`,
      })
      return
    }
    if (visited.has(id)) return

    visiting.add(id)
    for (const target of outgoing.get(id) ?? []) visit(target)
    visiting.delete(id)
    visited.add(id)
  }

  for (const node of nodes.values()) visit(node.id)

  return issues
}

/** Converte o documento visual para o netlist consumido pelo simulador. */
export function toNetlist(document: CircuitDocument): Netlist {
  const issues = validateCircuit(document)
  if (issues.length > 0) throw new CircuitValidationError(issues)

  const inputsByNode = new Map<string, PortRef[]>()
  for (const connection of document.connections) {
    const inputs = inputsByNode.get(connection.target.node) ?? []
    inputs[connection.target.port] = connection.source
    inputsByNode.set(connection.target.node, inputs)
  }

  const components: ComponentSpec[] = document.nodes.map((node) => {
    const inputs = inputsByNode.get(node.id)
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
