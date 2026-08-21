import { describe, expect, it } from 'vitest'
import {
  REQUIRED_REALTIME_POLICIES,
  REQUIRED_VERITAS_TABLES,
  validateSupabaseStructuralAudit,
} from '../../scripts/supabaseStructuralAudit.mjs'

const validReport = {
  projectId: 'hcwzsxdcvmswebunznak',
  tables: REQUIRED_VERITAS_TABLES.map((tableName) => ({ tableName, rlsEnabled: true, policyCount: 1 })),
  realtimePolicies: [...REQUIRED_REALTIME_POLICIES],
}

describe('validateSupabaseStructuralAudit', () => {
  it('aceita o conjunto estrutural completo do Veritas', () => {
    expect(validateSupabaseStructuralAudit(validReport, 'hcwzsxdcvmswebunznak')).toEqual([])
  })

  it('rejeita project_id divergente e tabela sem RLS', () => {
    const tables = validReport.tables.map((table) => table.tableName === 'veritas_circuit_rooms' ? { ...table, rlsEnabled: false } : table)
    const errors = validateSupabaseStructuralAudit({ ...validReport, tables }, 'outro-projeto')
    expect(errors).toEqual(expect.arrayContaining([
      'projectId do relatório=hcwzsxdcvmswebunznak, esperado=outro-projeto',
      'tabela veritas_circuit_rooms está sem RLS habilitado',
    ]))
  })

  it('rejeita policy count zero e policy Realtime ausente', () => {
    const tables = validReport.tables.map((table) => table.tableName === 'veritas_circuit_projects' ? { ...table, policyCount: 0 } : table)
    const realtimePolicies = REQUIRED_REALTIME_POLICIES.filter((policy) => policy !== 'veritas_realtime_circuit_read')
    const errors = validateSupabaseStructuralAudit({ ...validReport, tables, realtimePolicies }, 'hcwzsxdcvmswebunznak')
    expect(errors).toEqual(expect.arrayContaining([
      'tabela veritas_circuit_projects não possui policy registrada',
      'policy Realtime veritas_realtime_circuit_read não foi declarada',
    ]))
  })
})
