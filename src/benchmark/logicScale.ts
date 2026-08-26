import {
  MAX_CIRCUIT_CONNECTIONS,
  MAX_CIRCUIT_NODES,
  type CircuitDocument,
} from '../circuit'
import type { Netlist } from '../simulation/components'

export const LOGIC_SCALE_TARGETS = [10, 100, 500, 1000, 5000] as const

export interface LogicScalePlan {
  gates: number
  supported: boolean
  nodes: number
  connections: number
  reason?: string
}

export function maxSupportedNotChainGates(): number {
  return Math.min(MAX_CIRCUIT_NODES - 2, MAX_CIRCUIT_CONNECTIONS - 1)
}

export function createLogicScalePlan(
  targets: readonly number[] = LOGIC_SCALE_TARGETS,
): LogicScalePlan[] {
  const maxGates = maxSupportedNotChainGates()
  return targets.map((gates) => {
    const nodes = gates + 2
    const connections = gates + 1
    const supported = Number.isInteger(gates) && gates >= 1 && gates <= maxGates
    return {
      gates,
      supported,
      nodes,
      connections,
      ...(supported
        ? {}
        : {
            reason:
              `A cadeia precisa de ${nodes} nós e ${connections} conexões; ` +
              `o CircuitDocument atual limita a ${MAX_CIRCUIT_NODES} nós e ` +
              `${MAX_CIRCUIT_CONNECTIONS} conexões.`,
          }),
    }
  })
}

export function createNotChainNetlist(gates: number): Netlist {
  if (!Number.isInteger(gates) || gates < 1) throw new Error('A cadeia precisa ter ao menos um gate.')

  const components: Netlist['components'] = [
    { id: 'input', type: 'input' },
  ]
  for (let index = 0; index < gates; index += 1) {
    components.push({
      id: `not-${index}`,
      type: 'not',
      inputs: [{ node: index === 0 ? 'input' : `not-${index - 1}` }],
    })
  }
  components.push({
    id: 'output',
    type: 'output',
    inputs: [{ node: `not-${gates - 1}` }],
  })
  return { components }
}

export function createNotChainDocument(gates: number): CircuitDocument {
  const plan = createLogicScalePlan([gates])[0]
  if (!plan.supported)
    throw new Error(plan.reason ?? 'Escala de benchmark inválida.')

  const nodes: CircuitDocument['nodes'] = [
    { id: 'input', type: 'input', position: { x: 0, y: 0 }, label: 'A' },
  ]
  for (let index = 0; index < gates; index += 1) {
    nodes.push({
      id: `not-${index}`,
      type: 'not',
      position: { x: (index + 1) * 160, y: 0 },
    })
  }
  nodes.push({
    id: 'output',
    type: 'output',
    position: { x: (gates + 1) * 160, y: 0 },
    label: 'S',
  })

  const connections: CircuitDocument['connections'] = [
    { source: { node: 'input' }, target: { node: 'not-0', port: 0 } },
  ]
  for (let index = 0; index < gates - 1; index += 1) {
    connections.push({
      source: { node: `not-${index}` },
      target: { node: `not-${index + 1}`, port: 0 },
    })
  }
  connections.push({
    source: { node: `not-${gates - 1}` },
    target: { node: 'output', port: 0 },
  })

  return {
    format: 'veritas-circuit',
    version: 1,
    name: `Benchmark cadeia NOT ${gates} gates`,
    nodes,
    connections,
  }
}
