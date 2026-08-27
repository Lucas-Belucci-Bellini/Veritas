import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAlgorithmDocument } from '../algorithms'
import { db } from './db'
import {
  createAlgorithmProject,
  deleteAlgorithmProject,
  getAlgorithmProject,
  listAlgorithmProjects,
  updateAlgorithmProject,
} from './algorithms'

beforeEach(async () => {
  await db.open()
  await db.algorithmProjects.clear()
})

describe('algoritmos salvos localmente', () => {
  it('cria e reabre um AlgorithmDocument versionado', async () => {
    const document = createAlgorithmDocument('Primeiro algoritmo')
    const id = await createAlgorithmProject({ name: document.name, document })
    const saved = await getAlgorithmProject(id)

    expect(saved).toMatchObject({ name: 'Primeiro algoritmo', document })
    expect(saved!.createdAt).toBeGreaterThan(0)
  })

  it('recusa documento com entrada inexistente', async () => {
    const invalid = { ...createAlgorithmDocument('Inválido'), entryNodeId: 'missing' }

    await expect(createAlgorithmProject({
      name: invalid.name,
      document: invalid,
    })).rejects.toThrow('não pode ser salvo')
    expect(await listAlgorithmProjects()).toHaveLength(0)
  })

  it('recusa atualização para documento semanticamente inválido', async () => {
    const valid = createAlgorithmDocument('Válido')
    const id = await createAlgorithmProject({ name: valid.name, document: valid })
    const invalid = { ...valid, entryNodeId: 'missing' }

    await expect(updateAlgorithmProject(id, { document: invalid })).rejects.toThrow('não pode ser salvo')
    expect((await getAlgorithmProject(id))?.document.entryNodeId).toBe('start')
  })

  it('normaliza nomes vazios e atualiza updatedAt', async () => {
    const document = createAlgorithmDocument()
    const id = await createAlgorithmProject({ name: '   ', document })
    const before = (await getAlgorithmProject(id))!.updatedAt

    await new Promise((resolve) => setTimeout(resolve, 5))
    await updateAlgorithmProject(id, { name: 'Algoritmo atualizado' })

    const updated = await getAlgorithmProject(id)
    expect(updated!.name).toBe('Algoritmo atualizado')
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('lista os algoritmos mais recentes primeiro e permite apagar', async () => {
    const first = createAlgorithmDocument('Antigo')
    const second = createAlgorithmDocument('Novo')
    const firstId = await createAlgorithmProject({ name: first.name, document: first })
    await new Promise((resolve) => setTimeout(resolve, 5))
    const secondId = await createAlgorithmProject({ name: second.name, document: second })

    expect((await listAlgorithmProjects()).map((project) => project.name)).toEqual(['Novo', 'Antigo'])
    await deleteAlgorithmProject(firstId)
    expect(await getAlgorithmProject(firstId)).toBeUndefined()
    expect(await getAlgorithmProject(secondId)).toBeDefined()
  })
})
