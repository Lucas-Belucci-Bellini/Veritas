import { describe, expect, it } from 'vitest'
import { aggregateBetaEvidence, parseEvidenceReport } from '../../scripts/betaEvidenceAggregate.mjs'

const validStructuralReport = {
  projectId: 'hcwzsxdcvmswebunznak',
  tables: [
    'veritas_ai_metrics',
    'veritas_circuit_collaborators',
    'veritas_circuit_context',
    'veritas_circuit_projects',
    'veritas_circuit_rooms',
    'veritas_circuit_versions',
  ].map((tableName) => ({ tableName, rlsEnabled: true, policyCount: 1 })),
  realtimePolicies: [
    'veritas_realtime_ai_metrics_read',
    'veritas_realtime_circuit_broadcast_write',
    'veritas_realtime_circuit_presence_write',
    'veritas_realtime_circuit_read',
  ],
}

describe('aggregateBetaEvidence', () => {
  it('não transforma relatório vazio em PASS', () => {
    const manifest = aggregateBetaEvidence({ version: '0.9.0-rc.1' })
    expect(manifest.gates.rls.status).toBe('PENDING')
    expect(manifest.gates.edge.status).toBe('PENDING')
    expect(manifest.gates.realtime.status).toBe('PENDING')
    expect(manifest.openP1).toContain('RLS-EVIDENCE-INCOMPLETE')
    expect(manifest.openP1).toContain('REALTIME-EVIDENCE-INCOMPLETE')
    expect(manifest.openP1).toContain('EDGE-EVIDENCE-INCOMPLETE')
  })

  it('agrega RLS, Edge e Supabase estrutural quando todos os casos fornecidos passam', () => {
    const rlsReport = Array.from({ length: 22 }, (_, index) => `RLS-${String(index + 1).padStart(3, '0')} PASS`).join('\n')
    const edgeReport = 'RLS-019 PASS\nRLS-020 PASS\nRLS-021 PASS'
    const realtimeReport = 'RT-001 PASS\nRT-002 PASS\nRT-003 PASS\nRT-004 PASS\nRT-005 PASS'
    const manifest = aggregateBetaEvidence({
      version: '0.9.0-rc.1',
      rlsReport,
      edgeReport,
      realtimeReport,
      structuralReport: validStructuralReport,
      structuralProjectId: 'hcwzsxdcvmswebunznak',
      evidencePaths: { rls: 'artifacts/rls.md', edge: 'artifacts/edge.md', realtime: 'artifacts/realtime.md', supabaseStructural: 'artifacts/structural.json' },
    })
    expect(manifest.gates.rls.status).toBe('PASS')
    expect(manifest.gates.edge.status).toBe('PASS')
    expect(manifest.gates.supabaseStructural.status).toBe('PASS')
    expect(manifest.gates.realtime.status).toBe('PASS')
    expect(manifest.openP0).toEqual([])
    expect(manifest.openP1).toEqual([
      'HDL-EVIDENCE-INCOMPLETE',
      'ACCESSIBILITY-EVIDENCE-INCOMPLETE',
      'MOBILE-EVIDENCE-INCOMPLETE',
      'ROLLBACK-EVIDENCE-INCOMPLETE',
      'ONBOARDING-EVIDENCE-INCOMPLETE',
    ])
  })

  it('classifica SKIP de Edge como evidência incompleta e não como sucesso', () => {
    const manifest = aggregateBetaEvidence({
      version: '0.9.0-rc.1',
      edgeReport: 'RLS-019 PASS\nRLS-020 SKIP\nRLS-021 SKIP',
    })
    expect(manifest.gates.edge.status).toBe('PENDING')
    expect(manifest.gates.edge.evidence).toBe('')
    expect(manifest.openP1).toContain('EDGE-EVIDENCE-INCOMPLETE')
  })

  it('parseia somente linhas de cenário reconhecidas', () => {
    expect(parseEvidenceReport('RLS-019 PASS\nRT-001 PASS\ntexto sem contrato\nRLS-020 SKIP')).toEqual({ 'RLS-019': 'PASS', 'RT-001': 'PASS', 'RLS-020': 'SKIP' })
  })
})
