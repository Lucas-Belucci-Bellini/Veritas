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
  circuitDifferential,
  circuitEquivalence,
  circuitTruthTable,
  runTestbenchTool,
  circuitVectorTruthTable,
  exportCircuitTool,
  MAX_SIMULATION_MEMORY_BYTES,
  MAX_SIMULATION_OPERATIONS_PER_TICK,
  MAX_SIMULATION_TICKS,
  normalForms,
  simplifyExpression,
  simulateCircuit,
  simulateCircuitAsync,
  truthTable,
} from './tools'
import { createAlgorithmDocument } from '../../src/algorithms'
import { buildCustomChipDefinition, createCircuitDocument, type CircuitDifferentialStep, type CircuitDocument } from '../../src/circuit'

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
const customChipCircuit: CircuitDocument = {
  ...createCircuitDocument('Circuito NOT MCP'),
  nodes: [
    { id: 'input', type: 'input', position: { x: 0, y: 0 }, label: 'Entrada' },
    { id: 'chip', type: 'custom-chip', position: { x: 120, y: 0 }, label: 'NOT', options: { customChipId: 7 } },
    { id: 'output', type: 'output', position: { x: 240, y: 0 }, label: 'Resultado' },
  ],
  connections: [
    { source: { node: 'input' }, target: { node: 'chip', port: 0 } },
    { source: { node: 'chip' }, target: { node: 'output', port: 0 } },
  ],
}

function vectorAndCircuit(width = 4): CircuitDocument {
  return {
    ...createCircuitDocument('AND vetorial MCP'),
    nodes: [
      { id: 'a', type: 'input', position: { x: 0, y: 0 }, options: { width } },
      { id: 'b', type: 'input', position: { x: 0, y: 100 }, options: { width } },
      { id: 'gate', type: 'and', position: { x: 180, y: 50 }, options: { width } },
      { id: 'out', type: 'output', position: { x: 360, y: 50 }, options: { width } },
    ],
    connections: [
      { source: { node: 'a' }, target: { node: 'gate', port: 0 } },
      { source: { node: 'b' }, target: { node: 'gate', port: 1 } },
      { source: { node: 'gate' }, target: { node: 'out', port: 0 } },
    ],
  }
}

describe('circuit_vector_truth_table', () => {
  it('gera linhas binárias determinísticas para AND de quatro bits', () => {
    const result = circuitVectorTruthTable({ document: vectorAndCircuit(), maxRows: 4 })

    expect(result.isError).not.toBe(true)
    expect(result.text).toContain('| a[3:0] | b[3:0] | out[3:0] |')
    expect(result.text).toContain('| 0000 | 0000 | 0000 |')
    expect(result.text).toContain('Bits de entrada: 8')
    expect(result.text).toContain('Exibindo 4 de 256 combinações.')
  })

  it('respeita output_id e max_bits sem expor valores não solicitados', () => {
    const result = circuitVectorTruthTable({ document: vectorAndCircuit(), outputId: 'out', maxBits: 8, maxRows: 1 })

    expect(result.isError).not.toBe(true)
    expect(result.text).toContain('Combinações geradas: 1 de 256')
  })

  it('recusa largura total acima do limite vetorial', () => {
    const result = circuitVectorTruthTable({ document: vectorAndCircuit(8) })

    expect(result.isError).toBe(true)
    expect(result.text).toContain('limite seguro é 12')
  })

  it('recusa documento inválido com erro MCP controlado', () => {
    const result = circuitVectorTruthTable({ document: { format: 'invalid' } })

    expect(result.isError).toBe(true)
    expect(result.text).toContain('formato veritas-circuit')
  })
})

describe('circuit_truth_table', () => {
  it('gera tabela determinística para instância customizada', () => {
    const result = circuitTruthTable({ document: customChipCircuit, customChips })

    expect(result.isError).not.toBe(true)
    expect(result.text).toContain('| Entrada | Resultado |')
    expect(result.text).toContain('| 0 | 1 |')
    expect(result.text).toContain('| 1 | 0 |')
  })

  it('recusa tabela de instância sem definição portátil', () => {
    const result = circuitTruthTable({ document: customChipCircuit })

    expect(result.isError).toBe(true)
    expect(result.text).toContain('definição local')
  })
})

