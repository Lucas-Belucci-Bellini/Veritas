import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildCustomChipDefinition,
  createCircuitDocument,
  type CircuitDocument,
  type CustomChipLibraryEntry,
} from '../circuit'
import { db } from './db'
import {
  createCustomChipProject,
  importCustomChipLibraryFile,
  listCustomChipProjects,
  MAX_CUSTOM_CHIP_LIBRARY_CHIPS,
  MAX_CUSTOM_CHIP_LIBRARY_FILE_BYTES,
  parseCustomChipLibraryFile,
  serializeCustomChipLibrary,
} from './customChips'

function singleInputDocument(name: string, childId?: number): CircuitDocument {
  const child = childId === undefined
    ? { id: 'gate', type: 'not' as const, position: { x: 160, y: 0 } }
    : { id: 'chip', type: 'custom-chip' as const, position: { x: 160, y: 0 }, options: { customChipId: childId } }
  return {
    ...createCircuitDocument(name),
    nodes: [
      { id: 'a', type: 'input', position: { x: 0, y: 0 }, label: 'A' },
      child,
      { id: 'y', type: 'output', position: { x: 320, y: 0 }, label: 'Y' },
    ],
    connections: [
      { source: { node: 'a' }, target: { node: child.id, port: 0 } },
      { source: { node: child.id }, target: { node: 'y', port: 0 } },
    ],
  }
}

function library(): CustomChipLibraryEntry[] {
  const base: CustomChipLibraryEntry = {
    id: 1,
    definition: buildCustomChipDefinition(singleInputDocument('Inversor'), 'Inversor'),
  }
  const nested: CustomChipLibraryEntry = {
    id: 2,
    definition: buildCustomChipDefinition(singleInputDocument('Inversor composto', base.id), 'Inversor composto', {
      customChips: [base],
    }),
  }
  return [base, nested]
}

beforeEach(async () => {
  await db.open()
  await db.customChipProjects.clear()
})

describe('arquivo portátil de biblioteca de chips', () => {
  it('faz round-trip determinístico e converte ids locais em refs file-local', () => {
    const text = serializeCustomChipLibrary(library().reverse(), '2026-08-27T00:00:00.000Z')
    const parsed = parseCustomChipLibraryFile(text)

    expect(parsed).toMatchObject({
      format: 'veritas-chip-library',
      version: 1,
      chips: [
        { ref: 'chip-1', name: 'Inversor' },
        { ref: 'chip-2', name: 'Inversor composto' },
      ],
    })
    expect(parsed.chips[1].document.nodes.find((node) => node.type === 'custom-chip')?.options?.customChipRef)
      .toBe('chip-1')
    expect(parseCustomChipLibraryFile(serializeCustomChipLibrary(library(), '2026-08-27T00:00:00.000Z'))).toEqual(parsed)
  })

  it('importa com ids locais novos e refs remapeadas', async () => {
    const text = serializeCustomChipLibrary(library(), '2026-08-27T00:00:00.000Z')
    await expect(importCustomChipLibraryFile(text)).resolves.toBe(2)

    const saved = await listCustomChipProjects()
    expect(saved.map((chip) => chip.name)).toEqual(['Inversor composto', 'Inversor'])
    const base = saved.find((chip) => chip.name === 'Inversor')!
    const nested = saved.find((chip) => chip.name === 'Inversor composto')!
    expect(nested.definition.document.nodes.find((node) => node.type === 'custom-chip')?.options?.customChipId)
      .toBe(base.id)
  })

  it('recusa colisão com nome já existente na biblioteca local', async () => {
    const [base] = library()
    await createCustomChipProject({ name: base.definition.name, document: base.definition.document })

    await expect(importCustomChipLibraryFile(serializeCustomChipLibrary([base], '2026-08-27T00:00:00.000Z')))
      .rejects.toThrow('Já existe um chip')
    expect(await listCustomChipProjects()).toHaveLength(1)
  })

  it('faz rollback se uma definição falhar depois de outra ser preparada', async () => {
    const invalid = JSON.parse(serializeCustomChipLibrary(library(), '2026-08-27T00:00:00.000Z'))
    invalid.chips[1].document.connections = []

    await expect(importCustomChipLibraryFile(JSON.stringify(invalid))).rejects.toBeDefined()
    expect(await listCustomChipProjects()).toHaveLength(0)
  })

  it('mantém o limite de quantidade simétrico no serializer', () => {
    expect(() => serializeCustomChipLibrary([])).toThrow('1 a 256')
    const [base] = library()
    const tooMany = Array.from({ length: MAX_CUSTOM_CHIP_LIBRARY_CHIPS + 1 }, (_, index) => ({
      id: index + 1,
      definition: base.definition,
    }))
    expect(() => serializeCustomChipLibrary(tooMany)).toThrow('1 a 256')
  })

  it('recusa dependência local ausente durante a serialização', () => {
    const orphan: CustomChipLibraryEntry = {
      id: 2,
      definition: buildCustomChipDefinition(singleInputDocument('Órfão', 1), 'Órfão', { customChips: [
        { id: 1, definition: buildCustomChipDefinition(singleInputDocument('Base'), 'Base') },
      ] }),
    }

    expect(() => serializeCustomChipLibrary([orphan])).toThrow('não foi incluída')
  })

  it('recusa ref ausente, refs duplicadas e ciclo no parser', () => {
    const base = serializeCustomChipLibrary(library(), '2026-08-27T00:00:00.000Z')
    const missing = JSON.parse(base)
    missing.chips[1].document.nodes.find((node: { type: string }) => node.type === 'custom-chip').options.customChipRef = 'chip-missing'
    expect(() => parseCustomChipLibraryFile(JSON.stringify(missing))).toThrow('ausente')

    const duplicated = JSON.parse(base)
    duplicated.chips[1].ref = duplicated.chips[0].ref
    expect(() => parseCustomChipLibraryFile(JSON.stringify(duplicated))).toThrow('mais de uma vez')

    const cyclic = JSON.parse(base)
    cyclic.chips[1].document.nodes = cyclic.chips[1].document.nodes.map((node: { type: string; options?: Record<string, unknown> }) =>
      node.type === 'custom-chip' ? { ...node, options: { ...node.options, customChipRef: 'chip-2' } } : node,
    )
    expect(() => parseCustomChipLibraryFile(JSON.stringify(cyclic))).toThrow('ciclo')
  })

  it('recusa JSON inválido, versão fora do contrato, campos desconhecidos e arquivo grande', () => {
    expect(() => parseCustomChipLibraryFile('{nope')).toThrow('JSON válido')
    expect(() => parseCustomChipLibraryFile('{"format":"veritas-chip-library","version":0,"chips":[]}')).toThrow('versão inválida')
    expect(() => parseCustomChipLibraryFile('{"format":"veritas-chip-library","version":99,"chips":[]}')).toThrow('mais nova')

    const valid = JSON.parse(serializeCustomChipLibrary(library(), '2026-08-27T00:00:00.000Z'))
    valid.unknown = true
    expect(() => parseCustomChipLibraryFile(JSON.stringify(valid))).toThrow('campos desconhecidos')

    const oversized = 'x'.repeat(MAX_CUSTOM_CHIP_LIBRARY_FILE_BYTES + 1)
    expect(() => parseCustomChipLibraryFile(oversized)).toThrow('excede o limite')
  })
})
