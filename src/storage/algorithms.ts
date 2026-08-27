import {
  ALGORITHM_DOCUMENT_FORMAT,
  ALGORITHM_DOCUMENT_VERSION,
  hasValidationErrors,
  validateAlgorithmDocument,
  type AlgorithmDocument,
  type AlgorithmNode,
  type AlgorithmValueType,
  type RuntimeValue,
} from '../algorithms'
import { db, type AlgorithmProject, type NewAlgorithmProject } from './db'

export const ALGORITHM_FILE_FORMAT = 'veritas-algorithms' as const
export const ALGORITHM_FILE_VERSION = 1 as const
export const MAX_ALGORITHM_FILE_BYTES = 5_000_000
export const MAX_ALGORITHM_FILE_PROJECTS = 256
export const MAX_ALGORITHM_DOCUMENT_NODES = 1_024

export interface PortableAlgorithmProject {
  ref: string
  name: string
  document: AlgorithmDocument
}

export interface VeritasAlgorithmFile {
  format: typeof ALGORITHM_FILE_FORMAT
  version: typeof ALGORITHM_FILE_VERSION
  exportedAt?: string
  projects: PortableAlgorithmProject[]
}

export async function listAlgorithmProjects(): Promise<AlgorithmProject[]> {
  const projects = await db.algorithmProjects.toArray()
  return projects.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function createAlgorithmProject(input: NewAlgorithmProject): Promise<number> {
  assertValidAlgorithmDocument(input.document)
  const now = Date.now()
  return db.algorithmProjects.add({
    ...input,
    name: input.name.trim() || 'Algoritmo sem título',
    createdAt: now,
    updatedAt: now,
  } as AlgorithmProject)
}

export async function getAlgorithmProject(id: number): Promise<AlgorithmProject | undefined> {
  return db.algorithmProjects.get(id)
}

export async function updateAlgorithmProject(
  id: number,
  patch: Partial<NewAlgorithmProject>,
): Promise<void> {
  const clean = { ...patch }
  if (clean.document !== undefined) assertValidAlgorithmDocument(clean.document)
  if (clean.name !== undefined) clean.name = clean.name.trim() || 'Algoritmo sem título'
  await db.algorithmProjects.update(id, { ...clean, updatedAt: Date.now() })
}

export async function deleteAlgorithmProject(id: number): Promise<void> {
  await db.algorithmProjects.delete(id)
}

export function serializeAlgorithmProjects(
  projects: readonly AlgorithmProject[],
  exportedAt = new Date().toISOString(),
): string {
  if (projects.length === 0) throw new Error('Não há algoritmos para exportar.')
  if (projects.length > MAX_ALGORITHM_FILE_PROJECTS) {
    throw new Error(`O arquivo de algoritmos pode conter no máximo ${MAX_ALGORITHM_FILE_PROJECTS} projetos.`)
  }

  const names = new Set<string>()
  const serialized = [...projects]
    .sort((a, b) => a.id - b.id)
    .map((project) => {
      if (!Number.isInteger(project.id) || project.id < 1) {
        throw new Error('A biblioteca de algoritmos contém ids locais inválidos.')
      }
      assertValidAlgorithmDocument(project.document)
      const name = project.name.trim() || project.document.name.trim()
      const key = name.toLowerCase()
      if (!key || names.has(key)) {
        throw new Error(`A biblioteca contém nomes de algoritmos duplicados: "${name}".`)
      }
      names.add(key)
      return {
        ref: `algorithm-${project.id}`,
        name,
        document: project.document,
      }
    })

  const file: VeritasAlgorithmFile = {
    format: ALGORITHM_FILE_FORMAT,
    version: ALGORITHM_FILE_VERSION,
    exportedAt,
    projects: serialized,
  }
  const text = `${JSON.stringify(file, null, 2)}\n`
  assertFileSize(text)
  return text
}

export function parseAlgorithmFile(text: string): VeritasAlgorithmFile {
  assertFileSize(text)
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Esse arquivo de algoritmos não é um JSON válido.')
  }
  if (!isRecord(data) || data.format !== ALGORITHM_FILE_FORMAT) {
    throw new Error('Esse arquivo não é uma coleção de algoritmos do Veritas.')
  }
  if (
    !hasOnlyKeys(data, ['format', 'version', 'exportedAt', 'projects']) ||
    (data.exportedAt !== undefined && typeof data.exportedAt !== 'string')
  ) {
    throw new Error('O envelope de algoritmos contém campos desconhecidos ou inválidos.')
  }
  if (typeof data.version !== 'number' || !Number.isInteger(data.version) || data.version < 1) {
    throw new Error('Esse arquivo de algoritmos tem uma versão inválida.')
  }
  if (data.version > ALGORITHM_FILE_VERSION) {
    throw new Error('Esse arquivo de algoritmos foi salvo por uma versão mais nova do Veritas.')
  }
  if (data.version < ALGORITHM_FILE_VERSION) {
    throw new Error('Esse arquivo de algoritmos usa uma versão antiga sem migração disponível.')
  }
  if (
    !Array.isArray(data.projects) ||
    data.projects.length === 0 ||
    data.projects.length > MAX_ALGORITHM_FILE_PROJECTS
  ) {
    throw new Error(`O arquivo de algoritmos deve conter de 1 a ${MAX_ALGORITHM_FILE_PROJECTS} projetos.`)
  }

  const projects = data.projects.map((value, index) => {
    if (!isPortableAlgorithmProjectLike(value)) {
      throw new Error(`O projeto ${index + 1} do arquivo de algoritmos é inválido.`)
    }
    return value
  })
  const refs = new Set<string>()
  const names = new Set<string>()
  for (const project of projects) {
    if (refs.has(project.ref)) throw new Error(`A ref "${project.ref}" aparece mais de uma vez.`)
    const nameKey = project.name.trim().toLowerCase()
    if (names.has(nameKey)) throw new Error(`O nome de algoritmo "${project.name}" aparece mais de uma vez.`)
    refs.add(project.ref)
    names.add(nameKey)
    assertValidAlgorithmDocument(project.document)
  }

  return {
    format: ALGORITHM_FILE_FORMAT,
    version: ALGORITHM_FILE_VERSION,
    ...(data.exportedAt !== undefined ? { exportedAt: data.exportedAt } : {}),
    projects,
  }
}

