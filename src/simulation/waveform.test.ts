import { describe, expect, it } from 'vitest'
import type { SequentialSnapshot, SequentialWatch } from './workspace'
import { buildWaveform, compressWaveform } from './waveform'

const watches: readonly SequentialWatch[] = [
  { nodeId: 'clk', label: 'CLK' },
  { nodeId: 'ff', label: 'Q' },
  { nodeId: 'ff', label: 'Q̄', port: 1 },
]

const timeline: readonly SequentialSnapshot[] = [
  { tick: 0, values: { clk: [false], ff: [false, true] } },
  { tick: 1, values: { clk: [true], ff: [true, false] } },
  { tick: 2, values: { clk: [false], ff: [true, false] } },
  { tick: 3, values: { clk: [true], ff: [false, true] } },
]

describe('waveform sequencial', () => {
  it('projeta a timeline na ordem dos watches sem alterar os snapshots', () => {
    const result = buildWaveform(watches, timeline)

    expect(result.map((track) => track.label)).toEqual(['CLK', 'Q', 'Q̄'])
    expect(result[0]?.samples).toEqual([
      { tick: 0, value: false },
      { tick: 1, value: true },
      { tick: 2, value: false },
      { tick: 3, value: true },
    ])
    expect(result[1]?.samples.map((sample) => sample.value)).toEqual([false, true, true, false])
    expect(result[2]?.samples.map((sample) => sample.value)).toEqual([true, false, false, true])
    expect(timeline[0]?.values.ff).toEqual([false, true])
  })

  it('preserva amostras vazias e comprime apenas mudanças de nível', () => {
    expect(buildWaveform([{ nodeId: 'missing', label: 'MISSING' }], []).at(0)?.samples).toEqual([])
    expect(compressWaveform([])).toEqual([])
    expect(compressWaveform([{ tick: 4, value: true }])).toEqual([{ tick: 4, value: true }])
    expect(compressWaveform([
      { tick: 0, value: false },
      { tick: 1, value: false },
      { tick: 2, value: true },
      { tick: 3, value: true },
      { tick: 4, value: false },
    ])).toEqual([
      { tick: 0, value: false },
      { tick: 2, value: true },
      { tick: 4, value: false },
    ])
  })
})