describe('circuit_equivalence', () => {
  const gate = (name: string, prefix: string, type: 'xor' | 'or'): CircuitDocument => ({
    format: 'veritas-circuit',
    version: 1,
    name,
    nodes: [
      { id: `${prefix}a`, type: 'input', position: { x: 0, y: 0 }, label: 'A' },
      { id: `${prefix}b`, type: 'input', position: { x: 0, y: 0 }, label: 'B' },
      { id: `${prefix}g`, type, position: { x: 0, y: 0 } },
      { id: `${prefix}s`, type: 'output', position: { x: 0, y: 0 }, label: 'S' },
    ],
    connections: [
      { source: { node: `${prefix}a`, port: 0 }, target: { node: `${prefix}g`, port: 0 } },
      { source: { node: `${prefix}b`, port: 0 }, target: { node: `${prefix}g`, port: 1 } },
      { source: { node: `${prefix}g`, port: 0 }, target: { node: `${prefix}s`, port: 0 } },
    ],
  })

  it('reconhece dois circuitos com o mesmo comportamento', () => {
    const result = circuitEquivalence({
      documentA: gate('xor 1', 'x', 'xor'),
      documentB: gate('xor 2', 'y', 'xor'),
    })

    expect(result.isError).not.toBe(true)
    expect(result.text).toContain('Resultado: equivalente')
    expect(result.text).toContain('Linhas comparadas: 4 de 4')
  })

  it('devolve contraexemplo em Markdown quando divergem', () => {
    const result = circuitEquivalence({
      documentA: gate('xor', 'x', 'xor'),
      documentB: gate('ou', 'y', 'or'),
    })

    expect(result.isError).not.toBe(true)
    expect(result.text).toContain('Resultado: não equivalente')
    expect(result.text).toContain('Contraexemplo (linha 3)')
    expect(result.text).toContain('| S | 0 | 1 |')
  })

  it('recusa documento fora do formato', () => {
    const result = circuitEquivalence({ documentA: { nope: true }, documentB: gate('xor', 'y', 'xor') })

    expect(result.isError).toBe(true)
    expect(result.text).toContain('documento A não possui o formato')
  })

  it('não afirma equivalência quando o espaço de entrada excede o limite', () => {
    const wide = (prefix: string): CircuitDocument => ({
      format: 'veritas-circuit',
      version: 1,
      name: 'largo',
      nodes: [
        { id: `${prefix}a`, type: 'input', position: { x: 0, y: 0 }, label: 'A', options: { width: 8 } },
        { id: `${prefix}b`, type: 'input', position: { x: 0, y: 0 }, label: 'B', options: { width: 8 } },
        { id: `${prefix}g`, type: 'and', position: { x: 0, y: 0 }, options: { width: 8 } },
        { id: `${prefix}o`, type: 'output', position: { x: 0, y: 0 }, label: 'R', options: { width: 8 } },
      ],
      connections: [
        { source: { node: `${prefix}a`, port: 0 }, target: { node: `${prefix}g`, port: 0 } },
        { source: { node: `${prefix}b`, port: 0 }, target: { node: `${prefix}g`, port: 1 } },
        { source: { node: `${prefix}g`, port: 0 }, target: { node: `${prefix}o`, port: 0 } },
      ],
    })

    const result = circuitEquivalence({ documentA: wide('x'), documentB: wide('y'), maxInputBits: 8 })

    expect(result.text).toContain('Resultado: não comparável')
    expect(result.text).toContain('input-bits-exceeded')
    expect(result.text).toContain('não afirma nem nega equivalência')
  })
})

describe('circuit_differential', () => {
  const flipFlop = (prefix: string, sourcePort: 0 | 1): CircuitDocument => ({
    format: 'veritas-circuit',
    version: 1,
    name: 'flip-flop',
    nodes: [
      { id: `${prefix}d`, type: 'input', position: { x: 0, y: 0 }, label: 'D' },
      { id: `${prefix}c`, type: 'input', position: { x: 0, y: 60 }, label: 'CLK' },
      { id: `${prefix}ff`, type: 'dff', position: { x: 120, y: 30 } },
      { id: `${prefix}q`, type: 'output', position: { x: 240, y: 30 }, label: 'Q' },
    ],
    connections: [
      { source: { node: `${prefix}d`, port: 0 }, target: { node: `${prefix}ff`, port: 0 } },
      { source: { node: `${prefix}c`, port: 0 }, target: { node: `${prefix}ff`, port: 1 } },
      { source: { node: `${prefix}ff`, port: sourcePort }, target: { node: `${prefix}q`, port: 0 } },
    ],
  })

  const script: CircuitDifferentialStep[] = [
    { set: { D: true, CLK: false }, ticks: 2 },
    { set: { CLK: true }, ticks: 2 },
  ]

  it('reconhece dois sequenciais que concordam no roteiro', () => {
    const result = circuitDifferential({
      documentA: flipFlop('x', 0),
      documentB: flipFlop('y', 0),
      script,
    })

    expect(result.isError).not.toBe(true)
    expect(result.text).toContain('Resultado: idêntico neste roteiro')
    expect(result.text).toContain('Tiques simulados: 4')
    // O resultado precisa dizer que isso não é prova.
    expect(result.text).toContain('não é prova')
  })

  it('devolve o primeiro tique divergente', () => {
    const result = circuitDifferential({
      documentA: flipFlop('x', 0),
      documentB: flipFlop('y', 1),
      script,
    })

    expect(result.isError).not.toBe(true)
    expect(result.text).toContain('Resultado: divergente')
    expect(result.text).toContain('Primeira divergência no tique 1')
    expect(result.text).toContain('| Q | 0 | 1 |')
  })

  it('recusa roteiro acima do limite sem simular', () => {
    const result = circuitDifferential({
      documentA: flipFlop('x', 0),
      documentB: flipFlop('y', 0),
      script: [{ set: { CLK: false }, ticks: 900 }],
      maxTicks: 10,
    })

    expect(result.text).toContain('Resultado: não comparável')
    expect(result.text).toContain('ticks-exceeded')
    expect(result.text).toContain('Nenhum tique foi simulado')
  })

  it('recusa documento fora do formato', () => {
    const result = circuitDifferential({ documentA: { nope: true }, documentB: flipFlop('y', 0), script })

    expect(result.isError).toBe(true)
    expect(result.text).toContain('documento A não possui o formato')
  })
})

