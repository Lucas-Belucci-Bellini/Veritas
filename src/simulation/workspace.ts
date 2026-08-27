import { Simulator, type SimulatorAsyncOptions } from './simulator'
import type { Netlist } from './components'

export type SequentialDemoId = 'dff-clock' | 'tff-clock' | 'jk-clock' | 'sr-clock' | 'register-4bit' | 'counter-4bit' | 'delay' | 'feedback-counter'
export type SequentialControlMode = 'auto-clock' | 'manual-input' | 'manual-clock'

export interface SequentialWatch {
  nodeId: string
  label: string
  port?: number
}

export interface SequentialDemo {
  id: SequentialDemoId
  title: string
  description: string
  controlMode: SequentialControlMode
  controls: readonly string[]
  initialInputs: Readonly<Record<string, boolean>>
  watch: readonly SequentialWatch[]
  /** Tiques baixos adicionais para acomodar lógica combinacional após um pulso. */
  clockSettleTicks?: number
  netlist: Netlist
}

export interface SequentialSnapshot {
  tick: number
  values: Record<string, boolean[]>
}

const DFF_CLOCK: SequentialDemo = {
  id: 'dff-clock',
  title: 'Flip-flop D com clock',
  description: 'O D é capturado somente na borda de subida do clock automático.',
  controlMode: 'auto-clock',
  controls: ['d'],
  initialInputs: { d: false },
  watch: [
    { nodeId: 'd', label: 'D' },
    { nodeId: 'clk', label: 'CLK' },
    { nodeId: 'ff', label: 'Q' },
    { nodeId: 'ff', label: 'Q̄', port: 1 },
  ],
  netlist: {
    components: [
      { id: 'd', type: 'input' },
      { id: 'clk', type: 'clock', options: { period: 1 } },
      { id: 'ff', type: 'dff', inputs: [{ node: 'd' }, { node: 'clk' }] },
      { id: 'qout', type: 'output', inputs: [{ node: 'ff' }] },
    ],
  },
}

const TFF_CLOCK: SequentialDemo = {
  id: 'tff-clock',
  title: 'Flip-flop T com clock',
  description: 'O T permanece ligado e alterna Q a cada borda de subida.',
  controlMode: 'auto-clock',
  controls: [],
  initialInputs: {},
  watch: [
    { nodeId: 't', label: 'T' },
    { nodeId: 'clk', label: 'CLK' },
    { nodeId: 'ff', label: 'Q' },
    { nodeId: 'ff', label: 'Q̄', port: 1 },
  ],
  netlist: {
    components: [
      { id: 't', type: 'constant', options: { value: true } },
      { id: 'clk', type: 'clock', options: { period: 1 } },
      { id: 'ff', type: 'tff', inputs: [{ node: 't' }, { node: 'clk' }] },
      { id: 'qout', type: 'output', inputs: [{ node: 'ff' }] },
    ],
  },
}

const JK_CLOCK: SequentialDemo = {
  id: 'jk-clock',
  title: 'Flip-flop JK com clock',
  description: 'J e K são amostrados na borda de subida: hold, set, reset ou toggle.',
  controlMode: 'auto-clock',
  controls: ['j', 'k'],
  initialInputs: { j: false, k: false },
  watch: [
    { nodeId: 'j', label: 'J' },
    { nodeId: 'k', label: 'K' },
    { nodeId: 'clk', label: 'CLK' },
    { nodeId: 'ff', label: 'Q' },
    { nodeId: 'ff', label: 'Q̄', port: 1 },
  ],
  netlist: {
    components: [
      { id: 'j', type: 'input' },
      { id: 'k', type: 'input' },
      { id: 'clk', type: 'clock', options: { period: 1 } },
      { id: 'ff', type: 'jk', inputs: [{ node: 'j' }, { node: 'k' }, { node: 'clk' }] },
      { id: 'qout', type: 'output', inputs: [{ node: 'ff' }] },
    ],
  },
}

const SR_CLOCK: SequentialDemo = {
  id: 'sr-clock',
  title: 'Flip-flop SR com clock',
  description: 'S e R são amostrados na borda de subida; S=R=1 preserva o estado de forma determinística.',
  controlMode: 'auto-clock',
  controls: ['s', 'r'],
  initialInputs: { s: false, r: false },
  watch: [
    { nodeId: 's', label: 'S' },
    { nodeId: 'r', label: 'R' },
    { nodeId: 'clk', label: 'CLK' },
    { nodeId: 'ff', label: 'Q' },
    { nodeId: 'ff', label: 'Q̄', port: 1 },
  ],
  netlist: {
    components: [
      { id: 's', type: 'input' },
      { id: 'r', type: 'input' },
      { id: 'clk', type: 'clock', options: { period: 1 } },
      { id: 'ff', type: 'sr', inputs: [{ node: 's' }, { node: 'r' }, { node: 'clk' }] },
      { id: 'qout', type: 'output', inputs: [{ node: 'ff' }] },
    ],
  },
}

