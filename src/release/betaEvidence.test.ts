import { describe, expect, it } from 'vitest'
import { REQUIRED_BETA_EVIDENCE_GATES, validateBetaEvidenceManifest } from '../../scripts/betaEvidence.mjs'

const validManifest = {
  version: '0.9.0-rc.1',
  generatedAt: '2026-08-21T02:00:00.000Z',
  openP0: [],
  openP1: [],
  gates: Object.fromEntries(REQUIRED_BETA_EVIDENCE_GATES.map((gate) => [gate, { status: 'PASS', evidence: `artifacts/${gate}.md` }])),
}

describe('validateBetaEvidenceManifest', () => {
  it('aceita manifesto completo sem P0/P1 abertos', () => {
    expect(validateBetaEvidenceManifest(validManifest, '0.9.0-rc.1')).toEqual([])
  })

  it('rejeita versão divergente e bloqueadores abertos', () => {
    const errors = validateBetaEvidenceManifest({ ...validManifest, version: '0.8.0-rc.1', openP1: ['P1-001'] }, '0.9.0-rc.1')
    expect(errors).toEqual(expect.arrayContaining([
      'versão do manifesto=0.8.0-rc.1, esperado=0.9.0-rc.1',
      'openP1 precisa ser uma lista vazia',
    ]))
  })

  it('rejeita gates não aprovados ou sem evidência', () => {
    const gates = { ...validManifest.gates, hdl: { status: 'PENDING', evidence: '' } }
    const errors = validateBetaEvidenceManifest({ ...validManifest, gates }, '0.9.0-rc.1')
    expect(errors).toEqual(expect.arrayContaining([
      'gate hdl não está PASS',
      'gate hdl não possui evidência',
    ]))
  })

  it('rejeita gate obrigatório ausente', () => {
    const gates = { ...validManifest.gates }
    delete gates.rollback
    const errors = validateBetaEvidenceManifest({ ...validManifest, gates }, '0.9.0-rc.1')
    expect(errors).toContain('gate rollback não foi declarado')
  })

  it('rejeita manifesto sem o gate MCP obrigatório', () => {
    const gates = { ...validManifest.gates }
    delete gates.mcp
    const errors = validateBetaEvidenceManifest({ ...validManifest, gates }, '0.9.0-rc.1')
    expect(errors).toContain('gate mcp não foi declarado')
  })
})
