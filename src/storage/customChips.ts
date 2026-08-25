import {
  buildCustomChipDefinition,
  type CircuitDocument,
  type CustomChipDefinition,
  type CustomChipLibraryEntry,
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

export async function createCustomChipProject(
  input: NewCustomChipInput,
  customChips: readonly CustomChipLibraryEntry[] = [],
): Promise<number> {
  const definition = buildCustomChipDefinition(input.document, input.name, { customChips })
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
  customChips: readonly CustomChipLibraryEntry[] = [],
): Promise<void> {
  const current = await db.customChipProjects.get(id)
  if (!current) throw new Error('Chip customizado não encontrado.')
  const definition = buildCustomChipDefinition(
    patch.document ?? current.definition.document,
    patch.name ?? current.name,
    { customChips },
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