const REGISTER_4BIT: SequentialDemo = {
  id: 'register-4bit',
  title: 'Registrador paralelo de 4 bits',
  description: 'Os quatro bits de entrada são capturados juntos na borda de subida do clock.',
  controlMode: 'auto-clock',
  controls: ['d0', 'd1', 'd2', 'd3'],
  initialInputs: { d0: false, d1: false, d2: false, d3: false },
  watch: [
    { nodeId: 'd0', label: 'D0' },
    { nodeId: 'd1', label: 'D1' },
    { nodeId: 'd2', label: 'D2' },
    { nodeId: 'd3', label: 'D3' },
    { nodeId: 'clk', label: 'CLK' },
    { nodeId: 'ff0', label: 'Q0' },
    { nodeId: 'ff1', label: 'Q1' },
    { nodeId: 'ff2', label: 'Q2' },
    { nodeId: 'ff3', label: 'Q3' },
  ],
  netlist: {
    components: [
      { id: 'd0', type: 'input' },
      { id: 'd1', type: 'input' },
      { id: 'd2', type: 'input' },
      { id: 'd3', type: 'input' },
      { id: 'clk', type: 'clock', options: { period: 1 } },
      { id: 'ff0', type: 'dff', inputs: [{ node: 'd0' }, { node: 'clk' }] },
      { id: 'ff1', type: 'dff', inputs: [{ node: 'd1' }, { node: 'clk' }] },
      { id: 'ff2', type: 'dff', inputs: [{ node: 'd2' }, { node: 'clk' }] },
      { id: 'ff3', type: 'dff', inputs: [{ node: 'd3' }, { node: 'clk' }] },
      { id: 'qout0', type: 'output', inputs: [{ node: 'ff0' }] },
      { id: 'qout1', type: 'output', inputs: [{ node: 'ff1' }] },
      { id: 'qout2', type: 'output', inputs: [{ node: 'ff2' }] },
      { id: 'qout3', type: 'output', inputs: [{ node: 'ff3' }] },
    ],
  },
}

const COUNTER_4BIT: SequentialDemo = {
  id: 'counter-4bit',
  title: 'Contador síncrono de 4 bits',
  description: 'Cada pulso de clock incrementa o contador de 0000 a 1111.',
  controlMode: 'manual-clock',
  controls: ['clk'],
  initialInputs: { clk: false },
  clockSettleTicks: 2,
  watch: [
    { nodeId: 'clk', label: 'CLK' },
    { nodeId: 'ff0', label: 'Q0 · LSB' },
    { nodeId: 'ff1', label: 'Q1' },
    { nodeId: 'ff2', label: 'Q2' },
    { nodeId: 'ff3', label: 'Q3 · MSB' },
  ],
  netlist: {
    components: [
      { id: 'one', type: 'constant', options: { value: true } },
      { id: 'clk', type: 'input' },
      { id: 'carry1', type: 'and', inputs: [{ node: 'ff0' }, { node: 'one' }] },
      { id: 'carry2', type: 'and', inputs: [{ node: 'ff0' }, { node: 'ff1' }] },
      { id: 'carry3a', type: 'and', inputs: [{ node: 'ff0' }, { node: 'ff1' }] },
      { id: 'carry3', type: 'and', inputs: [{ node: 'carry3a' }, { node: 'ff2' }] },
      { id: 'ff0', type: 'tff', inputs: [{ node: 'one' }, { node: 'clk' }] },
      { id: 'ff1', type: 'tff', inputs: [{ node: 'carry1' }, { node: 'clk' }] },
      { id: 'ff2', type: 'tff', inputs: [{ node: 'carry2' }, { node: 'clk' }] },
      { id: 'ff3', type: 'tff', inputs: [{ node: 'carry3' }, { node: 'clk' }] },
      { id: 'qout0', type: 'output', inputs: [{ node: 'ff0' }] },
      { id: 'qout1', type: 'output', inputs: [{ node: 'ff1' }] },
      { id: 'qout2', type: 'output', inputs: [{ node: 'ff2' }] },
      { id: 'qout3', type: 'output', inputs: [{ node: 'ff3' }] },
    ],
  },
}

