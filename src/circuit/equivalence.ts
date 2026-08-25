import { bitVector, toBinary, type BitVector } from '../bus'
import { evaluateVectorNetlist } from './evaluate'
import {
  CircuitValidationError,
  isStatefulEditorType,
  toNetlist,
  type CircuitDocument,
} from './editorModel'
import {
  collectCircuitPorts,
  compareCircuitText,
  duplicatePortMessage,
  type CircuitPort,
} from './portIdentity'
import { normalizeCircuitDocument } from './documentContract'
import type { CustomChipLibraryEntry } from './customChip'

/**
 * Teto absoluto de bits de entrada em uma comparação exaustiva.
 *
 * 16 bits equivalem a 65 536 linhas avaliadas em cada circuito. Acima disso a
 * comparação deixa de ser interativa e a resposta correta é recusar, não
 * truncar: uma prova parcial não é prova.
 */
export const MAX_EQUIVALENCE_INPUT_BITS = 16

/** Padrão conservador, alinhado ao limite da tabela verdade vetorial. */
export const DEFAULT_EQUIVALENCE_INPUT_BITS = 12

export type CircuitEquivalenceStatus = 'equivalent' | 'divergent' | 'incomparable'

export type CircuitEquivalenceIssueCode =
  | 'sequential-unsupported'
  | 'duplicate-port-name'
  | 'missing-output'
  | 'input-set-mismatch'
  | 'output-set-mismatch'
  | 'width-mismatch'
  | 'input-bits-exceeded'

export interface CircuitEquivalenceIssue {
  code: CircuitEquivalenceIssueCode
  message: string
  /** Nomes presentes apenas no circuito A, quando o código for de conjunto/largura. */
  onlyInA?: string[]
  /** Nomes presentes apenas no circuito B, quando o código for de conjunto/largura. */
  onlyInB?: string[]
}

export type CircuitEquivalencePort = CircuitPort

export interface CircuitEquivalenceInputValue {
  name: string
  width: number
  /** Valor em binário, com um caractere por bit (mais significativo à esquerda). */
  value: string
}

export interface CircuitEquivalenceDivergence {
  output: string
  width: number
  /** Valor observado no circuito A, em binário. */
  a: string
  /** Valor observado no circuito B, em binário. */
  b: string
}

export interface CircuitEquivalenceCounterexample {
  /** Índice da linha na enumeração canônica, começando em zero. */
  row: number
  inputs: CircuitEquivalenceInputValue[]
  divergences: CircuitEquivalenceDivergence[]
}

export interface CircuitEquivalenceReport {
  status: CircuitEquivalenceStatus
  /** Verdadeiro apenas quando a comparação foi exaustiva e nenhuma linha divergiu. */
  equivalent: boolean
  /** Falso quando a comparação não pôde percorrer todo o espaço de entrada. */
  exhaustive: boolean
  /** Interface comparada, em ordem canônica por nome. */
  inputs: CircuitEquivalencePort[]
  outputs: CircuitEquivalencePort[]
  totalRows: number
  comparedRows: number
  divergentRows: number
  /** Saídas que divergiram em ao menos uma linha, em ordem canônica. */
  divergentOutputs: string[]
  /** Primeira linha divergente na ordem canônica; nulo quando não há divergência. */
  counterexample: CircuitEquivalenceCounterexample | null
  issues: CircuitEquivalenceIssue[]
}

export interface CircuitEquivalenceOptions {
  /** Definições aplicadas aos dois circuitos quando não houver biblioteca específica. */
  customChips?: readonly CustomChipLibraryEntry[]
  /** Definições exclusivas do circuito A. */
  customChipsA?: readonly CustomChipLibraryEntry[]
  /** Definições exclusivas do circuito B. */
  customChipsB?: readonly CustomChipLibraryEntry[]
  /** Teto de bits de entrada aceito nesta comparação. */
  maxInputBits?: number
}

/**
 * Compara dois circuitos combinacionais por comportamento, não por estrutura.
 *
 * A identidade das portas é o rótulo visual (ou o ID, quando não houver
 * rótulo): dois circuitos escritos de formas diferentes são equivalentes se
 * concordarem em todas as combinações de entrada. Quando divergem, o relatório
 * devolve a primeira linha divergente na ordem canônica — o contraexemplo é o
 * produto mais útil da verificação, e é determinístico.
 *
 * A ordem canônica é alfabética por nome de porta, e não a ordem de declaração,
 * para que `compare(a, b)` e `compare(b, a)` encontrem sempre a mesma linha.
 */
