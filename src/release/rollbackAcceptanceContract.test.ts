import { describe, expect, it } from 'vitest'
import {
  ROLLBACK_ACCEPTANCE_IDS,
  renderRollbackReport,
  sanitizeRollbackMessage,
} from '../../scripts/rollbackAcceptanceContract.mjs'

describe('contrato de aceitação de rollback', () => {
  it('mantém os cinco cenários RB em ordem estável', () => {
    expect(ROLLBACK_ACCEPTANCE_IDS).toEqual(['RB-001', 'RB-002', 'RB-003', 'RB-004', 'RB-005'])
  })

  it('remove URLs e credenciais das mensagens', () => {
    const message = sanitizeRollbackMessage('https://veritas.example token=super-secret')
    expect(message).toContain('[url]')
    expect(message).toContain('token=[redacted]')
    expect(message).not.toContain('super-secret')
  })

  it('renderiza o resumo do ensaio sem efeito remoto', () => {
    const report = renderRollbackReport([
      { id: 'RB-001', status: 'PASS', operation: 'tag', message: 'ok' },
      { id: 'RB-002', status: 'PASS', operation: 'parent', message: 'ok' },
      { id: 'RB-003', status: 'PASS', operation: 'runbook', message: 'ok' },
      { id: 'RB-004', status: 'PASS', operation: 'recovery', message: 'ok' },
      { id: 'RB-005', status: 'SKIP', operation: 'workflow', message: 'ensaio manual pendente' },
    ], '2026-08-21T00:00:00.000Z')
    expect(report).toContain('# Rollback acceptance 2026-08-21T00:00:00.000Z')
    expect(report).toContain('não altera dados remotos')
    expect(report).toContain('Resumo: 4 PASS, 0 FAIL, 1 SKIP.')
  })
})
