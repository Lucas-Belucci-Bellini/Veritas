import { beforeEach, describe, expect, it, vi } from 'vitest'

const fakeSupabase = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabase: fakeSupabase }))

import { recordAiMetric, toAiMetricEvent } from './aiMetrics'

beforeEach(() => {
  vi.clearAllMocks()
  fakeSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
})

describe('aiMetrics', () => {
  it('normaliza um registro vindo do Supabase', () => {
    const event = toAiMetricEvent({
      id: 'metric-1', user_id: 'user-1', action: 'analyze', provider: 'llm', latency_ms: 120,
      success: true, confidence: 0.91, content_hash: 'hash', error_message: null, metadata: { model: 'test' },
      created_at: '2026-08-14T20:00:00.000Z',
    })

    expect(event).toMatchObject({ id: 'metric-1', action: 'analyze', provider: 'llm', latencyMs: 120, confidence: 0.91, userId: 'user-1' })
    expect(event?.createdAt).toBe(Date.parse('2026-08-14T20:00:00.000Z'))
  })

  it('rejeita ação ou provedor desconhecido', () => {
    expect(toAiMetricEvent({ id: 'x', user_id: 'u', action: 'delete', provider: 'llm', latency_ms: 1, success: true, created_at: new Date().toISOString() })).toBeNull()
    expect(toAiMetricEvent({ id: 'x', user_id: 'u', action: 'analyze', provider: 'other', latency_ms: 1, success: true, created_at: new Date().toISOString() })).toBeNull()
  })

  it('registra telemetria no usuário autenticado sem propagar erro de observabilidade', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    fakeSupabase.from.mockReturnValue({ insert })

    await recordAiMetric({ action: 'optimize', provider: 'llm', latencyMs: -20, success: true, confidence: 2, errorMessage: 'x'.repeat(600) })

    expect(fakeSupabase.from).toHaveBeenCalledWith('veritas_ai_metrics')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1', latency_ms: 0, confidence: 1, error_message: 'x'.repeat(500) }))
  })
})
