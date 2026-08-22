import { buildCustomChipDefinition, type CircuitDocument, type CustomChipDefinition } from '../circuit'
import {
  db,
  type CustomChipProject,
} from './db'

export interface NewCustomChipInput {
  name: string
  document: CircuitDocument
}

export async function listCustomChipProjects(): Promise<CustomChipProject[]> {
  const projects = await db.customChipProjects.toArray()
  return projects.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getCustomChipProject(id: number): Promise<CustomChipProject | undefined> {
  return db.customChipProjects.get(id)
}

export async function createCustomChipProject(input: NewCustomChipInput): Promise<number> {
  const definition = buildCustomChipDefinition(input.document, input.name)
  const now = Date.now()
  return db.customChipProjects.add({
    name: definition.name,
    definition,
    createdAt: now,
    updatedAt: now,
  } as CustomChipProject)
}

export async function updateCustomChipProject(
  id: number,
  patch: Partial<NewCustomChipInput>,
): Promise<void> {
  const current = await db.customChipProjects.get(id)
  if (!current) throw new Error('Chip customizado não encontrado.')
  const definition = buildCustomChipDefinition(
    patch.document ?? current.definition.document,
    patch.name ?? current.name,
  )
  await db.customChipProjects.update(id, {
    name: definition.name,
    definition,
    updatedAt: Date.now(),
  })
}

export async function deleteCustomChipProject(id: number): Promise<void> {
  await db.customChipProjects.delete(id)
}

export function customChipDocument(definition: CustomChipDefinition): CircuitDocument {
  return definition.document
}
