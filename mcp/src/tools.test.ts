import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  debugAlgorithm,
  evaluateExpression,
  evaluateLogicCase,
  fullPropositionalTable,
  getChip,
  karnaugh,
  listChips,
  MAX_SIMULATION_TICKS,
  normalForms,
  simplifyExpression,
  simulateCircuit,
  truthTable,
} from './tools'
import { createAlgorithmDocument } from '../../src/algorithms'
import { buildCustomChipDefinition, createCircuitDocument, type CircuitDocument } from '../../src/circuit'

describe('logic_case', () => {
  it('avalia um caso didático e expõe o contraexemplo', () => {
    const result = evaluateLogicCase('implication-counterexample')
    expect(result.text).toContain('| V | F | F | não |')
    expect(result.text).toContain('Caso válido: não')
  })

  it('rejeita um identificador de caso desconhecido', () => {
    const result = evaluateLogicCase('nao-existe')
    expect(result.isError).toBe(true)
    expect(result.text).toContain('Disponíveis:')
  })
})

describe('propositional_truth_table', () => {
  it('usa a tabela completa para conectivos avançados', () => {
    const result = fullPropositionalTable('A NAND B <-> (A -> B)', { notation: 'text' })
    expect(result.text).toContain('| A | B |')
    expect(result.text).toContain('Classificação:')
    expect(result.text).toContain('NAND')
  })
})

describe('debug_algorithm', () => {
  it('faz uma transição step sem efeitos externos', () => {
    const document = createAlgorithmDocument('MCP debug')
    const result = debugAlgorithm({ document, mode: 'step' })
    const state = JSON.parse(result.text) as { status: string; activeNodeId: string; stepIndex: number }
    expect(state.status).toBe('paused')
    expect(state.activeNodeId).toBe('end')
    expect(state.stepIndex).toBe(1)
  })

  it('preserva breakpoint no estado retornado', () => {
    const document = createAlgorithmDocument('MCP breakpoint')
    const result = debugAlgorithm({ document, mode: 'run', breakpoints: ['end'] })
    const state = JSON.parse(result.text) as { status: string; activeNodeId: string; debug: { lastPauseReason: string } }
    expect(state.status).toBe('paused')
    expect(state.activeNodeId).toBe('end')
    expect(state.debug.lastPauseReason).toBe('breakpoint')
  })
})

describe('truth_table', () => {
  it('devolve a tabela em markdown com a classificação', () => {
    const { text } = truthTable('A XOR B')
    expect(text).toContain('| A | B | A ⊕ B |')
    expect(text).toContain('| 0 | 1 | 1 |')
    expect(text).toContain('Classificação: contingencia')
  })

  it('respeita o pedido de esconder os passos', () => {
    const withSteps = truthTable('(A AND B) OR C').text
    const without = truthTable('(A AND B) OR C', { includeSteps: false }).text
    expect(withSteps).toContain('A ∧ B |')
    expect(without.split('\n')[0]).toBe('| A | B | C | A ∧ B ∨ C |')
  })

  it('avisa quando corta a tabela', () => {
    const { text } = truthTable('A AND B AND C AND D AND E', { maxRows: 4 })
    expect(text).toContain('Exibindo 4 de 32 linhas')
  })

  it('explica o erro de sintaxe apontando a posição', () => {
    expect(() => truthTable('(A AND')).toThrow('Falta fechar 1 parêntese')
    try {
      truthTable('A AND OR B')
    } catch (error) {
      expect((error as Error).message).toContain('Dois operadores seguidos')
      expect((error as Error).message).toContain('^')
    }
  })
})

describe('evaluate_expression', () => {
  it('resolve e mostra os passos', () => {
    const { text } = evaluateExpression('(A AND B) OR NOT C', {
      A: true,
      B: false,
      C: false,
    })
    expect(text).toContain('= VERDADEIRO')
    expect(text).toContain('A ∧ B = F')
    expect(text).toContain('¬C = V')
  })

  it('reclama de variável sem valor em vez de assumir falso', () => {
    const result = evaluateExpression('A AND B', { A: true })
    expect(result.isError).toBe(true)
    expect(result.text).toContain('Faltam valores para: B')
  })
})

