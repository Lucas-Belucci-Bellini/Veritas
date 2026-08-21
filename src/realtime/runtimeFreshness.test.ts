import { describe, expect, it } from 'vitest'
import { isRuntimeStateFresh, runtimeFreshness, RUNTIME_STATE_MAX_AGE_MS } from './runtimeFreshness'

const NOW = Date.parse('2026-08-21T01:40:00.000Z')

describe('runtimeFreshness', () => {
  it('aceita estado recente e calcula a expiração', () => {
    const result = runtimeFreshness('2026-08-21T01:39:50.000Z', NOW)

    expect(result).toEqual({
      sentAtMs: NOW - 10_000,
      ageMs: 10_000,
      expiresInMs: RUNTIME_STATE_MAX_AGE_MS - 10_000,
    })
    expect(isRuntimeStateFresh('2026-08-21T01:39:50.000Z', NOW)).toBe(true)
  })

  it('descarta estado mais antigo que a retenção', () => {
    expect(runtimeFreshness('2026-08-21T01:39:29.999Z', NOW)).toBeNull()
    expect(isRuntimeStateFresh('2026-08-21T01:39:29.999Z', NOW)).toBe(false)
  })

  it('tolera pequeno adiantamento de relógio, mas rejeita timestamp muito futuro ou inválido', () => {
    expect(isRuntimeStateFresh('2026-08-21T01:40:03.000Z', NOW)).toBe(true)
    expect(isRuntimeStateFresh('2026-08-21T01:40:06.000Z', NOW)).toBe(false)
    expect(runtimeFreshness('não-é-data', NOW)).toBeNull()
  })
})
