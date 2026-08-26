import { describe, expect, it } from 'vitest'
import {
  buildCustomChipDefinition,
  createCircuitDocument,
  elaborateCustomChipDocument,
  evaluateCircuit,
  type CircuitDocument,
  type CustomChipLibraryEntry,
} from './index'

function validDocument(): CircuitDocument {
  return {
    ...createCircuitDocument(' Meio somador '),
    nodes: [
      { id: 'sum', type: 'output', position: { x: 360, y: 0 }, label: ' Soma ' },
      { id: 'b', type: 'input', position: { x: 0, y: 100 }, label: 'Entrada' },
      { id: 'a', type: 'input', position: { x: 0, y: 0 }, label: 'Entrada' },
      { id: 'gate', type: 'xor', position: { x: 180, y: 50 } },
    ],
    connections: [
      { source: { node: 'a' }, target: { node: 'gate', port: 0 } },
      { source: { node: 'b' }, target: { node: 'gate', port: 1 } },
      { source: { node: 'gate' }, target: { node: 'sum', port: 0 } },
    ],
  }
}

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

describe('customChip', () => {
  it('cria definição com portas determinísticas e documento normalizado', () => {
    const source = validDocument()
    const original = JSON.stringify(source)
    const definition = buildCustomChipDefinition(source, '  Somador local  ')

    expect(definition.format).toBe('veritas-custom-chip')
    expect(definition.version).toBe(1)
    expect(definition.name).toBe('Somador local')
    expect(definition.inputs).toEqual([
      { id: 'a', name: 'Entrada', width: 1 },
      { id: 'b', name: 'Entrada_2', width: 1 },
    ])
    expect(definition.outputs).toEqual([{ id: 'sum', name: 'Soma', width: 1 }])
    expect(definition.document.name).toBe('Meio somador')
    expect(JSON.stringify(source)).toBe(original)
  })

  it('recusa documento inválido antes de criar chip', () => {
    const invalid = validDocument()
    invalid.connections = []

    expect(() => buildCustomChipDefinition(invalid)).toThrow('entrada')
  })

  it('recusa circuito sequencial e ausência de portas', () => {
    const sequential = validDocument()
    sequential.nodes.push({ id: 'clk', type: 'clock', position: { x: 0, y: 200 } })
    expect(() => buildCustomChipDefinition(sequential)).toThrow('combinacionais')

    const noInput: CircuitDocument = {
      ...createCircuitDocument('Constante'),
      nodes: [
        { id: 'constant', type: 'constant', position: { x: 0, y: 0 } },
        { id: 'out', type: 'output', position: { x: 180, y: 0 } },
      ],
      connections: [{ source: { node: 'constant' }, target: { node: 'out', port: 0 } }],
    }
    expect(() => buildCustomChipDefinition(noInput)).toThrow('pelo menos uma entrada')
  })

  it('limita o nome do chip', () => {
    expect(() => buildCustomChipDefinition(validDocument(), 'x'.repeat(201))).toThrow('no máximo 200')
  })

  it('permite empacotar, reutilizar e expandir chips compostos', () => {
    const base: CustomChipLibraryEntry = {
      id: 1,
      definition: buildCustomChipDefinition(singleInputDocument('Inversor'), 'Inversor'),
    }
    const nestedDocument = singleInputDocument('Inversor composto', base.id)
    const nested: CustomChipLibraryEntry = {
      id: 2,
      definition: buildCustomChipDefinition(nestedDocument, 'Inversor composto', { customChips: [base] }),
    }
    const outerDocument = singleInputDocument('Inversor duplo', nested.id)
    const outer = buildCustomChipDefinition(outerDocument, 'Inversor duplo', { customChips: [base, nested] })

    expect(evaluateCircuit(outer.document, { a: true }, { customChips: [base, nested] }).outputs).toEqual({ y: false })
    const expanded = elaborateCustomChipDocument(outer.document, { customChips: [base, nested] })
    expect(expanded.nodes.some((node) => node.type === 'custom-chip')).toBe(false)
    expect(expanded.nodes.map((node) => node.id)).toContain('chip__chip__gate')
  })

  it('rejeita referências recursivas entre definições', () => {
    const recursive: CustomChipLibraryEntry = {
      id: 9,
      definition: {
        format: 'veritas-custom-chip',
        version: 1,
        name: 'Recursivo',
        document: singleInputDocument('Recursivo', 9),
        inputs: [{ id: 'a', name: 'A', width: 1 }],
        outputs: [{ id: 'y', name: 'Y', width: 1 }],
      },
    }

    expect(() => buildCustomChipDefinition(singleInputDocument('Ciclo', 9), 'Ciclo', { customChips: [recursive] })).toThrow('recursiva')
  })

  it('rejeita hierarquia acima do limite seguro', () => {
    const library: CustomChipLibraryEntry[] = []
    const leaf: CustomChipLibraryEntry = {
      id: 1,
      definition: buildCustomChipDefinition(singleInputDocument('N1'), 'N1'),
    }
    library.push(leaf)
    for (let id = 2; id <= 8; id += 1) {
      const child = library[library.length - 1]
      library.push({
        id,
        definition: buildCustomChipDefinition(singleInputDocument(`N${id}`, child.id), `N${id}`, { customChips: library }),
      })
    }

    const tooDeep = singleInputDocument('N9', 8)
    expect(() => buildCustomChipDefinition(tooDeep, 'N9', { customChips: library, maxDepth: 3 })).toThrow('limite seguro')
  })
})
