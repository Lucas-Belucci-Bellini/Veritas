import { MAX_BUS_WIDTH } from '../bus'
import {
  buildCustomChipDefinition,
  createDlsImportRun,
  planDlsImport,
  type CircuitDocument,
  type CircuitNode,
  isEditorComponentType,
  type CustomChipDefinition,
  type CustomChipLibraryEntry,
  type DlsImportReport,
} from '../circuit'
import {
  db,
  type CustomChipProject,
} from './db'

export const CUSTOM_CHIP_LIBRARY_EVENT = 'veritas:custom-chip-library-changed'

export interface NewCustomChipInput {
  name: string
  document: CircuitDocument
}

export function announceCustomChipLibraryChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CUSTOM_CHIP_LIBRARY_EVENT))
}

export async function listCustomChipProjects(): Promise<CustomChipProject[]> {
  const projects = await db.customChipProjects.toArray()
  return projects.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getCustomChipProject(id: number): Promise<CustomChipProject | undefined> {
  return db.customChipProjects.get(id)
}

/**
 * Biblioteca local no formato que a validação hierárquica espera.
 *
 * Um chip pode conter outros chips, então construir uma definição exige ter as
 * definições dos filhos à mão. Carregar aqui mantém a API do storage estável:
 * quem salva um chip não precisa montar a biblioteca.
 */
async function loadLibrary(): Promise<CustomChipLibraryEntry[]> {
  const projects = await db.customChipProjects.toArray()
  return projects.map((project) => ({ id: project.id, definition: project.definition }))
}

export async function createCustomChipProject(
  input: NewCustomChipInput,
  customChips?: readonly CustomChipLibraryEntry[],
): Promise<number> {
  const definition = buildCustomChipDefinition(input.document, input.name, {
    customChips: customChips ?? await loadLibrary(),
  })
  const now = Date.now()
  const id = await db.customChipProjects.add({
    name: definition.name,
    definition,
    createdAt: now,
    updatedAt: now,
  } as CustomChipProject)
  announceCustomChipLibraryChanged()
  return id
}

export async function updateCustomChipProject(
  id: number,
  patch: Partial<NewCustomChipInput>,
  customChips?: readonly CustomChipLibraryEntry[],
): Promise<void> {
  const current = await db.customChipProjects.get(id)
  if (!current) throw new Error('Chip customizado não encontrado.')
  const definition = buildCustomChipDefinition(
    patch.document ?? current.definition.document,
    patch.name ?? current.name,
    { customChips: customChips ?? await loadLibrary(), selfId: id },
  )
  await db.customChipProjects.update(id, {
    name: definition.name,
    definition,
    updatedAt: Date.now(),
  })
  announceCustomChipLibraryChanged()
}

export async function deleteCustomChipProject(id: number): Promise<void> {
  await db.customChipProjects.delete(id)
  announceCustomChipLibraryChanged()
}

export function customChipDocument(definition: CustomChipDefinition): CircuitDocument {
  return definition.document
}

export const CUSTOM_CHIP_LIBRARY_FILE_FORMAT = 'veritas-chip-library' as const
export const CUSTOM_CHIP_LIBRARY_FILE_VERSION = 1 as const
export const MAX_CUSTOM_CHIP_LIBRARY_FILE_BYTES = 5_000_000

export interface PortableCustomChipNodeOptions {
  period?: number
  ticks?: number
  value?: boolean
  initial?: boolean
  width?: number
  widths?: number[]
  channel?: string
  customChipRef?: string
  customChipBoundary?: 'internal'
}

export type PortableCustomChipNode = Omit<CircuitNode, 'options'> & {
  options?: PortableCustomChipNodeOptions
}

export interface PortableCustomChipDocument {
  format: 'veritas-circuit'
  version: 1
  name: string
  nodes: PortableCustomChipNode[]
  connections: CircuitDocument['connections']
}

export interface PortableCustomChipEntry {
  ref: string
  name: string
  document: PortableCustomChipDocument
}

export interface VeritasCustomChipLibraryFile {
  format: typeof CUSTOM_CHIP_LIBRARY_FILE_FORMAT
  version: typeof CUSTOM_CHIP_LIBRARY_FILE_VERSION
  exportedAt?: string
  chips: PortableCustomChipEntry[]
}

/**
 * Serializa uma biblioteca local sem exportar ids Dexie. Referências são refs
 * opacas e locais ao arquivo; dependências aparecem antes dos dependentes.
 */
export function serializeCustomChipLibrary(
  chips: readonly CustomChipLibraryEntry[],
  exportedAt = new Date().toISOString(),
): string {
  const byId = new Map<number, CustomChipLibraryEntry>()
  const byName = new Set<string>()
  for (const entry of chips) {
    if (!Number.isInteger(entry.id) || entry.id < 1 || byId.has(entry.id)) {
      throw new Error('A biblioteca de chips contém ids locais inválidos ou duplicados.')
    }
    const nameKey = entry.definition.name.trim().toLowerCase()
    if (!nameKey || byName.has(nameKey)) {
      throw new Error(`A biblioteca contém nomes de chips duplicados: "${entry.definition.name}".`)
    }
    byName.add(nameKey)
    byId.set(entry.id, entry)
  }

  const refForId = (id: number): string => {
    if (!byId.has(id)) {
      throw new Error(`A dependência local do chip ${id} não foi incluída na biblioteca.`)
    }
    return `chip-${id}`
  }
  const ordered: CustomChipLibraryEntry[] = []
  const visiting = new Set<number>()
  const visited = new Set<number>()
  const visit = (entry: CustomChipLibraryEntry): void => {
    if (visited.has(entry.id)) return
    if (visiting.has(entry.id)) {
      throw new Error(`A biblioteca contém um ciclo envolvendo o chip "${entry.definition.name}".`)
    }
    visiting.add(entry.id)
    for (const node of entry.definition.document.nodes) {
      if (node.type !== 'custom-chip') continue
      const childId = node.options?.customChipId
      if (childId === undefined) {
        throw new Error(`O chip "${entry.definition.name}" tem uma dependência sem id.`)
      }
      refForId(childId)
      visit(byId.get(childId)!)
    }
    visiting.delete(entry.id)
    visited.add(entry.id)
    ordered.push(entry)
  }
  for (const entry of [...chips].sort((a, b) => a.id - b.id)) visit(entry)

  const file: VeritasCustomChipLibraryFile = {
    format: CUSTOM_CHIP_LIBRARY_FILE_FORMAT,
    version: CUSTOM_CHIP_LIBRARY_FILE_VERSION,
    exportedAt,
    chips: ordered.map((entry) => ({
      ref: refForId(entry.id),
      name: entry.definition.name,
      document: toPortableDocument(entry.definition.document, refForId),
    })),
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

/** Lê o envelope portátil sem resolver ids locais nem gravar no banco. */
export async function importCustomChipLibraryFile(text: string): Promise<number> {
  const file = parseCustomChipLibraryFile(text)
  let importedCount = 0
  await db.transaction('rw', db.customChipProjects, async () => {
    const existing = await loadLibrary()
    const existingNames = new Set(existing.map((entry) => entry.definition.name.trim().toLowerCase()))
    for (const chip of file.chips) {
      if (existingNames.has(chip.name.trim().toLowerCase())) {
        throw new Error(`Já existe um chip chamado "${chip.name}" na biblioteca local.`)
      }
    }

    const byRef = new Map(file.chips.map((chip) => [chip.ref, chip] as const))
    const ordered = orderPortableChips(file.chips, byRef)
    const localIds = new Map<string, number>()
    const library = [...existing]
    for (const chip of ordered) {
      const document = toLocalDocument(chip.document, localIds)
      const definition = buildCustomChipDefinition(document, chip.name, { customChips: library })
      const now = Date.now()
      const id = await db.customChipProjects.add({
        name: definition.name,
        definition,
        createdAt: now,
        updatedAt: now,
      } as CustomChipProject)
      localIds.set(chip.ref, id)
      library.push({ id, definition })
      existingNames.add(definition.name.trim().toLowerCase())
      importedCount += 1
    }
  })
  announceCustomChipLibraryChanged()
  return importedCount
}

export function parseCustomChipLibraryFile(text: string): VeritasCustomChipLibraryFile {
  if (new TextEncoder().encode(text).length > MAX_CUSTOM_CHIP_LIBRARY_FILE_BYTES) {
    throw new Error(`Esse arquivo de chips excede o limite de ${MAX_CUSTOM_CHIP_LIBRARY_FILE_BYTES} bytes.`)
  }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Esse arquivo de chips não é um JSON válido.')
  }
  if (!isRecord(data) || data.format !== CUSTOM_CHIP_LIBRARY_FILE_FORMAT) {
    throw new Error('Esse arquivo não é uma biblioteca de chips do Veritas.')
  }
  if (
    !hasOnlyKeys(data, ['format', 'version', 'exportedAt', 'chips']) ||
    (data.exportedAt !== undefined && typeof data.exportedAt !== 'string')
  ) {
    throw new Error('O envelope da biblioteca de chips contém campos desconhecidos ou inválidos.')
  }
  if (typeof data.version !== 'number' || !Number.isInteger(data.version) || data.version < 1) {
    throw new Error('Esse arquivo de chips tem uma versão inválida.')
  }
  if (data.version > CUSTOM_CHIP_LIBRARY_FILE_VERSION) {
    throw new Error('Esse arquivo de chips foi salvo por uma versão mais nova do Veritas.')
  }
  if (data.version < CUSTOM_CHIP_LIBRARY_FILE_VERSION) {
    throw new Error('Esse arquivo de chips usa uma versão antiga sem migração disponível.')
  }
  if (!Array.isArray(data.chips) || data.chips.length === 0) {
    throw new Error('O arquivo de chips não tem nenhuma definição.')
  }

  const chips = data.chips.map((value, index) => {
    if (!isPortableChipEntryLike(value)) {
      throw new Error(`O chip ${index + 1} do arquivo de chips é inválido.`)
    }
    return value
  })
  const refs = new Set<string>()
  const names = new Set<string>()
  const dependencies = new Map<string, string[]>()
  for (const chip of chips) {
    if (refs.has(chip.ref)) throw new Error(`A ref "${chip.ref}" aparece mais de uma vez.`)
    const nameKey = chip.name.trim().toLowerCase()
    if (names.has(nameKey)) throw new Error(`O nome de chip "${chip.name}" aparece mais de uma vez.`)
    refs.add(chip.ref)
    names.add(nameKey)
    dependencies.set(chip.ref, chip.document.nodes
      .filter((node) => node.type === 'custom-chip')
      .map((node) => node.options!.customChipRef!))
  }
  for (const [ref, childRefs] of dependencies) {
    for (const childRef of childRefs) {
      if (!refs.has(childRef)) {
        throw new Error(`O chip "${ref}" referencia a dependência "${childRef}" ausente.`)
      }
    }
  }
  assertAcyclicPortableDependencies(dependencies)

  return {
    format: CUSTOM_CHIP_LIBRARY_FILE_FORMAT,
    version: CUSTOM_CHIP_LIBRARY_FILE_VERSION,
    ...(data.exportedAt !== undefined ? { exportedAt: data.exportedAt } : {}),
    chips,
  }
}

function orderPortableChips(
  chips: readonly PortableCustomChipEntry[],
  byRef: ReadonlyMap<string, PortableCustomChipEntry>,
): PortableCustomChipEntry[] {
  const ordered: PortableCustomChipEntry[] = []
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (chip: PortableCustomChipEntry): void => {
    if (visited.has(chip.ref)) return
    if (visiting.has(chip.ref)) throw new Error(`A biblioteca contém um ciclo envolvendo a ref "${chip.ref}".`)
    visiting.add(chip.ref)
    for (const childRef of chip.document.nodes
      .filter((node) => node.type === 'custom-chip')
      .map((node) => node.options!.customChipRef!)) {
      visit(byRef.get(childRef)!)
    }
    visiting.delete(chip.ref)
    visited.add(chip.ref)
    ordered.push(chip)
  }
  for (const chip of [...chips].sort((a, b) => a.ref.localeCompare(b.ref))) visit(chip)
  return ordered
}

function toLocalDocument(
  document: PortableCustomChipDocument,
  localIds: ReadonlyMap<string, number>,
): CircuitDocument {
  return {
    format: document.format,
    version: document.version,
    name: document.name,
    nodes: document.nodes.map((node) => {
      if (node.type !== 'custom-chip') return node as CircuitNode
      const ref = node.options?.customChipRef
      const childId = ref === undefined ? undefined : localIds.get(ref)
      if (childId === undefined) {
        throw new Error(`A dependência portátil "${ref ?? ''}" ainda não foi importada.`)
      }
      const { customChipRef: _customChipRef, ...options } = node.options ?? {}
      return { ...node, options: { ...options, customChipId: childId } } as CircuitNode
    }),
    connections: document.connections,
  }
}

function toPortableDocument(
  document: CircuitDocument,
  refForId: (id: number) => string,
): PortableCustomChipDocument {
  return {
    format: document.format,
    version: document.version,
    name: document.name,
    nodes: document.nodes.map((node) => {
      if (node.type !== 'custom-chip') return node
      const childId = node.options?.customChipId
      if (childId === undefined) throw new Error(`O chip "${node.id}" não declara dependência.`)
      const { customChipId: _customChipId, ...options } = node.options ?? {}
      return { ...node, options: { ...options, customChipRef: refForId(childId) } }
    }),
    connections: document.connections,
  }
}

function isPortableChipEntryLike(value: unknown): value is PortableCustomChipEntry {
  return isRecord(value) &&
    hasOnlyKeys(value, ['ref', 'name', 'document']) &&
    typeof value.ref === 'string' && value.ref.trim().length > 0 && value.ref.length <= 128 &&
    typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 256 &&
    isPortableDocumentLike(value.document)
}

function isPortableDocumentLike(value: unknown): value is PortableCustomChipDocument {
  return isRecord(value) &&
    hasOnlyKeys(value, ['format', 'version', 'name', 'nodes', 'connections']) &&
    value.format === 'veritas-circuit' && value.version === 1 &&
    typeof value.name === 'string' &&
    Array.isArray(value.nodes) && value.nodes.every(isPortableNodeLike) &&
    Array.isArray(value.connections) && value.connections.every(isPortableConnectionLike)
}

function isPortableNodeLike(value: unknown): value is PortableCustomChipNode {
  if (!isRecord(value) || !hasOnlyKeys(value, ['id', 'type', 'position', 'label', 'options']) ||
      typeof value.id !== 'string' || typeof value.type !== 'string' ||
      !isEditorComponentType(value.type as never) || !isRecord(value.position) ||
      !hasOnlyKeys(value.position, ['x', 'y']) || !isFiniteNumber(value.position.x) ||
      !isFiniteNumber(value.position.y) || (value.label !== undefined && typeof value.label !== 'string')) return false
  if (value.options === undefined) return value.type !== 'custom-chip'
  if (!isRecord(value.options) || !hasOnlyKeys(value.options, [
    'period', 'ticks', 'value', 'initial', 'width', 'widths', 'channel',
    'customChipRef', 'customChipBoundary',
  ])) return false
  if (value.options.period !== undefined && !isPositiveInteger(value.options.period)) return false
  if (value.options.ticks !== undefined && !isPositiveInteger(value.options.ticks)) return false
  if (value.options.value !== undefined && typeof value.options.value !== 'boolean') return false
  if (value.options.initial !== undefined && typeof value.options.initial !== 'boolean') return false
  if (value.options.width !== undefined && !isCircuitWidth(value.options.width)) return false
  if (value.options.widths !== undefined && (!Array.isArray(value.options.widths) || value.options.widths.some((part) => !isCircuitWidth(part)))) return false
  if (value.options.channel !== undefined && typeof value.options.channel !== 'string') return false
  if (value.options.customChipBoundary !== undefined && value.options.customChipBoundary !== 'internal') return false
  if (value.type === 'custom-chip') return typeof value.options.customChipRef === 'string' && value.options.customChipRef.length > 0
  return value.options.customChipRef === undefined
}

function isPortableConnectionLike(value: unknown): value is CircuitDocument['connections'][number] {
  return isRecord(value) && hasOnlyKeys(value, ['source', 'target']) && isRecord(value.source) &&
    isRecord(value.target) && hasOnlyKeys(value.source, ['node', 'port']) &&
    hasOnlyKeys(value.target, ['node', 'port']) && typeof value.source.node === 'string' &&
    (value.source.port === undefined || Number.isInteger(value.source.port)) &&
    typeof value.target.node === 'string' && Number.isInteger(value.target.port)
}

function assertAcyclicPortableDependencies(dependencies: ReadonlyMap<string, readonly string[]>): void {
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (ref: string): void => {
    if (visited.has(ref)) return
    if (visiting.has(ref)) throw new Error(`A biblioteca contém um ciclo envolvendo a ref "${ref}".`)
    visiting.add(ref)
    for (const child of dependencies.get(ref) ?? []) visit(child)
    visiting.delete(ref)
    visited.add(ref)
  }
  for (const ref of dependencies.keys()) visit(ref)
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export interface DlsImportProgress {
  /** Chips já processados, entre acertos e recusas. */
  done: number
  total: number
  name: string
}

/**
 * Traz uma biblioteca inteira do Digital Logic Sim para a biblioteca local.
 *
 * Salvar chip a chip pelo `createCustomChipProject` releria a tabela toda a
 * cada um — com centenas de chips, a importação vira O(n²) de leitura. Aqui a
 * biblioteca é carregada uma vez e cresce em memória junto com o que entra.
 *
 * Quem valida continua sendo o Veritas: cada chip passa por
 * `buildCustomChipDefinition` antes de ir para o banco, e o que ele rejeitar
 * sai no relatório com a mensagem dele — junto com quem dependia daquele chip.
 */
export async function importDlsChipProjects(
  sources: readonly unknown[],
  onProgress?: (progress: DlsImportProgress) => void,
): Promise<DlsImportReport> {
  const plan = planDlsImport(sources)
  const run = createDlsImportRun(plan)
  const library = await loadLibrary()
  const existing = new Map(library.map((entry) => [entry.definition.name, entry] as const))
  let done = 0

  for (let step = run.next(); step; step = run.next()) {
    try {
      const already = existing.get(step.name)
      if (already) {
        // Reaproveitar em vez de duplicar mantém um chip por nome — mas só
        // quando os pinos batem, senão os fios de quem o usa cairiam em portas
        // que não existem, e o erro apareceria longe da causa.
        const inputs = step.chip.InputPins?.length ?? 0
        const outputs = step.chip.OutputPins?.length ?? 0
        if (already.definition.inputs.length !== inputs || already.definition.outputs.length !== outputs) {
          throw new Error(
            `Já existe um chip chamado "${step.name}" na biblioteca, com ` +
            `${already.definition.inputs.length} entradas e ${already.definition.outputs.length} saídas ` +
            `em vez de ${inputs} e ${outputs}.`,
          )
        }
        run.reused(step, already.id)
      } else {
        const definition = buildCustomChipDefinition(run.document(step), step.name, { customChips: library })
        const now = Date.now()
        const id = await db.customChipProjects.add({
          name: definition.name,
          definition,
          createdAt: now,
          updatedAt: now,
        } as CustomChipProject)
        const entry = { id, definition }
        library.push(entry)
        existing.set(definition.name, entry)
        run.succeeded(step, id)
      }
    } catch (error) {
      run.failed(step, error instanceof Error ? error.message : String(error))
    }
    done += 1
    onProgress?.({ done, total: plan.order.length, name: step.name })
  }

  announceCustomChipLibraryChanged()
  return run.report()
}
