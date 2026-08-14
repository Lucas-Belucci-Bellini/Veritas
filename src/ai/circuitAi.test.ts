import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCircuitDocument, type CircuitDocument } from '../circuit'

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
