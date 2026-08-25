import { createDocumentRuntime } from '../simulation/documentRuntime'
import type { CustomChipLibraryEntry } from './customChip'
import { CircuitValidationError, type CircuitDocument } from './editorModel'
import { normalizeCircuitDocument } from './documentContract'
import {
  circuitPortName,
  collectCircuitPorts,
  compareCircuitText,
  duplicatePortMessage,
} from './portIdentity'

/**
 * Teto de tiques de uma comparação temporal.
 *
 * O limite existe para que um roteiro mal formado não prenda a interface. Ele
 * não é uma medida de qualidade: um roteiro curto que encontra a divergência
 * vale mais que um longo que não encontra nada.
 */
export const MAX_DIFFERENTIAL_TICKS = 1000

export type CircuitDifferentialStatus = 'identical' | 'divergent' | 'incomparable'

export type CircuitDifferentialIssueCode =
  | 'duplicate-port-name'
  | 'missing-output'
  | 'input-set-mismatch'
  | 'output-set-mismatch'
  | 'unknown-input'
  | 'empty-script'
  | 'ticks-exceeded'

export interface CircuitDifferentialIssue {
  code: CircuitDifferentialIssueCode
  message: string
  onlyInA?: string[]
  onlyInB?: string[]
}

/** Um passo do roteiro: aplica entradas e roda um número de tiques. */
export interface CircuitDifferentialStep {
  /** Valores a aplicar nos pinos de entrada, por nome, antes de rodar. */
  set?: Readonly<Record<string, boolean>>
  /** Quantos tiques rodar depois de aplicar. Mínimo 1. */
  ticks?: number
}

export interface CircuitDifferentialSignal {
  signal: string
  a: boolean
  b: boolean
}

export interface CircuitDifferentialDivergence {
  /** Tique global em que os dois circuitos passaram a discordar. */
  tick: number
  /** Índice do passo do roteiro que estava em execução, começando em zero. */
  step: number
  /** Entradas em vigor nesse instante, em ordem canônica. */
  inputs: { name: string; value: boolean }[]
  /** Somente os sinais que discordam nesse tique. */
  signals: CircuitDifferentialSignal[]
}

export interface CircuitDifferentialReport {
  status: CircuitDifferentialStatus
  /**
   * Verdadeiro quando os dois circuitos concordaram em todos os tiques do
   * roteiro. Isso **não** é equivalência: é concordância em um roteiro.
   */
  identical: boolean
  inputs: string[]
  outputs: string[]
  totalTicks: number
  comparedTicks: number
  divergentTicks: number
  divergentOutputs: string[]
  firstDivergence: CircuitDifferentialDivergence | null
  issues: CircuitDifferentialIssue[]
}

export interface CircuitDifferentialOptions {
  /** Teto de tiques desta execução; o máximo absoluto é MAX_DIFFERENTIAL_TICKS. */
  maxTicks?: number
  /** Definições locais usadas para expandir chips nos dois runtimes. */
  customChips?: readonly CustomChipLibraryEntry[]
}

/**
 * Roda a mesma sequência de entradas em dois circuitos e aponta o primeiro
 * tique em que eles discordam.
 *
 * É a contraparte temporal de `compareCircuitEquivalence`: cobre exatamente a
 * classe que aquela recusa — circuitos com clock, flip-flops e atrasos, cuja
 * saída depende do histórico.
 *
 * A diferença de força entre as duas é deliberada e aparece no vocabulário do
 * relatório. A equivalência percorre **todo** o espaço de entrada e por isso
 * pode dizer `equivalent`. Aqui só existe o roteiro que o autor escreveu, então
 * o melhor resultado possível é `identical` — "concordaram neste roteiro".
 * Nenhum roteiro que termina sem divergência prova que não existe uma.
 */
