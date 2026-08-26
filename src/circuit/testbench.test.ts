import { describe, expect, it } from 'vitest'
import {
  MAX_TESTBENCH_CASES,
  MAX_TESTBENCH_DIAGNOSTIC_TICKS,
  MAX_TESTBENCH_TICKS,
  runTestbench,
  TESTBENCH_FORMAT,
  TESTBENCH_VERSION,
  type TestbenchDocument,
} from './testbench'
import { buildCustomChipDefinition, type CustomChipLibraryEntry } from './customChip'
import {
  CIRCUIT_DOCUMENT_FORMAT,
  CIRCUIT_DOCUMENT_VERSION,
  type CircuitConnection,
  type CircuitDocument,
  type CircuitNode,
} from './editorModel'

function doc(name: string, nodes: CircuitNode[], connections: CircuitConnection[]): CircuitDocument {
  return { format: CIRCUIT_DOCUMENT_FORMAT, version: CIRCUIT_DOCUMENT_VERSION, name, nodes, connections }
}

function node(id: string, type: CircuitNode['type'], label?: string, options?: CircuitNode['options']): CircuitNode {
  return { id, type, position: { x: 0, y: 0 }, ...(label ? { label } : {}), ...(options ? { options } : {}) }
}

function link(source: string, target: string, port = 0, sourcePort = 0): CircuitConnection {
  return { source: { node: source, port: sourcePort }, target: { node: target, port } }
}

/** Meio somador: SOMA = A xor B, VAIUM = A `carry` B. */
function halfAdder(carry: 'and' | 'or'): CircuitDocument {
  return doc(
    'meio somador',
    [
      node('a', 'input', 'A'),
      node('b', 'input', 'B'),
      node('x', 'xor'),
      node('c', carry),
      node('s', 'output', 'SOMA'),
      node('v', 'output', 'VAIUM'),
    ],
    [
      link('a', 'x', 0), link('b', 'x', 1),
      link('a', 'c', 0), link('b', 'c', 1),
      link('x', 's'), link('c', 'v'),
    ],
  )
}

function bench(cases: TestbenchDocument['cases'], name = 'meio somador'): TestbenchDocument {
  return { format: TESTBENCH_FORMAT, version: TESTBENCH_VERSION, name, cases }
}

const HALF_ADDER_TABLE = bench([
  { name: '0+0', inputs: { A: false, B: false }, expect: { SOMA: false, VAIUM: false } },
  { name: '0+1', inputs: { A: false, B: true }, expect: { SOMA: true, VAIUM: false } },
  { name: '1+0', inputs: { A: true, B: false }, expect: { SOMA: true, VAIUM: false } },
  { name: '1+1', inputs: { A: true, B: true }, expect: { SOMA: false, VAIUM: true } },
])

