import { describe, expect, it } from 'vitest'
import { collectVariables, evaluate, parse } from '../engine'
import { assignmentForRow } from '../engine/truthTable'
import { netlistFromAst } from './fromAst'
import {
  DEFAULT_MAX_MEMORY_BYTES,
  MAX_MEMORY_BYTES,
  MAX_OPERATIONS_PER_TICK,
  MAX_SETTLE_TICKS,
  MAX_TOTAL_OPERATIONS,
  MAX_TOTAL_TICKS,
  Simulator,
} from './simulator'
import type { Netlist } from './components'

describe('validação do circuito', () => {
  it('recusa componentes com o mesmo id', () => {
    const netlist: Netlist = {
      components: [
        { id: 'a', type: 'input' },
        { id: 'a', type: 'input' },
      ],
    }
    expect(() => new Simulator(netlist)).toThrow('Componente duplicado')
  })

  it('recusa ligação para um componente inexistente', () => {
    const netlist: Netlist = {
      components: [{ id: 'g', type: 'and', inputs: [{ node: 'fantasma' }] }],
    }
    expect(() => new Simulator(netlist)).toThrow('não existe')
  })

  it('recusa saída que o componente não tem', () => {
    const netlist: Netlist = {
      components: [
        { id: 'a', type: 'input' },
        { id: 'g', type: 'not', inputs: [{ node: 'a', port: 1 }] },
      ],
    }
    expect(() => new Simulator(netlist)).toThrow('não tem a saída 1')
  })
})