const DELAY: SequentialDemo = {
  id: 'delay',
  title: 'Atraso de propagação',
  description: 'O sinal de entrada aparece na saída depois de três tiques.',
  controlMode: 'manual-input',
  controls: ['signal'],
  initialInputs: { signal: false },
  watch: [
    { nodeId: 'signal', label: 'IN' },
    { nodeId: 'delay', label: 'DELAY' },
    { nodeId: 'out', label: 'OUT' },
  ],
  netlist: {
    components: [
      { id: 'signal', type: 'input' },
      { id: 'delay', type: 'delay', options: { ticks: 3 }, inputs: [{ node: 'signal' }] },
      { id: 'out', type: 'output', inputs: [{ node: 'delay' }] },
    ],
  },
}

const FEEDBACK_COUNTER: SequentialDemo = {
  id: 'feedback-counter',
  title: 'Contador de 1 bit com feedback',
  description: 'Q̄ volta para D; cada pulso completo de clock alterna o estado armazenado.',
  controlMode: 'manual-clock',
  controls: ['clk'],
  initialInputs: { clk: false },
  watch: [
    { nodeId: 'clk', label: 'CLK' },
    { nodeId: 'ff', label: 'Q' },
    { nodeId: 'ff', label: 'Q̄', port: 1 },
    { nodeId: 'out', label: 'OUT' },
  ],
  netlist: {
    components: [
      { id: 'clk', type: 'input' },
      { id: 'ff', type: 'dff', inputs: [{ node: 'ff', port: 1 }, { node: 'clk' }] },
      { id: 'out', type: 'output', inputs: [{ node: 'ff' }] },
    ],
  },
}

export const SEQUENTIAL_DEMOS: readonly SequentialDemo[] = [
  DFF_CLOCK,
  TFF_CLOCK,
  JK_CLOCK,
  SR_CLOCK,
  REGISTER_4BIT,
  COUNTER_4BIT,
  DELAY,
  FEEDBACK_COUNTER,
]

export function getSequentialDemo(id: SequentialDemoId): SequentialDemo {
  const demo = SEQUENTIAL_DEMOS.find((candidate) => candidate.id === id)
  if (!demo) throw new Error(`Demo sequencial desconhecida: ${id}.`)
  return demo
}

export function createSequentialSimulator(id: SequentialDemoId): Simulator {
  return new Simulator(getSequentialDemo(id).netlist)
}

export function snapshotSequentialSimulator(simulator: Simulator): SequentialSnapshot {
  return {
    tick: simulator.tickCount,
    values: simulator.snapshot(),
  }
}

export function applySequentialInputs(
  simulator: Simulator,
  inputs: Readonly<Record<string, boolean>>,
): void {
  for (const [id, value] of Object.entries(inputs)) simulator.setInput(id, value)
}

export function pulseClock(
  simulator: Simulator,
  inputId: string,
  settleTicks = 0,
): readonly SequentialSnapshot[] {
  const boundedSettleTicks = Math.max(0, Math.floor(settleTicks))
  simulator.setInput(inputId, true)
  simulator.tick()
  const high = snapshotSequentialSimulator(simulator)
  simulator.setInput(inputId, false)
  simulator.tick()
  const low = snapshotSequentialSimulator(simulator)
  const settled: SequentialSnapshot[] = []
  for (let index = 0; index < boundedSettleTicks; index += 1) {
    simulator.tick()
    settled.push(snapshotSequentialSimulator(simulator))
  }
  return [high, low, ...settled]
}

export async function pulseClockAsync(
  simulator: Simulator,
  inputId: string,
  settleTicks = 0,
  options: SimulatorAsyncOptions = {},
): Promise<readonly SequentialSnapshot[]> {
  const boundedSettleTicks = Math.max(0, Math.floor(settleTicks))
  simulator.setInput(inputId, true)
  await simulator.tickAsync(1, options)
  const high = snapshotSequentialSimulator(simulator)
  simulator.setInput(inputId, false)
  await simulator.tickAsync(1, options)
  const low = snapshotSequentialSimulator(simulator)
  const settled: SequentialSnapshot[] = []
  for (let index = 0; index < boundedSettleTicks; index += 1) {
    await simulator.tickAsync(1, options)
    settled.push(snapshotSequentialSimulator(simulator))
  }
  return [high, low, ...settled]
}

export function outputValue(
  snapshot: SequentialSnapshot,
  watch: Pick<SequentialWatch, 'nodeId' | 'port'>,
): boolean {
  return snapshot.values[watch.nodeId]?.[watch.port ?? 0] ?? false
}

export function signalLabel(value: boolean): string {
  return value ? '1' : '0'
}
