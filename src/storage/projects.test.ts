import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  createProject,
  deleteProject,
  getProject,
  importProjects,
  listProjects,
  parseVeritasFile,
  serializeProjects,
  updateProject,
} from './projects'

const sample = {
  name: 'Meia soma',
  expression: '(A AND B) OR NOT C',
  notation: 'math' as const,
}

beforeEach(async () => {
  await db.projects.clear()
})

describe('projetos salvos', () => {
  it('cria e lê um projeto', async () => {
    const id = await createProject(sample)
    const saved = await getProject(id)
    expect(saved).toMatchObject(sample)
    expect(saved!.createdAt).toBeGreaterThan(0)
  })

  it('usa "Sem nome" quando o nome vem vazio', async () => {
    const id = await createProject({ ...sample, name: '   ' })
    expect((await getProject(id))!.name).toBe('Sem nome')
  })

  it('atualiza mexendo no updatedAt', async () => {
    const id = await createProject(sample)
    const before = (await getProject(id))!.updatedAt
    await new Promise((resolve) => setTimeout(resolve, 5))
    await updateProject(id, { expression: 'A XOR B' })
    const after = (await getProject(id))!
    expect(after.expression).toBe('A XOR B')
    expect(after.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('apaga', async () => {
    const id = await createProject(sample)
    await deleteProject(id)
    expect(await getProject(id)).toBeUndefined()
  })

  it('lista do mais recente para o mais antigo', async () => {
    await createProject({ ...sample, name: 'Antigo' })
    await new Promise((resolve) => setTimeout(resolve, 5))
    await createProject({ ...sample, name: 'Novo' })
    expect((await listProjects()).map((p) => p.name)).toEqual(['Novo', 'Antigo'])
  })
})

describe('arquivo .veritas', () => {
  it('faz a volta completa: exportar e importar', async () => {
    await createProject(sample)
    await createProject({ ...sample, name: 'Outro', expression: 'A -> B' })

    const text = serializeProjects(await listProjects())
    await db.projects.clear()

    const count = await importProjects(parseVeritasFile(text))
    expect(count).toBe(2)
    expect((await listProjects()).map((p) => p.expression)).toContain('A -> B')
  })

  it('recusa JSON quebrado', () => {
    expect(() => parseVeritasFile('{nope')).toThrow('não é um JSON válido')
  })

  it('recusa arquivo de outro programa', () => {
    expect(() => parseVeritasFile('{"format":"outro"}')).toThrow(
      'não é um projeto do Veritas',
    )
  })

  it('recusa versões futura, antiga ou não inteira', () => {
    expect(() =>
      parseVeritasFile('{"format":"veritas","version":99,"projects":[]}'),
    ).toThrow('versão mais nova')
    expect(() =>
      parseVeritasFile('{"format":"veritas","version":0,"projects":[]}'),
    ).toThrow('versão inválida')
    expect(() =>
      parseVeritasFile('{"format":"veritas","version":1.5,"projects":[]}'),
    ).toThrow('versão inválida')
  })

  it('recusa campos desconhecidos no envelope e no projeto', () => {
    expect(() => parseVeritasFile(JSON.stringify({
      format: 'veritas',
      version: 1,
      projects: [{ name: 'x', expression: 'A', notation: 'math' }],
      unknown: true,
    }))).toThrow('envelope')

    expect(() => parseVeritasFile(JSON.stringify({
      format: 'veritas',
      version: 1,
      projects: [{ name: 'x', expression: 'A', notation: 'math', unknown: true }],
    }))).toThrow('projeto 1')
  })

  it('rejeita coleção com entrada inválida sem importação parcial', () => {
    expect(() => parseVeritasFile(JSON.stringify({
      format: 'veritas',
      version: 1,
      projects: [
        { name: 'ok', expression: 'A AND B', notation: 'math' },
        { name: 'vazio', expression: '   ' },
        { nada: true },
      ],
    }))).toThrow('projeto 2')
  })

  it('rejeita uma coleção vazia', () => {
    expect(() => parseVeritasFile('{"format":"veritas","version":1,"projects":[]}'))
      .toThrow('nenhum projeto')
  })

  it('normaliza notação desconhecida para matemática', () => {
    const [project] = parseVeritasFile(
      JSON.stringify({
        format: 'veritas',
        version: 1,
        projects: [{ name: 'x', expression: 'A', notation: 'klingon' }],
      }),
    )
    expect(project.notation).toBe('math')
  })
})
