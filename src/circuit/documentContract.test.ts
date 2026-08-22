import { describe, expect, it } from 'vitest'
import { createCircuitDocument } from './editorModel'
import {
  documentSerializedBytes,
  getCircuitDocumentBoundIssues,
  normalizeCircuitDocument,
} from './documentContract'

function document() {
  return {
    ...createCircuitDocument('  Circuito base  '),
    nodes: [
      { id: '  input-a  ', type: 'input' as const, position: { x: 0, y: 0 }, label: '  A  ' },
      { id: 'out', type: 'output' as const, position: { x: 200, y: 0 }, label: 'Saída' },
    ],
    connections: [{ source: { node: '  input-a  ' }, target: { node: 'out', port: 0 } }],
  }
}

describe('contrato runtime do documento', () => {
  it('normaliza texto e referências sem mutar o documento original', () => {
    const original = document()
    const normalized = normalizeCircuitDocument(original)

    expect(normalized).toMatchObject({
      name: 'Circuito base',
      nodes: [
        { id: 'input-a', label: 'A' },
        { id: 'out', label: 'Saída' },
      ],
      connections: [{ source: { node: 'input-a' }, target: { node: 'out', port: 0 } }],
    })
    expect(original.name).toBe('  Circuito base  ')
    expect(original.nodes[0].id).toBe('  input-a  ')
  })

  it('detecta nome, rótulo e cardinalidade fora dos limites', () => {
    const invalid = {
      ...createCircuitDocument('  '),
      nodes: Array.from({ length: 257 }, (_, index) => ({
        id: `node-${index}`,
        type: 'input' as const,
        position: { x: index, y: 0 },
        label: 'x'.repeat(121),
      })),
      connections: Array.from({ length: 513 }, (_, index) => ({
        source: { node: `node-${index % 257}` },
        target: { node: `node-${index % 257}`, port: 0 },
      })),
    }

    const issues = getCircuitDocumentBoundIssues(invalid)
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'invalid-document-name',
      'document-too-many-nodes',
      'document-too-many-connections',
      'node-label-too-long',
    ]))
  })

  it('mede o tamanho serializado de forma determinística', () => {
    const first = document()
    const second = normalizeCircuitDocument(first)

    expect(documentSerializedBytes(first)).toBeGreaterThan(0)
    expect(documentSerializedBytes(first)).not.toBe(documentSerializedBytes(second))
    expect(documentSerializedBytes(second)).toBe(documentSerializedBytes(normalizeCircuitDocument(second)))
  })

  it('detecta payload serializado acima do limite sem depender da UI', () => {
    const oversized = {
      ...document(),
      metadata: 'x'.repeat(500_001),
    } as ReturnType<typeof document> & { metadata: string }

    expect(getCircuitDocumentBoundIssues(oversized).map((issue) => issue.code)).toContain('document-too-large')
  })
})
