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

export interface SimulatorAsyncOptions {
  /** Quantos tiques executar antes de devolver controle ao event loop. */
  yieldEvery?: number
  /** Tempo máximo da operação assíncrona, em milissegundos. */
  timeoutMs?: number
  /** Sinal adicional para cancelar esta execução. */
  signal?: AbortSignal
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
  /** Teto de memória estimada para o estado deste runtime. */
  maxMemoryBytes?: number
  /** Budget compartilhável entre runtimes do mesmo documento ou operação. */
  executionBudget?: SimulatorExecutionBudget
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

export type SimulatorExecutionErrorCode = 'aborted' | 'cancelled' | 'shutdown' | 'operation-budget' | 'timeout' | 'document-budget'

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
export const DEFAULT_MAX_MEMORY_BYTES = 64 * 1024 * 1024
export const MAX_MEMORY_BYTES = 512 * 1024 * 1024
export const DEFAULT_ASYNC_YIELD_EVERY = 16
export const MAX_ASYNC_YIELD_EVERY = 1_000
export const DEFAULT_ASYNC_TIMEOUT_MS = 30_000
export const MAX_ASYNC_TIMEOUT_MS = 300_000

export interface SimulatorExecutionBudgetOptions {
  /** Teto acumulado de tiques entre todos os runtimes que compartilham a quota. */
  maxTicks?: number
  /** Teto acumulado de operações entre todos os runtimes que compartilham a quota. */
  maxOperations?: number
  /** Teto de memória estimada mantida simultaneamente pelos runtimes compartilhados. */
  maxMemoryBytes?: number
}

/**
 * Quota explícita para agregar o custo de vários runtimes de um mesmo documento
 * ou operação. A quota é cumulativa para tiques/operações e reserva apenas a
 * memória estimada enquanto cada runtime permanece vivo.
 */
export class SimulatorExecutionBudget {
  readonly maxTicks: number
  readonly maxOperations: number
  readonly maxMemoryBytes: number
  private ticks = 0
  private operations = 0
  private memoryBytes = 0

  constructor(options: SimulatorExecutionBudgetOptions = {}) {
    this.maxTicks = normalizeTotalTickBudget(options.maxTicks ?? DEFAULT_MAX_TOTAL_TICKS)
    this.maxOperations = normalizeOperationBudget(
      options.maxOperations ?? DEFAULT_MAX_TOTAL_OPERATIONS,
      MAX_TOTAL_OPERATIONS,
      'total',
    )
    this.maxMemoryBytes = normalizeMemoryBudget(options.maxMemoryBytes ?? DEFAULT_MAX_MEMORY_BYTES)
  }

  get tickCount(): number {
    return this.ticks
  }

  get operationCount(): number {
    return this.operations
  }

  get reservedMemoryBytes(): number {
    return this.memoryBytes
  }

  reserveTicks(count: number): void {
    validateBudgetDelta(count, 'tiques')
    if (this.ticks + count > this.maxTicks) {
      throw new SimulatorExecutionError(
        'document-budget',
        `A execução excederia o orçamento agregado de ${this.maxTicks} tiques.`,
      )
    }
    this.ticks += count
  }

  reserveOperations(count: number): void {
    validateBudgetDelta(count, 'operações')
    if (this.operations + count > this.maxOperations) {
      throw new SimulatorExecutionError(
        'document-budget',
        `A execução excederia o orçamento agregado de ${this.maxOperations} operações.`,
      )
    }
    this.operations += count
  }

  releaseTicks(count: number): void {
    validateBudgetDelta(count, 'tiques')
    if (count > this.ticks) throw new RangeError('A liberação de tiques excede a quota agregada reservada.')
    this.ticks -= count
  }

  releaseOperations(count: number): void {
    validateBudgetDelta(count, 'operações')
    if (count > this.operations) throw new RangeError('A liberação de operações excede a quota agregada reservada.')
    this.operations -= count
  }

