import { describe, expect, it } from 'vitest'
import {
  MOBILE_ACCEPTANCE_IDS,
  renderMobileAcceptanceReport,
  renderMobileSkipReport,
  validateMobileManualEvidence,
} from '../../scripts/mobileAcceptanceContract.mjs'

const validEvidence = {
  executionMode: 'REAL_MANUAL',
  runnerGuard: 'MOBILE_MANUAL_ALLOW_REAL=1',
  reviewer: 'external-reviewer',
  device: 'iPhone test device',
  browser: 'Safari iOS',
  checkedAt: '2026-08-21T00:00:00.000Z',
  checks: Object.fromEntries(MOBILE_ACCEPTANCE_IDS.map((id) => [id, { status: 'PASS', evidence: `${id} checklist externo` }])),
}

describe('contrato de aceitação mobile manual', () => {
  it('aceita evidência real manual completa', () => {
    expect(validateMobileManualEvidence(validEvidence)).toEqual([])
    expect(renderMobileAcceptanceReport(validEvidence, '2026-08-21T01:00:00.000Z')).toContain('Execution mode: REAL_MANUAL')
    expect(renderMobileAcceptanceReport(validEvidence, '2026-08-21T01:00:00.000Z')).toContain('MOBILE-004 PASS')
  })

  it('rejeita evidência sem guard real e sem checks completos', () => {
    const errors = validateMobileManualEvidence({ ...validEvidence, executionMode: 'SAFE', runnerGuard: 'not-real', checks: {} })
    expect(errors).toEqual(expect.arrayContaining([
      'executionMode precisa ser REAL_MANUAL',
      'runnerGuard precisa ser MOBILE_MANUAL_ALLOW_REAL=1',
      'MOBILE-001 não foi declarado',
      'MOBILE-004 não foi declarado',
    ]))
  })

  it('gera SKIP explícito quando a inspeção humana ainda não ocorreu', () => {
    const report = renderMobileSkipReport('2026-08-21T02:00:00.000Z')
    expect(report).toContain('Execution mode: NOT_RUN')
    expect(report).toContain('MOBILE-001 SKIP')
    expect(report).toContain('Resumo: 0 PASS, 0 FAIL, 4 SKIP.')
  })
})
