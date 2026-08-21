import { describe, expect, it } from 'vitest'
import {
  ONBOARDING_ACCEPTANCE_IDS,
  renderOnboardingReport,
  sanitizeOnboardingMessage,
} from '../../scripts/onboardingAcceptanceContract.mjs'

describe('contrato de aceitação de onboarding', () => {
  it('mantém os quatro cenários ONB em ordem estável', () => {
    expect(ONBOARDING_ACCEPTANCE_IDS).toEqual(['ONB-001', 'ONB-002', 'ONB-003', 'ONB-004'])
  })

  it('sanitiza mensagens sem apagar o status', () => {
    const message = sanitizeOnboardingMessage('token=private-value passo concluído')
    expect(message).toContain('token=[redacted]')
    expect(message).not.toContain('private-value')
    expect(message).toContain('passo concluído')
  })

  it('renderiza a pendência externa explicitamente', () => {
    const report = renderOnboardingReport([
      { id: 'ONB-001', status: 'PASS', operation: 'app', message: 'ok' },
      { id: 'ONB-002', status: 'PASS', operation: 'docs', message: 'ok' },
      { id: 'ONB-003', status: 'PASS', operation: 'limits', message: 'ok' },
      { id: 'ONB-004', status: 'SKIP', operation: 'external', message: 'pendente' },
    ], '2026-08-21T00:00:00.000Z')
    expect(report).toContain('ONB-004 SKIP')
    expect(report).toContain('Resumo: 3 PASS, 0 FAIL, 1 SKIP.')
    expect(report).toContain('confirmação de pessoa externa')
  })
})
