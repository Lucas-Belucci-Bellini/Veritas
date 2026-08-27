import {
  combinationalResult,
  outputCount,
  type ComponentSpec,
  type Netlist,
  type PortRef,
} from './components'

interface NodeState {
  spec: ComponentSpec
  /** Valores que as saídas mostram agora. */
  outputs: boolean[]
  /** Valores calculados nesta rodada, ainda não publicados. */
  next: boolean[]
  /** Nível do clock na rodada anterior, para detectar a borda de subida. */
  lastClock: boolean
  nextLastClock: boolean
  /** Fila do componente de atraso. */
  queue: boolean[]
  nextQueue: boolean[]
  /** Contador interno do clock. */
  counter: number
  nextCounter: number
}

export interface SimulatorOptions {
  /** Teto de tiques em `settle`, para não rodar para sempre. */
  maxSettleTicks?: number
  /** Teto acumulado de tiques deste runtime, incluindo chamadas anteriores. */
  maxTotalTicks?: number
  /** Teto de operações de componentes dentro de um único tique. */
  maxOperationsPerTick?: number
  /** Teto acumulado de operações deste runtime, incluindo chamadas anteriores. */
  maxTotalOperations?: number
  /** Sinal externo para cancelar entre tiques ou antes de uma execução. */
  signal?: AbortSignal
}

export interface SimulatorNodeState {
  outputs: boolean[]
  next: boolean[]
  lastClock: boolean
  nextLastClock: boolean
  queue: boolean[]
  nextQueue: boolean[]
  counter: number
  nextCounter: number
}

export interface SimulatorState {
  tickCount: number
  nodes: Record<string, SimulatorNodeState>
}

export type SettleDiagnosticStatus = 'stabilized' | 'cycle-detected' | 'budget-exhausted'

export interface SettleDiagnostic {
  status: SettleDiagnosticStatus
  ticksExecuted: number
  cycleStartTick?: number
  cyclePeriod?: number
}

export type SimulatorExecutionErrorCode = 'aborted' | 'cancelled' | 'shutdown' | 'operation-budget'

export class SimulatorExecutionError extends Error {
  readonly code: SimulatorExecutionErrorCode

  constructor(code: SimulatorExecutionErrorCode, message: string) {
    super(message)
    this.name = 'SimulatorExecutionError'
    this.code = code
  }
}

export const DEFAULT_MAX_SETTLE_TICKS = 200
export const MAX_SETTLE_TICKS = 10_000
export const DEFAULT_MAX_TOTAL_TICKS = 100_000
export const MAX_TOTAL_TICKS = 1_000_000
export const DEFAULT_MAX_OPERATIONS_PER_TICK = 1_000_000
export const MAX_OPERATIONS_PER_TICK = 10_000_000
export const DEFAULT_MAX_TOTAL_OPERATIONS = 1_000_000_000
export const MAX_TOTAL_OPERATIONS = 10_000_000_000

/**
 * Simulador de circuitos por tiques.
 *
 * Cada tique acontece em duas fases: primeiro todo mundo calcula o próprio
 * próximo valor olhando para os valores *atuais* dos vizinhos, e só depois
 * todos publicam ao mesmo tempo. É o que a eletricidade faz de verdade — cada
 * porta tem seu atraso de propagação — e é o que permite simular circuitos com
 * realimentação sem o navegador entrar em laço infinito.
 */
export class Simulator {
  private readonly nodes = new Map<string, NodeState>()
  private readonly order: string[] = []
  private readonly maxSettleTicks: number
  private readonly maxTotalTicks: number
  private readonly maxOperationsPerTick: number
  private readonly maxTotalOperations: number
  private readonly signal?: AbortSignal
  private ticks = 0
  private operations = 0
  private cancelled = false
  private shutdownState = false

