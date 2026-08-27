import { describe, expect, it } from 'vitest'
import {
  buildCustomChipDefinition,
  type CircuitDocument,
  type CustomChipLibraryEntry,
} from '../circuit'
import {
  createDocumentRuntime,
  diagnoseDocumentRuntime,
  diagnoseDocumentRuntimePreview,
  documentInputIds,
  preflightDocumentRuntime,
  tickDocumentRuntimeAsync,
  documentWatches,
  runtimeValue,
  snapshotDocumentRuntime,
} from './documentRuntime'

function inverterChip(): CustomChipLibraryEntry {
  const document: CircuitDocument = {
    format: 'veritas-circuit',
    version: 1,
    name: 'Inversor',
    nodes: [
      { id: 'in', type: 'input', position: { x: 0, y: 0 } },
      { id: 'not', type: 'not', position: { x: 100, y: 0 } },
      { id: 'out', type: 'output', position: { x: 200, y: 0 } },
    ],
    connections: [
      { source: { node: 'in' }, target: { node: 'not', port: 0 } },
      { source: { node: 'not' }, target: { node: 'out', port: 0 } },
    ],
  }
  return { id: 1, definition: buildCustomChipDefinition(document, 'Inversor') }
}

function clockDocument(): CircuitDocument {
  return {
    format: 'veritas-circuit',
    version: 1,
    name: 'Clock de diagnóstico',
    nodes: [{ id: 'clk', type: 'clock', position: { x: 0, y: 0 }, options: { period: 1 } }],
    connections: [],
  }
}

function feedbackDocument(): CircuitDocument {
  return {
    format: 'veritas-circuit',
    version: 1,
    name: 'Contador visual',
    nodes: [
      { id: 'clk', type: 'input', position: { x: 0, y: 0 }, options: { initial: false } },
      { id: 'ff', type: 'dff', position: { x: 180, y: 50 } },
      { id: 'out', type: 'output', position: { x: 360, y: 50 } },
    ],
    connections: [
      { source: { node: 'ff', port: 1 }, target: { node: 'ff', port: 0 } },
      { source: { node: 'clk' }, target: { node: 'ff', port: 1 } },
      { source: { node: 'ff' }, target: { node: 'out', port: 0 } },
    ],
  }
}