describe('lógica combinacional', () => {
  const andCircuit: Netlist = {
    components: [
      { id: 'a', type: 'input' },
      { id: 'b', type: 'input' },
      { id: 'g', type: 'and', inputs: [{ node: 'a' }, { node: 'b' }] },
      { id: 'out', type: 'output', inputs: [{ node: 'g' }] },
    ],
  }

  it('propaga um tique por porta', () => {
    const sim = new Simulator(andCircuit)
    sim.setInput('a', true)
    sim.setInput('b', true)

    sim.tick()
    // A porta já calculou, mas a saída ainda está lendo o valor antigo dela.
    expect(sim.read('out')).toBe(false)
    sim.tick()
    expect(sim.read('out')).toBe(true)
  })

  it('estabiliza sozinho', () => {
    const sim = new Simulator(andCircuit)
    sim.setInput('a', true)
    sim.setInput('b', false)
    expect(sim.settle()).toBe(true)
    expect(sim.read('out')).toBe(false)

    sim.setInput('b', true)
    expect(sim.settle()).toBe(true)
    expect(sim.read('out')).toBe(true)
  })

  it('recusa budgets de settle não finitos, fracionários ou acima do teto', () => {
    expect(() => new Simulator(andCircuit, { maxSettleTicks: 0 })).toThrow('orçamento de settle')
    expect(() => new Simulator(andCircuit, { maxSettleTicks: Number.POSITIVE_INFINITY })).toThrow('orçamento de settle')
    expect(() => new Simulator(andCircuit, { maxSettleTicks: 1.5 })).toThrow('orçamento de settle')

    const sim = new Simulator(andCircuit)
    expect(() => sim.settle(-1)).toThrow('orçamento de settle')
    expect(() => sim.settle(MAX_SETTLE_TICKS + 1)).toThrow('orçamento de settle')
    expect(sim.settle(0)).toBe(false)
    expect(sim.tickCount).toBe(0)
  })

  it('diagnostica estabilização combinacional com contagem de tiques', () => {
    const sim = new Simulator(andCircuit)
    sim.setInput('a', true)
    sim.setInput('b', true)

    const diagnostic = sim.diagnoseSettle()
    expect(diagnostic.status).toBe('stabilized')
    expect(diagnostic.ticksExecuted).toBeGreaterThan(0)
    expect(sim.read('out')).toBe(true)
  })

  it('diagnostica ciclo de clock e informa período observado', () => {
    const sim = new Simulator({
      components: [{ id: 'clk', type: 'clock', options: { period: 1 } }],
    })

    const diagnostic = sim.diagnoseSettle(20)
    expect(diagnostic).toMatchObject({
      status: 'cycle-detected',
      ticksExecuted: 2,
      cycleStartTick: 0,
      cyclePeriod: 2,
    })
  })

  it('distingue orçamento de diagnóstico esgotado de um ciclo detectado', () => {
    const sim = new Simulator({
      components: [{ id: 'clk', type: 'clock', options: { period: 1 } }],
    })

    expect(sim.diagnoseSettle(1)).toEqual({ status: 'budget-exhausted', ticksExecuted: 1 })
  })

  it('valida e expõe o budget de memória estimada antes da alocação', () => {
    expect(() => new Simulator(andCircuit, { maxMemoryBytes: 1023 })).toThrow('orçamento de memória')
    expect(() => new Simulator(andCircuit, { maxMemoryBytes: Number.POSITIVE_INFINITY })).toThrow('orçamento de memória')
    expect(() => new Simulator(andCircuit, { maxMemoryBytes: MAX_MEMORY_BYTES + 1 })).toThrow('orçamento de memória')

    const sim = new Simulator(andCircuit, { maxMemoryBytes: DEFAULT_MAX_MEMORY_BYTES })
    expect(sim.memoryEstimateBytes).toBeGreaterThan(0)
    expect(() => new Simulator({
      components: [{ id: 'delay', type: 'delay', options: { ticks: 1_000_000 } }],
    }, { maxMemoryBytes: 1024 * 1024 })).toThrow('orçamento de memória')
  })

  it('valida budgets de operações por tique e total', () => {
    expect(() => new Simulator(andCircuit, { maxOperationsPerTick: 0 })).toThrow('orçamento de operações')
    expect(() => new Simulator(andCircuit, { maxOperationsPerTick: MAX_OPERATIONS_PER_TICK + 1 })).toThrow('orçamento de operações')
    expect(() => new Simulator(andCircuit, { maxTotalOperations: 0 })).toThrow('orçamento de operações')
    expect(() => new Simulator(andCircuit, { maxTotalOperations: MAX_TOTAL_OPERATIONS + 1 })).toThrow('orçamento de operações')
  })

  it('faz rollback atômico quando o budget de operações é excedido', () => {
    const sim = new Simulator(andCircuit, { maxOperationsPerTick: 3 })
    sim.setInput('a', true)
    sim.setInput('b', true)

    expect(() => sim.tick()).toThrow('orçamento de 3 operações')
    expect(sim.tickCount).toBe(0)
    expect(sim.operationCount).toBe(0)
    expect(sim.read('a')).toBe(true)
    expect(sim.read('b')).toBe(true)
    expect(sim.read('g')).toBe(false)
    expect(sim.read('out')).toBe(false)
  })

  it('faz rollback atômico quando o budget total de operações é excedido', () => {
    const sim = new Simulator(andCircuit, { maxTotalOperations: 3 })
    sim.setInput('a', true)
    sim.setInput('b', true)

    expect(() => sim.tick()).toThrow('orçamento total de 3 operações')
    expect(sim.tickCount).toBe(0)
    expect(sim.operationCount).toBe(0)
    expect(sim.read('g')).toBe(false)
  })

  it('diagnostica budget de operações excedido sem mutar o runtime', () => {
    const sim = new Simulator(andCircuit, { maxOperationsPerTick: 3 })
    sim.setInput('a', true)
    sim.setInput('b', true)

    expect(sim.diagnoseSettle()).toEqual({ status: 'budget-exhausted', ticksExecuted: 0 })
    expect(sim.tickCount).toBe(0)
    expect(sim.operationCount).toBe(0)
    expect(sim.read('g')).toBe(false)
  })

  it('executa tiques assíncronos em lotes e preserva o estado', async () => {
    const sim = new Simulator(andCircuit)
    sim.setInput('a', true)
    sim.setInput('b', true)

    await sim.tickAsync(2, { yieldEvery: 1 })

    expect(sim.tickCount).toBe(2)
    expect(sim.read('g')).toBe(true)
  })

  it('faz rollback completo quando AbortSignal cancela entre lotes', async () => {
    const controller = new AbortController()
    const sim = new Simulator(andCircuit)
    const before = sim.exportState()
    const abortTimer = setTimeout(() => controller.abort(), 0)

    await expect(sim.tickAsync(8, { yieldEvery: 1, signal: controller.signal })).rejects.toThrow('execução do simulador foi abortada')
    clearTimeout(abortTimer)

    expect(sim.exportState()).toEqual(before)
    expect(sim.operationCount).toBe(0)
  })

  it('encerra tickAsync por timeout e valida opções assíncronas fail-closed', async () => {
    const sim = new Simulator(andCircuit)

    await expect(sim.tickAsync(1, { yieldEvery: 0 })).rejects.toThrow('yield assíncrono')
    await expect(sim.tickAsync(1, { timeoutMs: 0 })).rejects.toThrow('timeout assíncrono')
    await expect(sim.tickAsync(1_000, { yieldEvery: 1, timeoutMs: 1 })).rejects.toThrow('timeout de 1 ms')
    expect(sim.tickCount).toBe(0)
  })

  it('cancela execução de forma idempotente e permite reset explícito', () => {
    const sim = new Simulator(andCircuit)
    sim.cancel()
    sim.cancel()

    expect(() => sim.tick()).toThrow('execução do simulador foi cancelada')
    expect(sim.tickCount).toBe(0)

    sim.reset()
    sim.tick()
    expect(sim.tickCount).toBe(1)
  })

  it('respeita AbortSignal antes de executar e não consome budget', () => {
    const controller = new AbortController()
    controller.abort()
    const sim = new Simulator(andCircuit, { signal: controller.signal })

    expect(() => sim.tick()).toThrow('execução do simulador foi abortada')
    expect(sim.tickCount).toBe(0)
    expect(sim.operationCount).toBe(0)
  })

  it('encerra e limpa o runtime de forma idempotente', () => {
    const sim = new Simulator(andCircuit)
    expect(sim.nodeCount).toBe(4)

    sim.shutdown()
    sim.shutdown()

    expect(sim.nodeCount).toBe(0)
    expect(() => sim.tick()).toThrow('simulador já foi encerrado')
    expect(() => sim.read('out')).toThrow('simulador já foi encerrado')
  })

  it('limita o orçamento total de tiques e rejeita contagens inválidas', () => {
    const sim = new Simulator(andCircuit, { maxTotalTicks: 3 })
    sim.tick(3)
    expect(sim.tickCount).toBe(3)
    expect(() => sim.tick()).toThrow('orçamento total')
    expect(() => sim.tick(-1)).toThrow('quantidade de tiques')
    expect(() => sim.tick(1.5)).toThrow('quantidade de tiques')
    expect(() => sim.tick(Number.POSITIVE_INFINITY)).toThrow('quantidade de tiques')
    expect(() => new Simulator(andCircuit, { maxTotalTicks: 0 })).toThrow('orçamento total')
    expect(() => new Simulator(andCircuit, { maxTotalTicks: MAX_TOTAL_TICKS + 1 })).toThrow('orçamento total')
  })

  it('rejeita restoreState acima do orçamento sem mutar o runtime', () => {
    const source = new Simulator(andCircuit, { maxTotalTicks: 2 })
    source.setInput('a', true)
    source.tick(2)

    const target = new Simulator(andCircuit, { maxTotalTicks: 1 })
    expect(() => target.restoreState(source.exportState())).toThrow('excede o orçamento total')
    expect(target.tickCount).toBe(0)
    expect(target.read('a')).toBe(false)
  })

  it('trata entrada solta como falso', () => {
    const sim = new Simulator({
      components: [{ id: 'g', type: 'and', inputs: [] }],
    })
    sim.settle()
    expect(sim.read('g')).toBe(false)
  })

  it('concorda com o avaliador de expressões em todas as linhas', () => {
    const cases = [
      '(A AND B) OR NOT C',
      'A XOR B XOR C',
      'A -> B',
      'A <-> B',
      '(A NAND B) NOR (C XNOR D)',
      'NOT (A OR B) AND (C -> D)',
    ]

    for (const source of cases) {
      const ast = parse(source)
      const variables = collectVariables(ast)
      const { netlist, inputs, outputId } = netlistFromAst(ast)
      const sim = new Simulator(netlist)

      for (let row = 0; row < 2 ** variables.length; row += 1) {
        const assignment = assignmentForRow(variables, row)
        for (const name of variables) sim.setInput(inputs[name], assignment[name])
        expect(sim.settle(), `${source} linha ${row}`).toBe(true)
        expect(sim.read(outputId), `${source} linha ${row}`).toBe(
          evaluate(ast, assignment),
        )
      }
    }
  })
})

