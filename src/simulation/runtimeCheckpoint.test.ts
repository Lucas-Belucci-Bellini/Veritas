import { describe, expect, it } from 'vitest'
import { createDocumentRuntime } from './documentRuntime'
import {
  clearRuntimeCheckpoint,
  readRuntimeCheckpoint,
  runtimeDocumentKey,
  writeRuntimeCheckpoint,
  type CheckpointStorage,
} from './runtimeCheckpoint'
import { Simulator } from './simulator'

class MemoryStorage implements CheckpointStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

describe('estado persistente do Simulator', () => {
  it('restaura um DFF no mesmo instante e continua a sequência', () => {
    const netlist = {
      components: [
        { id: 'd', type: 'input' as const },
        { id: 'clk', type: 'input' as const },
        { id: 'ff', type: 'dff' as const, inputs: [{ node: 'd' }, { node: 'clk' }] },
      ],
    }
    const original = new Simulator(netlist)
    original.setInput('d', true)
    original.setInput('clk', true)
    original.tick()

    const restored = new Simulator(netlist)
    restored.restoreState(original.exportState())
    expect(restored.tickCount).toBe(original.tickCount)
    expect(restored.snapshot()).toEqual(original.snapshot())

    restored.setInput('clk', false)
    restored.tick()
    restored.setInput('clk', true)
    restored.tick()
    expect(restored.read('ff')).toBe(true)
  })

  it('rejeita estado de outro netlist', () => {
    const source = new Simulator({ components: [{ id: 'a', type: 'input' }] })
    const target = new Simulator({ components: [{ id: 'b', type: 'input' }] })

    expect(() => target.restoreState(source.exportState())).toThrow(/não corresponde/)
  })
})

describe('runtimeCheckpoint', () => {
  it('persiste e lê um checkpoint limitado ao documento', () => {
    const storage = new MemoryStorage()
    const document = {
      format: 'veritas-circuit',
      version: 1,
      nodes: [{ id: 'd', type: 'input' }],
      connections: [],
    }
    const key = runtimeDocumentKey(document)
    const simulator = createDocumentRuntime(document as never)
    const snapshot = { tick: 0, values: simulator.snapshot() }

    expect(writeRuntimeCheckpoint({
      version: 1,
      documentKey: key,
      savedAt: new Date(0).toISOString(),
      inputs: { d: true },
      simulator: simulator.exportState(),
      timeline: [snapshot],
    }, storage)).toBe(true)
    expect(readRuntimeCheckpoint(key, storage)).toEqual(expect.objectContaining({
      documentKey: key,
      inputs: { d: true },
      timeline: [snapshot],
    }))

    clearRuntimeCheckpoint(key, storage)
    expect(readRuntimeCheckpoint(key, storage)).toBeNull()
  })

  it('ignora payload corrompido sem interromper o fluxo local', () => {
    const storage = new MemoryStorage()
    const document = { format: 'veritas-circuit', version: 1, nodes: [], connections: [] }
    const key = runtimeDocumentKey(document)
    storage.setItem(key, '{not-json')

    expect(readRuntimeCheckpoint(key, storage)).toBeNull()
  })
})
