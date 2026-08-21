import { describe, expect, it } from 'vitest'
import {
  ACCESSIBILITY_ACCEPTANCE_IDS,
  renderAccessibilityReport,
  sanitizeAccessibilityMessage,
} from '../../scripts/accessibilityAcceptanceContract.mjs'

describe('contrato de aceitação de acessibilidade', () => {
  it('mantém os cinco cenários A11Y em ordem estável', () => {
    expect(ACCESSIBILITY_ACCEPTANCE_IDS).toEqual(['A11Y-001', 'A11Y-002', 'A11Y-003', 'A11Y-004', 'A11Y-005'])
  })

  it('limita mensagens sem remover o resultado do check', () => {
    const message = sanitizeAccessibilityMessage(`  ${'mensagem '.repeat(60)} `)
    expect(message.length).toBeLessThanOrEqual(240)
    expect(message.startsWith('mensagem')).toBe(true)
  })

  it('renderiza resumo determinístico sem dados privados', () => {
    const report = renderAccessibilityReport([
      { id: 'A11Y-001', status: 'PASS', operation: 'landmarks', message: 'ok' },
      { id: 'A11Y-002', status: 'PASS', operation: 'teclado', message: 'ok' },
      { id: 'A11Y-003', status: 'PASS', operation: 'aria-live', message: 'ok' },
      { id: 'A11Y-004', status: 'SKIP', operation: 'mobile', message: 'janela manual' },
      { id: 'A11Y-005', status: 'PASS', operation: 'regressão', message: 'ok' },
    ], '2026-08-21T00:00:00.000Z')
    expect(report).toContain('# Accessibility acceptance 2026-08-21T00:00:00.000Z')
    expect(report).toContain('Resumo: 4 PASS, 0 FAIL, 1 SKIP.')
    expect(report).not.toContain('access_token')
  })
})
