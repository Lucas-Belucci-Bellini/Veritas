import { describe, expect, it } from 'vitest'
import { missingEvidenceMarkers, missingPassScenarios } from '../../scripts/betaEvidenceProvenance.mjs'

describe('proveniência de evidências beta', () => {
  it('aceita RLS somente com guard real, quatro contas e todos os cenários PASS', () => {
    const report = [
      'Execution mode: REAL',
      'Runner guard: RLS_RUNNER_ALLOW_REAL=1',
      'Accounts: 4 disposable accounts',
      ...Array.from({ length: 22 }, (_, index) => `RLS-${String(index + 1).padStart(3, '0')} PASS`),
    ].join('\n')
    expect(missingEvidenceMarkers(report, 'rls')).toEqual([])
    expect(missingPassScenarios(report, 'rls')).toEqual([])
  })

  it('não trata o relatório seguro Realtime como evidência real', () => {
    const report = 'Execution mode: SAFE\nRT-001 SKIP\nRT-002 SKIP'
    expect(missingEvidenceMarkers(report, 'realtime')).toContain('Execution mode: REAL_REQUIRED')
    expect(missingPassScenarios(report, 'realtime')).toContain('RT-001')
  })

  it('aceita mobile somente com checklist manual e proveniência explícita', () => {
    const report = [
      'Execution mode: REAL_MANUAL',
      'Runner guard: MOBILE_MANUAL_ALLOW_REAL=1',
      'Reviewer: external-reviewer',
      'Device: iPhone test device',
      'Browser: Safari iOS',
      'Checked at: 2026-08-21T00:00:00.000Z',
      'MOBILE-001 PASS — abertura',
      'MOBILE-002 PASS — toque e foco',
      'MOBILE-003 PASS — local-first',
      'MOBILE-004 PASS — rotação e zoom',
    ].join('\n')
    expect(missingEvidenceMarkers(report, 'mobile')).toEqual([])
    expect(missingPassScenarios(report, 'mobile')).toEqual([])
  })

  it('não trata mobile SKIP ou modo seguro como evidência real', () => {
    const report = 'Execution mode: SAFE\nMOBILE-001 SKIP\nMOBILE-002 SKIP\nMOBILE-003 SKIP\nMOBILE-004 SKIP'
    expect(missingEvidenceMarkers(report, 'mobile')).toContain('Execution mode: REAL_MANUAL')
    expect(missingPassScenarios(report, 'mobile')).toContain('MOBILE-001')
  })

  it('exige JWT descartável autenticado para Edge', () => {
    const report = 'Execution mode: REAL\nAuthenticated mode: ANONYMOUS_ONLY\nRLS-019 PASS\nRLS-020 SKIP\nRLS-021 SKIP'
    expect(missingEvidenceMarkers(report, 'edge')).toEqual([
      'Authenticated mode: REAL_REQUIRED',
      'Authenticated disposable JWT: provided',
    ])
    expect(missingPassScenarios(report, 'edge')).toEqual(['RLS-020', 'RLS-021'])
  })
})