export function compareCircuitEquivalence(
  a: CircuitDocument,
  b: CircuitDocument,
  options: CircuitEquivalenceOptions = {},
): CircuitEquivalenceReport {
  const chipsA = options.customChipsA ?? options.customChips
  const chipsB = options.customChipsB ?? options.customChips
  const normalizedA = normalizeCircuitDocument(a)
  const normalizedB = normalizeCircuitDocument(b)

  const netlistA = buildNetlist(normalizedA, chipsA, 'A')
  const netlistB = buildNetlist(normalizedB, chipsB, 'B')

  const sequential = collectSequentialIssue(normalizedA, normalizedB)
  if (sequential) return incomparable([sequential])

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

  const widthIssues = [
    ...compareWidths('entrada', portsA.inputs, portsB.inputs),
    ...compareWidths('saída', portsA.outputs, portsB.outputs),
  ]
  if (widthIssues.length > 0) return incomparable(widthIssues)

  const inputs = portsA.inputs.map((port) => ({ name: port.name, width: port.width }))
  const outputs = portsA.outputs.map((port) => ({ name: port.name, width: port.width }))
  const totalInputBits = inputs.reduce((total, port) => total + port.width, 0)
  const maxInputBits = Math.max(
    1,
    Math.min(options.maxInputBits ?? DEFAULT_EQUIVALENCE_INPUT_BITS, MAX_EQUIVALENCE_INPUT_BITS),
  )
  if (totalInputBits > maxInputBits) {
    return incomparable(
      [
        {
          code: 'input-bits-exceeded',
          message:
            `A comparação exaustiva exigiria ${totalInputBits} bits de entrada; o limite desta execução é ` +
            `${maxInputBits}. Uma comparação parcial não prova equivalência, então nenhuma linha foi avaliada.`,
        },
      ],
      { inputs, outputs, totalRows: 2 ** totalInputBits },
    )
  }

  const totalRows = 2 ** totalInputBits
  const divergentOutputs = new Set<string>()
  let divergentRows = 0
  let counterexample: CircuitEquivalenceCounterexample | null = null

  for (let row = 0; row < totalRows; row += 1) {
    const values = rowValues(inputs, row, totalInputBits)
    const resultA = evaluateVectorNetlist(
      netlistA,
      assignmentFor(inputs, values, portsA.inputIds),
      { customChips: chipsA },
    )
    const resultB = evaluateVectorNetlist(
      netlistB,
      assignmentFor(inputs, values, portsB.inputIds),
      { customChips: chipsB },
    )

    const divergences: CircuitEquivalenceDivergence[] = []
    for (const output of outputs) {
      const valueA = readOutput(resultA.outputs, portsA.outputIds.get(output.name), output.width)
      const valueB = readOutput(resultB.outputs, portsB.outputIds.get(output.name), output.width)
      if (valueA !== valueB) {
        divergences.push({ output: output.name, width: output.width, a: valueA, b: valueB })
        divergentOutputs.add(output.name)
      }
    }

    if (divergences.length > 0) {
      divergentRows += 1
      counterexample ??= {
        row,
        inputs: inputs.map((port, index) => ({
          name: port.name,
          width: port.width,
          value: toBinary(values[index]),
        })),
        divergences,
      }
    }
  }

  return {
    status: divergentRows > 0 ? 'divergent' : 'equivalent',
    equivalent: divergentRows === 0,
    exhaustive: true,
    inputs,
    outputs,
    totalRows,
    comparedRows: totalRows,
    divergentRows,
    divergentOutputs: outputs.map((port) => port.name).filter((name) => divergentOutputs.has(name)),
    counterexample,
    issues: [],
  }
}

function buildNetlist(
  document: CircuitDocument,
  customChips: readonly CustomChipLibraryEntry[] | undefined,
  side: 'A' | 'B',
) {
  try {
    return toNetlist(document, { allowBuses: true, customChips })
  } catch (error) {
    const detail = error instanceof CircuitValidationError
      ? error.issues[0]?.message ?? error.message
      : error instanceof Error
        ? error.message
        : 'motivo desconhecido'
    throw new Error(`Circuito ${side} inválido: ${detail}`)
  }
}

