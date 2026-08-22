import {
  MAX_CIRCUIT_CONNECTIONS,
  MAX_CIRCUIT_LABEL_LENGTH,
  MAX_CIRCUIT_NAME_LENGTH,
  MAX_CIRCUIT_NODES,
  MAX_CIRCUIT_SERIALIZED_BYTES,
} from './documentLimits'
import type { CircuitDocument } from './editorModel'

export type CircuitDocumentBoundIssueCode =
  | 'invalid-document-name'
  | 'document-too-many-nodes'
  | 'document-too-many-connections'
  | 'node-label-too-long'
  | 'document-too-large'

export interface CircuitDocumentBoundIssue {
  code: CircuitDocumentBoundIssueCode
  nodeId?: string
  message: string
}

/**
 * Normaliza somente representação, nunca corrige semântica inválida.
 * IDs são aparados junto das referências para manter o documento consistente.
 */
export function normalizeCircuitDocument(document: CircuitDocument): CircuitDocument {
  const rawName = (document as CircuitDocument & { name?: unknown }).name
  const name = typeof rawName === 'string' ? rawName.trim() : 'Circuito sem nome'
  let changed = name !== rawName
  const nodes = document.nodes.map((node) => {
    const id = node.id.trim()
    const label = normalizeOptionalText(node.label)
    if (id !== node.id || label !== node.label) changed = true
    return {
      ...node,
      id,
      label,
      position: node.position ? { x: node.position.x, y: node.position.y } : node.position,
      options: node.options ? { ...node.options } : undefined,
    }
  })
  const connections = document.connections.map((connection) => {
    const sourceNode = connection.source.node.trim()
    const targetNode = connection.target.node.trim()
    if (sourceNode !== connection.source.node || targetNode !== connection.target.node) changed = true
    return {
      source: {
        node: sourceNode,
        ...(connection.source.port === undefined ? {} : { port: connection.source.port }),
      },
      target: {
        node: targetNode,
        port: connection.target.port,
      },
    }
  })

  if (!changed) return document
  return {
    ...document,
    name,
    nodes,
    connections,
  }
}

export function getCircuitDocumentBoundIssues(document: CircuitDocument): CircuitDocumentBoundIssue[] {
  const issues: CircuitDocumentBoundIssue[] = []
  const trimmedName = typeof document.name === 'string' ? document.name.trim() : ''
  if (trimmedName.length === 0) {
    issues.push({ code: 'invalid-document-name', message: 'O circuito precisa ter um nome não vazio.' })
  } else if (trimmedName.length > MAX_CIRCUIT_NAME_LENGTH) {
    issues.push({ code: 'invalid-document-name', message: `O nome do circuito pode ter no máximo ${MAX_CIRCUIT_NAME_LENGTH} caracteres.` })
  }
  if (document.nodes.length > MAX_CIRCUIT_NODES) {
    issues.push({ code: 'document-too-many-nodes', message: `O circuito pode ter no máximo ${MAX_CIRCUIT_NODES} componentes.` })
  }
  if (document.connections.length > MAX_CIRCUIT_CONNECTIONS) {
    issues.push({ code: 'document-too-many-connections', message: `O circuito pode ter no máximo ${MAX_CIRCUIT_CONNECTIONS} conexões.` })
  }
  for (const node of document.nodes) {
    if ((node.label?.trim().length ?? 0) > MAX_CIRCUIT_LABEL_LENGTH) {
      issues.push({
        code: 'node-label-too-long',
        nodeId: node.id,
        message: `O rótulo do componente "${node.id}" pode ter no máximo ${MAX_CIRCUIT_LABEL_LENGTH} caracteres.`,
      })
    }
  }
  if (documentSerializedBytes(document) > MAX_CIRCUIT_SERIALIZED_BYTES) {
    issues.push({ code: 'document-too-large', message: `O documento serializado pode ter no máximo ${MAX_CIRCUIT_SERIALIZED_BYTES} bytes.` })
  }
  return issues
}

export function documentSerializedBytes(document: CircuitDocument): number {
  return new TextEncoder().encode(JSON.stringify(document)).length
}

/** Guard estrutural compartilhável por importadores e integrações externas. */
export function isCircuitDocumentShape(value: unknown): value is CircuitDocument {
  if (!isRecord(value) || value.format !== 'veritas-circuit' || value.version !== 1) return false
  if (typeof value.name !== 'string' || !Array.isArray(value.nodes) || !Array.isArray(value.connections)) return false
  return value.nodes.every(isCircuitNodeShape) && value.connections.every(isCircuitConnectionShape)
}

function isCircuitNodeShape(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string') return false
  if (!isRecord(value.position) || !isFiniteNumber(value.position.x) || !isFiniteNumber(value.position.y)) return false
  if (value.label !== undefined && typeof value.label !== 'string') return false
  return value.options === undefined || isRecord(value.options)
}

function isCircuitConnectionShape(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.source) || !isRecord(value.target)) return false
  return (
    typeof value.source.node === 'string' &&
    (value.source.port === undefined || Number.isInteger(value.source.port)) &&
    typeof value.target.node === 'string' &&
    Number.isInteger(value.target.port)
  )
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