describe('runTestbench', () => {
  it('aprova um circuito que satisfaz todos os vetores', () => {
    const report = runTestbench(halfAdder('and'), HALF_ADDER_TABLE)

    expect(report.status).toBe('passed')
    expect(report.total).toBe(4)
    expect(report.passed).toBe(4)
    expect(report.failed).toBe(0)
    expect(report.cases.every((item) => item.mode === 'combinational')).toBe(true)
    expect(report.issues).toEqual([])
  })

  it('reprova apontando o caso, a saída e os dois valores', () => {
    // O vai-um vira OR: erra em 0+1 e 1+0, acerta em 0+0 e 1+1.
    const report = runTestbench(halfAdder('or'), HALF_ADDER_TABLE)

    expect(report.status).toBe('failed')
    expect(report.passed).toBe(2)
    expect(report.failed).toBe(2)

    const failed = report.cases.filter((item) => item.status === 'failed')
    expect(failed.map((item) => item.name)).toEqual(['0+1', '1+0'])
    expect(failed[0]?.mismatches).toEqual([{ output: 'VAIUM', expected: false, actual: true }])
  })

  it('roda todos os casos, sem parar no primeiro que falha', () => {
    const report = runTestbench(halfAdder('or'), HALF_ADDER_TABLE)

    expect(report.cases).toHaveLength(4)
    expect(report.cases.map((item) => item.status)).toEqual(['passed', 'failed', 'failed', 'passed'])
  })

  it('nomeia casos sem nome pela posição', () => {
    const report = runTestbench(halfAdder('and'), bench([
      { inputs: { A: true, B: true }, expect: { SOMA: false } },
    ]))

    expect(report.cases[0]?.name).toBe('#1')
  })

  it('confere saídas ao longo do tempo em um caso sequencial', () => {
    const register = doc(
      'registrador',
      [
        node('d', 'input', 'D'),
        node('c', 'input', 'CLK'),
        node('ff', 'dff'),
        node('q', 'output', 'Q'),
      ],
      [link('d', 'ff', 0), link('c', 'ff', 1), link('ff', 'q')],
    )

    const report = runTestbench(register, bench([
      {
        name: 'carrega 1 na borda de subida',
        steps: [
          { set: { D: true, CLK: false }, ticks: 2, expect: { Q: false } },
          { set: { CLK: true }, ticks: 2, expect: { Q: true } },
        ],
      },
    ], 'registrador'))

    expect(report.status).toBe('passed')
    expect(report.cases[0]?.mode).toBe('sequential')
    expect(report.cases[0]?.diagnostic).toMatchObject({ status: 'stabilized' })
  })

  it('anexa diagnóstico de ciclo ao caso sequencial sem alterar PASS/FAIL', () => {
    const clock = doc(
      'clock',
      [node('clk', 'clock', 'CLK', { period: 1 }), node('out', 'output', 'OUT')],
      [link('clk', 'out')],
    )

    const report = runTestbench(
      clock,
      bench([{ name: 'primeiro nível', steps: [{ ticks: 1, expect: { OUT: false } }] }], 'clock'),
      { diagnosticTicks: 8 },
    )

    expect(report.status).toBe('passed')
    expect(report.cases[0]?.diagnostic).toEqual({
      status: 'cycle-detected',
      ticksExecuted: 2,
      cycleStartTick: 1,
      cyclePeriod: 2,
    })
  })

  it('anexa budget esgotado quando a janela diagnóstica termina antes do ciclo', () => {
    const clock = doc(
      'clock',
      [node('clk', 'clock', 'CLK', { period: 1 }), node('out', 'output', 'OUT')],
      [link('clk', 'out')],
    )

    const report = runTestbench(
      clock,
      bench([{ steps: [{ ticks: 1, expect: { OUT: false } }] }], 'clock'),
      { diagnosticTicks: 1 },
    )

    expect(report.status).toBe('passed')
    expect(report.cases[0]?.diagnostic).toEqual({
      status: 'budget-exhausted',
      ticksExecuted: 1,
    })
  })

  it('recusa budget diagnóstico inválido antes de executar os casos', () => {
    const report = runTestbench(halfAdder('and'), HALF_ADDER_TABLE, {
      diagnosticTicks: MAX_TESTBENCH_DIAGNOSTIC_TICKS + 1,
    })

    expect(report.status).toBe('invalid')
    expect(report.issues).toEqual([
      {
        code: 'diagnostic-budget-invalid',
        message: expect.stringContaining('entre 1 e 64 tiques'),
      },
    ])
    expect(report.total).toBe(0)
  })

  it('aponta o tique e o passo quando um caso sequencial falha', () => {
    const register = doc(
      'registrador',
      [node('d', 'input', 'D'), node('c', 'input', 'CLK'), node('ff', 'dff'), node('q', 'output', 'Q')],
      [link('d', 'ff', 0), link('c', 'ff', 1), link('ff', 'q')],
    )

    const report = runTestbench(register, bench([
      {
        name: 'espera carregar cedo demais',
        steps: [{ set: { D: true, CLK: false }, ticks: 2, expect: { Q: true } }],
      },
    ], 'registrador'))

    expect(report.status).toBe('failed')
    const mismatch = report.cases[0]?.mismatches[0]
    expect(mismatch?.output).toBe('Q')
    expect(mismatch?.expected).toBe(true)
    expect(mismatch?.actual).toBe(false)
    expect(mismatch?.step).toBe(0)
    expect(mismatch?.tick).toBe(2)
  })

  it('recusa caso que mistura os dois modos', () => {
    const report = runTestbench(halfAdder('and'), bench([
      { name: 'confuso', inputs: { A: true }, expect: { SOMA: true }, steps: [{ ticks: 1 }] },
    ]))

    expect(report.status).toBe('invalid')
    expect(report.issues[0]?.code).toBe('mixed-case-mode')
    expect(report.issues[0]?.caseIndex).toBe(0)
    expect(report.total).toBe(0)
  })

  it('recusa caso sem expectativa, que não poderia falhar', () => {
    const report = runTestbench(halfAdder('and'), bench([{ inputs: { A: true, B: true } }]))

    expect(report.status).toBe('invalid')
    expect(report.issues[0]?.code).toBe('missing-expectation')
    expect(report.issues[0]?.message).toContain('não testa nada')
  })

  it('recusa caso sequencial que nunca confere nada', () => {
    const register = doc(
      'registrador',
      [node('d', 'input', 'D'), node('c', 'input', 'CLK'), node('ff', 'dff'), node('q', 'output', 'Q')],
      [link('d', 'ff', 0), link('c', 'ff', 1), link('ff', 'q')],
    )

    const report = runTestbench(register, bench([{ steps: [{ set: { D: true }, ticks: 3 }] }], 'r'))

    expect(report.status).toBe('invalid')
    expect(report.issues[0]?.code).toBe('missing-expectation')
  })

  it('recusa referências a portas que não existem', () => {
    const report = runTestbench(halfAdder('and'), bench([
      { inputs: { A: true, RESET: true }, expect: { SOMA: true, OVERFLOW: false } },
    ]))

    expect(report.status).toBe('invalid')
    expect(report.issues.map((issue) => issue.code)).toEqual(['unknown-input', 'unknown-output'])
    expect(report.issues[0]?.message).toContain('RESET')
    expect(report.issues[1]?.message).toContain('OVERFLOW')
  })

  it('recusa documento de teste fora do formato', () => {
    const report = runTestbench(halfAdder('and'), { format: 'outro', version: 9, name: 'x', cases: [] } as unknown as TestbenchDocument)

    expect(report.status).toBe('invalid')
    expect(report.issues[0]?.code).toBe('invalid-document')
  })

  it('recusa documento sem casos', () => {
    const report = runTestbench(halfAdder('and'), bench([]))

    expect(report.status).toBe('invalid')
    expect(report.issues[0]?.code).toBe('empty-cases')
  })

  it('recusa mais casos que o limite', () => {
    const many = Array.from({ length: MAX_TESTBENCH_CASES + 1 }, () => ({
      inputs: { A: true, B: true },
      expect: { SOMA: false },
    }))

    const report = runTestbench(halfAdder('and'), bench(many))

    expect(report.status).toBe('invalid')
    expect(report.issues[0]?.code).toBe('cases-exceeded')
  })

  it('recusa roteiro acima do limite de tiques sem executar nada', () => {
    const register = doc(
      'registrador',
      [node('d', 'input', 'D'), node('c', 'input', 'CLK'), node('ff', 'dff'), node('q', 'output', 'Q')],
      [link('d', 'ff', 0), link('c', 'ff', 1), link('ff', 'q')],
    )

    const report = runTestbench(register, bench([
      { steps: [{ ticks: MAX_TESTBENCH_TICKS + 1, expect: { Q: false } }] },
    ], 'r'))

    expect(report.status).toBe('invalid')
    expect(report.issues[0]?.code).toBe('ticks-exceeded')
    expect(report.total).toBe(0)
  })

  it('recusa rótulos duplicados no circuito', () => {
    const ambiguous = doc(
      'rótulos repetidos',
      [node('a1', 'input', 'A'), node('a2', 'input', 'A'), node('g', 'or'), node('s', 'output', 'SOMA')],
      [link('a1', 'g', 0), link('a2', 'g', 1), link('g', 's')],
    )

    const report = runTestbench(ambiguous, bench([
      { inputs: { A: true }, expect: { SOMA: true } },
    ]))

    expect(report.status).toBe('invalid')
    expect(report.issues[0]?.code).toBe('duplicate-port-name')
  })

  it('roda casos sequenciais sobre um circuito montado com chips', () => {
    // Registrador cujo dado passa por um chip combinacional: só funciona se o
    // runtime temporal souber expandir a instância.
    const inverter = buildCustomChipDefinition(
      doc(
        'inversor',
        [node('i', 'input', 'IN'), node('n', 'not'), node('o', 'output', 'OUT')],
        [link('i', 'n'), link('n', 'o')],
      ),
      'Inversor',
    )
    const library: CustomChipLibraryEntry[] = [{ id: 1, definition: inverter }]

    const register = doc(
      'registrador com chip',
      [
        node('d', 'input', 'D'),
        node('c', 'input', 'CLK'),
        node('chip', 'custom-chip', 'INV', { customChipId: 1 }),
        node('ff', 'dff'),
        node('q', 'output', 'Q'),
      ],
      [link('d', 'chip', 0), link('chip', 'ff', 0), link('c', 'ff', 1), link('ff', 'q')],
    )

    // D=1 passa pelo inversor e vira 0; na borda de subida, Q carrega 0.
    const report = runTestbench(
      register,
      bench([
        {
          name: 'carrega o inverso de D',
          steps: [
            { set: { D: true, CLK: false }, ticks: 3, expect: { Q: false } },
            { set: { CLK: true }, ticks: 3, expect: { Q: false } },
          ],
        },
        {
          name: 'com D=0 carrega 1',
          steps: [
            { set: { D: false, CLK: false }, ticks: 3 },
            { set: { CLK: true }, ticks: 3, expect: { Q: true } },
          ],
        },
      ], 'registrador com chip'),
      { customChips: library },
    )

    expect(report.issues).toEqual([])
    expect(report.status).toBe('passed')
    expect(report.cases.every((item) => item.mode === 'sequential')).toBe(true)
  })

  it('trata passo sem ticks como um único tique', () => {
    const register = doc(
      'registrador',
      [node('d', 'input', 'D'), node('c', 'input', 'CLK'), node('ff', 'dff'), node('q', 'output', 'Q')],
      [link('d', 'ff', 0), link('c', 'ff', 1), link('ff', 'q')],
    )

    const report = runTestbench(register, bench([
      { steps: [{ set: { D: true, CLK: false }, expect: { Q: false } }] },
    ], 'r'))

    expect(report.status).toBe('passed')
    expect(report.cases[0]?.mismatches).toEqual([])
  })

  it('é determinístico: a mesma execução repetida dá o mesmo relatório', () => {
    const run = () => runTestbench(halfAdder('or'), HALF_ADDER_TABLE)

    expect(run()).toEqual(run())
  })

  it('ordena as saídas divergentes de forma canônica', () => {
    const report = runTestbench(halfAdder('or'), bench([
      { name: 'ambas erradas', inputs: { A: false, B: true }, expect: { VAIUM: false, SOMA: false } },
    ]))

    // SOMA vem antes de VAIUM mesmo tendo sido declarada depois.
    expect(report.cases[0]?.mismatches.map((item) => item.output)).toEqual(['SOMA', 'VAIUM'])
  })
})