describe('clock', () => {
  it('alterna no período configurado', () => {
    const sim = new Simulator({
      components: [{ id: 'clk', type: 'clock', options: { period: 2 } }],
    })

    const levels: boolean[] = []
    for (let index = 0; index < 8; index += 1) {
      sim.tick()
      levels.push(sim.read('clk'))
    }
    expect(levels).toEqual([false, true, true, false, false, true, true, false])
  })

  it('nunca estabiliza, e o settle desiste em vez de travar', () => {
    const sim = new Simulator({
      components: [{ id: 'clk', type: 'clock', options: { period: 1 } }],
    })
    expect(sim.settle(20)).toBe(false)
    expect(sim.tickCount).toBe(20)
  })
})

describe('memória', () => {
  it('trava o valor do flip-flop D na borda de subida', () => {
    const sim = new Simulator({
      components: [
        { id: 'd', type: 'input' },
        { id: 'clk', type: 'input' },
        { id: 'ff', type: 'dff', inputs: [{ node: 'd' }, { node: 'clk' }] },
      ],
    })

    sim.setInput('d', true)
    sim.tick()
    // Sem borda de subida o flip-flop ignora a entrada.
    expect(sim.read('ff')).toBe(false)

    sim.setInput('clk', true)
    sim.tick()
    expect(sim.read('ff')).toBe(true)
    expect(sim.read('ff', 1)).toBe(false)

    // Enquanto o clock fica em alto, mudar D não muda nada.
    sim.setInput('d', false)
    sim.tick(3)
    expect(sim.read('ff')).toBe(true)

    // Só na próxima subida ele captura o novo valor.
    sim.setInput('clk', false)
    sim.tick()
    sim.setInput('clk', true)
    sim.tick()
    expect(sim.read('ff')).toBe(false)
  })

  it('monta um contador ligando a saída invertida na entrada', () => {
    const sim = new Simulator({
      components: [
        { id: 'clk', type: 'input' },
        // D vem de Q̄: a cada subida o flip-flop troca de estado.
        { id: 'ff', type: 'dff', inputs: [{ node: 'ff', port: 1 }, { node: 'clk' }] },
      ],
    })

    const pulse = () => {
      sim.setInput('clk', true)
      sim.tick()
      sim.setInput('clk', false)
      sim.tick()
    }

    expect(sim.read('ff')).toBe(false)
    pulse()
    expect(sim.read('ff')).toBe(true)
    pulse()
    expect(sim.read('ff')).toBe(false)
    pulse()
    expect(sim.read('ff')).toBe(true)
  })

  it('faz o flip-flop T alternar só quando T está ligado', () => {
    const sim = new Simulator({
      components: [
        { id: 't', type: 'input' },
        { id: 'clk', type: 'input' },
        { id: 'ff', type: 'tff', inputs: [{ node: 't' }, { node: 'clk' }] },
      ],
    })

    const pulse = () => {
      sim.setInput('clk', true)
      sim.tick()
      sim.setInput('clk', false)
      sim.tick()
    }

    sim.setInput('t', false)
    pulse()
    expect(sim.read('ff')).toBe(false)

    sim.setInput('t', true)
    pulse()
    expect(sim.read('ff')).toBe(true)
    pulse()
    expect(sim.read('ff')).toBe(false)
  })

  it('implementa a tabela de transição do flip-flop JK na borda de subida', () => {
    const sim = new Simulator({
      components: [
        { id: 'j', type: 'input' },
        { id: 'k', type: 'input' },
        { id: 'clk', type: 'input' },
        { id: 'ff', type: 'jk', inputs: [{ node: 'j' }, { node: 'k' }, { node: 'clk' }] },
      ],
    })

    const pulse = () => {
      sim.setInput('clk', true)
      sim.tick()
      sim.setInput('clk', false)
      sim.tick()
    }

    const setInputs = (j: boolean, k: boolean) => {
      sim.setInput('j', j)
      sim.setInput('k', k)
    }

    setInputs(false, false)
    pulse()
    expect(sim.read('ff')).toBe(false)

    setInputs(true, false)
    pulse()
    expect(sim.read('ff')).toBe(true)
    expect(sim.read('ff', 1)).toBe(false)

    setInputs(false, false)
    pulse()
    expect(sim.read('ff')).toBe(true)

    setInputs(false, true)
    pulse()
    expect(sim.read('ff')).toBe(false)

    setInputs(true, true)
    pulse()
    expect(sim.read('ff')).toBe(true)
    pulse()
    expect(sim.read('ff')).toBe(false)
  })

  it('implementa set, reset e hold do flip-flop SR com S=R=1 determinístico', () => {
    const sim = new Simulator({
      components: [
        { id: 's', type: 'input' },
        { id: 'r', type: 'input' },
        { id: 'clk', type: 'input' },
        { id: 'ff', type: 'sr', inputs: [{ node: 's' }, { node: 'r' }, { node: 'clk' }] },
      ],
    })

    const pulse = () => {
      sim.setInput('clk', true)
      sim.tick()
      sim.setInput('clk', false)
      sim.tick()
    }

    sim.setInput('s', true)
    sim.setInput('r', false)
    pulse()
    expect(sim.read('ff')).toBe(true)
    expect(sim.read('ff', 1)).toBe(false)

    sim.setInput('s', false)
    sim.setInput('r', false)
    pulse()
    expect(sim.read('ff')).toBe(true)

    sim.setInput('s', true)
    sim.setInput('r', true)
    pulse()
    expect(sim.read('ff')).toBe(true)
    expect(sim.read('ff', 1)).toBe(false)

    sim.setInput('s', false)
    sim.setInput('r', true)
    pulse()
    expect(sim.read('ff')).toBe(false)
    expect(sim.read('ff', 1)).toBe(true)

    sim.setInput('s', true)
    sim.setInput('r', true)
    pulse()
    expect(sim.read('ff')).toBe(false)
    expect(sim.read('ff', 1)).toBe(true)
  })

  it('segura o estado num latch SR feito de portas NOR', () => {
    const sim = new Simulator({
      components: [
        { id: 's', type: 'input' },
        { id: 'r', type: 'input' },
        { id: 'q', type: 'nor', inputs: [{ node: 'r' }, { node: 'nq' }] },
        { id: 'nq', type: 'nor', inputs: [{ node: 's' }, { node: 'q' }] },
      ],
    })

    sim.setInput('s', true)
    sim.settle()
    expect(sim.read('q')).toBe(true)

    // Tirando o set, o latch continua lembrando.
    sim.setInput('s', false)
    sim.settle()
    expect(sim.read('q')).toBe(true)

    sim.setInput('r', true)
    sim.settle()
    expect(sim.read('q')).toBe(false)

    sim.setInput('r', false)
    sim.settle()
    expect(sim.read('q')).toBe(false)
  })
})

