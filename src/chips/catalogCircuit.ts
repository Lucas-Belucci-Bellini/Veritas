import { collectVariables, parse } from '../engine'
import { netlistFromAst } from '../simulation/fromAst'
import {
  MAX_CIRCUIT_LABEL_LENGTH,
  MAX_CIRCUIT_NAME_LENGTH,
  type CircuitDocument,
  type CircuitNode,
} from '../circuit'
import type { ChipEntry } from './types'

/**
 * Converte um chip do catálogo em um documento combinacional executável.
 *
 * O catálogo contém expressões derivadas, não os JSONs originais do DLS. Por
 * isso somente chips escalares com uma expressão válida para cada saída podem
 * ser materializados no editor nesta etapa; os demais continuam disponíveis
 * para consulta, mas não são apresentados como executáveis.
 */
export function catalogChipToCircuitDocument(chip: ChipEntry): CircuitDocument | null {
  if (chip.widths?.some((width) => width !== 1)) return null
  if (!chip.derivedOutputs || chip.derivedOutputs.length !== chip.out) return null
  if (chip.derivedOutputs.some((output) => !output.expression)) return null

  const expressions = chip.derivedOutputs.map((output) => output.expression!)
  const variables = chip.variables?.length === chip.in
    ? chip.variables
    : inferVariables(expressions, chip.in)
  if (!variables || variables.length !== chip.in) return null

  const name = bounded(chip.name, MAX_CIRCUIT_NAME_LENGTH) || 'Chip importado'
  const inputLabels = chip.pins?.in?.length === chip.in
    ? chip.pins.in
    : variables
  const outputLabels = chip.pins?.out?.length === chip.out
    ? chip.pins.out
    : chip.derivedOutputs.map((output, index) => output.name || `OUT ${index + 1}`)

  const nodes: CircuitNode[] = variables.map((variable, index) => ({
    id: `input-${index + 1}`,
    type: 'input',
    position: { x: 0, y: index * 80 },
    label: bounded(inputLabels[index] || variable, MAX_CIRCUIT_LABEL_LENGTH),
  }))
  const connections: CircuitDocument['connections'] = []
  const inputIds = new Map(variables.map((variable, index) => [variable, `input-${index + 1}`] as const))

  for (const [outputIndex, expression] of expressions.entries()) {
    let ast
    try {
      ast = parse(expression)
    } catch {
      return null
    }

    let generated
    try {
      generated = netlistFromAst(ast)
    } catch {
      return null
    }

    const ids = new Map<string, string>()
    for (const component of generated.netlist.components) {
      const mappedInput = component.type === 'input'
        ? inputIds.get(component.label ?? '')
        : undefined
      const id = mappedInput ?? `output-${outputIndex + 1}-${component.id}`
      ids.set(component.id, id)
      if (mappedInput) continue

      const isOutput = component.type === 'output'
      nodes.push({
        id,
        type: component.type,
        position: isOutput
          ? { x: 420, y: outputIndex * 120 }
          : { x: 160 + (component.id.length % 4) * 70, y: outputIndex * 120 + 40 },
        ...(isOutput
          ? { label: bounded(outputLabels[outputIndex] || `OUT ${outputIndex + 1}`, MAX_CIRCUIT_LABEL_LENGTH) }
          : {}),
        ...(component.options ? { options: component.options } : {}),
      })
    }

    for (const component of generated.netlist.components) {
      const target = ids.get(component.id)
      if (!target) return null
      for (const [port, source] of (component.inputs ?? []).entries()) {
        const sourceId = ids.get(source.node)
        if (!sourceId) return null
        connections.push({ source: { node: sourceId, ...(source.port === undefined ? {} : { port: source.port }) }, target: { node: target, port } })
      }
    }
  }

  const document: CircuitDocument = {
    format: 'veritas-circuit',
    version: 1,
    name,
    nodes,
    connections,
  }
  return document
}

function inferVariables(expressions: readonly string[], inputCount: number): string[] | null {
  const found = new Set<string>()
  try {
    for (const expression of expressions) {
      for (const variable of collectVariables(parse(expression))) found.add(variable)
    }
  } catch {
    return null
  }
  const variables = [...found].sort()
  if (variables.length > inputCount) return null
  for (let index = variables.length; index < inputCount; index += 1) {
    variables.push(`X${index + 1}`)
  }
  return variables
}

function bounded(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength)
}
