import { describe, expect, it } from 'vitest'
import { REQUIRED_RLS_IDS, renderRlsReport } from '../../scripts/rlsAcceptanceContract.mjs'

describe('contrato do runner RLS', () => {
  it('declara exatamente RLS-001 a RLS-022 em ordem', () => {
    expect(REQUIRED_RLS_IDS).toHaveLength(22)
    expect(REQUIRED_RLS_IDS[0]).toBe('RLS-001')
    expect(REQUIRED_RLS_IDS.at(-1)).toBe('RLS-022')
  })

  it('renderiza relatório sem tokens ou passwords', () => {
    const report = renderRlsReport('fixture-safe', [{
      id: 'RLS-019',
      status: 'PASS',
      logicalUser: 'anon',
      operation: 'Edge Function',
      message: 'Bearer secret-token password=super-secret',
    }], '2026-08-21T00:00:00.000Z')
    expect(report).toContain('RLS-019 PASS')
    expect(report).toContain('Bearer [redacted]')
    expect(report).toContain('password=[redacted]')
    expect(report).not.toContain('secret-token')
    expect(report).not.toContain('super-secret')
  })
})
