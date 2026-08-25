import type { CircuitDocument, CircuitNode } from './editorModel'

/**
 * Identidade pública de uma porta de entrada ou saída.
 *
 * Todas as ferramentas de verificação pareiam portas pelo **rótulo visual**,
 * com o ID como reserva. É essa escolha que permite comparar dois circuitos
 * desenhados separadamente: eles nunca compartilham IDs, mas compartilham a
 * interface que o autor nomeou.
 */
export interface CircuitPort {
  name: string
  width: number
}

export interface CircuitPortIdentity {
  /** Entradas em ordem canônica por nome. */
  inputs: CircuitPort[]
  /** Saídas em ordem canônica por nome. */
  outputs: CircuitPort[]
  /** Nome público → ID do nó, para entradas. */
  inputIds: Map<string, string>
  /** Nome público → ID do nó, para saídas. */
  outputIds: Map<string, string>
  /** Nomes duplicados encontrados; a identidade fica ambígua e o chamador recusa. */
  duplicates: CircuitPortDuplicate[]
}

export interface CircuitPortDuplicate {
  name: string
  direction: 'input' | 'output'
}

/**
 * Lê as portas públicas de um documento, em ordem canônica por nome.
 *
 * A ordem é alfabética, e não a de declaração, para que comparações entre dois
 * documentos sejam simétricas: trocar os lados encontra sempre a mesma linha ou
 * o mesmo tique.
 */
export function collectCircuitPorts(document: CircuitDocument): CircuitPortIdentity {
  const inputs: CircuitPort[] = []
  const outputs: CircuitPort[] = []
  const inputIds = new Map<string, string>()
  const outputIds = new Map<string, string>()
  const duplicates: CircuitPortDuplicate[] = []

  for (const node of document.nodes) {
    if (node.type !== 'input' && node.type !== 'output') continue
    const name = circuitPortName(node)
    const ids = node.type === 'input' ? inputIds : outputIds
    if (ids.has(name)) {
      duplicates.push({ name, direction: node.type })
      continue
    }
    ids.set(name, node.id)
    const port: CircuitPort = { name, width: node.options?.width ?? 1 }
    if (node.type === 'input') inputs.push(port)
    else outputs.push(port)
  }

  inputs.sort(comparePorts)
  outputs.sort(comparePorts)
  return { inputs, outputs, inputIds, outputIds, duplicates }
}

/** Nome público de um nó: o rótulo, ou o ID quando não houver rótulo. */
export function circuitPortName(node: CircuitNode): string {
  const label = node.label?.trim()
  return label && label.length > 0 ? label : node.id
}

/** Mensagem única para o caso de rótulo duplicado, usada por todas as ferramentas. */
export function duplicatePortMessage(duplicate: CircuitPortDuplicate, side?: string): string {
  const kind = duplicate.direction === 'input' ? 'entrada' : 'saída'
  const subject = side ? `O circuito ${side} tem` : 'O circuito tem'
  return (
    `${subject} mais de uma ${kind} chamada "${duplicate.name}". ` +
    'A verificação usa o rótulo como identidade, então os nomes precisam ser únicos.'
  )
}

/** Comparação estável e independente de locale, para manter a ordem determinística. */
export function compareCircuitText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function comparePorts(a: CircuitPort, b: CircuitPort): number {
  return compareCircuitText(a.name, b.name)
}
