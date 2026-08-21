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
