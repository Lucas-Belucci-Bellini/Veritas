import { describe, expect, it } from 'vitest'
import {
  buildCustomChipDefinition,
  createCircuitDocument,
  elaborateCustomChipDocument,
  type CircuitDocument,
  type CustomChipLibraryEntry,
} from './index'

function andEntry(id = 1): CustomChipLibraryEntry {
  const definition: CircuitDocument = {
    ...createCircuitDocument('AND interno'),
    nodes: [
      { id: 'a', type: 'input', position: { x: 0, y: 0 }, label: 'A' },
      { id: 'b', type: 'input', position: { x: 0, y: 100 }, label: 'B' },
      { id: 'gate', type: 'and', position: { x: 160, y: 50 }, label: 'E' },
      { id: 'y', type: 'output', position: { x: 320, y: 50 }, label: 'Y' },
    ],
    connections: [
      { source: { node: 'a' }, target: { node: 'gate', port: 0 } },
      { source: { node: 'b' }, target: { node: 'gate', port: 1 } },
      { source: { node: 'gate' }, target: { node: 'y', port: 0 } },
    ],
  }
  return { id, definition: buildCustomChipDefinition(definition, 'AND interno') }
}

function instanceDocument(): CircuitDocument {
  return {
    ...createCircuitDocument('Duas instâncias'),
    nodes: [
      { id: 'ext-a', type: 'input', position: { x: 0, y: 0 }, label: 'A' },
      { id: 'ext-b', type: 'input', position: { x: 0, y: 100 }, label: 'B' },
      { id: 'left', type: 'custom-chip', position: { x: 180, y: 0 }, options: { customChipId: 1 } },
      { id: 'right', type: 'custom-chip', position: { x: 180, y: 100 }, options: { customChipId: 1 } },
      { id: 'out-left', type: 'output', position: { x: 400, y: 0 }, label: 'L' },
      { id: 'out-right', type: 'output', position: { x: 400, y: 100 }, label: 'R' },
    ],
    connections: [
      { source: { node: 'ext-a' }, target: { node: 'left', port: 0 } },
      { source: { node: 'ext-b' }, target: { node: 'left', port: 1 } },
      { source: { node: 'left' }, target: { node: 'out-left', port: 0 } },
      { source: { node: 'ext-a' }, target: { node: 'right', port: 0 } },
      { source: { node: 'ext-b' }, target: { node: 'right', port: 1 } },
      { source: { node: 'right' }, target: { node: 'out-right', port: 0 } },
    ],
  }
}

describe('customChipElaboration', () => {
  it('cria namespaces determinísticos e marca fronteiras sem expor portas internas', () => {
    const expanded = elaborateCustomChipDocument(instanceDocument(), { customChips: [andEntry()] })
    const ids = expanded.nodes.map((node) => node.id)

    expect(ids).toContain('left__a')
    expect(ids).toContain('right__a')
    expect(ids).not.toContain('a')
    expect(expanded.nodes.find((node) => node.id === 'left__a')?.options?.customChipBoundary).toBe('internal')
    expect(expanded.nodes.find((node) => node.id === 'right__y')?.options?.customChipBoundary).toBe('internal')
    expect(expanded.connections).toEqual(expect.arrayContaining([
      { source: { node: 'ext-a' }, target: { node: 'left__a', port: 0 } },
      { source: { node: 'right__y' }, target: { node: 'out-right', port: 0 } },
    ]))
  })

  it('rejeita instância sem definição local antes de gerar HDL', () => {
    expect(() => elaborateCustomChipDocument(instanceDocument())).toThrow('definição local')
  })
})