describe('simplify_expression', () => {
  it('minimiza e conta a economia', () => {
    const { text } = simplifyExpression('(A AND B) OR (A AND NOT B)')
    expect(text).toContain('Mínima:   A')
    expect(text).toContain('Operadores: 4 → 0')
  })

  it('recusa expressões grandes demais', () => {
    const many = 'A AND B AND C AND D AND E AND G AND H AND I AND J AND K AND L AND M AND N'
    expect(simplifyExpression(many).isError).toBe(true)
  })
})

describe('karnaugh_map', () => {
  it('desenha o mapa e lista os agrupamentos', () => {
    const { text } = karnaugh('(NOT B AND NOT D) OR (A AND C)')
    expect(text).toContain('| AB\\CD | 00 | 01 | 11 | 10 |')
    expect(text).toContain('¬B ∧ ¬D  (4 células)')
    expect(text).toContain('A ∧ C  (4 células)')
  })

  it('recusa acima de quatro variáveis', () => {
    expect(karnaugh('A AND B AND C AND D AND E').isError).toBe(true)
  })
})

// O catálogo é lido do disco; sem ele estes testes não fazem sentido.
const hasCatalog = existsSync(new URL('../../src/chips/catalog.json', import.meta.url))

describe.skipIf(!hasCatalog)('biblioteca de chips', () => {
  it('filtra por nome e por expressão derivada', () => {
    const { text } = listChips({ query: 'Full Adder', onlyDerived: true, limit: 5 })
    expect(text).toContain('Full Adder')
    expect(text).toContain('(com expressão)')
  })

  it('avisa quando nada casa', () => {
    expect(listChips({ query: 'chip-que-nao-existe' }).text).toContain(
      'Nenhum chip encontrado',
    )
  })

  it('descreve um chip com as expressões de cada saída', () => {
    const { text } = getChip('Full Adder')
    expect(text).toContain('Entradas: Carry In, IN A, IN B')
    expect(text).toContain('Carry Out = (B AND C) OR (A AND C) OR (A AND B)')
  })

  it('sugere nomes parecidos quando erra o chip', () => {
    const result = getChip('Full Add')
    expect(result.isError).toBe(true)
    expect(result.text).toContain('Parecidos:')
  })
})

function customChipDefinition(): CircuitDocument {
  return {
    ...createCircuitDocument('NOT MCP'),
    nodes: [
      { id: 'input', type: 'input', position: { x: 0, y: 0 }, label: 'Entrada' },
      { id: 'not', type: 'not', position: { x: 120, y: 0 }, label: 'NOT' },
      { id: 'output', type: 'output', position: { x: 240, y: 0 }, label: 'Saída' },
    ],
    connections: [
      { source: { node: 'input' }, target: { node: 'not', port: 0 } },
      { source: { node: 'not' }, target: { node: 'output', port: 0 } },
    ],
  }
}

const customChipComponents = [
  { id: 'input', type: 'input' as const },
  { id: 'chip', type: 'custom-chip' as const, inputs: [{ node: 'input' }], options: { customChipId: 7 } },
  { id: 'out', type: 'output' as const, inputs: [{ node: 'chip' }] },
]

const customChips = [{ id: 7, definition: buildCustomChipDefinition(customChipDefinition(), 'NOT MCP') }]

