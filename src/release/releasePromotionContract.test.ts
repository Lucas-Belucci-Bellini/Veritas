import { describe, expect, it } from 'vitest'
import {
  classifyReleaseVersion,
  validateReleasePromotion,
} from '../../scripts/releasePromotionContract.mjs'

describe('contrato de promoção SemVer', () => {
  it('classifica alpha, beta, RC e estável', () => {
    expect(classifyReleaseVersion('v0.9.0-alpha.1')).toBe('alpha')
    expect(classifyReleaseVersion('0.9.0-beta.1')).toBe('beta')
    expect(classifyReleaseVersion('v0.9.0-rc.1')).toBe('rc')
    expect(classifyReleaseVersion('1.0.0')).toBe('stable')
    expect(classifyReleaseVersion('v0.9')).toBe('invalid')
  })

  it('bloqueia beta sem preflight, manifesto e aprovação', () => {
    const result = validateReleasePromotion({ version: 'v0.9.0-beta.1' })
    expect(result.channel).toBe('beta')
    expect(result.allowed).toBe(false)
    expect(result.errors).toEqual([
      'promoção beta exige preflight estrito',
      'promoção beta exige manifesto de evidências PASS',
      'promoção beta exige aprovação explícita',
    ])
  })

  it('permite beta somente com todos os requisitos', () => {
    expect(validateReleasePromotion({
      version: 'v0.9.0-beta.1',
      preflightStrict: true,
      evidenceStatus: 'PASS',
      approval: true,
    })).toMatchObject({ channel: 'beta', allowed: true, errors: [] })
  })

  it('não adiciona bloqueio beta a RC ou estável', () => {
    expect(validateReleasePromotion({ version: 'v0.9.0-rc.1' }).allowed).toBe(true)
    expect(validateReleasePromotion({ version: '1.0.0' }).allowed).toBe(true)
  })
})
