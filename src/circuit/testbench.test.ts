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

function vectorAnd(width = 4): CircuitDocument {
  return doc(
    'and multi-bit',
    [
      node('a', 'input', 'A', { width }),
      node('b', 'input', 'B', { width }),
      node('gate', 'and', undefined, { width }),
      node('out', 'output', 'OUT', { width }),
    ],
    [link('a', 'gate', 0), link('b', 'gate', 1), link('gate', 'out')],
  )
}

function jkDocument(): CircuitDocument {
  return doc(
    'jk',
    [node('j', 'input', 'J'), node('k', 'input', 'K'), node('clk', 'input', 'CLK'), node('ff', 'jk'), node('q', 'output', 'Q')],
    [link('j', 'ff', 0), link('k', 'ff', 1), link('clk', 'ff', 2), link('ff', 'q')],
  )
}

function srDocument(): CircuitDocument {
  return doc(
    'sr',
    [node('s', 'input', 'S'), node('r', 'input', 'R'), node('clk', 'input', 'CLK'), node('ff', 'sr'), node('q', 'output', 'Q')],
    [link('s', 'ff', 0), link('r', 'ff', 1), link('clk', 'ff', 2), link('ff', 'q')],
  )
}

function register4Document(): CircuitDocument {
  const data = ['0', '1', '2', '3'].map((id) => node(`d${id}`, 'input', `D${id}`))
  const flipFlops = ['0', '1', '2', '3'].map((id) => node(`ff${id}`, 'dff'))
  const outputs = ['0', '1', '2', '3'].map((id) => node(`q${id}`, 'output', `Q${id}`))
  return doc(
    'register-4bit',
    [...data, node('clk', 'input', 'CLK'), ...flipFlops, ...outputs],
    [
      ...['0', '1', '2', '3'].flatMap((id) => [link(`d${id}`, `ff${id}`, 0), link('clk', `ff${id}`, 1), link(`ff${id}`, `q${id}`)]),
    ],
  )
}

function counter4Document(): CircuitDocument {
  return doc(
    'counter-4bit',
    [
      node('one', 'constant', undefined, { value: true }),
      node('clk', 'input', 'CLK'),
      node('carry1', 'and'),
      node('carry2', 'and'),
      node('carry3a', 'and'),
      node('carry3', 'and'),
      node('ff0', 'tff'),
      node('ff1', 'tff'),
      node('ff2', 'tff'),
      node('ff3', 'tff'),
      node('q0', 'output', 'Q0'),
      node('q1', 'output', 'Q1'),
      node('q2', 'output', 'Q2'),
      node('q3', 'output', 'Q3'),
    ],
    [
      link('ff0', 'carry1', 0), link('one', 'carry1', 1),
      link('ff0', 'carry2', 0), link('ff1', 'carry2', 1),
      link('ff0', 'carry3a', 0), link('ff1', 'carry3a', 1),
      link('carry3a', 'carry3', 0), link('ff2', 'carry3', 1),
      link('one', 'ff0', 0), link('clk', 'ff0', 1),
      link('carry1', 'ff1', 0), link('clk', 'ff1', 1),
      link('carry2', 'ff2', 0), link('clk', 'ff2', 1),
      link('carry3', 'ff3', 0), link('clk', 'ff3', 1),
      link('ff0', 'q0'), link('ff1', 'q1'), link('ff2', 'q2'), link('ff3', 'q3'),
    ],
  )
}