describe('documentRuntime', () => {
  it('classifica a topologia no preflight sem criar um runtime mutável', () => {
    const report = preflightDocumentRuntime(feedbackDocument())

    expect(report.status).toBe('temporal-feedback')
    expect(report.cycles).toEqual([{ kind: 'temporal-feedback', nodeIds: ['ff'] }])
  })

  it('converte um documento visual e aplica entradas iniciais', () => {
    const document = feedbackDocument()
    const simulator = createDocumentRuntime(document)
    const snapshot = snapshotDocumentRuntime(simulator)

    expect(documentInputIds(document)).toEqual(['clk'])
    expect(snapshot.tick).toBe(0)
    expect(runtimeValue(snapshot, 'ff')).toBe(false)
    expect(documentWatches(document).map((watch) => watch.label)).toEqual(['clk', 'ff · Q', 'ff · Q̄', 'out'])
  })

  it('expõe diagnóstico de estabilização do documento sem duplicar o Simulator', () => {
    const combinational: CircuitDocument = {
      format: 'veritas-circuit',
      version: 1,
      name: 'Diagnóstico combinacional',
      nodes: [
        { id: 'input', type: 'input', position: { x: 0, y: 0 } },
        { id: 'not', type: 'not', position: { x: 120, y: 0 } },
        { id: 'out', type: 'output', position: { x: 240, y: 0 } },
      ],
      connections: [
        { source: { node: 'input' }, target: { node: 'not', port: 0 } },
        { source: { node: 'not' }, target: { node: 'out', port: 0 } },
      ],
    }
    const simulator = createDocumentRuntime(combinational)
    simulator.setInput('input', true)

    expect(diagnoseDocumentRuntime(simulator)).toMatchObject({ status: 'stabilized' })
    expect(simulator.read('out')).toBe(false)
  })

  it('executa tiques assíncronos pelo adaptador de documento e devolve snapshot', async () => {
    const simulator = createDocumentRuntime(feedbackDocument())

    const snapshot = await tickDocumentRuntimeAsync(simulator, 2, { yieldEvery: 1 })

    expect(snapshot.tick).toBe(2)
    expect(snapshot.values.ff).toEqual([false, true])
  })

  it('encaminha o budget de memória e rejeita delays excessivos antes da alocação', () => {
    const document: CircuitDocument = {
      format: 'veritas-circuit',
      version: 1,
      name: 'Memory cross-layer',
      nodes: [
        { id: 'input', type: 'input', position: { x: 0, y: 0 } },
        { id: 'delay', type: 'delay', position: { x: 120, y: 0 }, options: { ticks: 1_000_000 } },
      ],
      connections: [{ source: { node: 'input' }, target: { node: 'delay', port: 0 } }],
    }

    expect(() => createDocumentRuntime(document, { maxMemoryBytes: 1024 * 1024 })).toThrow('orçamento de memória')
  })

  it('encaminha o budget de operações e preserva rollback do documento', () => {
    const document: CircuitDocument = {
      format: 'veritas-circuit',
      version: 1,
      name: 'Budget cross-layer',
      nodes: [
        { id: 'a', type: 'input', position: { x: 0, y: 0 } },
        { id: 'b', type: 'input', position: { x: 0, y: 80 } },
        { id: 'and', type: 'and', position: { x: 160, y: 40 } },
      ],
      connections: [
        { source: { node: 'a' }, target: { node: 'and', port: 0 } },
        { source: { node: 'b' }, target: { node: 'and', port: 1 } },
      ],
    }
    const simulator = createDocumentRuntime(document, { maxOperationsPerTick: 2 })
    simulator.setInput('a', true)
    simulator.setInput('b', true)

    expect(() => simulator.tick()).toThrow('orçamento de 2 operações')
    expect(simulator.tickCount).toBe(0)
    expect(simulator.operationCount).toBe(0)
    expect(simulator.read('and')).toBe(false)
  })

  it('encaminha AbortSignal e encerra o runtime sem reter nós', () => {
    const controller = new AbortController()
    const simulator = createDocumentRuntime(clockDocument(), { signal: controller.signal })
    controller.abort()

    expect(() => simulator.tick()).toThrow('execução do simulador foi abortada')
    simulator.shutdown()
    simulator.shutdown()
    expect(simulator.nodeCount).toBe(0)
  })

  it('detecta ciclo de clock no documento e aplica budget total configurado', () => {
    const simulator = createDocumentRuntime(clockDocument(), { maxTotalTicks: 4 })

    expect(diagnoseDocumentRuntime(simulator, 20)).toMatchObject({
      status: 'cycle-detected',
      cycleStartTick: 0,
      cyclePeriod: 2,
    })
    expect(simulator.tickCount).toBe(2)
    expect(() => simulator.tick(3)).toThrow('orçamento total')
  })

  it('diagnostica em uma cópia e não altera o runtime ativo', () => {
    const document = clockDocument()
    const active = createDocumentRuntime(document)
    const before = active.exportState()

    const preview = diagnoseDocumentRuntimePreview(document, {
      simulatorState: before,
      maxTicks: 1,
    })

    expect(preview.diagnostic).toEqual({ status: 'budget-exhausted', ticksExecuted: 1 })
    expect(preview.snapshot.tick).toBe(1)
    expect(active.exportState()).toEqual(before)
  })

  it('retorna diagnóstico e estado final da cópia para ciclo e estabilidade', () => {
    const stableDocument: CircuitDocument = {
      format: 'veritas-circuit',
      version: 1,
      name: 'Preview combinacional',
      nodes: [
        { id: 'input', type: 'input', position: { x: 0, y: 0 } },
        { id: 'out', type: 'output', position: { x: 120, y: 0 } },
      ],
      connections: [{ source: { node: 'input' }, target: { node: 'out', port: 0 } }],
    }

    const stable = diagnoseDocumentRuntimePreview(stableDocument, {
      inputs: { input: true },
    })
    const cycle = diagnoseDocumentRuntimePreview(clockDocument(), { maxTicks: 8 })

    expect(stable.diagnostic.status).toBe('stabilized')
    expect(stable.snapshot.values.out?.[0]).toBe(true)
    expect(stable.simulatorState.tickCount).toBe(stable.snapshot.tick)
    expect(cycle.diagnostic).toMatchObject({ status: 'cycle-detected', cyclePeriod: 2 })
    expect(cycle.simulatorState.tickCount).toBe(2)
  })

  it('rejeita budget de preview inválido antes de executar', () => {
    expect(() => diagnoseDocumentRuntimePreview(clockDocument(), { maxTicks: -1 })).toThrow(RangeError)
    expect(() => diagnoseDocumentRuntimePreview(clockDocument(), { maxSettleTicks: 10.5 })).toThrow(RangeError)
  })

  it('expõe Q e Q̄ de JK/SR nos watches do documento', () => {
    const document: CircuitDocument = {
      format: 'veritas-circuit',
      version: 1,
      name: 'Watches sequenciais',
      nodes: [
        { id: 'jk', type: 'jk', position: { x: 0, y: 0 } },
        { id: 'sr', type: 'sr', position: { x: 180, y: 0 }, label: 'Memória SR' },
      ],
      connections: [],
    }

    expect(documentWatches(document).map((watch) => watch.label)).toEqual([
      'jk · Q',
      'jk · Q̄',
      'Memória SR · Q',
      'Memória SR · Q̄',
    ])
  })

  it('propaga sinal wireless sem estado extra no runtime', () => {
    const document: CircuitDocument = {
      format: 'veritas-circuit',
      version: 1,
      name: 'Wireless runtime',
      nodes: [
        { id: 'input', type: 'input', position: { x: 0, y: 0 } },
        { id: 'tx', type: 'transmitter', position: { x: 120, y: 0 }, options: { channel: 'bus-a' } },
        { id: 'rx', type: 'receiver', position: { x: 240, y: 0 }, options: { channel: 'bus-a' } },
        { id: 'out', type: 'output', position: { x: 360, y: 0 } },
      ],
      connections: [
        { source: { node: 'input' }, target: { node: 'tx', port: 0 } },
        { source: { node: 'rx' }, target: { node: 'out', port: 0 } },
      ],
    }
    const simulator = createDocumentRuntime(document)

    simulator.setInput('input', true)
    simulator.tick(3)

    expect(simulator.read('tx')).toBe(true)
    expect(simulator.read('rx')).toBe(true)
    expect(simulator.read('out')).toBe(true)
  })

  it('expande chip customizado antes de simular um caminho temporal', () => {
    const document: CircuitDocument = {
      format: 'veritas-circuit',
      version: 1,
      name: 'DFF com inversor',
      nodes: [
        { id: 'd', type: 'input', position: { x: 0, y: 0 } },
        { id: 'clk', type: 'input', position: { x: 0, y: 100 } },
        { id: 'chip', type: 'custom-chip', position: { x: 150, y: 0 }, options: { customChipId: 1 } },
        { id: 'ff', type: 'dff', position: { x: 350, y: 0 } },
        { id: 'out', type: 'output', position: { x: 500, y: 0 } },
      ],
      connections: [
        { source: { node: 'd' }, target: { node: 'chip', port: 0 } },
        { source: { node: 'chip' }, target: { node: 'ff', port: 0 } },
        { source: { node: 'clk' }, target: { node: 'ff', port: 1 } },
        { source: { node: 'ff' }, target: { node: 'out', port: 0 } },
      ],
    }
    const simulator = createDocumentRuntime(document, { customChips: [inverterChip()] })

    simulator.setInput('d', false)
    simulator.setInput('clk', false)
    simulator.tick(2)
    simulator.setInput('clk', true)
    simulator.tick()
    simulator.tick()

    const snapshot = snapshotDocumentRuntime(simulator, document, [inverterChip()])
    expect(simulator.read('out')).toBe(true)
    expect(runtimeValue(snapshot, 'chip')).toBe(true)
  })

  it('mantém a realimentação e atualiza Q no pulso de clock', () => {
    const simulator = createDocumentRuntime(feedbackDocument())

    simulator.setInput('clk', true)
    simulator.tick()
    expect(simulator.read('ff')).toBe(true)
    expect(simulator.read('out')).toBe(false)
    simulator.tick()
    expect(simulator.read('out')).toBe(true)

    simulator.setInput('clk', false)
    simulator.tick()
    simulator.setInput('clk', true)
    simulator.tick()
    expect(simulator.read('ff')).toBe(false)
  })
})


describe('configuração temporal do documento', () => {
  it('aplica override de período ao runtime sem alterar o documento', () => {
    const document: CircuitDocument = {
      format: 'veritas-circuit',
      version: 1,
      name: 'Clock configurável',
      nodes: [{ id: 'clk', type: 'clock', position: { x: 0, y: 0 }, options: { period: 1 } }],
      connections: [],
    }
    const simulator = createDocumentRuntime(document, { clockPeriods: { clk: 4 } })

    simulator.tick(3)
    expect(simulator.read('clk')).toBe(false)
    simulator.tick()
    expect(simulator.read('clk')).toBe(true)
    expect(document.nodes[0].options?.period).toBe(1)
  })
})