export async function importAlgorithmFile(text: string): Promise<number> {
  const file = parseAlgorithmFile(text)
  let importedCount = 0
  await db.transaction('rw', db.algorithmProjects, async () => {
    const existing = await db.algorithmProjects.toArray()
    const existingNames = new Set(existing.map((project) => project.name.trim().toLowerCase()))
    for (const project of file.projects) {
      if (existingNames.has(project.name.trim().toLowerCase())) {
        throw new Error(`Já existe um algoritmo chamado "${project.name}" na biblioteca local.`)
      }
    }

    const now = Date.now()
    for (const project of [...file.projects].sort((a, b) => a.ref.localeCompare(b.ref))) {
      await db.algorithmProjects.add({
        name: project.name.trim() || 'Algoritmo sem título',
        document: project.document,
        createdAt: now + importedCount,
        updatedAt: now + importedCount,
      } as AlgorithmProject)
      importedCount += 1
    }
  })
  return importedCount
}

function assertValidAlgorithmDocument(document: NewAlgorithmProject['document']): void {
  if (!isAlgorithmDocumentLike(document)) {
    throw new Error('O algoritmo não pode ser salvo: documento fora do schema v1.')
  }
  const issues = validateAlgorithmDocument(document)
  if (hasValidationErrors(issues)) {
    throw new Error(`O algoritmo não pode ser salvo: ${issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message).join(' ')}`)
  }
}

