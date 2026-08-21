import { describe, expect, it } from 'vitest'
import { isStrictBetaPreflight, requiredEvidenceFlags } from '../../scripts/betaPreflightContract.mjs'

describe('contrato de preflight beta', () => {
  it('mantém o modo local permissivo sem flags de promoção', () => {
    expect(isStrictBetaPreflight({})).toBe(false)
    expect(requiredEvidenceFlags({})).toEqual({
      strict: false,
      evidenceManifest: false,
      rls: false,
      realtime: false,
      edge: false,
      supabaseStructural: false,
      smoke: false,
    })
  })

  it('torna evidências externas obrigatórias quando explicitamente solicitado', () => {
    expect(isStrictBetaPreflight({ BETA_PREFLIGHT_STRICT: '1' })).toBe(true)
    expect(requiredEvidenceFlags({ BETA_PREFLIGHT_STRICT: '1' })).toEqual({
      strict: true,
      evidenceManifest: true,
      rls: true,
      realtime: true,
      edge: true,
      supabaseStructural: true,
      smoke: true,
    })
  })

  it('detecta uma versão beta sem depender de flag adicional', () => {
    expect(isStrictBetaPreflight({ BETA_EXPECTED_VERSION: '0.9.0-beta.1' })).toBe(true)
    expect(isStrictBetaPreflight({ GITHUB_REF_NAME: 'v0.9.0-beta.1' })).toBe(true)
  })
})
