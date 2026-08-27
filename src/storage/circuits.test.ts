import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createCircuitDocument, type CircuitDocument } from '../circuit'
import {
  createCustomChipProject,
  deleteCustomChipProject,
  getCustomChipProject,
  listCustomChipProjects,
  updateCustomChipProject,
} from './customChips'
import { db } from './db'
import {
  createCircuitProject,
  deleteCircuitProject,
  getCircuitProject,
  importCircuitProjects,
  listCircuitProjects,
  MAX_CIRCUIT_FILE_BYTES,
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
  await db.customChipProjects.clear()
})

describe('customChipProjects', () => {
  it('persiste definição válida com portas, atualiza e remove', async () => {
    const id = await createCustomChipProject({ name: '  Somador local  ', document })
    const saved = await getCustomChipProject(id)

    expect(saved?.name).toBe('Somador local')
    expect(saved?.definition.inputs.map((port) => port.name)).toEqual(['A', 'B'])
    expect(saved?.definition.outputs.map((port) => port.name)).toEqual(['Saída'])

    await updateCustomChipProject(id, { name: 'Somador atualizado' })
    expect((await getCustomChipProject(id))?.name).toBe('Somador atualizado')
    expect((await listCustomChipProjects()).map((chip) => chip.name)).toEqual(['Somador atualizado'])

    await deleteCustomChipProject(id)
    expect(await getCustomChipProject(id)).toBeUndefined()
  })

  it('recusa salvar circuito inválido como chip', async () => {
    await expect(createCustomChipProject({
      name: 'Inválido',
      document: { ...document, connections: [] },
    })).rejects.toThrow('entrada')
  })
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

  it('normaliza IDs, labels e referências antes de persistir', async () => {
    const spaced = {
      ...document,
      name: '  AND local  ',
      nodes: document.nodes.map((node) => ({
        ...node,
        id: `  ${node.id}  `,
        label: node.label ? `  ${node.label}  ` : node.label,
      })),
      connections: document.connections.map((connection) => ({
        source: { ...connection.source, node: `  ${connection.source.node}  ` },
        target: { ...connection.target, node: `  ${connection.target.node}  ` },
      })),
    }

    const id = await createCircuitProject({ name: '  Meu AND  ', document: spaced })
    const saved = await getCircuitProject(id)

    expect(saved?.name).toBe('Meu AND')
    expect(saved?.document.name).toBe('AND local')
    expect(saved?.document.nodes[0].id).toBe('a')
    expect(saved?.document.connections[0].source.node).toBe('a')
    expect(saved?.document.nodes[0].label).toBe('A')
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

  it('preserva width ao salvar e reabrir um circuito vetorial', async () => {
    const vector = {
      ...document,
      nodes: document.nodes.map((node) => ({ ...node, options: { width: 8 } })),
    }
    const id = await createCircuitProject({ name: 'Barramento 8-bit', document: vector })
    db.close()
    await db.open()

    expect((await getCircuitProject(id))?.document.nodes.every((node) => node.options?.width === 8)).toBe(true)
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

  it('recusa JSON quebrado e versões fora do contrato', () => {
    expect(() => parseCircuitFile('{nope')).toThrow('não é um JSON válido')
    expect(() =>
      parseCircuitFile('{"format":"veritas-circuits","version":99,"projects":[]}'),
    ).toThrow('versão mais nova')
    expect(() =>
      parseCircuitFile('{"format":"veritas-circuits","version":0,"projects":[]}'),
    ).toThrow('versão inválida')
    expect(() =>
      parseCircuitFile('{"format":"veritas-circuits","version":1.5,"projects":[]}'),
    ).toThrow('versão inválida')
  })

  it('recusa arquivo acima do limite bounded', () => {
    const oversized = JSON.stringify({
      format: 'veritas-circuits',
      version: 1,
      projects: [{
        name: 'grande',
        document: { ...document, name: 'x'.repeat(MAX_CIRCUIT_FILE_BYTES) },
      }],
    })

    expect(() => parseCircuitFile(oversized)).toThrow('excede o limite')
  })

  it('recusa campos desconhecidos no envelope e no documento', () => {
    expect(() => parseCircuitFile(JSON.stringify({
      format: 'veritas-circuits',
      version: 1,
      projects: [{ name: 'x', document }],
      unknown: true,
    }))).toThrow('envelope')

    expect(() => parseCircuitFile(JSON.stringify({
      format: 'veritas-circuits',
      version: 1,
      projects: [{
        name: 'x',
        document: {
          ...document,
          nodes: document.nodes.map((node) => ({ ...node, unknown: true })),
        },
      }],
    }))).toThrow('projeto 1')
  })

  it('não filtra silenciosamente projeto inválido durante a importação', () => {
    const file = JSON.stringify({
      format: 'veritas-circuits',
      version: 1,
      projects: [
        { name: 'Válido', document },
        { name: 'Inválido', document: { ...document, connections: [] } },
      ],
    })

    expect(() => parseCircuitFile(file)).toThrow('projeto 2')
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

    expect(() => parseCircuitFile(invalid)).toThrow('projeto 1')
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

    expect(() => parseCircuitFile(invalid)).toThrow('projeto 1')
  })
})
