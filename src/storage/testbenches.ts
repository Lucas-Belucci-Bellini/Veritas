import {
  MAX_TESTBENCH_CASES,
  MAX_TESTBENCH_TICKS,
  TESTBENCH_FORMAT,
  TESTBENCH_VERSION,
  type TestbenchCase,
  type TestbenchDocument,
  type TestbenchStep,
} from '../circuit'
import { db, type NewTestbenchProject, type TestbenchProject } from './db'

export const TESTBENCH_FILE_FORMAT = 'veritas-testbenches'
export const TESTBENCH_FILE_VERSION = 1 as const
export const MAX_TESTBENCH_FILE_BYTES = 5_000_000

export interface VeritasTestbenchFile {
  format: typeof TESTBENCH_FILE_FORMAT
  version: typeof TESTBENCH_FILE_VERSION
  exportedAt: string
  testbenches: Array<{
    name: string
    circuitName: string
    document: TestbenchDocument
  }>
}

export async function listTestbenchProjects(
  circuitId?: number,
): Promise<TestbenchProject[]> {
  const projects =
    circuitId === undefined
      ? await db.testbenchProjects.toArray()
      : await db.testbenchProjects
          .where('circuitId')
          .equals(circuitId)
          .toArray()
  return projects.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getTestbenchProject(
  id: number,
): Promise<TestbenchProject | undefined> {
  return db.testbenchProjects.get(id)
}

export async function createTestbenchProject(
  input: NewTestbenchProject,
): Promise<number> {
  const now = Date.now()
  return db.testbenchProjects.add({
    ...input,
    name: normalizeName(input.name, input.document),
    document: normalizeTestbenchDocument(input.document),
    createdAt: now,
    updatedAt: now,
  } as TestbenchProject)
}

export async function updateTestbenchProject(
  id: number,
  patch: Partial<NewTestbenchProject>,
): Promise<void> {
  const clean = { ...patch }
  const current = await getTestbenchProject(id)
  if (!current) return
  if (clean.name !== undefined)
    clean.name = normalizeName(clean.name, clean.document ?? current.document)
  if (clean.document !== undefined) {
    clean.document = normalizeTestbenchDocument(clean.document)
    if (clean.name === undefined)
      clean.name = normalizeName(current.name, clean.document)
  }
  await db.testbenchProjects.update(id, { ...clean, updatedAt: Date.now() })
}

export async function deleteTestbenchProject(id: number): Promise<void> {
  await db.testbenchProjects.delete(id)
}

export function serializeTestbenchProjects(
  projects: readonly TestbenchProject[],
  circuitName: string,
): string {
  const file: VeritasTestbenchFile = {
    format: TESTBENCH_FILE_FORMAT,
    version: TESTBENCH_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    testbenches: projects.map((project) => ({
      name: project.name,
      circuitName: circuitName.trim() || 'Circuito sem nome',
      document: normalizeTestbenchDocument(project.document),
    })),
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

export function parseTestbenchFile(text: string): Array<{
  name: string
  circuitName: string
  document: TestbenchDocument
}> {
  if (new TextEncoder().encode(text).length > MAX_TESTBENCH_FILE_BYTES) {
    throw new Error(`Esse arquivo de testbench excede o limite de ${MAX_TESTBENCH_FILE_BYTES} bytes.`)
  }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Esse arquivo de testbench não é um JSON válido.')
  }

  if (!isRecord(data) || data.format !== TESTBENCH_FILE_FORMAT) {
    throw new Error('Esse arquivo não é uma coleção de testbenches do Veritas.')
  }
  if (
    !hasOnlyKeys(data, ['format', 'version', 'exportedAt', 'testbenches']) ||
    (data.exportedAt !== undefined && typeof data.exportedAt !== 'string')
  ) {
    throw new Error('O envelope do arquivo de testbench contém campos desconhecidos ou inválidos.')
  }
  if (
    typeof data.version !== 'number' ||
    !Number.isInteger(data.version) ||
    data.version < 1
  ) {
    throw new Error('Esse arquivo de testbench tem uma versão inválida.')
  }
  if (data.version > TESTBENCH_FILE_VERSION) {
    throw new Error(
      'Esse arquivo de testbench foi salvo por uma versão mais nova do Veritas.',
    )
  }
  if (!Array.isArray(data.testbenches)) {
    throw new Error('O arquivo de testbench não tem documentos dentro.')
  }

  const projects = data.testbenches.map((project, index) => {
    if (!isTestbenchProjectLike(project)) {
      throw new Error(`O documento ${index + 1} do arquivo de testbench é inválido.`)
    }
    return {
      name: normalizeName(project.name, project.document),
      circuitName: project.circuitName.trim() || 'Circuito sem nome',
      document: normalizeTestbenchDocument(project.document),
    }
  })

  if (projects.length === 0) {
    throw new Error('O arquivo de testbench não tem nenhum documento.')
  }
  return projects
}

export async function importTestbenchProjects(
  circuitId: number,
  projects: readonly { name: string; document: TestbenchDocument }[],
  expectedCircuitName?: string,
): Promise<number> {
  const now = Date.now()
  const rows = projects.map(
    (project, index) =>
      ({
        circuitId,
        name: normalizeName(project.name, project.document),
        document: normalizeTestbenchDocument(project.document),
        createdAt: now + index,
        updatedAt: now + index,
      }) as TestbenchProject,
  )
  await db.transaction('rw', db.circuitProjects, db.testbenchProjects, async () => {
    const circuit = await db.circuitProjects.get(circuitId)
    if (!circuit) {
      throw new Error('O circuito de destino do testbench não existe mais.')
    }
    if (
      expectedCircuitName !== undefined &&
      circuit.name.trim() !== expectedCircuitName.trim()
    ) {
      throw new Error('O circuito de destino mudou durante a importação do testbench.')
    }
    await db.testbenchProjects.bulkAdd(rows)
  })
  return rows.length
}

function normalizeName(name: string, document: TestbenchDocument): string {
  return name.trim() || document.name.trim() || 'Testbench sem nome'
}

function normalizeTestbenchDocument(
  document: TestbenchDocument,
): TestbenchDocument {
  return {
    format: TESTBENCH_FORMAT,
    version: TESTBENCH_VERSION,
    name: document.name.trim() || 'Testbench sem nome',
    cases: document.cases.map(normalizeCase),
  }
}

function normalizeCase(testCase: TestbenchCase): TestbenchCase {
  return {
    ...(testCase.name?.trim() ? { name: testCase.name.trim() } : {}),
    ...(testCase.inputs
      ? { inputs: normalizeBooleanRecord(testCase.inputs) }
      : {}),
    ...(testCase.expect
      ? { expect: normalizeBooleanRecord(testCase.expect) }
      : {}),
    ...(testCase.steps ? { steps: testCase.steps.map(normalizeStep) } : {}),
  }
}

function normalizeStep(step: TestbenchStep): TestbenchStep {
  return {
    ...(step.set ? { set: normalizeBooleanRecord(step.set) } : {}),
    ...(step.ticks !== undefined
      ? { ticks: Math.max(1, Math.floor(step.ticks)) }
      : {}),
    ...(step.expect ? { expect: normalizeBooleanRecord(step.expect) } : {}),
  }
}

function normalizeBooleanRecord(
  record: Readonly<Record<string, boolean>>,
): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(record).map(([name, value]) => [
      name.trim(),
      Boolean(value),
    ]),
  )
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed)
  return Object.keys(value).every((key) => allowedKeys.has(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([name, item]) => name.trim().length > 0 && typeof item === 'boolean',
    )
  )
}

