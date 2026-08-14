import { db, type AlgorithmProject, type NewAlgorithmProject } from './db'

export async function listAlgorithmProjects(): Promise<AlgorithmProject[]> {
  const projects = await db.algorithmProjects.toArray()
  return projects.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function createAlgorithmProject(input: NewAlgorithmProject): Promise<number> {
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
  if (clean.name !== undefined) clean.name = clean.name.trim() || 'Algoritmo sem título'
  await db.algorithmProjects.update(id, { ...clean, updatedAt: Date.now() })
}

export async function deleteAlgorithmProject(id: number): Promise<void> {
  await db.algorithmProjects.delete(id)
}
