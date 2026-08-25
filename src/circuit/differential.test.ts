import { describe, expect, it } from 'vitest'
import {
  compareCircuitTimelines,
  MAX_DIFFERENTIAL_TICKS,
  type CircuitDifferentialStep,
} from './differential'
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

function node(
  id: string,
  type: CircuitNode['type'],
  label?: string,
  options?: CircuitNode['options'],
): CircuitNode {
  return { id, type, position: { x: 0, y: 0 }, ...(label ? { label } : {}), ...(options ? { options } : {}) }
}

function link(source: string, target: string, port = 0, sourcePort = 0): CircuitConnection {
  return { source: { node: source, port: sourcePort }, target: { node: target, port } }
}

/** D flip-flop: D e CLK entram, Q sai. */
function flipFlop(prefix: string, invertOutput: boolean): CircuitDocument {
  const nodes = [
    node(`${prefix}d`, 'input', 'D'),
    node(`${prefix}c`, 'input', 'CLK'),
    node(`${prefix}ff`, 'dff'),
    node(`${prefix}q`, 'output', 'Q'),
  ]
  const connections = [link(`${prefix}d`, `${prefix}ff`, 0), link(`${prefix}c`, `${prefix}ff`, 1)]
  if (invertOutput) {
    // Mesma interface, mas lê Q̄ (porta 1) em vez de Q.
    connections.push(link(`${prefix}ff`, `${prefix}q`, 0, 1))
  } else {
    connections.push(link(`${prefix}ff`, `${prefix}q`, 0, 0))
  }
  return doc('flip-flop', nodes, connections)
}

/** Pulso de clock: sobe, desce. */
function clockPulse(d: boolean): CircuitDifferentialStep[] {
  return [
    { set: { D: d, CLK: false }, ticks: 2 },
    { set: { CLK: true }, ticks: 2 },
    { set: { CLK: false }, ticks: 2 },
  ]
}