export function compareCircuitTimelines(
  a: CircuitDocument,
  b: CircuitDocument,
  script: readonly CircuitDifferentialStep[],
  options: CircuitDifferentialOptions = {},
): CircuitDifferentialReport {
  const normalizedA = normalizeCircuitDocument(a)
  const normalizedB = normalizeCircuitDocument(b)

  const portsA = collectPorts(normalizedA, 'A')
  const portsB = collectPorts(normalizedB, 'B')
  const nameIssues = [...portsA.issues, ...portsB.issues]
  if (nameIssues.length > 0) return incomparable(nameIssues)

  if (portsA.outputs.length === 0 || portsB.outputs.length === 0) {
    return incomparable([
      {
        code: 'missing-output',
        message: 'Os dois circuitos precisam ter pelo menos uma saída para serem comparados.',
      },
    ])
  }

  const interfaceIssues = [
    ...compareNameSets('input-set-mismatch', 'entrada', portsA.inputs, portsB.inputs),
    ...compareNameSets('output-set-mismatch', 'saída', portsA.outputs, portsB.outputs),
  ]
  if (interfaceIssues.length > 0) return incomparable(interfaceIssues)

  const inputs = [...portsA.inputs].sort(compareCircuitText)
  const outputs = [...portsA.outputs].sort(compareCircuitText)

  if (script.length === 0) {
    return incomparable(
      [{ code: 'empty-script', message: 'O roteiro precisa ter pelo menos um passo.' }],
      { inputs, outputs },
    )
  }

  const unknown = new Set<string>()
  let totalTicks = 0
  for (const step of script) {
    totalTicks += normalizeTicks(step.ticks)
    for (const name of Object.keys(step.set ?? {})) {
      if (!portsA.inputIds.has(name)) unknown.add(name)
    }
  }
  if (unknown.size > 0) {
    return incomparable(
      [
        {
          code: 'unknown-input',
          message:
            `O roteiro aplica valores em entradas que não existem nos circuitos: ` +
            `${[...unknown].sort(compareCircuitText).join(', ')}.`,
        },
      ],
      { inputs, outputs, totalTicks },
    )
  }

  const maxTicks = Math.max(1, Math.min(options.maxTicks ?? MAX_DIFFERENTIAL_TICKS, MAX_DIFFERENTIAL_TICKS))
  if (totalTicks > maxTicks) {
    return incomparable(
      [
        {
          code: 'ticks-exceeded',
          message:
            `O roteiro pede ${totalTicks} tiques; o limite desta execução é ${maxTicks}. ` +
            'Nenhum tique foi simulado.',
        },
      ],
      { inputs, outputs, totalTicks },
    )
  }

  const runtimeA = buildRuntime(normalizedA, 'A', options)
  const runtimeB = buildRuntime(normalizedB, 'B', options)

  // O contraexemplo precisa refletir o estado real das entradas, e o runtime
  // aplica `options.initial` antes do primeiro tique. Sem semear isso aqui, uma
  // entrada que nunca aparece no roteiro seria reportada como 0 mesmo tendo
  // começado em 1.
  const applied = new Map<string, boolean>()
  for (const node of normalizedA.nodes) {
    if (node.type === 'input' && node.options?.initial !== undefined) {
      applied.set(circuitPortName(node), node.options.initial)
    }
  }
  const divergentOutputs = new Set<string>()
  let divergentTicks = 0
  let comparedTicks = 0
  let firstDivergence: CircuitDifferentialDivergence | null = null

  script.forEach((step, stepIndex) => {
    for (const [name, value] of Object.entries(step.set ?? {})) {
      applied.set(name, value)
      runtimeA.setInput(portsA.inputIds.get(name)!, value)
      runtimeB.setInput(portsB.inputIds.get(name)!, value)
    }

    const ticks = normalizeTicks(step.ticks)
    for (let index = 0; index < ticks; index += 1) {
      runtimeA.tick()
      runtimeB.tick()
      comparedTicks += 1

      const signals: CircuitDifferentialSignal[] = []
      for (const output of outputs) {
        const valueA = runtimeA.read(portsA.outputIds.get(output)!)
        const valueB = runtimeB.read(portsB.outputIds.get(output)!)
        if (valueA !== valueB) {
          signals.push({ signal: output, a: valueA, b: valueB })
          divergentOutputs.add(output)
        }
      }

      if (signals.length > 0) {
        divergentTicks += 1
        firstDivergence ??= {
          tick: runtimeA.tickCount,
          step: stepIndex,
          inputs: inputs.map((name) => ({ name, value: applied.get(name) ?? false })),
          signals,
        }
      }
    }
  })

  return {
    status: divergentTicks > 0 ? 'divergent' : 'identical',
    identical: divergentTicks === 0,
    inputs,
    outputs,
    totalTicks,
    comparedTicks,
    divergentTicks,
    divergentOutputs: outputs.filter((name) => divergentOutputs.has(name)),
    firstDivergence,
    issues: [],
  }
}