  constructor(netlist: Netlist, options: SimulatorOptions = {}) {
    this.maxSettleTicks = normalizeSettleBudget(options.maxSettleTicks ?? DEFAULT_MAX_SETTLE_TICKS, false)
    this.maxTotalTicks = normalizeTotalTickBudget(options.maxTotalTicks ?? DEFAULT_MAX_TOTAL_TICKS)
    this.maxOperationsPerTick = normalizeOperationBudget(options.maxOperationsPerTick ?? DEFAULT_MAX_OPERATIONS_PER_TICK, MAX_OPERATIONS_PER_TICK, 'por tique')
    this.maxTotalOperations = normalizeOperationBudget(options.maxTotalOperations ?? DEFAULT_MAX_TOTAL_OPERATIONS, MAX_TOTAL_OPERATIONS, 'total')
    this.signal = options.signal

    for (const spec of netlist.components) {
      if (this.nodes.has(spec.id)) {
        throw new Error(`Componente duplicado: "${spec.id}".`)
      }
      this.nodes.set(spec.id, createState(spec))
      this.order.push(spec.id)
    }

    // Só dá para validar as ligações depois que todos existem.
    for (const spec of netlist.components) {
      for (const input of spec.inputs ?? []) {
        const target = this.nodes.get(input.node)
        if (!target) {
          throw new Error(
            `O componente "${spec.id}" está ligado em "${input.node}", que não existe.`,
          )
        }
        const port = input.port ?? 0
        if (port >= outputCount(target.spec.type, target.spec.options)) {
          throw new Error(
            `"${input.node}" não tem a saída ${port} que "${spec.id}" pede.`,
          )
        }
      }
    }
  }

  /** Quantos tiques já rodaram desde o início ou o último reset. */
  get tickCount(): number {
    return this.ticks
  }

  /** Quantas operações de componentes foram contabilizadas neste runtime. */
  get operationCount(): number {
    return this.operations
  }

  /** Quantos componentes permanecem ativos neste runtime. */
  get nodeCount(): number {
    return this.nodes.size
  }

  /** Permite ao chamador cancelar uma execução futura de modo idempotente. */
  cancel(): void {
    if (!this.shutdownState) this.cancelled = true
  }

  /** Libera o estado interno; chamadas repetidas permanecem seguras. */
  shutdown(): void {
    if (this.shutdownState) return
    this.shutdownState = true
    this.cancelled = true
    this.nodes.clear()
    this.order.length = 0
  }

  /** Muda o valor de um pino de entrada. Vale a partir do próximo tique. */
  setInput(id: string, value: boolean): void {
    this.ensureRunnable()
    const node = this.require(id)
    if (node.spec.type !== 'input') {
      throw new Error(`"${id}" não é um pino de entrada.`)
    }
    node.outputs[0] = value
    node.next[0] = value
  }

  read(id: string, port = 0): boolean {
    this.ensureRunnable()
    return this.require(id).outputs[port] ?? false
  }

  /** Valores de todas as saídas, útil para comparar dois instantes. */
  snapshot(): Record<string, boolean[]> {
    this.ensureRunnable()
    const result: Record<string, boolean[]> = {}
    for (const [id, node] of this.nodes) result[id] = [...node.outputs]
    return result
  }

  exportState(): SimulatorState {
    this.ensureRunnable()
    const nodes: Record<string, SimulatorNodeState> = {}
    for (const [id, node] of this.nodes) {
      nodes[id] = {
        outputs: [...node.outputs],
        next: [...node.next],
        lastClock: node.lastClock,
        nextLastClock: node.nextLastClock,
        queue: [...node.queue],
        nextQueue: [...node.nextQueue],
        counter: node.counter,
        nextCounter: node.nextCounter,
      }
    }
    return { tickCount: this.ticks, nodes }
  }

  restoreState(state: SimulatorState): void {
    this.ensureRunnable()
    if (!Number.isInteger(state.tickCount) || state.tickCount < 0) {
      throw new Error('O estado do simulador possui um contador de tiques inválido.')
    }
    const stateIds = Object.keys(state.nodes).sort()
    const nodeIds = [...this.nodes.keys()].sort()
    if (stateIds.join('|') !== nodeIds.join('|')) {
      throw new Error('O estado do simulador não corresponde ao netlist atual.')
    }

    if (state.tickCount > this.maxTotalTicks) {
      throw new RangeError(`O estado excede o orçamento total de ${this.maxTotalTicks} tiques do simulador.`)
    }

    for (const [id, node] of this.nodes) {
      const saved = state.nodes[id]
      if (!saved || saved.outputs.length !== node.outputs.length || saved.next.length !== node.next.length) {
        throw new Error(`O estado do componente "${id}" é incompatível com o netlist atual.`)
      }
      if (!isBooleanArray(saved.outputs) || !isBooleanArray(saved.next) || !isBooleanArray(saved.queue) || !isBooleanArray(saved.nextQueue)) {
        throw new Error(`O estado do componente "${id}" contém valores inválidos.`)
      }
    }

    this.restoreStateUnchecked(state)
  }

