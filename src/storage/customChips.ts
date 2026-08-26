import {
  buildCustomChipDefinition,
  createDlsImportRun,
  planDlsImport,
  type CircuitDocument,
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
