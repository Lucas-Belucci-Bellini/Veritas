import { outputCount, type ComponentSpec, type Netlist } from './components'
import {
  DEFAULT_MAX_TOTAL_OPERATIONS,
  DEFAULT_MAX_TOTAL_TICKS,
  MAX_TOTAL_OPERATIONS,
  MAX_TOTAL_TICKS,
  type SimulatorNodeState,
  type SimulatorState,
} from './simulator'

export const SIMULATION_WORKER_CHECKPOINT_KIND = 'veritas.worker-checkpoint' as const
export const SIMULATION_WORKER_CHECKPOINT_VERSION = 1 as const
export const MAX_WORKER_CHECKPOINT_SERIALIZED_BYTES = 500_000

export interface SimulationWorkerCheckpointStateV1 {
  tickCount: number
  operationCount: number
  nodes: Record<string, SimulatorNodeState>
}

export interface SimulationWorkerCheckpointV1 {
  kind: typeof SIMULATION_WORKER_CHECKPOINT_KIND
  checkpointVersion: typeof SIMULATION_WORKER_CHECKPOINT_VERSION
  protocolVersion: 1
  netlistSignature: string
  state: SimulationWorkerCheckpointStateV1
}

export interface SimulationWorkerCheckpointLimits {
  maxTicks?: number
  maxOperations?: number
  maxSerializedBytes?: number
}

export interface SimulationWorkerCheckpointParseFailure {
  message: string
}

export interface ParsedSimulationWorkerCheckpoint {
  checkpoint: SimulationWorkerCheckpointV1
}

export type SimulationWorkerCheckpointParseResult =
  | ParsedSimulationWorkerCheckpoint
  | SimulationWorkerCheckpointParseFailure

/**
 * Cria um checkpoint de dados para uma futura continuação. O resultado ainda
 * não é aceito pelo protocolo Worker v1; a função existe como contrato isolado.
 */
export function createSimulationWorkerCheckpoint(
  netlist: Netlist,
  simulatorState: SimulatorState,
  operationCount: number,
): SimulationWorkerCheckpointV1 {
  const checkpoint: SimulationWorkerCheckpointV1 = {
    kind: SIMULATION_WORKER_CHECKPOINT_KIND,
    checkpointVersion: SIMULATION_WORKER_CHECKPOINT_VERSION,
    protocolVersion: 1,
    netlistSignature: simulationWorkerNetlistSignature(netlist),
    state: {
      tickCount: simulatorState.tickCount,
      operationCount,
      nodes: simulatorState.nodes,
    },
  }
  const parsed = parseSimulationWorkerCheckpoint(checkpoint, netlist)
  if ('message' in parsed) throw new RangeError(`Checkpoint inválido: ${parsed.message}`)
  return parsed.checkpoint
}

/** Retorna a representação canônica usada para vincular estado e netlist. */
export function simulationWorkerNetlistSignature(netlist: Netlist): string {
  const canonical = JSON.stringify(canonicalize(netlist))
  return `fnv1a64:${fnv1a64(canonical)}`
}

/** Serializa somente checkpoints já validados, sem executar conteúdo do envelope. */
export function serializeSimulationWorkerCheckpoint(
  checkpoint: SimulationWorkerCheckpointV1,
  netlist: Netlist,
  limits: SimulationWorkerCheckpointLimits = {},
): string {
  const parsed = parseSimulationWorkerCheckpoint(checkpoint, netlist, limits)
  if ('message' in parsed) throw new RangeError(`Checkpoint inválido: ${parsed.message}`)
  const serialized = JSON.stringify(parsed.checkpoint)
  const byteLength = new TextEncoder().encode(serialized).byteLength
  const maxBytes = limits.maxSerializedBytes ?? MAX_WORKER_CHECKPOINT_SERIALIZED_BYTES
  if (byteLength > maxBytes) throw new RangeError(`O checkpoint excede ${maxBytes} bytes.`)
  return serialized
}

/** Faz parse sem eval/Function e rejeita qualquer shape não versionado. */
export function parseSerializedSimulationWorkerCheckpoint(
  serialized: string,
  netlist: Netlist,
  limits: SimulationWorkerCheckpointLimits = {},
): SimulationWorkerCheckpointParseResult {
  if (typeof serialized !== 'string') return { message: 'O checkpoint serializado deve ser uma string.' }
  const maxBytes = limits.maxSerializedBytes ?? MAX_WORKER_CHECKPOINT_SERIALIZED_BYTES
  const byteLength = new TextEncoder().encode(serialized).byteLength
  if (byteLength > maxBytes) return { message: `O checkpoint excede ${maxBytes} bytes.` }
  let input: unknown
  try {
    input = JSON.parse(serialized)
  } catch {
    return { message: 'O checkpoint não contém JSON válido.' }
  }
  return parseSimulationWorkerCheckpoint(input, netlist, limits)
}

