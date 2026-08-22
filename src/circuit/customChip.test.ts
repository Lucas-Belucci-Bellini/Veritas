import { describe, expect, it } from 'vitest'
import { buildCustomChipDefinition, createCircuitDocument, type CircuitDocument } from './index'

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
})