function collectSequentialIssue(
  a: CircuitDocument,
  b: CircuitDocument,
): CircuitEquivalenceIssue | null {
  const inA = statefulTypes(a)
  const inB = statefulTypes(b)
  if (inA.length === 0 && inB.length === 0) return null
  const parts: string[] = []
  if (inA.length > 0) parts.push(`A usa ${inA.join(', ')}`)
  if (inB.length > 0) parts.push(`B usa ${inB.join(', ')}`)
  return {
    code: 'sequential-unsupported',
    message:
      `A equivalência exaustiva cobre apenas circuitos combinacionais; ${parts.join(' e ')}. ` +
      'Componentes com estado dependem do histórico e exigem comparação temporal.',
    onlyInA: inA.length > 0 ? inA : undefined,
    onlyInB: inB.length > 0 ? inB : undefined,
  }
}

function statefulTypes(document: CircuitDocument): string[] {
  const found = new Set<string>()
  for (const node of document.nodes) {
    if (isStatefulEditorType(node.type)) found.add(node.type)
  }
  return [...found].sort(compareCircuitText)
}

interface CollectedPorts {
  inputs: CircuitEquivalencePort[]
  outputs: CircuitEquivalencePort[]
  inputIds: Map<string, string>
  outputIds: Map<string, string>
  issues: CircuitEquivalenceIssue[]
}

function collectPorts(document: CircuitDocument, side: 'A' | 'B'): CollectedPorts {
  const identity = collectCircuitPorts(document)
  return {
    inputs: identity.inputs,
    outputs: identity.outputs,
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
  a: readonly CircuitEquivalencePort[],
  b: readonly CircuitEquivalencePort[],
): CircuitEquivalenceIssue[] {
  const namesA = new Set(a.map((port) => port.name))
  const namesB = new Set(b.map((port) => port.name))
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

function compareWidths(
  kind: string,
  a: readonly CircuitEquivalencePort[],
  b: readonly CircuitEquivalencePort[],
): CircuitEquivalenceIssue[] {
  const widthsB = new Map(b.map((port) => [port.name, port.width]))
  const divergent = a
    .filter((port) => widthsB.get(port.name) !== port.width)
    .map((port) => `${port.name} (A=${port.width}, B=${widthsB.get(port.name)})`)
  if (divergent.length === 0) return []
  return [
    {
      code: 'width-mismatch',
      message: `As larguras de ${kind} não coincidem: ${divergent.join('; ')}.`,
    },
  ]
}

function rowValues(
  inputs: readonly CircuitEquivalencePort[],
  row: number,
  totalBits: number,
): BitVector[] {
  const values: BitVector[] = []
  let consumed = 0
  for (const port of inputs) {
    const shift = totalBits - consumed - port.width
    const mask = (1n << BigInt(port.width)) - 1n
    values.push(bitVector(port.width, (BigInt(row) >> BigInt(Math.max(0, shift))) & mask))
    consumed += port.width
  }
  return values
}

function assignmentFor(
  inputs: readonly CircuitEquivalencePort[],
  values: readonly BitVector[],
  ids: ReadonlyMap<string, string>,
): Record<string, BitVector> {
  const assignment: Record<string, BitVector> = {}
  inputs.forEach((port, index) => {
    const id = ids.get(port.name)
    if (id) assignment[id] = values[index]
  })
  return assignment
}

function readOutput(
  outputs: Record<string, BitVector>,
  id: string | undefined,
  width: number,
): string {
  const value = id ? outputs[id] : undefined
  return toBinary(value ?? bitVector(width, 0))
}

function incomparable(
  issues: CircuitEquivalenceIssue[],
  partial: Partial<Pick<CircuitEquivalenceReport, 'inputs' | 'outputs' | 'totalRows'>> = {},
): CircuitEquivalenceReport {
  return {
    status: 'incomparable',
    equivalent: false,
    exhaustive: false,
    inputs: partial.inputs ?? [],
    outputs: partial.outputs ?? [],
    totalRows: partial.totalRows ?? 0,
    comparedRows: 0,
    divergentRows: 0,
    divergentOutputs: [],
    counterexample: null,
    issues,
  }
}

