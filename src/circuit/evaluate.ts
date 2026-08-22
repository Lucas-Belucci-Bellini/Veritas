import {
  combinationalResult,
  type ComponentSpec,
  type Netlist,
  type PortRef,
} from '../simulation/components'
import { bitVector, type BitVector, bitwiseAnd, bitwiseNot, bitwiseOr, bitwiseXor, parseBusLiteral } from '../bus'
import {
  toNetlist,
  type CircuitDocument,
  type EditorComponentType,
} from './editorModel'
import { assertCustomChipDepth, resolveCustomChipDefinition } from './customChipInstance'
import type { CustomChipLibraryEntry } from './customChip'
import { normalizeCircuitDocument } from './documentContract'
import { topologicalOrder } from './topology'

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
  /** Definições locais para expandir instâncias `custom-chip`. */
  customChips?: readonly CustomChipLibraryEntry[]
}

export type VectorInput = BitVector | bigint | number | string

type CircuitVectorValue = BitVector | BitVector[]

export interface CircuitVectorEvaluation {
  values: Record<string, BitVector>
  outputs: Record<string, BitVector>
  order: string[]
}

export interface CircuitVectorEvaluationOptions {
  /** Valor padrão aplicado a entradas ausentes, repetido na largura da porta. */
  defaultInput?: VectorInput
  /** Definições locais para expandir instâncias `custom-chip`. */
  customChips?: readonly CustomChipLibraryEntry[]
}

export function evaluateCircuit(
  document: CircuitDocument,
  inputs: Record<string, boolean> = {},
  options: CircuitEvaluationOptions = {},
): CircuitEvaluation {
  const resolved = normalizeCircuitDocument(document)
  return evaluateNetlist(toNetlist(resolved, { customChips: options.customChips }), inputs, options)
}

export function evaluateCircuitVectors(
  document: CircuitDocument,
  inputs: Record<string, VectorInput> = {},
  options: CircuitVectorEvaluationOptions = {},
): CircuitVectorEvaluation {
  const resolved = normalizeCircuitDocument(document)
  return evaluateVectorNetlist(toNetlist(resolved, { allowBuses: true, customChips: options.customChips }), inputs, options)
}

/**
 * Avalia apenas netlists combinacionais. A função é independente de React e do
 * DOM para ser compartilhada pelo editor, pelos testes e futuramente pelo MCP.
 */
export function evaluateNetlist(
  netlist: Netlist,
  inputs: Record<string, boolean> = {},
  options: CircuitEvaluationOptions = {},
  depth = 0,
): CircuitEvaluation {
  const components = new Map<string, ComponentSpec>()
  for (const component of netlist.components) {
    if (components.has(component.id)) {
      throw new Error(`Componente duplicado: "${component.id}".`)
    }
    components.set(component.id, component)
  }

  const order = topologicalOrder([...components.values()])

  const values: Record<string, boolean[]> = {}
  for (const id of order) {
    const component = components.get(id)!
    const componentInputs = (component.inputs ?? []).map((input) => readPort(values, input))
    const output = component.type === 'custom-chip'
      ? evaluateCustomComponent(component, componentInputs, options, depth)
      : evaluateComponent(component, componentInputs, inputs, options)
    values[id] = output
  }

  const outputs: Record<string, boolean> = {}
  for (const component of components.values()) {
    if (component.type === 'output') outputs[component.id] = values[component.id]?.[0] ?? false
  }

  return { values, outputs, order }
}

function evaluateVectorNetlist(
  netlist: Netlist,
  inputs: Record<string, VectorInput>,
  options: CircuitVectorEvaluationOptions,
  depth = 0,
): CircuitVectorEvaluation {
  const components = new Map<string, ComponentSpec>()
  for (const component of netlist.components) {
    if (components.has(component.id)) throw new Error(`Componente duplicado: "${component.id}".`)
    components.set(component.id, component)
  }

  const order = topologicalOrder([...components.values()])

  const values: Record<string, CircuitVectorValue> = {}
  for (const id of order) {
    const component = components.get(id)!
    const componentInputs = (component.inputs ?? []).map((input) => readVectorPort(values, input))
    values[id] = component.type === 'custom-chip'
      ? evaluateCustomVectorComponent(component, componentInputs, options, depth)
      : evaluateVectorComponent(component, componentInputs, inputs, options)
  }

  const outputs: Record<string, BitVector> = {}
  for (const component of components.values()) {
    if (component.type === 'output') outputs[component.id] = readVectorPort(values, { node: component.id })
  }
  const publicValues: Record<string, BitVector> = {}
  for (const [id, value] of Object.entries(values)) publicValues[id] = Array.isArray(value) ? value[0] : value
  return { values: publicValues, outputs, order }
}

