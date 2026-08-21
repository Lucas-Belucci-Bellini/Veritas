import { describe, expect, it } from 'vitest'
import {
  REALTIME_ACCEPTANCE_IDS,
  REALTIME_TEMPORAL_EVENTS,
  isAllowedRealtimeEvent,
  isBlockedRealtimeStatus,
  realtimeTopic,
  sanitizeRealtimeMessage,
} from '../../scripts/realtimeAcceptanceContract.mjs'

describe('contrato de aceitação Realtime temporal', () => {
  it('mantém a allowlist sincronizada com os eventos emitidos pelo cliente', () => {
    expect(REALTIME_TEMPORAL_EVENTS).toEqual(['circuit_snapshot', 'runtime_config', 'runtime_state'])
    expect(REALTIME_ACCEPTANCE_IDS).toEqual(['RT-001', 'RT-002', 'RT-003', 'RT-004', 'RT-005'])
    expect(REALTIME_TEMPORAL_EVENTS.every((event) => isAllowedRealtimeEvent(event))).toBe(true)
    expect(isAllowedRealtimeEvent('presence')).toBe(false)
    expect(isAllowedRealtimeEvent('private_event')).toBe(false)
  })

  it('classifica somente os estados de conexão que devem bloquear o cenário', () => {
    expect(isBlockedRealtimeStatus('CHANNEL_ERROR')).toBe(true)
    expect(isBlockedRealtimeStatus('TIMED_OUT')).toBe(true)
    expect(isBlockedRealtimeStatus('error')).toBe(true)
    expect(isBlockedRealtimeStatus('timeout')).toBe(true)
    expect(isBlockedRealtimeStatus('SUBSCRIBED')).toBe(false)
    expect(isBlockedRealtimeStatus('CLOSED')).toBe(false)
  })

  it('remove tokens e limita mensagens do relatório', () => {
    const sanitized = sanitizeRealtimeMessage('Bearer super-secret password=hunter2 token:abc api_key=xyz')
    expect(sanitized).not.toContain('super-secret')
    expect(sanitized).not.toContain('hunter2')
    expect(sanitized).not.toContain('abc')
    expect(sanitized).not.toContain('xyz')
    expect(sanitized).toContain('Bearer [redacted]')
    expect(sanitized.length).toBeLessThanOrEqual(240)
  })

  it('monta o tópico privado com projeto e sala normalizados pelo chamador', () => {
    expect(realtimeTopic('11111111-1111-1111-1111-111111111111', 'main'))
      .toBe('veritas:project:11111111-1111-1111-1111-111111111111:room:main')
  })
})
