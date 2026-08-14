import {
  combinationalResult,
  type ComponentSpec,
  type Netlist,
  type PortRef,
} from '../simulation/components'
import {
  toNetlist,
  type CircuitDocument,
  type EditorComponentType,
} from './editorModel'

export interface CircuitEvaluation {
  /** Valores de todas as saídas, indexados pelo ID do componente. */
  values: Record<string, boolean[]>
  /** Valores observáveis nos componentes do tipo `output`. */
  outputs: Record<string, boolean>
  /** Ordem topológica usada na avaliação. */
  order: string[]
}

export interface CircuitEvaluationOptions {
  /** Valor padrão aplicado a entradas que não foram informadas. */
  defaultInput?: boolean
}

export function evaluateCircuit(
  document: CircuitDocument,
  inputs: Record<string, boolean> = {},
  options: CircuitEvaluationOptions = {},
): CircuitEvaluation {
  return evaluateNetlist(toNetlist(document), inputs, options)
}

/**
 * Avalia apenas netlists combinacionais. A função é independente de React e do
 * DOM para ser compartilhada pelo editor, pelos testes e futuramente pelo MCP.
 */
export function evaluateNetlist(
  netlist: Netlist,
  inputs: Record<string, boolean> = {},
  options: CircuitEvaluationOptions = {},
): CircuitEvaluation {
  const components = new Map<string, ComponentSpec>()
  for (const component of netlist.components) {
    if (components.has(component.id)) {
      throw new Error(`Componente duplicado: "${component.id}".`)
    }
    components.set(component.id, component)
  }

  const dependencies = new Map<string, number>()
  const dependents = new Map<string, string[]>()
  for (const component of components.values()) {
    dependencies.set(component.id, 0)
  }

  for (const component of components.values()) {
    for (const input of component.inputs ?? []) {
      if (!input) continue
      if (!components.has(input.node)) {
        throw new Error(
          `O componente "${component.id}" está ligado em "${input.node}", que não existe.`,
        )
      }
      const targets = dependents.get(input.node) ?? []
      targets.push(component.id)
      dependents.set(input.node, targets)
      dependencies.set(component.id, (dependencies.get(component.id) ?? 0) + 1)
    }
  }

  const queue = [...components.values()]
    .filter((component) => dependencies.get(component.id) === 0)
    .map((component) => component.id)
  const order: string[] = []

  while (queue.length > 0) {
    const id = queue.shift()!
    order.push(id)
    for (const target of dependents.get(id) ?? []) {
      const remaining = (dependencies.get(target) ?? 0) - 1
      dependencies.set(target, remaining)
      if (remaining === 0) queue.push(target)
    }
  }

  if (order.length !== components.size) {
    throw new Error('O circuito contém um ciclo e não pode ser avaliado como combinacional.')
  }

  const values: Record<string, boolean[]> = {}
  for (const id of order) {
    const component = components.get(id)!
    const componentInputs = (component.inputs ?? []).map((input) => readPort(values, input))
    const output = evaluateComponent(component, componentInputs, inputs, options)
    values[id] = output
  }

  const outputs: Record<string, boolean> = {}
  for (const component of components.values()) {
    if (component.type === 'output') outputs[component.id] = values[component.id]?.[0] ?? false
  }

  return { values, outputs, order }
}

function evaluateComponent(
  component: ComponentSpec,
  componentInputs: boolean[],
  inputs: Record<string, boolean>,
  options: CircuitEvaluationOptions,
): boolean[] {
  switch (component.type as EditorComponentType) {
    case 'input':
      return [inputs[component.id] ?? component.options?.initial ?? options.defaultInput ?? false]
    case 'constant':
      return [component.options?.value ?? false]
    case 'output':
      return [componentInputs[0] ?? false]
    case 'and':
    case 'or':
    case 'not':
    case 'xor': {
      const result = combinationalResult(component.type, componentInputs)
      if (result === null) {
        throw new Error(`O componente "${component.id}" não é combinacional.`)
      }
      return [result]
    }
    default:
      throw new Error(`O componente "${component.id}" não é suportado no editor combinacional.`)
  }
}

function readPort(values: Record<string, boolean[]>, reference: PortRef): boolean {
  const source = values[reference.node]
  if (!source) {
    throw new Error(`A saída de "${reference.node}" ainda não está disponível.`)
  }
  return source[reference.port ?? 0] ?? false
}
