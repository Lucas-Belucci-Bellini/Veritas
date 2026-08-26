import { describe, expect, it } from 'vitest'
import {
  applySequentialInputs,
  createSequentialSimulator,
  getSequentialDemo,
  outputValue,
  pulseClock,
  snapshotSequentialSimulator,
} from './workspace'

describe('workspace sequencial', () => {
  it('expõe demos com contratos de controle explícitos', () => {
    expect(getSequentialDemo('dff-clock').controlMode).toBe('auto-clock')
    expect(getSequentialDemo('delay').controlMode).toBe('manual-input')
    expect(getSequentialDemo('feedback-counter').controlMode).toBe('manual-clock')
  })

  it('expõe demos JK/SR com controles e watches observáveis', () => {
    expect(getSequentialDemo('jk-clock')).toMatchObject({
      controlMode: 'auto-clock',
      controls: ['j', 'k'],
      initialInputs: { j: false, k: false },
      watch: expect.arrayContaining([
        { nodeId: 'ff', label: 'Q' },
        { nodeId: 'ff', label: 'Q̄', port: 1 },
      ]),
    })
    expect(getSequentialDemo('sr-clock')).toMatchObject({
      controlMode: 'auto-clock',
      controls: ['s', 'r'],
      initialInputs: { s: false, r: false },
    })
  })

  it('executa hold, set, reset e toggle na demo JK', () => {
    const simulator = createSequentialSimulator('jk-clock')

    simulator.setInput('j', true)
    simulator.setInput('k', false)
    simulator.tick(2)
    expect(simulator.read('ff')).toBe(true)

    simulator.setInput('j', false)
    simulator.setInput('k', true)
    simulator.tick(2)
    expect(simulator.read('ff')).toBe(false)

    simulator.setInput('j', true)
    simulator.setInput('k', true)
    simulator.tick(2)
    expect(simulator.read('ff')).toBe(true)
    simulator.tick(2)
    expect(simulator.read('ff')).toBe(false)
  })

  it('executa set, hold e reset na demo SR', () => {
    const simulator = createSequentialSimulator('sr-clock')

    simulator.setInput('s', true)
    simulator.setInput('r', false)
    simulator.tick(2)
    expect(simulator.read('ff')).toBe(true)

    simulator.setInput('s', false)
    simulator.setInput('r', false)
    simulator.tick(2)
    expect(simulator.read('ff')).toBe(true)

    simulator.setInput('s', false)
    simulator.setInput('r', true)
    simulator.tick(2)
    expect(simulator.read('ff')).toBe(false)
  })

  it('expõe e executa o registrador paralelo de 4 bits', () => {
    const simulator = createSequentialSimulator('register-4bit')
    const demo = getSequentialDemo('register-4bit')

    expect(demo.controls).toEqual(['d0', 'd1', 'd2', 'd3'])
    expect(demo.watch.map((watch) => watch.label)).toEqual(['D0', 'D1', 'D2', 'D3', 'CLK', 'Q0', 'Q1', 'Q2', 'Q3'])

    simulator.setInput('d0', true)
    simulator.setInput('d1', false)
    simulator.setInput('d2', true)
    simulator.setInput('d3', true)
    simulator.tick(2)
    expect(['ff0', 'ff1', 'ff2', 'ff3'].map((id) => simulator.read(id))).toEqual([true, false, true, true])

    simulator.setInput('d0', false)
    simulator.setInput('d1', true)
    simulator.setInput('d2', false)
    simulator.setInput('d3', false)
    simulator.tick()
    expect(['ff0', 'ff1', 'ff2', 'ff3'].map((id) => simulator.read(id))).toEqual([true, false, true, true])
    simulator.tick()
    expect(['ff0', 'ff1', 'ff2', 'ff3'].map((id) => simulator.read(id))).toEqual([false, true, false, false])
  })

  it('captura D na borda de subida do clock automático', () => {
    const simulator = createSequentialSimulator('dff-clock')
    simulator.setInput('d', true)

    simulator.tick()
    expect(simulator.read('ff')).toBe(false)

    simulator.tick()
    expect(simulator.read('ff')).toBe(true)
    expect(simulator.read('ff', 1)).toBe(false)
  })

  it('alterna T a cada borda de subida', () => {
    const simulator = createSequentialSimulator('tff-clock')

    simulator.tick()
    expect(simulator.read('ff')).toBe(false)
    simulator.tick()
    expect(simulator.read('ff')).toBe(true)
    simulator.tick(2)
    expect(simulator.read('ff')).toBe(false)
  })

  it('mantém o sinal na fila durante o atraso configurado', () => {
    const simulator = createSequentialSimulator('delay')
    simulator.setInput('signal', true)

    simulator.tick()
    expect(simulator.read('out')).toBe(false)
    simulator.tick()
    expect(simulator.read('out')).toBe(false)
    simulator.tick()
    expect(simulator.read('out')).toBe(false)
    simulator.tick()
    expect(simulator.read('out')).toBe(true)
  })

  it('produz snapshots de alto e baixo para um pulso manual', () => {
    const simulator = createSequentialSimulator('feedback-counter')
    const snapshots = pulseClock(simulator, 'clk')

    expect(snapshots).toHaveLength(2)
    expect(snapshots[0].tick).toBe(1)
    expect(snapshots[1].tick).toBe(2)
    expect(outputValue(snapshots[0], { nodeId: 'ff' })).toBe(true)
    expect(outputValue(snapshots[1], { nodeId: 'ff' })).toBe(true)
  })

  it('alterna o contador de feedback a cada pulso completo', () => {
    const simulator = createSequentialSimulator('feedback-counter')

    pulseClock(simulator, 'clk')
    expect(simulator.read('out')).toBe(true)
    pulseClock(simulator, 'clk')
    expect(simulator.read('out')).toBe(false)
  })

  it('aplica entradas iniciais e serializa um estado observável', () => {
    const simulator = createSequentialSimulator('delay')
    const demo = getSequentialDemo('delay')
    applySequentialInputs(simulator, demo.initialInputs)
    const snapshot = snapshotSequentialSimulator(simulator)

    expect(snapshot.tick).toBe(0)
    expect(snapshot.values.signal).toEqual([false])
  })
})