  private restoreStateUnchecked(state: SimulatorState): void {
    for (const [id, node] of this.nodes) {
      const saved = state.nodes[id]
      node.outputs = [...saved.outputs]
      node.next = [...saved.next]
      node.lastClock = saved.lastClock
      node.nextLastClock = saved.nextLastClock
      node.queue = [...saved.queue]
      node.nextQueue = [...saved.nextQueue]
      node.counter = saved.counter
      node.nextCounter = saved.nextCounter
    }
    this.ticks = state.tickCount
  }

  tick(count = 1): void {
    this.ensureRunnable()
    const requested = normalizeTickCount(count)
    if (requested === 0) return
    if (this.ticks + requested > this.maxTotalTicks) {
      throw new RangeError(`O simulador excederia o orçamento total de ${this.maxTotalTicks} tiques.`)
    }

    const before = this.exportState()
    const operationsBefore = this.operations
    try {
      for (let index = 0; index < requested; index += 1) {
        this.ensureRunnable()
        let operationsThisTick = 0
        this.evaluate(() => {
          operationsThisTick += 1
          this.chargeOperation(operationsThisTick)
        })
        this.propagate(() => {
          operationsThisTick += 1
          this.chargeOperation(operationsThisTick)
        })
        this.ticks += 1
      }
    } catch (error) {
      this.restoreStateUnchecked(before)
      this.operations = operationsBefore
      throw error
    }
  }

  /**
   * Roda até o circuito parar de mudar.
   *
   * Serve para circuitos combinacionais, onde o resultado aparece depois de
   * tantos tiques quanto for a profundidade. Um circuito com clock nunca
   * estabiliza — nesse caso devolve `false` ao bater no teto.
   */
  diagnoseSettle(maxTicks = this.maxSettleTicks): SettleDiagnostic {
    const budget = normalizeSettleBudget(maxTicks, true)
    const seen = new Map<string, number>()
    let ticksExecuted = 0

    for (let index = 0; index < budget; index += 1) {
      if (this.ticks >= this.maxTotalTicks) {
        return { status: 'budget-exhausted', ticksExecuted }
      }

      const before = this.serializeRuntime()
      const previousTick = seen.get(before)
      if (previousTick !== undefined) {
        return {
          status: 'cycle-detected',
          ticksExecuted,
          cycleStartTick: previousTick,
          cyclePeriod: this.ticks - previousTick,
        }
      }
      seen.set(before, this.ticks)

      try {
        this.tick()
      } catch (error) {
        if (error instanceof SimulatorExecutionError && error.code === 'operation-budget') {
          return { status: 'budget-exhausted', ticksExecuted }
        }
        throw error
      }
      ticksExecuted += 1
      const after = this.serializeRuntime()
      if (after === before) {
        return { status: 'stabilized', ticksExecuted }
      }

      const repeatedTick = seen.get(after)
      if (repeatedTick !== undefined) {
        return {
          status: 'cycle-detected',
          ticksExecuted,
          cycleStartTick: repeatedTick,
          cyclePeriod: this.ticks - repeatedTick,
        }
      }
    }

    return { status: 'budget-exhausted', ticksExecuted }
  }

  settle(maxTicks = this.maxSettleTicks): boolean {
    const budget = normalizeSettleBudget(maxTicks, true)
    for (let index = 0; index < budget; index += 1) {
      if (this.ticks >= this.maxTotalTicks) return false
      const before = this.serialize()
      this.tick()
      if (this.serialize() === before) return true
    }
    return false
  }