  reserveMemory(bytes: number): void {
    validateBudgetDelta(bytes, 'memória')
    if (this.memoryBytes + bytes > this.maxMemoryBytes) {
      throw new SimulatorExecutionError(
        'document-budget',
        `Os runtimes exigiriam ${this.memoryBytes + bytes} bytes, acima do orçamento agregado de memória de ${this.maxMemoryBytes} bytes.`,
      )
    }
    this.memoryBytes += bytes
  }

  releaseMemory(bytes: number): void {
    validateBudgetDelta(bytes, 'memória')
    if (bytes > this.memoryBytes) throw new RangeError('A liberação de memória excede a quota agregada reservada.')
    this.memoryBytes -= bytes
  }

}

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
  private readonly maxMemoryBytes: number
  private readonly memoryEstimate: number
  private readonly executionBudget?: SimulatorExecutionBudget
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
    this.maxMemoryBytes = normalizeMemoryBudget(options.maxMemoryBytes ?? DEFAULT_MAX_MEMORY_BYTES)
    this.memoryEstimate = estimateNetlistMemory(netlist)
    if (this.memoryEstimate > this.maxMemoryBytes) {
      throw new RangeError(`O runtime exigiria aproximadamente ${this.memoryEstimate} bytes, acima do orçamento de memória de ${this.maxMemoryBytes} bytes.`)
    }
    this.executionBudget = options.executionBudget
    this.signal = options.signal