describe('run_testbench', () => {
  const halfAdder = (carry: 'and' | 'or'): CircuitDocument => ({
    format: 'veritas-circuit',
    version: 1,
    name: 'meio somador',
    nodes: [
      { id: 'a', type: 'input', position: { x: 0, y: 0 }, label: 'A' },
      { id: 'b', type: 'input', position: { x: 0, y: 60 }, label: 'B' },
      { id: 'x', type: 'xor', position: { x: 120, y: 0 } },
      { id: 'c', type: carry, position: { x: 120, y: 60 } },
      { id: 's', type: 'output', position: { x: 240, y: 0 }, label: 'SOMA' },
      { id: 'v', type: 'output', position: { x: 240, y: 60 }, label: 'VAIUM' },
    ],
    connections: [
      { source: { node: 'a', port: 0 }, target: { node: 'x', port: 0 } },
      { source: { node: 'b', port: 0 }, target: { node: 'x', port: 1 } },
      { source: { node: 'a', port: 0 }, target: { node: 'c', port: 0 } },
      { source: { node: 'b', port: 0 }, target: { node: 'c', port: 1 } },
      { source: { node: 'x', port: 0 }, target: { node: 's', port: 0 } },
      { source: { node: 'c', port: 0 }, target: { node: 'v', port: 0 } },
    ],
  })

  const table = {
    format: 'veritas-testbench' as const,
    version: 1 as const,
    name: 'tabela do meio somador',
    cases: [
      { name: '0+1', inputs: { A: false, B: true }, expect: { SOMA: true, VAIUM: false } },
      { name: '1+1', inputs: { A: true, B: true }, expect: { SOMA: false, VAIUM: true } },
    ],
  }

  const sequentialClock: CircuitDocument = {
    format: 'veritas-circuit',
    version: 1,
    name: 'clock',
    nodes: [
      { id: 'clk', type: 'clock', position: { x: 0, y: 0 }, label: 'CLK', options: { period: 1 } },
      { id: 'out', type: 'output', position: { x: 180, y: 0 }, label: 'OUT' },
    ],
    connections: [{ source: { node: 'clk', port: 0 }, target: { node: 'out', port: 0 } }],
  }

  it('aprova um circuito que satisfaz os vetores', () => {
    const result = runTestbenchTool({ document: halfAdder('and'), testbench: table })

    expect(result.isError).not.toBe(true)
    expect(result.text).toContain('Resultado: todos os casos passaram')
    expect(result.text).toContain('Casos: 2 de 2 passaram')
    expect(result.text).toContain('Snapshots observados: 2')
    // O resultado positivo precisa dizer o que ele NÃO prova.
    expect(result.text).toContain('circuit_equivalence')
  })

  it('tabula os casos que falharam com esperado e obtido', () => {
    const result = runTestbenchTool({ document: halfAdder('or'), testbench: table })

    expect(result.isError).not.toBe(true)
    expect(result.text).toContain('Resultado: há casos falhando')
    expect(result.text).toContain('Casos: 1 de 2 passaram')
    expect(result.text).toContain('| 0+1 | VAIUM | 0 | 1 | — |')
    expect(result.text).toContain('Primeira divergência: VAIUM no tique 0')
    expect(result.text).toContain('Contraexemplos determinísticos:')
    expect(result.text).toContain('A=0, B=1')
  })

  it('recusa documento de teste inválido sem executar nada', () => {
    const result = runTestbenchTool({
      document: halfAdder('and'),
      testbench: { ...table, cases: [{ name: 'vazio', inputs: { A: true } }] },
    })

    expect(result.text).toContain('documento de teste inválido')
    expect(result.text).toContain('missing-expectation')
    expect(result.text).toContain('Nenhum caso foi executado')
  })

  it('expõe diagnóstico bounded de ciclo no resultado headless', () => {
    const result = runTestbenchTool({
      document: sequentialClock,
      testbench: {
        format: 'veritas-testbench',
        version: 1,
        name: 'clock',
        cases: [{ name: 'ciclo', steps: [{ ticks: 1, expect: { OUT: false } }] }],
      },
    })

    expect(result.isError).not.toBe(true)
    expect(result.text).toContain('Resultado: todos os casos passaram')
    expect(result.text).toContain('Diagnóstico bounded por caso:')
    expect(result.text).toContain('ciclo detectado')
    expect(result.text).toContain('início no tique 1')
    expect(result.text).toContain('período 2')
  })

  it('recusa circuito fora do formato', () => {
    const result = runTestbenchTool({ document: { nope: true }, testbench: table })

    expect(result.isError).toBe(true)
    expect(result.text).toContain('formato veritas-circuit')
  })
})

