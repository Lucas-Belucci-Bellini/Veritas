import { describe, expect, it } from 'vitest'
import {
  CIRCUIT_DOCUMENT_FORMAT,
  CIRCUIT_DOCUMENT_VERSION,
  runTestbench,
  TESTBENCH_FORMAT,
  TESTBENCH_VERSION,
  type CircuitConnection,
  type CircuitDocument,
  type CircuitNode,
} from '../../src/circuit'
import {
  createSequentialCase,
  toTestbenchCases,
} from '../../src/components/testbenchDraft'

function node(
  id: string,
  type: CircuitNode['type'],
  label?: string,
): CircuitNode {
  return { id, type, position: { x: 0, y: 0 }, ...(label ? { label } : {}) }
}

function link(
  source: string,
  target: string,
  targetPort = 0,
): CircuitConnection {
  return {
    source: { node: source, port: 0 },
    target: { node: target, port: targetPort },
  }
}

function register(): CircuitDocument {
  return {
    format: CIRCUIT_DOCUMENT_FORMAT,
    version: CIRCUIT_DOCUMENT_VERSION,
    name: 'registrador de regressão',
    nodes: [
      node('d', 'input', 'D'),
      node('clk', 'input', 'CLK'),
      node('ff', 'dff'),
      node('q', 'output', 'Q'),
    ],
    connections: [link('d', 'ff'), link('clk', 'ff', 1), link('ff', 'q')],
  }
}

describe('regressão cross-layer do testbench sequencial', () => {
  it('executa o roteiro produzido pelo modelo de UI no Simulator do domínio', () => {
    const draft = createSequentialCase({ inputs: ['D', 'CLK'], outputs: ['Q'] })
    draft.steps[0] = {
      set: { D: true, CLK: false },
      ticks: 2,
      expect: { Q: false },
    }
    draft.steps.push({
      set: { CLK: true },
      ticks: 2,
      expect: { Q: true },
    })

    const [testCase] = toTestbenchCases([draft])
    const report = runTestbench(register(), {
      format: TESTBENCH_FORMAT,
      version: TESTBENCH_VERSION,
      name: 'regressão sequencial',
      cases: [testCase!],
    })

    expect(report).toMatchObject({
      status: 'passed',
      total: 1,
      passed: 1,
      failed: 0,
    })
    expect(report.cases[0]).toMatchObject({
      mode: 'sequential',
      status: 'passed',
      mismatches: [],
    })
  })
})