describe('simulate_circuit', () => {
  it('devolve o diagrama de tempo de um contador', () => {
    const { text } = simulateCircuit(
      [
        { id: 'clk', type: 'input' },
        { id: 'ff', type: 'dff', inputs: [{ node: 'ff', port: 1 }, { node: 'clk' }] },
      ],
      [
        { set: { clk: true }, ticks: 1 },
        { set: { clk: false }, ticks: 1 },
        { set: { clk: true }, ticks: 1 },
      ],
      ['clk', 'ff'],
    )

    const lines = text.trim().split('\n')
    expect(lines[0]).toBe('| tique | clk | ff | evento |')
    // Começa em zero, sobe na primeira borda e continua ligado depois dela.
    expect(lines[2]).toContain('| 0 | 0 | 0 |')
    expect(lines[3]).toContain('| 1 | 1 | 1 |')
    expect(lines[5]).toContain('| 3 | 1 | 0 |')
  })

  it('simula a propagação de um canal wireless', () => {
    const result = simulateCircuit(
      [
        { id: 'input', type: 'input' },
        { id: 'tx', type: 'transmitter', inputs: [{ node: 'input' }], options: { channel: 'BUS A' } },
        { id: 'rx', type: 'receiver', options: { channel: 'bus-a' } },
        { id: 'out', type: 'output', inputs: [{ node: 'rx' }] },
      ],
      [{ set: { input: true }, ticks: 3 }],
      ['input', 'tx', 'rx', 'out'],
    )

    expect(result.isError).not.toBe(true)
    expect(result.text).toContain('| 3 | 1 | 1 | 1 | 1 |')
  })

  it('deixa o clock oscilar sozinho', () => {
    const { text } = simulateCircuit(
      [{ id: 'clk', type: 'clock', options: { period: 2 } }],
      [{ ticks: 4 }],
      ['clk'],
    )
    const levels = text
      .trim()
      .split('\n')
      .slice(2)
      .map((line) => line.split('|')[2].trim())
    expect(levels).toEqual(['0', '0', '1', '1', '0'])
  })

  it('recusa circuito com ligação inexistente', () => {
    const result = simulateCircuit(
      [{ id: 'g', type: 'and', inputs: [{ node: 'fantasma' }] }],
      [{ ticks: 1 }],
      [],
    )
    expect(result.isError).toBe(true)
    expect(result.text).toContain('não existe')
  })

  it('recusa acompanhar um componente que não existe', () => {
    const result = simulateCircuit([{ id: 'a', type: 'input' }], [{ ticks: 1 }], ['b'])
    expect(result.isError).toBe(true)
    expect(result.text).toContain('Não existem no circuito: b')
  })

  it('simula custom-chip com definição portátil e permite acompanhar a instância', () => {
    const result = simulateCircuit(customChipComponents, [{ set: { input: true }, ticks: 3 }], ['input', 'chip', 'out'], { customChips })

    expect(result.isError).not.toBe(true)
    expect(result.text).toContain('| tique | input | chip | out | evento |')
    expect(result.text).toContain('| 3 | 1 | 1 | 1 |')
  })

  it('recusa custom-chip sem definição correspondente', () => {
    const result = simulateCircuit(customChipComponents, [{ ticks: 1 }], [], { customChips: [] })

    expect(result.isError).toBe(true)
    expect(result.text).toContain('definição local')
  })

  it('recusa simulação longa demais', () => {
    const result = simulateCircuit(
      [{ id: 'a', type: 'input' }],
      [{ ticks: MAX_SIMULATION_TICKS + 1 }],
      [],
    )
    expect(result.isError).toBe(true)
    expect(result.text).toContain('limite por chamada')
  })
})

describe('normal_forms', () => {
  it('lista as quatro formas e a classificação', () => {
    const { text } = normalForms('A XOR B')
    expect(text).toContain('Como está escrita: Nem SOP nem POS')
    expect(text).toContain('SOP canônica — Σm(1, 2)')
    expect(text).toContain('POS canônica — ΠM(0, 3)')
    expect(text).toContain('¬A ∧ B ∨ A ∧ ¬B')
    expect(text).toContain('(A ∨ B) ∧ (¬A ∨ ¬B)')
  })

  it('reconhece uma POS escrita à mão', () => {
    expect(normalForms("(B + C' + D)(A' + B)").text).toContain(
      'Como está escrita: Produto de somas (POS)',
    )
  })

  it('diz qual das duas formas sai mais barata', () => {
    expect(normalForms('A OR B').text).toMatch(/mais barat|mesmo/)
  })
})
