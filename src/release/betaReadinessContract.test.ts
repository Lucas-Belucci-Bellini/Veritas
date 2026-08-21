import { describe, expect, it } from 'vitest'
import {
  READINESS_IDS,
  renderReadinessReport,
  sanitizeReadinessMessage,
} from '../../scripts/betaReadinessContract.mjs'

describe('contrato de prontidão beta', () => {
  it('mantém os seis IDs RDY em ordem estável', () => {
    expect(READINESS_IDS).toEqual(['RDY-001', 'RDY-002', 'RDY-003', 'RDY-004', 'RDY-005', 'RDY-006'])
  })

  it('sanitiza segredo e URL sem imprimir valor sensível', () => {
    const message = sanitizeReadinessMessage('token=secret-value https://private.example pronto')
    expect(message).toContain('token=[redacted]')
    expect(message).toContain('[url]')
    expect(message).not.toContain('secret-value')
  })

  it('renderiza os níveis de bloqueio sem transformar SKIP em READY', () => {
    const report = renderReadinessReport([
      { id: 'RDY-001', status: 'READY', area: 'Supabase', message: 'ok' },
      { id: 'RDY-002', status: 'BLOCKED', area: 'RLS', message: 'contas ausentes' },
      { id: 'RDY-003', status: 'READY', area: 'Realtime', message: 'ok' },
      { id: 'RDY-004', status: 'BLOCKED', area: 'Edge', message: 'JWT ausente' },
      { id: 'RDY-005', status: 'BLOCKED', area: 'evidências', message: 'arquivos ausentes' },
      { id: 'RDY-006', status: 'SKIP', area: 'versão', message: 'RC atual' },
    ], '2026-08-21T00:00:00.000Z')
    expect(report).toContain('Resumo: 2 READY, 3 BLOCKED, 1 SKIP.')
    expect(report).toContain('não abre sessões Supabase')
  })
})