describe('export_circuit_hdl', () => {
  it('exporta Verilog e VHDL de um circuito com custom-chip', () => {
    const verilog = exportCircuitTool({ document: customChipCircuit, format: 'verilog', customChips })
    const vhdl = exportCircuitTool({ document: customChipCircuit, format: 'vhdl', customChips })

    expect(verilog.isError).not.toBe(true)
    expect(verilog.text).toContain('module Circuito_NOT_MCP (')
    expect(verilog.text).toContain('output Resultado')
    expect(vhdl.isError).not.toBe(true)
    expect(vhdl.text).toContain('entity Circuito_NOT_MCP is')
    expect(vhdl.text).toContain('Resultado : out std_logic')
  })

  it('recusa exportar custom-chip sem definição correspondente', () => {
    const result = exportCircuitTool({ document: customChipCircuit, format: 'verilog' })

    expect(result.isError).toBe(true)
    expect(result.text).toContain('definição local')
  })
})

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

  it('recusa simulação quando o budget de operações headless é insuficiente', () => {
    const result = simulateCircuit(
      [{ id: 'a', type: 'input' }],
      [{ ticks: 1 }],
      ['a'],
      { maxOperationsPerTick: 1 },
    )

    expect(result.isError).toBe(true)
    expect(result.text).toContain('orçamento de 1 operações')
    expect(MAX_SIMULATION_OPERATIONS_PER_TICK).toBeGreaterThan(1)
  })

  it('recusa runtime MCP acima do budget de memória antes de alocar delay', () => {
    const result = simulateCircuit(
      [
        { id: 'input', type: 'input' },
        { id: 'delay', type: 'delay', inputs: [{ node: 'input' }], options: { ticks: 1_000_000 } },
      ],
      [{ ticks: 1 }],
      ['input', 'delay'],
      { maxMemoryBytes: 1024 * 1024 },
    )

    expect(result.isError).toBe(true)
    expect(result.text).toContain('orçamento de memória')
    expect(MAX_SIMULATION_MEMORY_BYTES).toBeGreaterThan(1024 * 1024)
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

  it('preserva o diagrama de tempo na variante assíncrona', async () => {
    const result = await simulateCircuitAsync(
      [{ id: 'clk', type: 'clock', options: { period: 2 } }],
      [{ ticks: 4 }],
      ['clk'],
      { yieldEvery: 1 },
    )

    expect(result.isError).not.toBe(true)
    expect(result.text).toContain('| tique | clk | evento |')
    expect(result.text).toContain('| 4 | 0 |  |')
  })

  it('retorna erro controlado quando o request MCP já chega abortado', async () => {
    const controller = new AbortController()
    controller.abort()

    const result = await simulateCircuitAsync(
      [{ id: 'a', type: 'input' }],
      [{ ticks: 1 }],
      ['a'],
      { signal: controller.signal },
    )

    expect(result.isError).toBe(true)
    expect(result.text).toContain('execução do simulador foi abortada')
  })

  it('aborta entre yields sem executar todos os tiques', async () => {
    const controller = new AbortController()
    const resultPromise = simulateCircuitAsync(
      [{ id: 'clk', type: 'clock', options: { period: 2 } }],
      [{ ticks: 64 }],
      ['clk'],
      { signal: controller.signal, yieldEvery: 1 },
    )

    setTimeout(() => controller.abort(), 0)
    const result = await resultPromise

    expect(result.isError).toBe(true)
    expect(result.text).toContain('execução do simulador foi abortada')
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
