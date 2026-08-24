import { describe, expect, it } from 'vitest'
import {
  compareCircuitEquivalence,
  DEFAULT_EQUIVALENCE_INPUT_BITS,
  MAX_EQUIVALENCE_INPUT_BITS,
} from './equivalence'
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

function link(source: string, target: string, port = 0): CircuitConnection {
  return { source: { node: source, port: 0 }, target: { node: target, port } }
}

/** XOR direto: S = A xor B. */
function xorDirect(): CircuitDocument {
  return doc(
    'xor direto',
    [
      node('a', 'input', 'A'),
      node('b', 'input', 'B'),
      node('x', 'xor'),
      node('s', 'output', 'S'),
    ],
    [link('a', 'x', 0), link('b', 'x', 1), link('x', 's')],
  )
}

/** XOR em soma de produtos: S = (A e não B) ou (não A e B). */
function xorAsSop(): CircuitDocument {
  return doc(
    'xor sop',
    [
      node('in1', 'input', 'A'),
      node('in2', 'input', 'B'),
      node('na', 'not'),
      node('nb', 'not'),
      node('and1', 'and'),
      node('and2', 'and'),
      node('or1', 'or'),
      node('out', 'output', 'S'),
    ],
    [
      link('in1', 'na'),
      link('in2', 'nb'),
      link('in1', 'and1', 0),
      link('nb', 'and1', 1),
      link('na', 'and2', 0),
      link('in2', 'and2', 1),
      link('and1', 'or1', 0),
      link('and2', 'or1', 1),
      link('or1', 'out'),
    ],
  )
}

