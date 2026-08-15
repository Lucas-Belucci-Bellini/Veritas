import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createCircuitDocument, type CircuitDocument } from '../circuit'
import { db } from './db'
import {
  createCircuitProject,
  deleteCircuitProject,
  getCircuitProject,
  importCircuitProjects,
  listCircuitProjects,
  parseCircuitFile,
  serializeCircuitProjects,
  updateCircuitProject,
} from './circuits'

const document: CircuitDocument = {
  ...createCircuitDocument('AND local'),
  nodes: [
    { id: 'a', type: 'input', position: { x: 0, y: 0 }, label: 'A' },
    { id: 'b', type: 'input', position: { x: 0, y: 100 }, label: 'B' },
    { id: 'gate', type: 'and', position: { x: 180, y: 50 } },
    { id: 'out', type: 'output', position: { x: 360, y: 50 }, label: 'Saída' },
  ],
  connections: [
    { source: { node: 'a' }, target: { node: 'gate', port: 0 } },
    { source: { node: 'b' }, target: { node: 'gate', port: 1 } },
    { source: { node: 'gate' }, target: { node: 'out', port: 0 } },
  ],
}

beforeEach(async () => {
  await db.open()
  await db.circuitProjects.clear()
})

describe('circuitProjects', () => {
  it('salva, lê, atualiza e remove um circuito', async () => {
    const id = await createCircuitProject({ name: 'Meu AND', document })
    expect((await getCircuitProject(id))!.document.nodes).toHaveLength(4)

    await updateCircuitProject(id, { name: 'AND atualizado' })
    expect((await getCircuitProject(id))!.name).toBe('AND atualizado')

    await deleteCircuitProject(id)
    expect(await getCircuitProject(id)).toBeUndefined()
  })

  it('atualiza o documento e move o circuito para o topo da lista', async () => {
    const firstId = await createCircuitProject({ name: 'Primeiro', document })
    await createCircuitProject({ name: 'Segundo', document })
    await new Promise((resolve) => setTimeout(resolve, 5))

    const changed = { ...document, name: 'AND modificado', connections: document.connections.slice(0, 2) }
    await updateCircuitProject(firstId, { document: changed })

    const saved = await getCircuitProject(firstId)
    expect(saved?.document.name).toBe('AND modificado')
    expect((await listCircuitProjects())[0].id).toBe(firstId)
  })

  it('mantém os circuitos depois de fechar e reabrir o IndexedDB', async () => {
    await createCircuitProject({ name: 'Persistente', document })
    db.close()
    await db.open()

    expect((await listCircuitProjects()).map((project) => project.name)).toEqual(['Persistente'])
  })

  it('lista os circuitos do mais recente para o mais antigo', async () => {
    await createCircuitProject({ name: 'Antigo', document })
    await new Promise((resolve) => setTimeout(resolve, 5))
    await createCircuitProject({ name: 'Novo', document })

    expect((await listCircuitProjects()).map((project) => project.name)).toEqual(['Novo', 'Antigo'])
  })
})

describe('arquivo de circuitos', () => {
  it('faz a volta completa no formato versionado', async () => {
    await createCircuitProject({ name: 'Meu AND', document })
    const text = serializeCircuitProjects(await listCircuitProjects())

    await db.circuitProjects.clear()
    await importCircuitProjects(parseCircuitFile(text))

    expect((await listCircuitProjects())[0].document.connections).toHaveLength(3)
  })

  it('recusa JSON quebrado e versão futura', () => {
    expect(() => parseCircuitFile('{nope')).toThrow('não é um JSON válido')
    expect(() =>
      parseCircuitFile('{"format":"veritas-circuits","version":99,"projects":[]}'),
    ).toThrow('versão mais nova')
  })

  it('normaliza nome vazio ao importar um circuito válido', () => {
    const file = JSON.stringify({
      format: 'veritas-circuits',
      version: 1,
      projects: [{ name: '   ', document }],
    })

    expect(parseCircuitFile(file)[0].name).toBe('AND local')
  })

  it('recusa circuito com ligação inválida', () => {
    const invalid = JSON.stringify({
      format: 'veritas-circuits',
      version: 1,
      projects: [
        {
          name: 'Inválido',
          document: {
            ...document,
            connections: [{ source: { node: 'unknown' }, target: { node: 'out', port: 0 } }],
          },
        },
      ],
    })

    expect(() => parseCircuitFile(invalid)).toThrow('nenhum projeto válido')
  })

  it('recusa width inválido antes de persistir o documento importado', () => {
    const invalid = JSON.stringify({
      format: 'veritas-circuits',
      version: 1,
      projects: [{
        name: 'Width inválido',
        document: {
          ...document,
          nodes: document.nodes.map((node, index) => index === 0 ? { ...node, options: { width: 0 } } : node),
        },
      }],
    })

    expect(() => parseCircuitFile(invalid)).toThrow('nenhum projeto válido')
  })
})
