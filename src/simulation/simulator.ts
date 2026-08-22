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

export const DEFAULT_MAX_SETTLE_TICKS = 200

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
  private ticks = 0

  constructor(netlist: Netlist, options: SimulatorOptions = {}) {
    this.maxSettleTicks = options.maxSettleTicks ?? DEFAULT_MAX_SETTLE_TICKS

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
        if (port >= outputCount(target.spec.type)) {
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

  /** Muda o valor de um pino de entrada. Vale a partir do próximo tique. */
  setInput(id: string, value: boolean): void {
    const node = this.require(id)
    if (node.spec.type !== 'input') {
      throw new Error(`"${id}" não é um pino de entrada.`)
    }
    node.outputs[0] = value
    node.next[0] = value
  }

  read(id: string, port = 0): boolean {
    return this.require(id).outputs[port] ?? false
  }

  /** Valores de todas as saídas, útil para comparar dois instantes. */
  snapshot(): Record<string, boolean[]> {
    const result: Record<string, boolean[]> = {}
    for (const [id, node] of this.nodes) result[id] = [...node.outputs]
    return result
  }

  exportState(): SimulatorState {
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
    if (!Number.isInteger(state.tickCount) || state.tickCount < 0) {
      throw new Error('O estado do simulador possui um contador de tiques inválido.')
    }
    const stateIds = Object.keys(state.nodes).sort()
    const nodeIds = [...this.nodes.keys()].sort()
    if (stateIds.join('|') !== nodeIds.join('|')) {
      throw new Error('O estado do simulador não corresponde ao netlist atual.')
    }

    for (const [id, node] of this.nodes) {
      const saved = state.nodes[id]
      if (!saved || saved.outputs.length !== node.outputs.length || saved.next.length !== node.next.length) {
        throw new Error(`O estado do componente "${id}" é incompatível com o netlist atual.`)
      }
      if (!isBooleanArray(saved.outputs) || !isBooleanArray(saved.next) || !isBooleanArray(saved.queue) || !isBooleanArray(saved.nextQueue)) {
        throw new Error(`O estado do componente "${id}" contém valores inválidos.`)
      }
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
    for (let index = 0; index < count; index += 1) {
      this.evaluate()
      this.propagate()
      this.ticks += 1
    }
  }

  /**
   * Roda até o circuito parar de mudar.
   *
   * Serve para circuitos combinacionais, onde o resultado aparece depois de
   * tantos tiques quanto for a profundidade. Um circuito com clock nunca
   * estabiliza — nesse caso devolve `false` ao bater no teto.
   */
  settle(maxTicks = this.maxSettleTicks): boolean {
    for (let index = 0; index < maxTicks; index += 1) {
      const before = this.serialize()
      this.tick()
      if (this.serialize() === before) return true
    }
    return false
  }

  reset(): void {
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
  }

  /** Fase 1: cada componente decide seu próximo valor, ninguém publica ainda. */
  private evaluate(): void {
    for (const id of this.order) {
      const node = this.nodes.get(id)!
      const values = (node.spec.inputs ?? []).map((input) => this.valueOf(input))
      this.computeNext(node, values)
    }
  }

  /** Fase 2: todo mundo publica ao mesmo tempo. */
  private propagate(): void {
    for (const id of this.order) {
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
        // Só muda por setInput.
        node.next[0] = node.outputs[0]
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
      case 'tff': {
        const data = values[0] ?? false
        const clock = values[1] ?? false
        const rising = clock && !node.lastClock
        node.nextLastClock = clock

        const current = node.outputs[0]
        // Fora da borda de subida o flip-flop ignora a entrada e segura o valor.
        const stored = !rising
          ? current
          : type === 'dff'
            ? data
            : data
              ? !current
              : current

        node.next[0] = stored
        node.next[1] = !stored
        return
      }

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

  private require(id: string): NodeState {
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
}

function isBooleanArray(values: readonly unknown[]): values is boolean[] {
  return values.every((value) => typeof value === 'boolean')
}

function createState(spec: ComponentSpec): NodeState {
  const size = outputCount(spec.type)
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
