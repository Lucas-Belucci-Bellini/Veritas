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
    expect(manifest.gates.hdl.status).toBe('PENDING')
    expect(manifest.gates.accessibility.status).toBe('PENDING')
    expect(manifest.gates.mobile.status).toBe('PENDING')
    expect(manifest.gates.rollback.status).toBe('PENDING')
    expect(manifest.gates.onboarding.status).toBe('PENDING')
    expect(manifest.gates.mcp.status).toBe('PENDING')
    expect(manifest.openP1).toContain('RLS-EVIDENCE-INCOMPLETE')
    expect(manifest.openP1).toContain('MCP-EVIDENCE-INCOMPLETE')
    expect(manifest.openP1).toContain('ONBOARDING-EVIDENCE-INCOMPLETE')
    expect(manifest.openP1).toContain('ROLLBACK-EVIDENCE-INCOMPLETE')
    expect(manifest.openP1).toContain('HDL-EVIDENCE-INCOMPLETE')
    expect(manifest.openP1).toContain('REALTIME-EVIDENCE-INCOMPLETE')
    expect(manifest.openP1).toContain('EDGE-EVIDENCE-INCOMPLETE')
  })

  it('agrega RLS, Edge e Supabase estrutural quando todos os casos fornecidos passam', () => {
    const rlsReport = Array.from({ length: 22 }, (_, index) => `RLS-${String(index + 1).padStart(3, '0')} PASS`).join('\n')
    const edgeReport = 'RLS-019 PASS\nRLS-020 PASS\nRLS-021 PASS'
    const realtimeReport = 'RT-001 PASS\nRT-002 PASS\nRT-003 PASS\nRT-004 PASS\nRT-005 PASS'
    const hdlReport = 'HDL-001 PASS\nHDL-002 PASS\nHDL-003 PASS'
    const accessibilityReport = 'A11Y-001 PASS\nA11Y-002 PASS\nA11Y-003 PASS\nA11Y-004 PASS\nA11Y-005 PASS'
    const rollbackReport = 'RB-001 PASS\nRB-002 PASS\nRB-003 PASS\nRB-004 PASS\nRB-005 PASS'
    const onboardingReport = 'ONB-001 PASS\nONB-002 PASS\nONB-003 PASS\nONB-004 PASS'
    const mcpReport = 'MCP-001 PASS\nMCP-002 PASS\nMCP-003 PASS\nMCP-004 PASS\nMCP-005 PASS\nMCP-006 PASS'
    const manifest = aggregateBetaEvidence({
      version: '0.9.0-rc.1',
      rlsReport,
      edgeReport,
      realtimeReport,
      hdlReport,
      accessibilityReport,
      rollbackReport,
      onboardingReport,
      mcpReport,
      structuralReport: validStructuralReport,
      structuralProjectId: 'hcwzsxdcvmswebunznak',
      evidencePaths: { rls: 'artifacts/rls.md', edge: 'artifacts/edge.md', realtime: 'artifacts/realtime.md', hdl: 'artifacts/hdl.md', accessibility: 'artifacts/accessibility.md', rollback: 'artifacts/rollback.md', onboarding: 'artifacts/onboarding.md', mcp: 'artifacts/mcp.md', supabaseStructural: 'artifacts/structural.json' },
    })
    expect(manifest.gates.rls.status).toBe('PASS')
    expect(manifest.gates.edge.status).toBe('PASS')
    expect(manifest.gates.supabaseStructural.status).toBe('PASS')
    expect(manifest.gates.realtime.status).toBe('PASS')
    expect(manifest.gates.hdl.status).toBe('PASS')
    expect(manifest.gates.accessibility.status).toBe('PASS')
    expect(manifest.gates.rollback.status).toBe('PASS')
    expect(manifest.gates.onboarding.status).toBe('PASS')
    expect(manifest.gates.mcp.status).toBe('PASS')
    expect(manifest.openP0).toEqual([])
    expect(manifest.openP1).toEqual([
      'MOBILE-EVIDENCE-INCOMPLETE',
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

  it('promove mobile somente com os quatro cenários PASS e caminho de evidência', () => {
    const mobileReport = 'MOBILE-001 PASS\nMOBILE-002 PASS\nMOBILE-003 PASS\nMOBILE-004 PASS'
    const manifest = aggregateBetaEvidence({
      version: '0.9.0-rc.1',
      mobileReport,
      evidencePaths: { mobile: 'artifacts/mobile.md' },
    })

    expect(manifest.gates.mobile).toMatchObject({ status: 'PASS', evidence: 'artifacts/mobile.md' })
    expect(manifest.openP1).not.toContain('MOBILE-EVIDENCE-INCOMPLETE')
  })

  it('reconhece IDs MOBILE no parser sanitizado', () => {
    expect(parseEvidenceReport('MOBILE-001 PASS\nMOBILE-004 SKIP')).toEqual({ 'MOBILE-001': 'PASS', 'MOBILE-004': 'SKIP' })
  })

  it('parseia somente linhas de cenário reconhecidas', () => {
    expect(parseEvidenceReport('RLS-019 PASS\nRT-001 PASS\nHDL-001 PASS\nA11Y-001 PASS\nRB-001 PASS\nONB-001 PASS\nMCP-001 PASS\ntexto sem contrato\nRLS-020 SKIP')).toEqual({ 'RLS-019': 'PASS', 'RT-001': 'PASS', 'HDL-001': 'PASS', 'A11Y-001': 'PASS', 'RB-001': 'PASS', 'ONB-001': 'PASS', 'MCP-001': 'PASS', 'RLS-020': 'SKIP' })
  })
})