/** Valida envelope, assinatura, shape, limites e invariantes temporais. */
export function parseSimulationWorkerCheckpoint(
  input: unknown,
  netlist: Netlist,
  limits: SimulationWorkerCheckpointLimits = {},
): SimulationWorkerCheckpointParseResult {
  if (!isRecord(input)) return { message: 'O checkpoint deve ser um objeto.' }
  if (!hasExactKeys(input, ['checkpointVersion', 'kind', 'netlistSignature', 'protocolVersion', 'state'])) {
    return { message: 'O envelope do checkpoint contém campos ausentes ou desconhecidos.' }
  }
  if (input.kind !== SIMULATION_WORKER_CHECKPOINT_KIND) return { message: 'kind de checkpoint desconhecido.' }
  if (input.checkpointVersion !== SIMULATION_WORKER_CHECKPOINT_VERSION) return { message: 'checkpointVersion incompatível.' }
  if (input.protocolVersion !== 1) return { message: 'protocolVersion incompatível.' }
  if (typeof input.netlistSignature !== 'string' || input.netlistSignature.length < 1 || input.netlistSignature.length > 128) {
    return { message: 'netlistSignature ausente ou acima do limite.' }
  }
  if (input.netlistSignature !== simulationWorkerNetlistSignature(netlist)) {
    return { message: 'O checkpoint não corresponde ao netlist atual.' }
  }
  const state = parseCheckpointState(input.state, netlist, limits)
  if ('message' in state) return state
  const checkpoint: SimulationWorkerCheckpointV1 = {
    kind: SIMULATION_WORKER_CHECKPOINT_KIND,
    checkpointVersion: SIMULATION_WORKER_CHECKPOINT_VERSION,
    protocolVersion: 1,
    netlistSignature: input.netlistSignature,
    state: state.state,
  }
  const maxBytes = limits.maxSerializedBytes ?? MAX_WORKER_CHECKPOINT_SERIALIZED_BYTES
  const serialized = JSON.stringify(checkpoint)
  if (new TextEncoder().encode(serialized).byteLength > maxBytes) return { message: `O checkpoint excede ${maxBytes} bytes.` }
  return { checkpoint }
}

interface ParsedCheckpointState {
  state: SimulationWorkerCheckpointStateV1
}

function parseCheckpointState(
  input: unknown,
  netlist: Netlist,
  limits: SimulationWorkerCheckpointLimits,
): ParsedCheckpointState | SimulationWorkerCheckpointParseFailure {
  if (!isRecord(input)) return { message: 'state do checkpoint deve ser um objeto.' }
  if (!hasExactKeys(input, ['nodes', 'operationCount', 'tickCount'])) {
    return { message: 'state do checkpoint contém campos ausentes ou desconhecidos.' }
  }

  const maxTicks = limits.maxTicks ?? DEFAULT_MAX_TOTAL_TICKS
  const maxOperations = limits.maxOperations ?? DEFAULT_MAX_TOTAL_OPERATIONS
  if (!isBoundedInteger(input.tickCount, 0, Math.min(maxTicks, MAX_TOTAL_TICKS))) {
    return { message: `tickCount deve ser um inteiro entre 0 e ${Math.min(maxTicks, MAX_TOTAL_TICKS)}.` }
  }
  if (!isBoundedInteger(input.operationCount, 0, Math.min(maxOperations, MAX_TOTAL_OPERATIONS))) {
    return { message: `operationCount deve ser um inteiro entre 0 e ${Math.min(maxOperations, MAX_TOTAL_OPERATIONS)}.` }
  }
  if (!isRecord(input.nodes)) return { message: 'nodes do checkpoint deve ser um mapa.' }

  const expectedIds = netlist.components.map((component) => component.id).sort()
  const actualIds = Object.keys(input.nodes).sort()
  if (expectedIds.join('|') !== actualIds.join('|')) return { message: 'nodes não corresponde exatamente ao netlist atual.' }

  const nodes: Record<string, SimulatorNodeState> = {}
  for (const component of netlist.components) {
    const node = input.nodes[component.id]
    const parsedNode = parseCheckpointNode(node, component)
    if ('message' in parsedNode) return { message: `Estado inválido em "${component.id}": ${parsedNode.message}` }
    nodes[component.id] = parsedNode.node
  }
  return { state: { tickCount: input.tickCount, operationCount: input.operationCount, nodes } }
}

