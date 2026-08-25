import { describe, expect, it } from 'vitest'
import { buildCustomChipDefinition } from './customChip'
import { MAX_CUSTOM_CHIP_DEPTH } from './customChipInstance'
import { evaluateCircuit } from './evaluate'
import { elaborateCustomChipDocument } from './customChipElaboration'
import {
  CIRCUIT_DOCUMENT_FORMAT,
  CIRCUIT_DOCUMENT_VERSION,
  type CircuitConnection,
  type CircuitDocument,
  type CircuitNode,
} from './editorModel'
import type { CustomChipLibraryEntry } from './customChip'

function doc(name: string, nodes: CircuitNode[], connections: CircuitConnection[]): CircuitDocument {
  return { format: CIRCUIT_DOCUMENT_FORMAT, version: CIRCUIT_DOCUMENT_VERSION, name, nodes, connections }
}

function node(id: string, type: CircuitNode['type'], label?: string, options?: CircuitNode['options']): CircuitNode {
  return { id, type, position: { x: 0, y: 0 }, ...(label ? { label } : {}), ...(options ? { options } : {}) }
}

function link(source: string, target: string, port = 0, sourcePort = 0): CircuitConnection {
  return { source: { node: source, port: sourcePort }, target: { node: target, port } }
}

/**
 * Meio somador. Entradas ordenadas por ID: a, b. Saídas: s (SOMA), v (VAIUM).
 */