function feedbackDocument(): CircuitDocument {
  return doc(
    'feedback',
    [node('clk', 'input', 'CLK'), node('ff', 'dff'), node('out', 'output', 'OUT')],
    [link('ff', 'ff', 0, 1), link('clk', 'ff', 1), link('ff', 'out')],
  )
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
    expect(report.snapshots).toHaveLength(4)
    expect(report.snapshots[0]).toMatchObject({ caseIndex: 0, tick: 0 })
    expect(report.counterexamples).toEqual([])
    expect(report.firstDivergence).toBeNull()
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
    expect(report.firstDivergence).toEqual({
      caseIndex: 1,
      signal: 'VAIUM',
      expected: false,
      actual: true,
      tick: 0,
    })
    expect(report.counterexamples[0]).toMatchObject({
      caseIndex: 1,
      inputs: { A: false, B: true },
      divergence: report.firstDivergence,
      snapshot: { caseIndex: 1, tick: 0 },
    })
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
    expect(report.cases[0]?.snapshots.map((snapshot) => snapshot.tick)).toEqual([2, 4])
    expect(report.cases[0]?.firstDivergence).toBeNull()
    expect(report.cases[0]?.counterexample).toBeNull()
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
    expect(report.firstDivergence).toEqual({
      caseIndex: 0,
      signal: 'Q',
      expected: true,
      actual: false,
      tick: 2,
      step: 0,
    })
    expect(report.counterexamples[0]).toMatchObject({
      inputs: { D: true },
      snapshot: { tick: 2, step: 0 },
    })
  })

  it('avalia um caso multi-bit e normaliza o snapshot para bits MSB → LSB', () => {
    const report = runTestbench(vectorAnd(), bench([
      {
        name: '1010 AND 0110',
        vectors: { inputs: { A: '0b1010', B: '0b0110' }, expect: { OUT: '0b0010' } },
      },
    ], 'multi-bit'))

    expect(report.status).toBe('passed')
    expect(report.cases[0]?.mode).toBe('combinational')
    expect(report.cases[0]?.snapshots[0]?.values.gate).toEqual([false, false, true, false])
    expect(report.cases[0]?.firstDivergence).toBeNull()
  })

  it('recusa literal multi-bit inválido antes da execução', () => {
    const report = runTestbench(vectorAnd(), bench([
      { vectors: { inputs: { A: '0b1020', B: '0b0001' }, expect: { OUT: '0b0000' } } },
    ], 'multi-bit inválido'))

    expect(report.status).toBe('invalid')
    expect(report.issues).toEqual([
      {
        code: 'vector-invalid',
        caseIndex: 0,
        message: expect.stringContaining('Literal binário inválido'),
      },
    ])
    expect(report.snapshots).toEqual([])
    expect(report.counterexamples).toEqual([])
  })

  it('cobre registrador, contador, JK, SR e feedback no mesmo runner', () => {
    const scenarios: Array<{ name: string; document: CircuitDocument; testbench: TestbenchDocument }> = [
      {
        name: 'register-4bit',
        document: register4Document(),
        testbench: bench([{
          steps: [
            { set: { D0: true, D1: false, D2: true, D3: true, CLK: false }, ticks: 1, expect: { Q0: false, Q1: false, Q2: false, Q3: false } },
            { set: { CLK: true }, ticks: 3, expect: { Q0: true, Q1: false, Q2: true, Q3: true } },
          ],
        }], 'register-4bit'),
      },
      {
        name: 'counter-4bit',
        document: counter4Document(),
        testbench: bench([{
          steps: [
            { set: { CLK: true }, ticks: 1 },
            { set: { CLK: false }, ticks: 2, expect: { Q0: true, Q1: false, Q2: false, Q3: false } },
            { set: { CLK: true }, ticks: 1 },
            { set: { CLK: false }, ticks: 2, expect: { Q0: false, Q1: true, Q2: false, Q3: false } },
          ],
        }], 'counter-4bit'),
      },
      {
        name: 'jk',
        document: jkDocument(),
        testbench: bench([{
          steps: [
            { set: { J: false, K: false, CLK: false }, ticks: 1, expect: { Q: false } },
            { set: { J: true, K: false, CLK: true }, ticks: 3, expect: { Q: true } },
            { set: { J: false, K: true, CLK: false }, ticks: 1 },
            { set: { CLK: true }, ticks: 3, expect: { Q: false } },
          ],
        }], 'jk'),
      },
      {
        name: 'sr',
        document: srDocument(),
        testbench: bench([{
          steps: [
            { set: { S: true, R: false, CLK: false }, ticks: 1, expect: { Q: false } },
            { set: { CLK: true }, ticks: 3, expect: { Q: true } },
            { set: { S: false, R: true, CLK: false }, ticks: 1 },
            { set: { CLK: true }, ticks: 3, expect: { Q: false } },
          ],
        }], 'sr'),
      },
      {
        name: 'feedback',
        document: feedbackDocument(),
        testbench: bench([{
          steps: [
            { set: { CLK: true }, ticks: 1 },
            { set: { CLK: false }, ticks: 1, expect: { OUT: true } },
            { set: { CLK: true }, ticks: 1 },
            { set: { CLK: false }, ticks: 1, expect: { OUT: false } },
          ],
        }], 'feedback'),
      },
    ]

    for (const scenario of scenarios) {
      const report = runTestbench(scenario.document, scenario.testbench)
      expect(report.status, scenario.name).toBe('passed')
      expect(report.cases[0]?.mode, scenario.name).toBe('sequential')
      expect(report.cases[0]?.firstDivergence, scenario.name).toBeNull()
    }
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
