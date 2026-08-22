import { describe, expect, it } from 'vitest'
import { buildCircuitContext } from './context'
import { buildCustomChipDefinition } from './customChip'
import { createCircuitDocument, type CircuitDocument } from './editorModel'

function circuit(): CircuitDocument {
  return {
    ...createCircuitDocument('Contexto AND'),
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
}

function customChipEntry() {
  const definition: CircuitDocument = {
    ...createCircuitDocument('NOT interno'),
    nodes: [
      { id: 'input', type: 'input', position: { x: 0, y: 0 }, label: 'Entrada' },
      { id: 'not', type: 'not', position: { x: 160, y: 0 }, label: 'NOT' },
      { id: 'output', type: 'output', position: { x: 320, y: 0 }, label: 'Saída' },
    ],
    connections: [
      { source: { node: 'input' }, target: { node: 'not', port: 0 } },
      { source: { node: 'not' }, target: { node: 'output', port: 0 } },
    ],
  }
  return { id: 42, definition: buildCustomChipDefinition(definition, 'NOT interno') }
}

function customChipCircuit(): CircuitDocument {
  return {
    ...createCircuitDocument('Contexto NOT customizado'),
    nodes: [
      { id: 'source', type: 'input', position: { x: 0, y: 0 }, label: 'Sinal' },
      { id: 'chip', type: 'custom-chip', position: { x: 180, y: 0 }, label: 'NOT customizado', options: { customChipId: 42 } },
      { id: 'result', type: 'output', position: { x: 360, y: 0 }, label: 'Resultado' },
    ],
    connections: [
      { source: { node: 'source' }, target: { node: 'chip', port: 0 } },
      { source: { node: 'chip' }, target: { node: 'result', port: 0 } },
    ],
  }
}

describe('buildCircuitContext', () => {
  it('gera contexto determinístico com tabela e fingerprint', () => {
    const first = buildCircuitContext(circuit())
    const second = buildCircuitContext(circuit())

    expect(first.contentHash).toBe(second.contentHash)
    expect(first.payload.truthTable.rows).toHaveLength(4)
    expect(first.payload.inputs).toEqual(['A', 'B'])
    expect(first.payload.outputs).toEqual(['Saída'])
    expect(first.tags).toContain('veritas')
  })

  it('normaliza o documento antes de gerar hash e payload', () => {
    const document = circuit()
    document.name = '  Contexto AND  '
    document.nodes[0].id = '  a  '
    document.nodes[0].label = '  A  '
    document.connections[0].source.node = '  a  '

    const context = buildCircuitContext(document)

    expect(context.circuitName).toBe('Contexto AND')
    expect(context.payload.document.name).toBe('Contexto AND')
    expect(context.payload.document.nodes[0].id).toBe('a')
    expect(context.payload.document.connections[0].source.node).toBe('a')
    expect(context.payload.truthTable.rows).toHaveLength(4)
  })

  it('inclui representação elaborada e metadados mínimos de chips customizados', () => {
    const context = buildCircuitContext(customChipCircuit(), undefined, { customChips: [customChipEntry()] })

    expect(context.payload.truthTable.rows).toHaveLength(2)
    expect(context.payload.elaboratedDocument?.nodes.some((node) => node.id === 'chip__not')).toBe(true)
    expect(context.payload.customChips).toEqual([{ id: 42, name: 'NOT interno', inputs: ['Entrada'], outputs: ['Saída'] }])
    expect(context.contentHash).toContain('fnv1a-')
  })

  it('recusa circuito inválido', () => {
    const document = circuit()
    document.connections = []

    expect(() => buildCircuitContext(document)).toThrow('desconectada')
  })
})