describe('compareCircuitEquivalence', () => {
  it('reconhece implementações diferentes da mesma função', () => {
    const report = compareCircuitEquivalence(xorDirect(), xorAsSop())

    expect(report.status).toBe('equivalent')
    expect(report.equivalent).toBe(true)
    expect(report.exhaustive).toBe(true)
    expect(report.counterexample).toBeNull()
    expect(report.divergentRows).toBe(0)
    expect(report.comparedRows).toBe(4)
    expect(report.totalRows).toBe(4)
    expect(report.inputs).toEqual([
      { name: 'A', width: 1 },
      { name: 'B', width: 1 },
    ])
    expect(report.outputs).toEqual([{ name: 'S', width: 1 }])
  })

  it('entrega contraexemplo determinístico quando as saídas divergem', () => {
    const or = doc(
      'ou',
      [node('a', 'input', 'A'), node('b', 'input', 'B'), node('g', 'or'), node('s', 'output', 'S')],
      [link('a', 'g', 0), link('b', 'g', 1), link('g', 's')],
    )

    const report = compareCircuitEquivalence(xorDirect(), or)

    expect(report.status).toBe('divergent')
    expect(report.equivalent).toBe(false)
    expect(report.exhaustive).toBe(true)
    expect(report.divergentRows).toBe(1)
    expect(report.divergentOutputs).toEqual(['S'])
    // A=1, B=1 é a única linha em que XOR e OR discordam.
    expect(report.counterexample).toEqual({
      row: 3,
      inputs: [
        { name: 'A', width: 1, value: '1' },
        { name: 'B', width: 1, value: '1' },
      ],
      divergences: [{ output: 'S', width: 1, a: '0', b: '1' }],
    })
  })

  it('encontra a mesma linha quando os circuitos trocam de lado', () => {
    const or = doc(
      'ou',
      [node('a', 'input', 'A'), node('b', 'input', 'B'), node('g', 'or'), node('s', 'output', 'S')],
      [link('a', 'g', 0), link('b', 'g', 1), link('g', 's')],
    )

    const direct = compareCircuitEquivalence(xorDirect(), or)
    const swapped = compareCircuitEquivalence(or, xorDirect())

    expect(swapped.counterexample?.row).toBe(direct.counterexample?.row)
    expect(swapped.counterexample?.inputs).toEqual(direct.counterexample?.inputs)
    expect(swapped.counterexample?.divergences).toEqual([
      { output: 'S', width: 1, a: '1', b: '0' },
    ])
  })

  it('compara por rótulo, ignorando IDs e ordem de declaração', () => {
    const reordered = doc(
      'xor com ordem trocada',
      [
        node('zzz', 'output', 'S'),
        node('mmm', 'xor'),
        node('bbb', 'input', 'B'),
        node('aaa', 'input', 'A'),
      ],
      [link('aaa', 'mmm', 0), link('bbb', 'mmm', 1), link('mmm', 'zzz')],
    )

    expect(compareCircuitEquivalence(xorDirect(), reordered).status).toBe('equivalent')
  })

  it('compara barramentos bit a bit', () => {
    const busAnd = (name: string, idPrefix: string): CircuitDocument =>
      doc(
        name,
        [
          node(`${idPrefix}a`, 'input', 'A', { width: 4 }),
          node(`${idPrefix}b`, 'input', 'B', { width: 4 }),
          node(`${idPrefix}g`, 'and', undefined, { width: 4 }),
          node(`${idPrefix}o`, 'output', 'R', { width: 4 }),
        ],
        [
          link(`${idPrefix}a`, `${idPrefix}g`, 0),
          link(`${idPrefix}b`, `${idPrefix}g`, 1),
          link(`${idPrefix}g`, `${idPrefix}o`),
        ],
      )

    const report = compareCircuitEquivalence(busAnd('and 1', 'x'), busAnd('and 2', 'y'))

    expect(report.status).toBe('equivalent')
    expect(report.totalRows).toBe(256)
    expect(report.comparedRows).toBe(256)
    expect(report.inputs).toEqual([
      { name: 'A', width: 4 },
      { name: 'B', width: 4 },
    ])
  })

  it('compara todas as saídas, não apenas a primeira', () => {
    // Meio somador: SOMA = A xor B, VAIUM = A e B.
    const halfAdder = (prefix: string, carry: 'and' | 'or'): CircuitDocument =>
      doc(
        'meio somador',
        [
          node(`${prefix}a`, 'input', 'A'),
          node(`${prefix}b`, 'input', 'B'),
          node(`${prefix}x`, 'xor'),
          node(`${prefix}c`, carry),
          node(`${prefix}s`, 'output', 'SOMA'),
          node(`${prefix}v`, 'output', 'VAIUM'),
        ],
        [
          link(`${prefix}a`, `${prefix}x`, 0),
          link(`${prefix}b`, `${prefix}x`, 1),
          link(`${prefix}a`, `${prefix}c`, 0),
          link(`${prefix}b`, `${prefix}c`, 1),
          link(`${prefix}x`, `${prefix}s`),
          link(`${prefix}c`, `${prefix}v`),
        ],
      )

    expect(compareCircuitEquivalence(halfAdder('x', 'and'), halfAdder('y', 'and')).status).toBe(
      'equivalent',
    )

    // A soma continua idêntica; só o vai-um está errado no segundo circuito.
    const report = compareCircuitEquivalence(halfAdder('x', 'and'), halfAdder('y', 'or'))

    expect(report.status).toBe('divergent')
    expect(report.outputs).toEqual([
      { name: 'SOMA', width: 1 },
      { name: 'VAIUM', width: 1 },
    ])
    expect(report.divergentOutputs).toEqual(['VAIUM'])
    expect(report.divergentRows).toBe(2)
    expect(report.counterexample?.divergences).toEqual([
      { output: 'VAIUM', width: 1, a: '0', b: '1' },
    ])
  })

  it('compara circuitos sem entradas em uma única linha', () => {
    const constant = (prefix: string, value: boolean): CircuitDocument =>
      doc(
        'constante',
        [node(`${prefix}k`, 'constant', undefined, { value }), node(`${prefix}o`, 'output', 'S')],
        [link(`${prefix}k`, `${prefix}o`)],
      )

    const same = compareCircuitEquivalence(constant('x', true), constant('y', true))
    expect(same.status).toBe('equivalent')
    expect(same.totalRows).toBe(1)
    expect(same.comparedRows).toBe(1)
    expect(same.inputs).toEqual([])

    const different = compareCircuitEquivalence(constant('x', true), constant('y', false))
    expect(different.status).toBe('divergent')
    expect(different.counterexample).toEqual({
      row: 0,
      inputs: [],
      divergences: [{ output: 'S', width: 1, a: '1', b: '0' }],
    })
  })

  it('recusa comparar circuitos sequenciais em vez de fingir uma prova', () => {
    const sequential = doc(
      'registrador',
      [
        node('d', 'input', 'A'),
        node('c', 'input', 'B'),
        node('ff', 'dff'),
        node('q', 'output', 'S'),
      ],
      [link('d', 'ff', 0), link('c', 'ff', 1), link('ff', 'q')],
    )

    const report = compareCircuitEquivalence(xorDirect(), sequential)

    expect(report.status).toBe('incomparable')
    expect(report.equivalent).toBe(false)
    expect(report.exhaustive).toBe(false)
    expect(report.comparedRows).toBe(0)
    expect(report.issues[0]?.code).toBe('sequential-unsupported')
    expect(report.issues[0]?.onlyInB).toEqual(['dff'])
  })

  it('aponta divergência de interface antes de avaliar', () => {
    const extra = doc(
      'xor com saída extra',
      [
        node('a', 'input', 'A'),
        node('b', 'input', 'B'),
        node('x', 'xor'),
        node('s', 'output', 'S'),
        node('c', 'output', 'CARRY'),
      ],
      [link('a', 'x', 0), link('b', 'x', 1), link('x', 's'), link('x', 'c')],
    )

    const report = compareCircuitEquivalence(xorDirect(), extra)

    expect(report.status).toBe('incomparable')
    expect(report.issues[0]?.code).toBe('output-set-mismatch')
    expect(report.issues[0]?.onlyInB).toEqual(['CARRY'])
    expect(report.comparedRows).toBe(0)
  })

  it('aponta divergência de largura entre portas de mesmo nome', () => {
    const wide = doc(
      'xor largo',
      [
        node('a', 'input', 'A', { width: 4 }),
        node('b', 'input', 'B', { width: 4 }),
        node('x', 'xor', undefined, { width: 4 }),
        node('s', 'output', 'S', { width: 4 }),
      ],
      [link('a', 'x', 0), link('b', 'x', 1), link('x', 's')],
    )

    const report = compareCircuitEquivalence(xorDirect(), wide)

    expect(report.status).toBe('incomparable')
    expect(report.issues[0]?.code).toBe('width-mismatch')
    expect(report.issues[0]?.message).toContain('A (A=1, B=4)')
  })

  it('recusa nomes duplicados, que tornariam a identidade ambígua', () => {
    const ambiguous = doc(
      'rótulos repetidos',
      [
        node('a1', 'input', 'A'),
        node('a2', 'input', 'A'),
        node('g', 'or'),
        node('s', 'output', 'S'),
      ],
      [link('a1', 'g', 0), link('a2', 'g', 1), link('g', 's')],
    )

    const report = compareCircuitEquivalence(xorDirect(), ambiguous)

    expect(report.status).toBe('incomparable')
    expect(report.issues[0]?.code).toBe('duplicate-port-name')
  })

  it('recusa espaço de entrada acima do limite sem avaliar nenhuma linha', () => {
    const wide = (name: string, prefix: string): CircuitDocument =>
      doc(
        name,
        [
          node(`${prefix}a`, 'input', 'A', { width: 8 }),
          node(`${prefix}b`, 'input', 'B', { width: 8 }),
          node(`${prefix}g`, 'and', undefined, { width: 8 }),
          node(`${prefix}o`, 'output', 'R', { width: 8 }),
        ],
        [link(`${prefix}a`, `${prefix}g`, 0), link(`${prefix}b`, `${prefix}g`, 1), link(`${prefix}g`, `${prefix}o`)],
      )

    const report = compareCircuitEquivalence(wide('a', 'x'), wide('b', 'y'), { maxInputBits: 8 })

    expect(report.status).toBe('incomparable')
    expect(report.exhaustive).toBe(false)
    expect(report.comparedRows).toBe(0)
    expect(report.totalRows).toBe(65536)
    expect(report.issues[0]?.code).toBe('input-bits-exceeded')
    // A interface segue disponível para explicar por que a prova não coube.
    expect(report.inputs).toEqual([
      { name: 'A', width: 8 },
      { name: 'B', width: 8 },
    ])
  })

  it('não deixa o chamador pedir mais bits que o teto absoluto', () => {
    const wide = (prefix: string): CircuitDocument =>
      doc(
        'largo',
        [
          node(`${prefix}a`, 'input', 'A', { width: 12 }),
          node(`${prefix}b`, 'input', 'B', { width: 12 }),
          node(`${prefix}g`, 'and', undefined, { width: 12 }),
          node(`${prefix}o`, 'output', 'R', { width: 12 }),
        ],
        [link(`${prefix}a`, `${prefix}g`, 0), link(`${prefix}b`, `${prefix}g`, 1), link(`${prefix}g`, `${prefix}o`)],
      )

    const report = compareCircuitEquivalence(wide('x'), wide('y'), { maxInputBits: 1024 })

    expect(report.issues[0]?.code).toBe('input-bits-exceeded')
    expect(report.issues[0]?.message).toContain(String(MAX_EQUIVALENCE_INPUT_BITS))
  })

  it('rejeita documento inválido identificando o lado', () => {
    const broken = doc(
      'sem origem',
      [node('a', 'input', 'A'), node('b', 'input', 'B'), node('x', 'xor'), node('s', 'output', 'S')],
      [link('a', 'x', 0), link('fantasma', 'x', 1), link('x', 's')],
    )

    expect(() => compareCircuitEquivalence(xorDirect(), broken)).toThrow(/Circuito B inválido/)
  })

  it('mantém o padrão conservador abaixo do teto absoluto', () => {
    expect(DEFAULT_EQUIVALENCE_INPUT_BITS).toBeLessThan(MAX_EQUIVALENCE_INPUT_BITS)
  })
})