function halfAdderDocument(): CircuitDocument {
  return doc(
    'meio somador',
    [
      node('a', 'input', 'A'),
      node('b', 'input', 'B'),
      node('x', 'xor'),
      node('c', 'and'),
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

/**
 * Somador completo montado com DOIS meio somadores e um OR — o loop do
 * Digital Logic Sim: constrói, empacota, reusa, empacota de novo.
 */
function fullAdderDocument(halfAdderId: number): CircuitDocument {
  return doc(
    'somador completo',
    [
      node('a', 'input', 'A'),
      node('b', 'input', 'B'),
      node('cin', 'input', 'CIN'),
      node('ha1', 'custom-chip', 'HA1', { customChipId: halfAdderId }),
      node('ha2', 'custom-chip', 'HA2', { customChipId: halfAdderId }),
      node('orc', 'or'),
      node('s', 'output', 'SOMA'),
      node('v', 'output', 'VAIUM'),
    ],
    [
      // HA1(A, B)
      link('a', 'ha1', 0), link('b', 'ha1', 1),
      // HA2(soma do HA1, CIN)
      link('ha1', 'ha2', 0, 0),
      link('cin', 'ha2', 1),
      // SOMA = soma do HA2
      link('ha2', 's', 0, 0),
      // VAIUM = vai-um do HA1 OU vai-um do HA2
      link('ha1', 'orc', 0, 1),
      link('ha2', 'orc', 1, 1),
      link('orc', 'v'),
    ],
  )
}

describe('hierarquia de chips customizados', () => {
  it('permite empacotar um circuito que já usa chips', () => {
    const halfAdder = buildCustomChipDefinition(halfAdderDocument(), 'Meio somador')
    const library: CustomChipLibraryEntry[] = [{ id: 1, definition: halfAdder }]

    const fullAdder = buildCustomChipDefinition(fullAdderDocument(1), 'Somador completo', {
      customChips: library,
    })

    expect(fullAdder.name).toBe('Somador completo')
    expect(fullAdder.inputs.map((port) => port.name)).toEqual(['A', 'B', 'CIN'])
    expect(fullAdder.outputs.map((port) => port.name)).toEqual(['SOMA', 'VAIUM'])
  })

  it('avalia o somador completo corretamente nas oito combinações', () => {
    const halfAdder = buildCustomChipDefinition(halfAdderDocument(), 'Meio somador')
    const library: CustomChipLibraryEntry[] = [{ id: 1, definition: halfAdder }]
    const document = fullAdderDocument(1)

    // a + b + cin = soma + 2 * vaium
    for (const [a, b, cin] of [
      [false, false, false], [false, false, true], [false, true, false], [false, true, true],
      [true, false, false], [true, false, true], [true, true, false], [true, true, true],
    ] as const) {
      const evaluation = evaluateCircuit(document, { a, b, cin }, { customChips: library })
      const total = Number(a) + Number(b) + Number(cin)
      expect({ a, b, cin, soma: evaluation.outputs.s, vaium: evaluation.outputs.v }).toEqual({
        a, b, cin,
        soma: total % 2 === 1,
        vaium: total >= 2,
      })
    }
  })

  it('empacota o somador completo e o reusa em um terceiro nível', () => {
    const halfAdder = buildCustomChipDefinition(halfAdderDocument(), 'Meio somador')
    const withHalf: CustomChipLibraryEntry[] = [{ id: 1, definition: halfAdder }]
    const fullAdder = buildCustomChipDefinition(fullAdderDocument(1), 'Somador completo', {
      customChips: withHalf,
    })
    const library: CustomChipLibraryEntry[] = [...withHalf, { id: 2, definition: fullAdder }]

    // Somador de dois bits: dois somadores completos em cascata.
    const twoBit = doc(
      'somador de 2 bits',
      [
        node('a0', 'input', 'A0'), node('b0', 'input', 'B0'),
        node('a1', 'input', 'A1'), node('b1', 'input', 'B1'),
        node('z', 'constant', 'ZERO', { value: false }),
        node('fa0', 'custom-chip', 'FA0', { customChipId: 2 }),
        node('fa1', 'custom-chip', 'FA1', { customChipId: 2 }),
        node('s0', 'output', 'S0'), node('s1', 'output', 'S1'), node('c', 'output', 'CARRY'),
      ],
      [
        link('a0', 'fa0', 0), link('b0', 'fa0', 1), link('z', 'fa0', 2),
        link('fa0', 's0', 0, 0),
        link('a1', 'fa1', 0), link('b1', 'fa1', 1), link('fa0', 'fa1', 2, 1),
        link('fa1', 's1', 0, 0), link('fa1', 'c', 0, 1),
      ],
    )

    const chip = buildCustomChipDefinition(twoBit, 'Somador de 2 bits', { customChips: library })
    expect(chip.outputs.map((port) => port.name)).toEqual(['CARRY', 'S0', 'S1'])

    // 3 + 1 = 4 → S0=0, S1=0, CARRY=1
    const evaluation = evaluateCircuit(
      twoBit,
      { a0: true, a1: true, b0: true, b1: false },
      { customChips: library },
    )
    expect(evaluation.outputs).toMatchObject({ s0: false, s1: false, c: true })
  })

  it('elabora a hierarquia inteira para HDL sem instâncias restantes', () => {
    const halfAdder = buildCustomChipDefinition(halfAdderDocument(), 'Meio somador')
    const library: CustomChipLibraryEntry[] = [{ id: 1, definition: halfAdder }]

    const elaborated = elaborateCustomChipDocument(fullAdderDocument(1), { customChips: library })

    expect(elaborated.nodes.some((item) => item.type === 'custom-chip')).toBe(false)
    // Dois meio somadores achatados: dois XOR e dois AND, mais o OR do vai-um.
    expect(elaborated.nodes.filter((item) => item.type === 'xor')).toHaveLength(2)
    expect(elaborated.nodes.filter((item) => item.type === 'and')).toHaveLength(2)
    expect(elaborated.nodes.filter((item) => item.type === 'or')).toHaveLength(1)
  })

  it('recusa instância cuja definição não veio na biblioteca', () => {
    expect(() => buildCustomChipDefinition(fullAdderDocument(99), 'Sem filho')).toThrow(
      /não encontrou a definição local/,
    )
  })

  it('recusa uma atualização que faria o chip conter a si mesmo', () => {
    const halfAdder = buildCustomChipDefinition(halfAdderDocument(), 'Meio somador')
    const library: CustomChipLibraryEntry[] = [{ id: 1, definition: halfAdder }]
    const fullAdder = buildCustomChipDefinition(fullAdderDocument(1), 'Somador completo', {
      customChips: library,
    })
    const withBoth: CustomChipLibraryEntry[] = [...library, { id: 2, definition: fullAdder }]

    // Tentar redefinir o chip 1 (meio somador) usando o chip 2, que já usa o 1.
    const cyclic = doc(
      'meio somador circular',
      [
        node('a', 'input', 'A'), node('b', 'input', 'B'), node('c', 'input', 'C'),
        node('fa', 'custom-chip', 'FA', { customChipId: 2 }),
        node('s', 'output', 'SOMA'), node('v', 'output', 'VAIUM'),
      ],
      [
        link('a', 'fa', 0), link('b', 'fa', 1), link('c', 'fa', 2),
        link('fa', 's', 0, 0), link('fa', 'v', 0, 1),
      ],
    )

    expect(() =>
      buildCustomChipDefinition(cyclic, 'Meio somador', { customChips: withBoth, selfId: 1 }),
    ).toThrow(/conter a si mesmo/)
  })

  it('aceita a mesma hierarquia quando não há ciclo', () => {
    const halfAdder = buildCustomChipDefinition(halfAdderDocument(), 'Meio somador')
    const library: CustomChipLibraryEntry[] = [{ id: 1, definition: halfAdder }]

    // selfId 7 não participa da hierarquia, então nada aponta de volta.
    expect(() =>
      buildCustomChipDefinition(fullAdderDocument(1), 'Somador completo', {
        customChips: library,
        selfId: 7,
      }),
    ).not.toThrow()
  })

  it('aceita exatamente o limite de níveis e recusa o nível seguinte', () => {
    // Cada nível embrulha o anterior: o nível k tem k+1 níveis de hierarquia.
    let definition = buildCustomChipDefinition(
      doc('base', [node('a', 'input', 'A'), node('o', 'output', 'OUT')], [link('a', 'o')]),
      'Nível 0',
    )
    const library: CustomChipLibraryEntry[] = [{ id: 1, definition }]

    const wrapperFor = (level: number): CircuitDocument =>
      doc(
        `nível ${level}`,
        [
          node('a', 'input', 'A'),
          node('chip', 'custom-chip', 'INNER', { customChipId: level }),
          node('o', 'output', 'OUT'),
        ],
        [link('a', 'chip', 0), link('chip', 'o')],
      )

    // Sobe até o teto: o nível MAX-1 produz exatamente MAX níveis e é aceito.
    for (let level = 1; level <= MAX_CUSTOM_CHIP_DEPTH - 1; level += 1) {
      definition = buildCustomChipDefinition(wrapperFor(level), `Nível ${level}`, {
        customChips: library,
      })
      library.push({ id: level + 1, definition })
    }
    expect(library).toHaveLength(MAX_CUSTOM_CHIP_DEPTH)

    // O próximo passaria de MAX e é recusado ao salvar, não ao simular.
    expect(() =>
      buildCustomChipDefinition(wrapperFor(MAX_CUSTOM_CHIP_DEPTH), 'Um a mais', {
        customChips: library,
      }),
    ).toThrow(/limite seguro/)
  })

  it('avalia a hierarquia no limite sem estourar na simulação', () => {
    // O guard de criação e o da avaliação precisam concordar: o que é aceito
    // ao salvar tem de rodar.
    let definition = buildCustomChipDefinition(
      doc('base', [node('a', 'input', 'A'), node('o', 'output', 'OUT')], [link('a', 'o')]),
      'Nível 0',
    )
    const library: CustomChipLibraryEntry[] = [{ id: 1, definition }]
    let top: CircuitDocument = doc('base', [node('a', 'input', 'A'), node('o', 'output', 'OUT')], [link('a', 'o')])

    for (let level = 1; level <= MAX_CUSTOM_CHIP_DEPTH - 1; level += 1) {
      top = doc(
        `nível ${level}`,
        [
          node('a', 'input', 'A'),
          node('chip', 'custom-chip', 'INNER', { customChipId: level }),
          node('o', 'output', 'OUT'),
        ],
        [link('a', 'chip', 0), link('chip', 'o')],
      )
      definition = buildCustomChipDefinition(top, `Nível ${level}`, { customChips: library })
      library.push({ id: level + 1, definition })
    }

    const evaluation = evaluateCircuit(top, { a: true }, { customChips: library })
    expect(evaluation.outputs.o).toBe(true)
  })

  it('mantém chips combinacionais mesmo com aninhamento', () => {
    const halfAdder = buildCustomChipDefinition(halfAdderDocument(), 'Meio somador')
    const library: CustomChipLibraryEntry[] = [{ id: 1, definition: halfAdder }]

    const withClock = doc(
      'com clock',
      [
        node('a', 'input', 'A'), node('b', 'input', 'B'),
        node('ha', 'custom-chip', 'HA', { customChipId: 1 }),
        node('ck', 'clock', undefined, { period: 2 }),
        node('s', 'output', 'SOMA'),
      ],
      [link('a', 'ha', 0), link('b', 'ha', 1), link('ha', 's', 0, 0)],
    )

    expect(() => buildCustomChipDefinition(withClock, 'Inválido', { customChips: library })).toThrow(
      /combinacionais/,
    )
  })
})
