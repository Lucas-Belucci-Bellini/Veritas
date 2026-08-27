import { describe, expect, it } from 'vitest'
import { createCircuitDocument, type CircuitDocument } from '../circuit'
import { buildDocumentWorkerRequest } from './documentWorker'
import { buildDocumentRuntimeNetlist } from './documentRuntime'

function simpleDocument(): CircuitDocument {
  const document = createCircuitDocument('Worker test')
  document.nodes = [
    { id: 'input', type: 'input', position: { x: 0, y: 0 }, options: { initial: false } },
    { id: 'not', type: 'not', position: { x: 160, y: 0 } },
    { id: 'output', type: 'output', position: { x: 320, y: 0 } },
  ]
  document.connections = [
    { source: { node: 'input' }, target: { node: 'not', port: 0 } },
    { source: { node: 'not' }, target: { node: 'output', port: 0 } },
  ]
  return document
}

describe('ponte CircuitDocument → Worker', () => {
  it('prepara o mesmo Netlist canônico e preserva o documento', () => {
    const document = simpleDocument()
    const before = JSON.stringify(document)

    const direct = buildDocumentRuntimeNetlist(document)
    const built = buildDocumentWorkerRequest(document, {
      requestId: 'document-1',
      inputs: { input: true },
      ticks: 2,
    })

    expect(built.preflight.status).toBe('acyclic')
    expect(built.request.components).toEqual(direct.components)
    expect(built.request.steps).toEqual([{ set: { input: true }, ticks: 2 }])
    expect(JSON.stringify(document)).toBe(before)
  })

  it('aplica clockPeriods somente na cópia do Netlist', () => {
    const document = createCircuitDocument('Clock worker')
    document.nodes = [{ id: 'clock', type: 'clock', position: { x: 0, y: 0 }, options: { period: 2 } }]

    const request = buildDocumentWorkerRequest(document, {
      requestId: 'clock-1',
      clockPeriods: { clock: 5 },
      ticks: 1,
    })

    expect(request.request.components[0]?.options?.period).toBe(5)
    expect(document.nodes[0]?.options?.period).toBe(2)
  })

  it('rejeita entrada que não pertence ao documento', () => {
    expect(() => buildDocumentWorkerRequest(simpleDocument(), {
      requestId: 'unknown-input',
      inputs: { missing: true },
    })).toThrow('Entradas inexistentes')
  })

  it('rejeita documento inválido no preflight antes de criar request', () => {
    const document = simpleDocument()
    document.connections.push({ source: { node: 'missing' }, target: { node: 'output', port: 0 } })

    expect(() => buildDocumentWorkerRequest(document, { requestId: 'invalid' })).toThrow('preflight')
  })

  it('rejeita documento vetorial no contrato escalar do Worker v1', () => {
    const document = createCircuitDocument('Vector worker')
    document.nodes = [{ id: 'bus', type: 'input', position: { x: 0, y: 0 }, options: { width: 4 } }]

    expect(() => buildDocumentWorkerRequest(document, { requestId: 'vector' })).toThrow('sinais escalares')
  })
})
