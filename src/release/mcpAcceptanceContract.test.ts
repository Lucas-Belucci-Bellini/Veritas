import { describe, expect, it } from 'vitest'
import {
  MCP_ACCEPTANCE_IDS,
  renderMcpReport,
  sanitizeMcpMessage,
} from '../../scripts/mcpAcceptanceContract.mjs'

describe('contrato de aceitação MCP', () => {
  it('mantém os dezesseis cenários MCP em ordem estável', () => {
    expect(MCP_ACCEPTANCE_IDS).toEqual(['MCP-001', 'MCP-002', 'MCP-003', 'MCP-004', 'MCP-005', 'MCP-006', 'MCP-007', 'MCP-008', 'MCP-009', 'MCP-010', 'MCP-EQ-001', 'MCP-EQ-002', 'MCP-DIFF-001', 'MCP-DIFF-002', 'MCP-TB-001', 'MCP-TB-002'])
  })

  it('sanitiza credenciais sem alterar o protocolo do resultado', () => {
    const message = sanitizeMcpMessage('token=secret-value resposta JSON válida')
    expect(message).toContain('token=[redacted]')
    expect(message).not.toContain('secret-value')
    expect(message).toContain('resposta JSON válida')
  })

  it('renderiza resumo determinístico do transporte local', () => {
    const report = renderMcpReport([
      { id: 'MCP-001', status: 'PASS', operation: 'initialize', message: 'ok' },
      { id: 'MCP-002', status: 'PASS', operation: 'tools/list', message: 'ok' },
      { id: 'MCP-003', status: 'PASS', operation: 'golden', message: 'ok' },
      { id: 'MCP-004', status: 'PASS', operation: 'golden', message: 'ok' },
      { id: 'MCP-005', status: 'PASS', operation: 'error', message: 'ok' },
      { id: 'MCP-006', status: 'SKIP', operation: 'transport', message: 'ensaio remoto' },
      { id: 'MCP-007', status: 'PASS', operation: 'custom-chip', message: 'ok' },
      { id: 'MCP-008', status: 'PASS', operation: 'circuit-truth-table', message: 'ok' },
      { id: 'MCP-009', status: 'PASS', operation: 'export-hdl', message: 'ok' },
      { id: 'MCP-010', status: 'PASS', operation: 'vector-truth-table', message: 'ok' },
      { id: 'MCP-EQ-001', status: 'PASS', operation: 'equivalence', message: 'ok' },
      { id: 'MCP-EQ-002', status: 'PASS', operation: 'counterexample', message: 'ok' },
      { id: 'MCP-DIFF-001', status: 'PASS', operation: 'timeline', message: 'ok' },
      { id: 'MCP-DIFF-002', status: 'PASS', operation: 'first-divergence', message: 'ok' },
      { id: 'MCP-TB-001', status: 'PASS', operation: 'testbench-passed', message: 'ok' },
      { id: 'MCP-TB-002', status: 'PASS', operation: 'testbench-failed', message: 'ok' },
    ], '2026-08-21T00:00:00.000Z')
    expect(report).toContain('# MCP acceptance 2026-08-21T00:00:00.000Z')
    expect(report).toContain('Resumo: 15 PASS, 0 FAIL, 1 SKIP.')
    expect(report).toContain('sem sessão de IA')
  })
})
