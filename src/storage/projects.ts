import { tryParse } from '../engine/parser'
import { db, type NewProject, type Project } from './db'

/** Projetos do mais recente para o mais antigo. */
export async function listProjects(): Promise<Project[]> {
  const projects = await db.projects.toArray()
  return projects.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function createProject(input: NewProject): Promise<number> {
  const now = Date.now()
  return db.projects.add({
    ...input,
    name: input.name.trim() || 'Sem nome',
    createdAt: now,
    updatedAt: now,
  } as Project)
}

export async function updateProject(
  id: number,
  patch: Partial<NewProject>,
): Promise<void> {
  const clean = { ...patch }
  if (clean.name !== undefined) clean.name = clean.name.trim() || 'Sem nome'
  await db.projects.update(id, { ...clean, updatedAt: Date.now() })
}

export async function deleteProject(id: number): Promise<void> {
  await db.projects.delete(id)
}

export async function getProject(id: number): Promise<Project | undefined> {
  return db.projects.get(id)
}

/** Formato do arquivo `.veritas` — o mesmo que a CLI e o servidor MCP vão ler. */
export interface VeritasFile {
  format: 'veritas'
  version: 1
  exportedAt: string
  projects: NewProject[]
}

export const VERITAS_FILE_VERSION = 1
export const MAX_VERITAS_FILE_BYTES = 5_000_000

export function serializeProjects(projects: readonly Project[]): string {
  const file: VeritasFile = {
    format: 'veritas',
    version: VERITAS_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    projects: projects.map(({ name, expression, notation }) => ({
      name,
      expression,
      notation,
    })),
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

/**
 * Lê um arquivo `.veritas`. Recusa qualquer coisa que não tenha a cara de um,
 * porque importar lixo silenciosamente é pior do que recusar.
 */
export function parseVeritasFile(text: string): NewProject[] {
  if (new TextEncoder().encode(text).length > MAX_VERITAS_FILE_BYTES) {
    throw new Error(`Esse arquivo excede o limite de ${MAX_VERITAS_FILE_BYTES} bytes.`)
  }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Esse arquivo não é um JSON válido.')
  }

  if (!isRecord(data) || data.format !== 'veritas') {
    throw new Error('Esse arquivo não é um projeto do Veritas.')
  }
  if (
    !hasOnlyKeys(data, ['format', 'version', 'exportedAt', 'projects']) ||
    (data.exportedAt !== undefined && typeof data.exportedAt !== 'string')
  ) {
    throw new Error('O envelope do arquivo contém campos desconhecidos ou inválidos.')
  }

  if (typeof data.version !== 'number' || !Number.isInteger(data.version) || data.version < 1) {
    throw new Error('Esse arquivo tem uma versão inválida.')
  }
  if (data.version > VERITAS_FILE_VERSION) {
    throw new Error(
      'Esse arquivo foi salvo por uma versão mais nova do Veritas.',
    )
  }
  if (data.version < VERITAS_FILE_VERSION) {
    throw new Error('Esse arquivo usa uma versão antiga sem migração disponível.')
  }

  if (!Array.isArray(data.projects)) {
    throw new Error('O arquivo não tem nenhum projeto dentro.')
  }

  const projects = data.projects.map((project, index) => {
    if (!isProjectLike(project)) {
      throw new Error(`O projeto ${index + 1} do arquivo é inválido.`)
    }
    if (!tryParse(project.expression).ok) {
      throw new Error(`O projeto ${index + 1} do arquivo contém uma expressão inválida.`)
    }
    return {
      name: project.name.trim() || 'Sem nome',
      expression: project.expression,
      notation: normalizeNotation(project.notation),
    }
  })

  if (projects.length === 0) {
    throw new Error('O arquivo não tem nenhum projeto.')
  }

  return projects
}

export async function importProjects(projects: readonly NewProject[]): Promise<number> {
  const now = Date.now()
  const rows = projects.map(
    (project, index) =>
      ({
        ...project,
        // O deslocamento preserva a ordem do arquivo na lista de recentes.
        createdAt: now + index,
        updatedAt: now + index,
      }) as Project,
  )
  await db.transaction('rw', db.projects, async () => {
    await db.projects.bulkAdd(rows)
  })
  return rows.length
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed)
  return Object.keys(value).every((key) => allowedKeys.has(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isProjectLike(
  value: unknown,
): value is { name: string; expression: string; notation: unknown } {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['name', 'expression', 'notation']) &&
    typeof value.name === 'string' &&
    typeof value.expression === 'string' &&
    value.expression.trim().length > 0
  )
}

function normalizeNotation(value: unknown): NewProject['notation'] {
  return value === 'programming' || value === 'text' ? value : 'math'
}