function isPortableAlgorithmProjectLike(value: unknown): value is PortableAlgorithmProject {
  return isRecord(value) &&
    hasOnlyKeys(value, ['ref', 'name', 'document']) &&
    typeof value.ref === 'string' && value.ref.trim().length > 0 && value.ref.length <= 128 &&
    typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 256 &&
    isAlgorithmDocumentLike(value.document)
}

function isAlgorithmDocumentLike(value: unknown): value is AlgorithmDocument {
  return isRecord(value) &&
    hasOnlyKeys(value, ['format', 'version', 'name', 'entryNodeId', 'nodes']) &&
    value.format === ALGORITHM_DOCUMENT_FORMAT &&
    value.version === ALGORITHM_DOCUMENT_VERSION &&
    typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 256 &&
    typeof value.entryNodeId === 'string' && value.entryNodeId.trim().length > 0 &&
    Array.isArray(value.nodes) &&
    value.nodes.length > 0 &&
    value.nodes.length <= MAX_ALGORITHM_DOCUMENT_NODES &&
    value.nodes.every(isAlgorithmNodeLike)
}

function isAlgorithmNodeLike(value: unknown): value is AlgorithmNode {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.trim().length === 0 || value.id.length > 128 ||
      typeof value.type !== 'string' || !isFinitePosition(value.position) ||
      (value.label !== undefined && (typeof value.label !== 'string' || value.label.length > 256))) return false

  const baseKeys = ['id', 'type', 'position', 'label']
  switch (value.type) {
    case 'start':
      return hasOnlyKeys(value, [...baseKeys, 'next']) && isNodeRef(value.next)
    case 'end':
      return hasOnlyKeys(value, baseKeys)
    case 'declare':
      return hasOnlyKeys(value, [...baseKeys, 'variable', 'valueType', 'initialValue', 'next']) &&
        isIdentifier(value.variable) && isValueType(value.valueType) &&
        (value.initialValue === undefined || isRuntimeValue(value.initialValue)) && isNodeRef(value.next)
    case 'assign':
      return hasOnlyKeys(value, [...baseKeys, 'variable', 'expression', 'next']) &&
        isIdentifier(value.variable) && isNonEmptyText(value.expression, 4_096) && isNodeRef(value.next)
    case 'if':
      return hasOnlyKeys(value, [...baseKeys, 'condition', 'thenNext', 'elseNext']) &&
        isNonEmptyText(value.condition, 4_096) && isNodeRef(value.thenNext) && isNodeRef(value.elseNext)
    case 'while':
      return hasOnlyKeys(value, [...baseKeys, 'condition', 'bodyNext', 'exitNext']) &&
        isNonEmptyText(value.condition, 4_096) && isNodeRef(value.bodyNext) && isNodeRef(value.exitNext)
    case 'input':
      return hasOnlyKeys(value, [...baseKeys, 'variable', 'prompt', 'next']) &&
        isIdentifier(value.variable) &&
        (value.prompt === undefined || isNonEmptyText(value.prompt, 1_024)) &&
        isNodeRef(value.next)
    case 'output':
      return hasOnlyKeys(value, [...baseKeys, 'expression', 'next']) &&
        isNonEmptyText(value.expression, 4_096) && isNodeRef(value.next)
    default:
      return false
  }
}

function isFinitePosition(value: unknown): boolean {
  return isRecord(value) && hasOnlyKeys(value, ['x', 'y']) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
}

function isNodeRef(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 128
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) && value.length <= 128
}

function isValueType(value: unknown): value is AlgorithmValueType {
  return value === 'boolean' || value === 'number' || value === 'string'
}

function isRuntimeValue(value: unknown): value is RuntimeValue {
  return value === null || typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    (typeof value === 'string' && value.length <= 4_096)
}

function isNonEmptyText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
}

function assertFileSize(text: string): void {
  if (new TextEncoder().encode(text).length > MAX_ALGORITHM_FILE_BYTES) {
    throw new Error(`Esse arquivo de algoritmos excede o limite de ${MAX_ALGORITHM_FILE_BYTES} bytes.`)
  }
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed)
  return Object.keys(value).every((key) => allowedKeys.has(key))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
