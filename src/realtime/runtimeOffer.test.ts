import { describe, expect, it } from 'vitest'
import { runtimeOfferDecision } from './runtimeOffer'

describe('runtimeOfferDecision', () => {
  it('permite aplicação quando a versão-base ainda é atual', () => {
    expect(runtimeOfferDecision(7, 7)).toBe('current')
  })

  it('bloqueia versão-base diferente ou inválida', () => {
    expect(runtimeOfferDecision(6, 7)).toBe('stale')
    expect(runtimeOfferDecision(-1, 7)).toBe('stale')
    expect(runtimeOfferDecision(1.5, 1.5)).toBe('stale')
  })
})
