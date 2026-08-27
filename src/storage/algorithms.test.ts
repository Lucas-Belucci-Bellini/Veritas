import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAlgorithmDocument } from '../algorithms'
import { db } from './db'
import {
  ALGORITHM_FILE_FORMAT,
  ALGORITHM_FILE_VERSION,
  createAlgorithmProject,
  deleteAlgorithmProject,
  getAlgorithmProject,
  importAlgorithmFile,
  listAlgorithmProjects,
  MAX_ALGORITHM_FILE_BYTES,
  parseAlgorithmFile,
  serializeAlgorithmProjects,
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

  it('faz round-trip do envelope portátil e importa em novos ids locais', async () => {
    const document = createAlgorithmDocument('Algoritmo portátil')
    const id = await createAlgorithmProject({ name: document.name, document })
    const text = serializeAlgorithmProjects(
      await listAlgorithmProjects(),
      '2026-08-27T00:00:00.000Z',
    )
    const parsed = parseAlgorithmFile(text)

    expect(parsed).toMatchObject({
      format: ALGORITHM_FILE_FORMAT,
      version: ALGORITHM_FILE_VERSION,
      projects: [{ ref: `algorithm-${id}`, name: 'Algoritmo portátil', document }],
    })
    await db.algorithmProjects.clear()
    await expect(importAlgorithmFile(text)).resolves.toBe(1)
    expect((await listAlgorithmProjects())[0]?.document).toEqual(document)
  })

  it('recusa colisão local, campos desconhecidos, versão inválida e arquivo grande', async () => {
    const document = createAlgorithmDocument('Colisão')
    await createAlgorithmProject({ name: document.name, document })
    const text = serializeAlgorithmProjects(await listAlgorithmProjects(), '2026-08-27T00:00:00.000Z')
    await expect(importAlgorithmFile(text)).rejects.toThrow('Já existe um algoritmo')
    expect(await listAlgorithmProjects()).toHaveLength(1)

    expect(() => parseAlgorithmFile('{nope')).toThrow('JSON válido')
    expect(() => parseAlgorithmFile('{"format":"veritas-algorithms","version":0,"projects":[]}')).toThrow('versão inválida')
    expect(() => parseAlgorithmFile('{"format":"veritas-algorithms","version":99,"projects":[]}')).toThrow('mais nova')
    const unknown = JSON.parse(text)
    unknown.unknown = true
    expect(() => parseAlgorithmFile(JSON.stringify(unknown))).toThrow('campos desconhecidos')
    expect(() => parseAlgorithmFile('x'.repeat(MAX_ALGORITHM_FILE_BYTES + 1))).toThrow('excede o limite')
  })

  it('recusa documento semântico inválido durante o parse do arquivo', () => {
    const document = createAlgorithmDocument('Inválido')
    document.entryNodeId = 'missing'
    const file = {
      format: ALGORITHM_FILE_FORMAT,
      version: ALGORITHM_FILE_VERSION,
      projects: [{ ref: 'algorithm-1', name: 'Inválido', document }],
    }

    expect(() => parseAlgorithmFile(JSON.stringify(file))).toThrow('não pode ser salvo')
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
