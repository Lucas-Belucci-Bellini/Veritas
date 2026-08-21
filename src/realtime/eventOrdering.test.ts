import { describe, expect, it } from 'vitest'
import {
  compareRealtimeEvents,
  createRealtimeOrderingState,
  reduceRealtimeEvent,
  type RealtimeEventEnvelope,
} from './eventOrdering'

const event = (overrides: Partial<RealtimeEventEnvelope> = {}): RealtimeEventEnvelope => ({
  baseVersion: 1,
  sentAt: '2026-08-21T00:00:00.000Z',
  clientId: 'client-a',
  hash: 'hash-a',
  ...overrides,
})

describe('ordenação determinística de eventos Realtime', () => {
  it('aceita versão mais nova e rejeita uma versão atrasada', () => {
    const first = reduceRealtimeEvent(createRealtimeOrderingState(), 'snapshot', event())
    const newer = reduceRealtimeEvent(first.state, 'snapshot', event({ baseVersion: 2, hash: 'hash-b' }))
    const stale = reduceRealtimeEvent(newer.state, 'snapshot', event({ baseVersion: 1, hash: 'hash-old' }))

    expect(newer).toMatchObject({ accepted: true, reason: 'newer-version' })
    expect(stale).toMatchObject({ accepted: false, reason: 'stale-version' })
    expect(stale.state.latest.snapshot?.hash).toBe('hash-b')
  })

  it('usa timestamp e depois clientId/hash para desempate estável', () => {
    const state = reduceRealtimeEvent(createRealtimeOrderingState(), 'snapshot', event()).state
    const later = reduceRealtimeEvent(state, 'snapshot', event({ sentAt: '2026-08-21T00:00:01.000Z', clientId: 'client-z' }))
    const sameTimeLower = reduceRealtimeEvent(later.state, 'snapshot', event({ sentAt: '2026-08-21T00:00:01.000Z', clientId: 'client-a', hash: 'hash-z' }))
    const duplicate = reduceRealtimeEvent(later.state, 'snapshot', event({ sentAt: '2026-08-21T00:00:01.000Z', clientId: 'client-z', hash: 'hash-a' }))

    expect(later.reason).toBe('newer-timestamp')
    expect(sameTimeLower).toMatchObject({ accepted: false, reason: 'losing-tie-breaker' })
    expect(duplicate).toMatchObject({ accepted: false, reason: 'duplicate' })
    expect(compareRealtimeEvents(event({ clientId: 'client-b' }), event({ clientId: 'client-a' }))).toBeGreaterThan(0)
  })

  it('mantém ordenação independente para snapshot, config e estado temporal', () => {
    let state = createRealtimeOrderingState()
    state = reduceRealtimeEvent(state, 'snapshot', event({ hash: 'document' })).state
    state = reduceRealtimeEvent(state, 'runtime_config', event({ hash: 'config' })).state
    state = reduceRealtimeEvent(state, 'runtime_state', event({ hash: 'runtime' })).state

    expect(Object.keys(state.latest).sort()).toEqual(['runtime_config', 'runtime_state', 'snapshot'])
    expect(state.latest.snapshot?.hash).toBe('document')
    expect(state.latest.runtime_config?.hash).toBe('config')
    expect(state.latest.runtime_state?.hash).toBe('runtime')
  })
})
