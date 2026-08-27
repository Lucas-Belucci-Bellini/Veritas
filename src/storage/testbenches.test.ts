import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createCircuitDocument,
  TESTBENCH_FORMAT,
  TESTBENCH_VERSION,
  type CircuitDocument,
  type TestbenchDocument,
} from '../circuit'
import { createCircuitProject } from './circuits'
import { db } from './db'
import {
  createTestbenchProject,
  deleteTestbenchProject,
  getTestbenchProject,
  importTestbenchProjects,
  listTestbenchProjects,
  MAX_TESTBENCH_FILE_BYTES,
  MAX_TESTBENCH_FILE_PROJECTS,
  parseTestbenchFile,
  serializeTestbenchProjects,
  updateTestbenchProject,
} from './testbenches'

const circuit: CircuitDocument = {
  ...createCircuitDocument('Registrador local'),
  nodes: [
    { id: 'input', type: 'input', position: { x: 0, y: 0 } },
    { id: 'output', type: 'output', position: { x: 180, y: 0 } },
  ],
  connections: [{ source: { node: 'input' }, target: { node: 'output', port: 0 } }],
}

function document(name = 'roteiro local'): TestbenchDocument {
  return {
    format: TESTBENCH_FORMAT,
    version: TESTBENCH_VERSION,
    name,
    cases: [
      {
        name: 'caso 1',
        inputs: { A: false },
        expect: { S: true },
      },
    ],
  }
}

beforeEach(async () => {
  await db.open()
  await db.circuitProjects.clear()
  await db.testbenchProjects.clear()
})

describe('testbenchProjects', () => {
  it('salva, lista por circuito, atualiza e remove', async () => {
    const id = await createTestbenchProject({
      circuitId: 7,
      name: '  Meu roteiro  ',
      document: document(),
    })

    expect((await getTestbenchProject(id))?.name).toBe('Meu roteiro')
    expect((await listTestbenchProjects(7)).map((item) => item.id)).toEqual([
      id,
    ])
    expect(await listTestbenchProjects(8)).toEqual([])

    await updateTestbenchProject(id, {
      name: 'Roteiro atualizado',
      document: document('documento atualizado'),
    })
    expect((await getTestbenchProject(id))?.document.name).toBe(
      'documento atualizado',
    )
    expect((await getTestbenchProject(id))?.name).toBe('Roteiro atualizado')

    await deleteTestbenchProject(id)
    expect(await getTestbenchProject(id)).toBeUndefined()
  })

  it('lista os testbenches mais recentes primeiro', async () => {
    const first = await createTestbenchProject({
      circuitId: 1,
      name: 'Antigo',
      document: document(),
    })
    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = await createTestbenchProject({
      circuitId: 1,
      name: 'Novo',
      document: document(),
    })

    expect((await listTestbenchProjects(1)).map((item) => item.id)).toEqual([
      second,
      first,
    ])
  })
})

