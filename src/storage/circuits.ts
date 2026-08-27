import { isEditorComponentType, normalizeCircuitDocument, validateCircuit, type CircuitDocument } from '../circuit'
import { db, type CircuitProject, type NewCircuitProject } from './db'
import { MAX_BUS_WIDTH } from '../bus'
import type { ComponentType } from '../simulation/components'

export const CIRCUIT_FILE_VERSION = 1 as const
export const MAX_CIRCUIT_FILE_BYTES = 5_000_000

export interface VeritasCircuitFile {
  format: 'veritas-circuits'
  version: typeof CIRCUIT_FILE_VERSION
  exportedAt: string
  projects: NewCircuitProject[]
}

export async function listCircuitProjects(): Promise<CircuitProject[]> {
  const projects = await db.circuitProjects.toArray()
  return projects.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getCircuitProject(id: number): Promise<CircuitProject | undefined> {
  return db.circuitProjects.get(id)
}

export async function createCircuitProject(input: NewCircuitProject): Promise<number> {
  const now = Date.now()
  return db.circuitProjects.add({
    ...input,
    name: input.name.trim() || input.document.name.trim() || 'Circuito sem nome',
    document: normalizeCircuitDocument(input.document),
    createdAt: now,
    updatedAt: now,
  } as CircuitProject)
}

export async function updateCircuitProject(
  id: number,
  patch: Partial<NewCircuitProject>,
): Promise<void> {
  const clean = { ...patch }
  if (clean.name !== undefined) clean.name = clean.name.trim() || 'Circuito sem nome'
  if (clean.document !== undefined) clean.document = normalizeCircuitDocument(clean.document)
  await db.circuitProjects.update(id, { ...clean, updatedAt: Date.now() })
}

export async function deleteCircuitProject(id: number): Promise<void> {
  await db.circuitProjects.delete(id)
}

export function serializeCircuitProjects(projects: readonly CircuitProject[]): string {
  const file: VeritasCircuitFile = {
    format: 'veritas-circuits',
    version: CIRCUIT_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    projects: projects.map(({ name, document }) => ({ name, document })),
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

export function parseCircuitFile(text: string): NewCircuitProject[] {
  if (new TextEncoder().encode(text).length > MAX_CIRCUIT_FILE_BYTES) {
    throw new Error(`Esse arquivo de circuitos excede o limite de ${MAX_CIRCUIT_FILE_BYTES} bytes.`)
  }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Esse arquivo de circuitos não é um JSON válido.')
  }

  if (!isRecord(data) || data.format !== 'veritas-circuits') {
    throw new Error('Esse arquivo não é uma coleção de circuitos do Veritas.')
  }
  if (!hasOnlyKeys(data, ['format', 'version', 'exportedAt', 'projects']) ||
      (data.exportedAt !== undefined && typeof data.exportedAt !== 'string')) {
    throw new Error('O envelope do arquivo de circuitos contém campos desconhecidos ou inválidos.')
  }

  if (typeof data.version !== 'number' || !Number.isInteger(data.version) || data.version < 1) {
    throw new Error('Esse arquivo de circuitos tem uma versão inválida.')
  }
  if (data.version > CIRCUIT_FILE_VERSION) {
    throw new Error('Esse arquivo de circuitos foi salvo por uma versão mais nova do Veritas.')
  }
  if (data.version < CIRCUIT_FILE_VERSION) {
    throw new Error('Esse arquivo de circuitos usa uma versão antiga sem migração disponível.')
  }

  if (!Array.isArray(data.projects)) {
    throw new Error('O arquivo de circuitos não tem projetos dentro.')
  }

  const projects = data.projects.map((project, index) => {
    if (!isCircuitProjectLike(project)) {
      throw new Error(`O projeto ${index + 1} do arquivo de circuitos é inválido.`)
    }
    return {
      name: project.name.trim() || project.document.name.trim() || 'Circuito sem nome',
      document: normalizeCircuitDocument(project.document),
    }
  })

  if (projects.length === 0) {
    throw new Error('O arquivo de circuitos não tem nenhum projeto.')
  }

  return projects
}

export async function importCircuitProjects(
  projects: readonly NewCircuitProject[],
): Promise<number> {
  const now = Date.now()
  const rows = projects.map(
    (project, index) =>
      ({
        ...project,
        name: project.name.trim() || project.document.name.trim() || 'Circuito sem nome',
        document: normalizeCircuitDocument(project.document),
        createdAt: now + index,
        updatedAt: now + index,
      }) as CircuitProject,
  )
  await db.circuitProjects.bulkAdd(rows)
  return rows.length
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCircuitProjectLike(
  value: unknown,
): value is { name: string; document: CircuitDocument } {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['name', 'document']) ||
    typeof value.name !== 'string' ||
    !isRecord(value.document)
  ) {
    return false
  }
  if (
    !hasOnlyKeys(value.document, ['format', 'version', 'name', 'nodes', 'connections']) ||
    value.document.format !== 'veritas-circuit' ||
    value.document.version !== 1 ||
    typeof value.document.name !== 'string' ||
    !Array.isArray(value.document.nodes) ||
    !Array.isArray(value.document.connections)
  ) {
    return false
  }

  const nodes = value.document.nodes.filter(isNodeLike)
  const connections = value.document.connections.filter(isConnectionLike)
  if (nodes.length !== value.document.nodes.length || connections.length !== value.document.connections.length) {
    return false
  }

  const document: CircuitDocument = {
    format: 'veritas-circuit',
    version: 1,
    name: value.document.name,
    nodes,
    connections,
  }
  return validateCircuit(document).length === 0
}

function isNodeLike(value: unknown): value is CircuitDocument['nodes'][number] {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['id', 'type', 'position', 'label', 'options']) ||
    typeof value.id !== 'string' ||
    typeof value.type !== 'string' ||
    !isEditorComponentType(value.type as ComponentType)
  ) {
    return false
  }
  if (
    !isRecord(value.position) ||
    !hasOnlyKeys(value.position, ['x', 'y']) ||
    !isFiniteNumber(value.position.x) ||
    !isFiniteNumber(value.position.y)
  ) {
    return false
  }
  if (value.label !== undefined && typeof value.label !== 'string') return false
  if (value.options !== undefined) {
    if (!isRecord(value.options) || !hasOnlyKeys(value.options, [
      'period', 'ticks', 'value', 'initial', 'width', 'widths', 'channel',
      'customChipId', 'customChipBoundary',
    ])) return false
    if (value.options.period !== undefined && !isPositiveInteger(value.options.period)) return false
    if (value.options.ticks !== undefined && !isPositiveInteger(value.options.ticks)) return false
    if (value.options.value !== undefined && typeof value.options.value !== 'boolean') return false
    if (value.options.initial !== undefined && typeof value.options.initial !== 'boolean') return false
    const width = value.options.width
    if (width !== undefined && !isCircuitWidth(width)) return false
    if (value.options.widths !== undefined && (
      !Array.isArray(value.options.widths) || value.options.widths.some((part) => !isCircuitWidth(part))
    )) return false
    if (value.options.channel !== undefined && typeof value.options.channel !== 'string') return false
    if (value.options.customChipId !== undefined && !isPositiveInteger(value.options.customChipId)) return false
    if (value.options.customChipBoundary !== undefined && value.options.customChipBoundary !== 'internal') return false
  }
  return true
}

function isConnectionLike(value: unknown): value is CircuitDocument['connections'][number] {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['source', 'target']) ||
    !isRecord(value.source) ||
    !isRecord(value.target) ||
    !hasOnlyKeys(value.source, ['node', 'port']) ||
    !hasOnlyKeys(value.target, ['node', 'port'])
  ) return false
  return (
    typeof value.source.node === 'string' &&
    (value.source.port === undefined || Number.isInteger(value.source.port)) &&
    typeof value.target.node === 'string' &&
    Number.isInteger(value.target.port)
  )
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed)
  return Object.keys(value).every((key) => allowedKeys.has(key))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isCircuitWidth(value: unknown): value is number {
  return isPositiveInteger(value) && value <= MAX_BUS_WIDTH
}