  reset(): void {
    this.ensureNotShutdown()
    this.cancelled = false
    for (const node of this.nodes.values()) {
      const fresh = createState(node.spec)
      node.outputs = fresh.outputs
      node.next = fresh.next
      node.lastClock = fresh.lastClock
      node.nextLastClock = fresh.nextLastClock
      node.queue = fresh.queue
      node.nextQueue = fresh.nextQueue
      node.counter = fresh.counter
      node.nextCounter = fresh.nextCounter
    }
    this.ticks = 0
    this.operations = 0
  }

  /** Fase 1: cada componente decide seu próximo valor, ninguém publica ainda. */
  private evaluate(charge: () => void): void {
    for (const id of this.order) {
      charge()
      const node = this.nodes.get(id)!
      const values = (node.spec.inputs ?? []).map((input) => this.valueOf(input))
      this.computeNext(node, values)
    }
  }

  /** Fase 2: todo mundo publica ao mesmo tempo. */
  private propagate(charge: () => void): void {
    for (const id of this.order) {
      charge()
      const node = this.nodes.get(id)!
      node.outputs = [...node.next]
      node.lastClock = node.nextLastClock
      node.counter = node.nextCounter
      node.queue = node.nextQueue
    }
  }

  private computeNext(node: NodeState, values: boolean[]): void {
    const { type, options } = node.spec

    const combinational = combinationalResult(type, values)
    if (combinational !== null) {
      node.next[0] = combinational
      return
    }

    switch (type) {
      case 'input':
        // Um `input` marcado como fronteira interna não é um pino do autor: é o
        // que sobrou de uma porta de chip depois da elaboração, e se comporta
        // como passagem. O avaliador combinacional já seguia essa convenção
        // (`nodeInputCount` conta 1 entrada nesse caso); sem isto o simulador
        // ignorava a ligação e o chip inteiro rodava com a entrada em zero.
        node.next[0] = options?.customChipBoundary === 'internal'
          ? values[0] ?? false
          : node.outputs[0]
        return

      case 'constant':
        node.next[0] = options?.value ?? false
        return

      case 'output':
      case 'transmitter':
      case 'receiver':
        node.next[0] = values[0] ?? false
        return

      case 'clock': {
        const period = Math.max(1, options?.period ?? 1)
        const counter = node.counter + 1
        if (counter >= period) {
          node.next[0] = !node.outputs[0]
          node.nextCounter = 0
        } else {
          node.next[0] = node.outputs[0]
          node.nextCounter = counter
        }
        return
      }

      case 'dff':
      case 'tff':
      case 'jk':
      case 'sr': {
        const clock = type === 'dff' || type === 'tff' ? values[1] ?? false : values[2] ?? false
        const rising = clock && !node.lastClock
        node.nextLastClock = clock

        const current = node.outputs[0]
        // Fora da borda de subida o componente ignora as entradas e segura o valor.
        let stored = current
        if (rising) {
          if (type === 'dff') {
            stored = values[0] ?? false
          } else if (type === 'tff') {
            stored = (values[0] ?? false) ? !current : current
          } else if (type === 'jk') {
            const j = values[0] ?? false
            const k = values[1] ?? false
            stored = j && k ? !current : j ? true : k ? false : current
          } else {
            const set = values[0] ?? false
            const reset = values[1] ?? false
            // S=R=1 é a condição proibida do latch SR; em simulação
            // determinística ela preserva o estado anterior e mantém Q̄ complementar.
            stored = set && reset ? current : set ? true : reset ? false : current
          }
        }

        node.next[0] = stored
        node.next[1] = !stored
        return
      }

      case 'splitter':
      case 'combiner':
        throw new Error(`O componente "${node.spec.id}" exige o runtime vetorial de barramentos.`)

      case 'delay': {
        const incoming = values[0] ?? false
        // Todo componente já custa um tique para propagar, então a fila só
        // precisa segurar os `depth - 1` tiques restantes.
        const extra = Math.max(1, options?.ticks ?? 1) - 1
        if (extra === 0) {
          node.next[0] = incoming
          return
        }
        const queue = [...node.queue]
        while (queue.length < extra) queue.unshift(false)
        queue.push(incoming)
        node.next[0] = queue.shift() ?? false
        node.nextQueue = queue
        return
      }
    }
  }