interface ParsedCheckpointNode {
  node: SimulatorNodeState
}

function parseCheckpointNode(input: unknown, component: ComponentSpec): ParsedCheckpointNode | SimulationWorkerCheckpointParseFailure {
  if (!isRecord(input)) return { message: 'o nó deve ser um objeto.' }
  if (!hasExactKeys(input, ['counter', 'lastClock', 'next', 'nextCounter', 'nextLastClock', 'nextQueue', 'outputs', 'queue'])) {
    return { message: 'o nó contém campos ausentes ou desconhecidos.' }
  }
  if (!isBoolean(input.lastClock) || !isBoolean(input.nextLastClock)) return { message: 'os clocks internos devem ser booleanos.' }
  if (!isBoundedInteger(input.counter, 0, MAX_TOTAL_TICKS) || !isBoundedInteger(input.nextCounter, 0, MAX_TOTAL_TICKS)) {
    return { message: 'os contadores internos devem ser inteiros bounded.' }
  }
  if (!isBooleanArray(input.outputs) || !isBooleanArray(input.next) || !isBooleanArray(input.queue) || !isBooleanArray(input.nextQueue)) {
    return { message: 'as filas e saídas devem conter somente booleanos.' }
  }
  if (component.type === 'splitter' || component.type === 'combiner' || component.type === 'custom-chip') {
    return { message: 'o checkpoint v1 aceita somente netlists escalares.' }
  }
  if (component.options?.width !== undefined || component.options?.widths !== undefined) {
    return { message: 'o checkpoint v1 não aceita larguras vetoriais.' }
  }

  const outputs = outputCount(component.type, component.options)
  if (input.outputs.length !== outputs || input.next.length !== outputs) {
    return { message: `outputs deve possuir ${outputs} itens.` }
  }
  const delayExtra = component.type === 'delay' ? Math.max(1, component.options?.ticks ?? 1) - 1 : 0
  if (input.queue.length !== delayExtra || input.nextQueue.length !== delayExtra) {
    return { message: 'o tamanho da fila não corresponde ao atraso declarado.' }
  }
  if (component.type !== 'dff' && component.type !== 'tff' && component.type !== 'jk' && component.type !== 'sr' &&
    (input.outputs.length > 1 || input.outputs[1] === input.outputs[0] || input.next.length > 1 && input.next[1] === input.next[0])) {
    return { message: 'saída complementar inválida para o componente.' }
  }
  if (component.type === 'dff' || component.type === 'tff' || component.type === 'jk' || component.type === 'sr') {
    if (input.outputs[1] === input.outputs[0] || input.next[1] === input.next[0]) return { message: 'Q̄ deve ser complementar a Q.' }
    if (input.queue.length !== 0 || input.nextQueue.length !== 0 || input.counter !== 0 || input.nextCounter !== 0) {
      return { message: 'flip-flop não pode possuir fila ou contador de clock.' }
    }
  } else if (component.type !== 'clock' && (input.queue.length !== 0 || input.nextQueue.length !== 0 || input.counter !== 0 || input.nextCounter !== 0)) {
    return { message: 'componente sem estado não pode possuir fila ou contador.' }
  }
  const isFlipFlop = component.type === 'dff' || component.type === 'tff' || component.type === 'jk' || component.type === 'sr'
  if (component.type === 'clock') {
    const period = Math.max(1, component.options?.period ?? 1)
    if (input.counter >= period || input.nextCounter >= period) return { message: 'contador de clock fora do período declarado.' }
  }
  if (!isFlipFlop && (input.lastClock || input.nextLastClock)) {
    return { message: 'componente sem flip-flop não pode possuir estado de clock.' }
  }
  return {
    node: {
      outputs: [...input.outputs],
      next: [...input.next],
      lastClock: input.lastClock,
      nextLastClock: input.nextLastClock,
      queue: [...input.queue],
      nextQueue: [...input.nextQueue],
      counter: input.counter,
      nextCounter: input.nextCounter,
    },
  }
}

function hasExactKeys(input: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = [...keys].sort()
  return Object.keys(input).sort().join('|') === expected.join('|')
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isBooleanArray(value: unknown): value is boolean[] {
  return Array.isArray(value) && value.every(isBoolean)
}

function isBoundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte)
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return hash.toString(16).padStart(16, '0')
}