function evaluateCustomComponent(
  component: ComponentSpec,
  componentInputs: boolean[],
  options: CircuitEvaluationOptions,
  depth: number,
): boolean[] {
  assertCustomChipDepth(depth)
  const definition = resolveCustomChipDefinition({ id: component.id, type: 'custom-chip', options: component.options }, options.customChips)
  const nestedInputs = Object.fromEntries(definition.inputs.map((port, index) => [port.id, componentInputs[index] ?? false]))
  const nested = evaluateNetlist(toNetlist(definition.document, { customChips: options.customChips }), nestedInputs, options, depth + 1)
  return definition.outputs.map((port) => nested.outputs[port.id] ?? false)
}

function evaluateCustomVectorComponent(
  component: ComponentSpec,
  componentInputs: BitVector[],
  options: CircuitVectorEvaluationOptions,
  depth: number,
): BitVector[] {
  assertCustomChipDepth(depth)
  const definition = resolveCustomChipDefinition({ id: component.id, type: 'custom-chip', options: component.options }, options.customChips)
  const nestedInputs = Object.fromEntries(definition.inputs.map((port, index) => [port.id, componentInputs[index] ?? bitVector(port.width, 0)]))
  const nested = evaluateVectorNetlist(toNetlist(definition.document, { allowBuses: true, customChips: options.customChips }), nestedInputs, options, depth + 1)
  return definition.outputs.map((port) => nested.outputs[port.id] ?? bitVector(port.width, 0))
}

function evaluateVectorComponent(
  component: ComponentSpec,
  componentInputs: BitVector[],
  inputs: Record<string, VectorInput>,
  options: CircuitVectorEvaluationOptions,
): BitVector {
  const width = component.options?.width ?? componentInputs[0]?.width ?? 1
  switch (component.type as EditorComponentType) {
    case 'input':
      return coerceVector(inputs[component.id] ?? options.defaultInput ?? 0, width)
    case 'constant':
      return coerceVector(component.options?.value ?? false, width)
    case 'output':
    case 'transmitter':
    case 'receiver':
      return componentInputs[0] ?? bitVector(width, 0)
    case 'and':
      return foldVectors(componentInputs, width, bitwiseAnd)
    case 'or':
      return foldVectors(componentInputs, width, bitwiseOr)
    case 'xor':
      return foldVectors(componentInputs, width, bitwiseXor)
    case 'not':
      return bitwiseNot(componentInputs[0] ?? bitVector(width, 0))
    default:
      throw new Error(`O componente "${component.id}" não é suportado no avaliador vetorial.`)
  }
}

function foldVectors(values: BitVector[], width: number, operation: (left: BitVector, right: BitVector) => BitVector): BitVector {
  if (values.length === 0) return bitVector(width, 0)
  return values.slice(1).reduce((left, right) => operation(left, right), values[0])
}

function coerceVector(value: VectorInput | boolean, width: number): BitVector {
  if (typeof value === 'object' && value !== null && 'bits' in value) {
    const vector = value as BitVector
    if (vector.width !== width) throw new Error(`A entrada vetorial espera ${width} bits, mas recebeu ${vector.width}.`)
    return vector
  }
  if (typeof value === 'string') return parseBusLiteral(value, width)
  return bitVector(width, typeof value === 'boolean' ? (value ? 1n : 0n) : value)
}

function readVectorPort(values: Record<string, CircuitVectorValue>, reference: PortRef): BitVector {
  const source = values[reference.node]
  if (!source) throw new Error(`A saída de "${reference.node}" ainda não está disponível.`)
  if (Array.isArray(source)) {
    const value = source[reference.port ?? 0]
    if (!value) throw new Error(`A porta vetorial ${reference.port ?? 0} não existe em "${reference.node}".`)
    return value
  }
  if (reference.port !== undefined && reference.port !== 0) throw new Error(`A porta vetorial ${reference.port} não existe em "${reference.node}".`)
  return source
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
    case 'transmitter':
    case 'receiver':
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