  private valueOf(input: PortRef): boolean {
    const node = this.nodes.get(input.node)
    if (!node) return false
    return node.outputs[input.port ?? 0] ?? false
  }

  private ensureNotShutdown(): void {
    if (this.shutdownState) {
      throw new SimulatorExecutionError('shutdown', 'O simulador já foi encerrado.')
    }
  }

  private ensureRunnable(): void {
    this.ensureNotShutdown()
    if (this.cancelled) {
      throw new SimulatorExecutionError('cancelled', 'A execução do simulador foi cancelada.')
    }
    if (this.signal?.aborted) {
      throw new SimulatorExecutionError('aborted', 'A execução do simulador foi abortada.')
    }
  }

  private chargeOperation(operationInTick: number): void {
    this.ensureRunnable()
    if (operationInTick > this.maxOperationsPerTick) {
      throw new SimulatorExecutionError(
        'operation-budget',
        `O tique excederia o orçamento de ${this.maxOperationsPerTick} operações.`,
      )
    }
    if (this.operations >= this.maxTotalOperations) {
      throw new SimulatorExecutionError(
        'operation-budget',
        `O simulador excederia o orçamento total de ${this.maxTotalOperations} operações.`,
      )
    }
    this.operations += 1
  }

  private require(id: string): NodeState {
    this.ensureRunnable()
    const node = this.nodes.get(id)
    if (!node) throw new Error(`Componente "${id}" não existe no circuito.`)
    return node
  }

  private serialize(): string {
    let result = ''
    for (const id of this.order) {
      result += this.nodes.get(id)!.outputs.map((value) => (value ? '1' : '0')).join('')
    }
    return result
  }

  private serializeRuntime(): string {
    let result = ''
    for (const id of this.order) {
      const node = this.nodes.get(id)!
      result += [
        node.outputs,
        node.next,
        node.lastClock,
        node.nextLastClock,
        node.queue,
        node.nextQueue,
        node.counter,
        node.nextCounter,
      ].map((value) => typeof value === 'boolean' ? (value ? '1' : '0') : Array.isArray(value) ? value.map((item) => (item ? '1' : '0')).join('') : String(value)).join(':')
      result += '|'
    }
    return result
  }
}

function isBooleanArray(values: readonly unknown[]): values is boolean[] {
  return values.every((value) => typeof value === 'boolean')
}

function normalizeTickCount(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError('A quantidade de tiques deve ser um inteiro finito não negativo.')
  }
  return value
}

function normalizeTotalTickBudget(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > MAX_TOTAL_TICKS) {
    throw new RangeError(`O orçamento total deve ser um inteiro entre 1 e ${MAX_TOTAL_TICKS}.`)
  }
  return value
}

function normalizeOperationBudget(value: number, maximum: number, scope: string): number {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new RangeError(`O orçamento de operações ${scope} deve ser um inteiro entre 1 e ${maximum}.`)
  }
  return value
}

function normalizeSettleBudget(value: number, allowZero: boolean): number {
  const minimum = allowZero ? 0 : 1
  if (!Number.isInteger(value) || value < minimum || value > MAX_SETTLE_TICKS) {
    const lowerBound = allowZero ? '0' : '1'
    throw new RangeError(`O orçamento de settle deve ser um inteiro entre ${lowerBound} e ${MAX_SETTLE_TICKS}.`)
  }
  return value
}

function createState(spec: ComponentSpec): NodeState {
  const size = outputCount(spec.type, spec.options)
  const initial = spec.options?.initial ?? false
  const value = spec.type === 'constant' ? (spec.options?.value ?? false) : initial

  const outputs = new Array<boolean>(size).fill(false)
  outputs[0] = value
  if (size > 1) outputs[1] = !value

  const extra = Math.max(1, spec.options?.ticks ?? 1) - 1
  const queue = spec.type === 'delay' ? new Array<boolean>(extra).fill(false) : []

  return {
    spec,
    outputs,
    next: [...outputs],
    lastClock: false,
    nextLastClock: false,
    queue,
    nextQueue: [...queue],
    counter: 0,
    nextCounter: 0,
  }
}
