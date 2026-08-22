import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCustomChipDefinition, createCircuitDocument, type CircuitDocument } from '../circuit'

const fakeSupabase = vi.hoisted(() => ({
  functions: { invoke: vi.fn() },
}))

vi.mock('../lib/supabase', () => ({ supabase: fakeSupabase }))

import { requestCircuitAi } from './circuitAi'

const document: CircuitDocument = {
  ...createCircuitDocument('AI test'),
  nodes: [
    { id: 'a', type: 'input', position: { x: 0, y: 0 }, label: 'A' },
    { id: 'out', type: 'output', position: { x: 180, y: 0 }, label: 'Saída' },
  ],
  connections: [{ source: { node: 'a' }, target: { node: 'out', port: 0 } }],
}

const customChipDefinition: CircuitDocument = {
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
const customChipDocument: CircuitDocument = {
  ...createCircuitDocument('AI com chip'),
  nodes: [
    { id: 'source', type: 'input', position: { x: 0, y: 0 }, label: 'Sinal' },
    { id: 'chip', type: 'custom-chip', position: { x: 180, y: 0 }, label: 'NOT', options: { customChipId: 7 } },
    { id: 'result', type: 'output', position: { x: 360, y: 0 }, label: 'Resultado' },
  ],
  connections: [
    { source: { node: 'source' }, target: { node: 'chip', port: 0 } },
    { source: { node: 'chip' }, target: { node: 'result', port: 0 } },
  ],
}
const customChipEntry = { id: 7, definition: buildCustomChipDefinition(customChipDefinition, 'NOT interno') }

beforeEach(() => vi.clearAllMocks())

describe('requestCircuitAi', () => {
  it('envia o contexto determinístico à Edge Function para análise', async () => {
    fakeSupabase.functions.invoke.mockResolvedValue({
      data: {
        action: 'analyze',
        provider: 'heuristic',
        summary: 'Circuito válido.',
        suggestions: ['Nenhuma alteração necessária.'],
        optimizedDocument: null,
        confidence: 0.72,
      },
      error: null,
    })

    const result = await requestCircuitAi(document, 'analyze', 'Explique se existe redundância na saída.')
    const [name, options] = fakeSupabase.functions.invoke.mock.calls[0]

    expect(name).toBe('veritas-circuit-ai')
    expect(options.body.action).toBe('analyze')
    expect(options.body.context.contextType).toBe('circuit')
    expect(options.body.context.payload.document).toEqual(document)
    expect(options.body.instruction).toBe('Explique se existe redundância na saída.')
    expect(result).toMatchObject({ action: 'analyze', provider: 'heuristic', confidence: 0.72 })
  })

  it('envia elaboração e metadados de chips ao analisar circuito hierárquico', async () => {
    fakeSupabase.functions.invoke.mockResolvedValue({
      data: {
        action: 'analyze',
        provider: 'heuristic',
        summary: 'Circuito hierárquico válido.',
        suggestions: ['A definição local foi expandida para análise.'],
        optimizedDocument: customChipDocument,
        confidence: 0.72,
      },
      error: null,
    })

    const result = await requestCircuitAi(customChipDocument, 'analyze', undefined, { customChips: [customChipEntry] })
    const context = fakeSupabase.functions.invoke.mock.calls[0][1].body.context

    expect(context.payload.document).toEqual(customChipDocument)
    expect(context.payload.elaboratedDocument.nodes.some((node: CircuitDocument['nodes'][number]) => node.id === 'chip__not')).toBe(true)
    expect(context.payload.customChips).toEqual([{ id: 7, name: 'NOT interno', inputs: ['Entrada'], outputs: ['Saída'] }])
    expect(result.optimizedDocument).toEqual(customChipDocument)
  })

  it('aceita uma otimização validada para aplicação posterior no editor', async () => {
    fakeSupabase.functions.invoke.mockResolvedValue({
      data: {
        action: 'optimize',
        provider: 'llm',
        summary: 'Removido um componente sem saída.',
        suggestions: ['Revise o circuito antes de aplicar.'],
        optimizedDocument: document,
        confidence: 0.91,
      },
      error: null,
    })

    const result = await requestCircuitAi(document, 'optimize')

    expect(result.action).toBe('optimize')
    expect(result.optimizedDocument).toEqual(document)
    expect(result.provider).toBe('llm')
  })

  it('recusa resposta com shape inválido ou erro da Edge Function', async () => {
    fakeSupabase.functions.invoke.mockResolvedValueOnce({ data: { summary: 'incompleto' }, error: null })
    await expect(requestCircuitAi(document, 'analyze')).rejects.toThrow('análise inválida')

    fakeSupabase.functions.invoke.mockResolvedValueOnce({ data: null, error: new Error('JWT inválido') })
    await expect(requestCircuitAi(document, 'analyze')).rejects.toThrow('JWT inválido')
  })
})