    let memoryReserved = false
    try {
      // A quota agregada é reservada antes de criar nós e filas de delay.
      this.executionBudget?.reserveMemory(this.memoryEstimate)
      memoryReserved = this.executionBudget !== undefined

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
    } catch (error) {
      if (memoryReserved) this.executionBudget?.releaseMemory(this.memoryEstimate)
      throw error
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

  /** Estimativa determinística do estado alocado para este runtime. */
  get memoryEstimateBytes(): number {
    return this.memoryEstimate
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
    this.executionBudget?.releaseMemory(this.memoryEstimate)
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
    let budgetTicksReserved = 0
    let budgetOperationsReserved = 0
    try {
      for (let index = 0; index < requested; index += 1) {
        this.ensureRunnable()
        this.executionBudget?.reserveTicks(1)
        budgetTicksReserved += this.executionBudget ? 1 : 0
        let operationsThisTick = 0
        this.evaluate(() => {
          operationsThisTick += 1
          this.chargeOperation(operationsThisTick, () => { budgetOperationsReserved += 1 })
        })
        this.propagate(() => {
          operationsThisTick += 1
          this.chargeOperation(operationsThisTick, () => { budgetOperationsReserved += 1 })
        })
        this.ticks += 1
      }
    } catch (error) {
      this.restoreStateUnchecked(before)
      this.operations = operationsBefore
      this.executionBudget?.releaseOperations(budgetOperationsReserved)
      this.executionBudget?.releaseTicks(budgetTicksReserved)
      throw error
    }
  }

  /**
   * Executa tiques devolvendo controle ao event loop entre lotes.
   *
   * A operação é transacional: timeout, cancelamento, abort ou budget restaura
   * o estado anterior ao lote inteiro, sem deixar execução parcial publicada.
   */
  async tickAsync(count = 1, options: SimulatorAsyncOptions = {}): Promise<void> {
    this.ensureRunnable(options.signal)
    const requested = normalizeTickCount(count)
    if (requested === 0) return
    if (this.ticks + requested > this.maxTotalTicks) {
      throw new RangeError(`O simulador excederia o orçamento total de ${this.maxTotalTicks} tiques.`)
    }

    const yieldEvery = normalizeAsyncYieldEvery(options.yieldEvery ?? DEFAULT_ASYNC_YIELD_EVERY)
    const timeoutMs = normalizeAsyncTimeout(options.timeoutMs ?? DEFAULT_ASYNC_TIMEOUT_MS)
    const startedAt = Date.now()
    const before = this.exportState()
    const operationsBefore = this.operations
    const ticksBefore = this.ticks
    try {
      for (let index = 0; index < requested; index += 1) {
        this.ensureRunnable(options.signal)
        if (Date.now() - startedAt >= timeoutMs) {
          throw new SimulatorExecutionError('timeout', `A execução excedeu o timeout de ${timeoutMs} ms.`)
        }
        this.tick()
        if (Date.now() - startedAt >= timeoutMs && index + 1 < requested) {
          throw new SimulatorExecutionError('timeout', `A execução excedeu o timeout de ${timeoutMs} ms.`)
        }
        if (index + 1 < requested && (index + 1) % yieldEvery === 0) {
          await yieldExecution()
        }
      }
    } catch (error) {
      const ticksReserved = this.ticks - ticksBefore
      const operationsReserved = this.operations - operationsBefore
      this.restoreStateUnchecked(before)
      this.operations = operationsBefore
      this.executionBudget?.releaseOperations(operationsReserved)
      this.executionBudget?.releaseTicks(ticksReserved)
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
        if (error instanceof SimulatorExecutionError && (error.code === 'operation-budget' || error.code === 'document-budget')) {
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

  private ensureRunnable(signal?: AbortSignal): void {
    this.ensureNotShutdown()
    if (this.cancelled) {
      throw new SimulatorExecutionError('cancelled', 'A execução do simulador foi cancelada.')
    }
    if (this.signal?.aborted || signal?.aborted) {
      throw new SimulatorExecutionError('aborted', 'A execução do simulador foi abortada.')
    }
  }

  private chargeOperation(operationInTick: number, onBudgetReserved?: () => void): void {
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
    this.executionBudget?.reserveOperations(1)
    onBudgetReserved?.()
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

function validateBudgetDelta(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`A reserva agregada de ${label} deve ser um inteiro finito não negativo.`)
  }
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

function normalizeMemoryBudget(value: number): number {
  if (!Number.isInteger(value) || value < 1024 || value > MAX_MEMORY_BYTES) {
    throw new RangeError(`O orçamento de memória deve ser um inteiro entre 1024 e ${MAX_MEMORY_BYTES} bytes.`)
  }
  return value
}

function normalizeAsyncYieldEvery(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > MAX_ASYNC_YIELD_EVERY) {
    throw new RangeError(`O yield assíncrono deve ser um inteiro entre 1 e ${MAX_ASYNC_YIELD_EVERY} tiques.`)
  }
  return value
}

function normalizeAsyncTimeout(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > MAX_ASYNC_TIMEOUT_MS) {
    throw new RangeError(`O timeout assíncrono deve ser um inteiro entre 1 e ${MAX_ASYNC_TIMEOUT_MS} ms.`)
  }
  return value
}

function yieldExecution(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function estimateNetlistMemory(netlist: Netlist): number {
  let estimate = 128
  for (const component of netlist.components) {
    const outputs = outputCount(component.type, component.options)
    const inputs = component.inputs?.length ?? 0
    const delayTicks = component.type === 'delay' ? normalizeDelayTicks(component.options?.ticks) : 0
    const widths = component.options?.widths?.reduce((sum, width) => sum + Math.max(0, width), 0) ?? 0
    const componentBytes = 512
      + outputs * 16
      + inputs * 32
      + delayTicks * 8
      + widths * 8
      + (component.id.length + (component.label?.length ?? 0)) * 2
    estimate += componentBytes
    if (!Number.isSafeInteger(estimate)) return Number.MAX_SAFE_INTEGER
  }
  return estimate
}

function normalizeDelayTicks(value: number | undefined): number {
  if (value === undefined) return 0
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError('O atraso deve ser um inteiro positivo.')
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

  const delayTicks = spec.type === 'delay' ? normalizeDelayTicks(spec.options?.ticks ?? 1) : 0
  const extra = Math.max(1, delayTicks) - 1
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