function buildRuntime(document: CircuitDocument, side: 'A' | 'B', options: CircuitDifferentialOptions) {
  try {
    return createDocumentRuntime(document, { customChips: options.customChips })
  } catch (error) {
    const detail = error instanceof CircuitValidationError
      ? error.issues[0]?.message ?? error.message
      : error instanceof Error
        ? error.message
        : 'motivo desconhecido'
    throw new Error(`Circuito ${side} inválido: ${detail}`)
  }
}

function normalizeTicks(ticks: number | undefined): number {
  if (ticks === undefined) return 1
  if (!Number.isFinite(ticks)) return 1
  return Math.max(1, Math.floor(ticks))
}

interface CollectedPorts {
  inputs: string[]
  outputs: string[]
  inputIds: Map<string, string>
  outputIds: Map<string, string>
  issues: CircuitDifferentialIssue[]
}

function collectPorts(document: CircuitDocument, side: 'A' | 'B'): CollectedPorts {
  const identity = collectCircuitPorts(document)
  return {
    inputs: identity.inputs.map((port) => port.name),
    outputs: identity.outputs.map((port) => port.name),
    inputIds: identity.inputIds,
    outputIds: identity.outputIds,
    issues: identity.duplicates.map((duplicate) => ({
      code: 'duplicate-port-name' as const,
      message: duplicatePortMessage(duplicate, side),
    })),
  }
}

function compareNameSets(
  code: 'input-set-mismatch' | 'output-set-mismatch',
  kind: string,
  a: readonly string[],
  b: readonly string[],
): CircuitDifferentialIssue[] {
  const namesA = new Set(a)
  const namesB = new Set(b)
  const onlyInA = [...namesA].filter((name) => !namesB.has(name)).sort(compareCircuitText)
  const onlyInB = [...namesB].filter((name) => !namesA.has(name)).sort(compareCircuitText)
  if (onlyInA.length === 0 && onlyInB.length === 0) return []

  const parts: string[] = []
  if (onlyInA.length > 0) parts.push(`só em A: ${onlyInA.join(', ')}`)
  if (onlyInB.length > 0) parts.push(`só em B: ${onlyInB.join(', ')}`)
  return [
    {
      code,
      message: `Os circuitos não expõem a mesma interface de ${kind} (${parts.join('; ')}).`,
      onlyInA: onlyInA.length > 0 ? onlyInA : undefined,
      onlyInB: onlyInB.length > 0 ? onlyInB : undefined,
    },
  ]
}

function incomparable(
  issues: CircuitDifferentialIssue[],
  partial: Partial<Pick<CircuitDifferentialReport, 'inputs' | 'outputs' | 'totalTicks'>> = {},
): CircuitDifferentialReport {
  return {
    status: 'incomparable',
    identical: false,
    inputs: partial.inputs ?? [],
    outputs: partial.outputs ?? [],
    totalTicks: partial.totalTicks ?? 0,
    comparedTicks: 0,
    divergentTicks: 0,
    divergentOutputs: [],
    firstDivergence: null,
    issues,
  }
}