describe('atraso', () => {
  it('segura o sinal pelo número de tiques configurado', () => {
    const sim = new Simulator({
      components: [
        { id: 'a', type: 'input' },
        { id: 'd', type: 'delay', inputs: [{ node: 'a' }], options: { ticks: 3 } },
      ],
    })

    sim.setInput('a', true)
    sim.tick()
    expect(sim.read('d')).toBe(false)
    sim.tick()
    expect(sim.read('d')).toBe(false)
    sim.tick()
    expect(sim.read('d')).toBe(true)
  })
})

describe('reset', () => {
  it('volta tudo ao instante zero', () => {
    const sim = new Simulator({
      components: [
        { id: 'clk', type: 'clock', options: { period: 1 } },
        { id: 'ff', type: 'dff', inputs: [{ node: 'ff', port: 1 }, { node: 'clk' }] },
      ],
    })

    sim.tick(10)
    sim.reset()
    expect(sim.tickCount).toBe(0)
    expect(sim.read('clk')).toBe(false)
    expect(sim.read('ff')).toBe(false)
    expect(sim.read('ff', 1)).toBe(true)
  })
})

describe('atraso de um tique', () => {
  it('se comporta como um buffer simples', () => {
    const sim = new Simulator({
      components: [
        { id: 'a', type: 'input' },
        { id: 'd', type: 'delay', inputs: [{ node: 'a' }], options: { ticks: 1 } },
        { id: 'n', type: 'not', inputs: [{ node: 'a' }] },
      ],
    })

    sim.setInput('a', true)
    sim.tick()
    // Mesma latência de uma porta NOT.
    expect(sim.read('d')).toBe(true)
    expect(sim.read('n')).toBe(false)
  })
})