describe('compareCircuitTimelines', () => {
  it('reconhece dois circuitos sequenciais idênticos ao longo do roteiro', () => {
    const report = compareCircuitTimelines(flipFlop('x', false), flipFlop('y', false), clockPulse(true))

    expect(report.status).toBe('identical')
    expect(report.identical).toBe(true)
    expect(report.divergentTicks).toBe(0)
    expect(report.firstDivergence).toBeNull()
    expect(report.comparedTicks).toBe(6)
    expect(report.totalTicks).toBe(6)
    expect(report.inputs).toEqual(['CLK', 'D'])
    expect(report.outputs).toEqual(['Q'])
  })

  it('aponta o primeiro tique divergente, não apenas que divergem', () => {
    const report = compareCircuitTimelines(flipFlop('x', false), flipFlop('y', true), clockPulse(true))

    expect(report.status).toBe('divergent')
    expect(report.identical).toBe(false)
    expect(report.divergentOutputs).toEqual(['Q'])
    expect(report.firstDivergence).not.toBeNull()
    // Q e Q̄ já discordam no primeiro tique, antes mesmo da borda de clock.
    expect(report.firstDivergence?.tick).toBe(1)
    expect(report.firstDivergence?.step).toBe(0)
    expect(report.firstDivergence?.signals).toEqual([{ signal: 'Q', a: false, b: true }])
    expect(report.firstDivergence?.inputs).toEqual([
      { name: 'CLK', value: false },
      { name: 'D', value: true },
    ])
  })

  it('encontra divergência que só aparece depois de vários ciclos', () => {
    // A: atraso de 1 tique. B: atraso de 3 tiques. A diferença some no regime
    // permanente e só aparece na transição.
    const delayed = (prefix: string, ticks: number): CircuitDocument =>
      doc(
        'atraso',
        [
          node(`${prefix}i`, 'input', 'IN'),
          node(`${prefix}d`, 'delay', undefined, { ticks }),
          node(`${prefix}o`, 'output', 'OUT'),
        ],
        [link(`${prefix}i`, `${prefix}d`), link(`${prefix}d`, `${prefix}o`)],
      )

    const script: CircuitDifferentialStep[] = [
      { set: { IN: false }, ticks: 6 },
      { set: { IN: true }, ticks: 6 },
    ]

    const same = compareCircuitTimelines(delayed('x', 3), delayed('y', 3), script)
    expect(same.status).toBe('identical')

    const report = compareCircuitTimelines(delayed('x', 1), delayed('y', 3), script)
    expect(report.status).toBe('divergent')
    // Os seis primeiros tiques concordam (ambos em 0); a divergência aparece
    // depois da transição, quando o atraso curto já propagou e o longo não.
    expect(report.firstDivergence?.tick).toBeGreaterThan(6)
    expect(report.firstDivergence?.step).toBe(1)
    expect(report.firstDivergence?.inputs).toEqual([{ name: 'IN', value: true }])
  })

  it('é determinístico: a mesma comparação repetida dá o mesmo tique', () => {
    const run = () =>
      compareCircuitTimelines(flipFlop('x', false), flipFlop('y', true), clockPulse(true))

    expect(run().firstDivergence).toEqual(run().firstDivergence)
  })

  it('conta os tiques divergentes além do primeiro', () => {
    const report = compareCircuitTimelines(flipFlop('x', false), flipFlop('y', true), clockPulse(true))

    expect(report.divergentTicks).toBeGreaterThan(1)
    expect(report.divergentTicks).toBeLessThanOrEqual(report.comparedTicks)
  })

  it('reporta o valor inicial de entradas que o roteiro nunca toca', () => {
    // ENABLE começa em 1 e nunca é mexida pelo roteiro; o contraexemplo precisa
    // dizer 1, não o zero padrão.
    const gated = (prefix: string, sourcePort: 0 | 1): CircuitDocument =>
      doc(
        'flip-flop com enable',
        [
          node(`${prefix}e`, 'input', 'ENABLE', { initial: true }),
          node(`${prefix}c`, 'input', 'CLK'),
          node(`${prefix}ff`, 'dff'),
          node(`${prefix}q`, 'output', 'Q'),
        ],
        [
          link(`${prefix}e`, `${prefix}ff`, 0),
          link(`${prefix}c`, `${prefix}ff`, 1),
          link(`${prefix}ff`, `${prefix}q`, 0, sourcePort),
        ],
      )

    const report = compareCircuitTimelines(gated('x', 0), gated('y', 1), [
      { set: { CLK: false }, ticks: 1 },
    ])

    expect(report.status).toBe('divergent')
    expect(report.firstDivergence?.inputs).toEqual([
      { name: 'CLK', value: false },
      { name: 'ENABLE', value: true },
    ])
  })

  it('aponta divergência de interface antes de simular', () => {
    const extra = doc(
      'flip-flop com saída extra',
      [
        node('d', 'input', 'D'),
        node('c', 'input', 'CLK'),
        node('ff', 'dff'),
        node('q', 'output', 'Q'),
        node('n', 'output', 'NQ'),
      ],
      [link('d', 'ff', 0), link('c', 'ff', 1), link('ff', 'q', 0, 0), link('ff', 'n', 0, 1)],
    )

    const report = compareCircuitTimelines(flipFlop('x', false), extra, clockPulse(true))

    expect(report.status).toBe('incomparable')
    expect(report.issues[0]?.code).toBe('output-set-mismatch')
    expect(report.issues[0]?.onlyInB).toEqual(['NQ'])
    expect(report.comparedTicks).toBe(0)
  })

  it('recusa roteiro que mexe em entrada inexistente', () => {
    const report = compareCircuitTimelines(flipFlop('x', false), flipFlop('y', false), [
      { set: { RESET: true }, ticks: 1 },
    ])

    expect(report.status).toBe('incomparable')
    expect(report.issues[0]?.code).toBe('unknown-input')
    expect(report.issues[0]?.message).toContain('RESET')
    expect(report.comparedTicks).toBe(0)
  })

  it('recusa roteiro vazio', () => {
    const report = compareCircuitTimelines(flipFlop('x', false), flipFlop('y', false), [])

    expect(report.status).toBe('incomparable')
    expect(report.issues[0]?.code).toBe('empty-script')
  })

  it('recusa roteiro acima do limite sem simular nada', () => {
    const report = compareCircuitTimelines(flipFlop('x', false), flipFlop('y', false), [
      { set: { CLK: false }, ticks: 50 },
    ], { maxTicks: 10 })

    expect(report.status).toBe('incomparable')
    expect(report.issues[0]?.code).toBe('ticks-exceeded')
    expect(report.totalTicks).toBe(50)
    expect(report.comparedTicks).toBe(0)
  })

  it('não deixa o chamador pedir mais que o teto absoluto', () => {
    const report = compareCircuitTimelines(flipFlop('x', false), flipFlop('y', false), [
      { ticks: MAX_DIFFERENTIAL_TICKS + 1 },
    ], { maxTicks: Number.MAX_SAFE_INTEGER })

    expect(report.issues[0]?.code).toBe('ticks-exceeded')
    expect(report.issues[0]?.message).toContain(String(MAX_DIFFERENTIAL_TICKS))
  })

  it('trata passo sem ticks como um único tique', () => {
    const report = compareCircuitTimelines(flipFlop('x', false), flipFlop('y', false), [
      { set: { D: true, CLK: false } },
      { set: { CLK: true } },
    ])

    expect(report.totalTicks).toBe(2)
    expect(report.comparedTicks).toBe(2)
  })

  it('rejeita documento inválido identificando o lado', () => {
    const broken = doc(
      'sem origem',
      [node('d', 'input', 'D'), node('c', 'input', 'CLK'), node('ff', 'dff'), node('q', 'output', 'Q')],
      [link('fantasma', 'ff', 0), link('c', 'ff', 1), link('ff', 'q')],
    )

    expect(() => compareCircuitTimelines(flipFlop('x', false), broken, clockPulse(true))).toThrow(
      /Circuito B inválido/,
    )
  })

  it('recusa nomes duplicados, que tornariam a identidade ambígua', () => {
    const ambiguous = doc(
      'rótulos repetidos',
      [
        node('d1', 'input', 'D'),
        node('d2', 'input', 'D'),
        node('c', 'input', 'CLK'),
        node('ff', 'dff'),
        node('q', 'output', 'Q'),
      ],
      [link('d1', 'ff', 0), link('c', 'ff', 1), link('ff', 'q')],
    )

    const report = compareCircuitTimelines(flipFlop('x', false), ambiguous, clockPulse(true))

    expect(report.status).toBe('incomparable')
    expect(report.issues[0]?.code).toBe('duplicate-port-name')
  })
})