function isTestbenchProjectLike(
  value: unknown,
): value is { name: string; circuitName: string; document: TestbenchDocument } {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['name', 'circuitName', 'document']) ||
    typeof value.name !== 'string' ||
    typeof value.circuitName !== 'string' ||
    !isTestbenchDocumentLike(value.document)
  ) {
    return false
  }
  return true
}

function isTestbenchDocumentLike(value: unknown): value is TestbenchDocument {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['format', 'version', 'name', 'cases']) ||
    value.format !== TESTBENCH_FORMAT ||
    value.version !== TESTBENCH_VERSION ||
    typeof value.name !== 'string' ||
    !Array.isArray(value.cases) ||
    value.cases.length === 0 ||
    value.cases.length > MAX_TESTBENCH_CASES
  ) {
    return false
  }
  if (!value.cases.every(isTestbenchCaseLike)) return false
  const totalTicks = value.cases.reduce(
    (total, testCase) =>
      total +
      (testCase.steps ?? []).reduce(
        (sum, step) => sum + Math.max(1, Math.floor(step.ticks ?? 1)),
        0,
      ),
    0,
  )
  return totalTicks <= MAX_TESTBENCH_TICKS
}

function isTestbenchCaseLike(value: unknown): value is TestbenchCase {
  if (!isRecord(value) || !hasOnlyKeys(value, ['name', 'inputs', 'expect', 'steps'])) return false
  if (value.name !== undefined && typeof value.name !== 'string') return false
  if (value.inputs !== undefined && !isBooleanRecord(value.inputs)) return false
  if (value.expect !== undefined && !isBooleanRecord(value.expect)) return false
  if (
    value.steps !== undefined &&
    (!Array.isArray(value.steps) ||
      value.steps.length === 0 ||
      !value.steps.every(isTestbenchStepLike))
  )
    return false
  const hasSteps = value.steps !== undefined
  const hasVector = value.inputs !== undefined || value.expect !== undefined
  return hasSteps !== hasVector
}

function isTestbenchStepLike(value: unknown): value is TestbenchStep {
  if (!isRecord(value) || !hasOnlyKeys(value, ['set', 'ticks', 'expect'])) return false
  if (value.set !== undefined && !isBooleanRecord(value.set)) return false
  if (value.expect !== undefined && !isBooleanRecord(value.expect)) return false
  if (
    value.ticks !== undefined &&
    (typeof value.ticks !== 'number' ||
      !Number.isFinite(value.ticks) ||
      value.ticks < 0)
  ) {
    return false
  }
  return true
}