describe('arquivo de testbench', () => {
  it('faz round-trip versionado e preserva o circuito de origem no arquivo', async () => {
    const circuitId = await createCircuitProject({
      name: 'Registrador local',
      document: circuit,
    })
    await createTestbenchProject({
      circuitId,
      name: 'Registrador',
      document: document('DFF'),
    })
    const text = serializeTestbenchProjects(
      await listTestbenchProjects(circuitId),
      '  Registrador local  ',
    )
    const parsed = parseTestbenchFile(text)

    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toMatchObject({
      name: 'Registrador',
      circuitName: 'Registrador local',
      document: {
        format: TESTBENCH_FORMAT,
        version: TESTBENCH_VERSION,
        name: 'DFF',
      },
    })

    await db.testbenchProjects.clear()
    const count = await importTestbenchProjects(
      circuitId,
      parsed.map(({ name, document: savedDocument }) => ({
        name,
        document: savedDocument,
      })),
      'Registrador local',
    )
    expect(count).toBe(1)
    expect((await listTestbenchProjects(circuitId))[0]?.document.cases).toEqual(
      document('DFF').cases,
    )
  })

  it('recusa circuito inexistente ou nome de origem divergente', async () => {
    await expect(importTestbenchProjects(999, [{ name: 'x', document: document() }]))
      .rejects.toThrow('não existe mais')

    const circuitId = await createCircuitProject({ name: 'Destino', document: circuit })
    await expect(importTestbenchProjects(
      circuitId,
      [{ name: 'x', document: document() }],
      'Origem',
    )).rejects.toThrow('mudou durante')
    expect(await listTestbenchProjects(circuitId)).toHaveLength(0)
  })

  it('recusa JSON quebrado, formato desconhecido, versão futura e documentos inválidos', () => {
    expect(() => parseTestbenchFile('{nope')).toThrow('não é um JSON válido')
    expect(() =>
      parseTestbenchFile('{"format":"outro","version":1,"testbenches":[]}'),
    ).toThrow('não é uma coleção')
    expect(() =>
      parseTestbenchFile(
        '{"format":"veritas-testbenches","version":99,"testbenches":[]}',
      ),
    ).toThrow('versão mais nova')
    expect(() =>
      parseTestbenchFile('{"format":"veritas-testbenches","version":0,"testbenches":[]}'),
    ).toThrow('versão inválida')
    expect(() =>
      parseTestbenchFile('{"format":"veritas-testbenches","version":1.5,"testbenches":[]}'),
    ).toThrow('versão inválida')
    expect(() =>
      parseTestbenchFile(
        JSON.stringify({
          format: 'veritas-testbenches',
          version: 1,
          testbenches: [
            {
              name: 'inválido',
              circuitName: 'x',
              document: {
                format: TESTBENCH_FORMAT,
                version: 1,
                name: 'x',
                cases: [{ inputs: { A: 'sim' } }],
              },
            },
          ],
        }),
      ),
    ).toThrow('documento 1')
    expect(() =>
      parseTestbenchFile(
        JSON.stringify({
          format: 'veritas-testbenches',
          version: 1,
          testbenches: [
            {
              name: 'vazio',
              circuitName: 'x',
              document: {
                format: TESTBENCH_FORMAT,
                version: 1,
                name: 'x',
                cases: [],
              },
            },
          ],
        }),
      ),
    ).toThrow('documento 1')
    expect(() =>
      parseTestbenchFile(
        JSON.stringify({
          format: 'veritas-testbenches',
          version: 1,
          testbenches: [
            {
              name: 'misturado',
              circuitName: 'x',
              document: {
                format: TESTBENCH_FORMAT,
                version: 1,
                name: 'x',
                cases: [
                  {
                    inputs: { A: false },
                    expect: { S: false },
                    steps: [{ expect: { S: true } }],
                  },
                ],
              },
            },
          ],
        }),
      ),
    ).toThrow('documento 1')
  })

  it('mantém o limite de quantidade simétrico no serializer', () => {
    expect(() => serializeTestbenchProjects([], 'c')).toThrow('1 a 256')
    const tooMany = Array.from({ length: MAX_TESTBENCH_FILE_PROJECTS + 1 }, (_, index) => ({
      id: index + 1,
      circuitId: 1,
      name: `T${index}`,
      document: document(`d${index}`),
      createdAt: index,
      updatedAt: index,
    }))
    expect(() => serializeTestbenchProjects(tooMany, 'c')).toThrow('1 a 256')
  })

  it('recusa nomes duplicados e lote acima do limite bounded', () => {
    const duplicate = {
      format: 'veritas-testbenches',
      version: 1,
      testbenches: [
        { name: 'Mesmo', circuitName: 'c', document: document('a') },
        { name: ' mesmo ', circuitName: 'c', document: document('b') },
      ],
    }
    expect(() => parseTestbenchFile(JSON.stringify(duplicate))).toThrow('aparece mais de uma vez')

    const tooMany = {
      format: 'veritas-testbenches',
      version: 1,
      testbenches: Array.from({ length: MAX_TESTBENCH_FILE_PROJECTS + 1 }, (_, index) => ({
        name: `T${index}`,
        circuitName: 'c',
        document: document(`d${index}`),
      })),
    }
    expect(() => parseTestbenchFile(JSON.stringify(tooMany))).toThrow('1 a 256')
  })

  it('recusa arquivo acima do limite de bytes', () => {
    const oversized = JSON.stringify({
      format: 'veritas-testbenches',
      version: 1,
      testbenches: [{
        name: 'grande',
        circuitName: 'circuito',
        document: { ...document(), name: 'x'.repeat(MAX_TESTBENCH_FILE_BYTES) },
      }],
    })

    expect(() => parseTestbenchFile(oversized)).toThrow('excede o limite')
  })

  it('recusa campos desconhecidos no envelope e no documento', () => {
    expect(() => parseTestbenchFile(JSON.stringify({
      format: 'veritas-testbenches',
      version: 1,
      testbenches: [{ name: 'x', circuitName: 'c', document: document() }],
      unknown: true,
    }))).toThrow('envelope')

    expect(() => parseTestbenchFile(JSON.stringify({
      format: 'veritas-testbenches',
      version: 1,
      testbenches: [{
        name: 'x',
        circuitName: 'c',
        document: { ...document(), cases: [{ ...document().cases[0], unknown: true }] },
      }],
    }))).toThrow('documento 1')
  })
})
