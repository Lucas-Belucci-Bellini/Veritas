import { MAX_CIRCUIT_LABEL_LENGTH } from './documentLimits'
import type { CircuitConnection, CircuitDocument, CircuitNode } from './editorModel'

/**
 * Traz a biblioteca de chips do Digital Logic Sim preservando a construção.
 *
 * Um chip do DLS é uma netlist: pinos de entrada, pinos de saída, sub-chips e
 * fios. A importação que existia antes resolvia essa netlist, simulava o chip
 * em todas as combinações e guardava só a expressão booleana de cada saída — o
 * comportamento sobrevivia, a construção não, e chips com mais de dez entradas
 * ficavam de fora porque a simulação exaustiva não cabia.
 *
 * Aqui a netlist vira um `CircuitDocument`: cada sub-chip vira uma instância do
 * chip correspondente e a hierarquia que o autor montou continua navegável.
 *
 * O NAND é o único primitivo. O projeto constrói o próprio AND, OR, NOT e XOR
 * a partir dele; trocar essas definições por portas nativas do Veritas daria o
 * mesmo resultado e apagaria justamente o que o autor construiu.
 *
 * O que a importação **não** promete é equivalência com o DLS: ela transcreve a
 * netlist, não confere comportamento. Para isso existe a comparação de
 * equivalência, que roda depois sobre o chip já importado.
 */

export interface DlsPinAddress {
  PinID: number
  PinOwnerID: number
}

export interface DlsPin {
  ID: number
  Name?: string
  BitCount?: number
  Position?: { x: number; y: number }
}

export interface DlsSubChip {
  ID: number
  Name: string
  Label?: string
  Position?: { x: number; y: number }
}

export interface DlsWire {
  SourcePinAddress: DlsPinAddress
  TargetPinAddress: DlsPinAddress
}

export interface DlsChip {
  Name: string
  InputPins?: DlsPin[]
  OutputPins?: DlsPin[]
  SubChips?: DlsSubChip[]
  Wires?: DlsWire[]
}

export interface DlsImportStep {
  name: string
  chip: DlsChip
  /** Chips usados diretamente por este, todos em passos anteriores da ordem. */
  dependencies: readonly string[]
}

export interface DlsImportRefusal {
  name: string
  reason: string
}

export interface DlsImportPlan {
  /** Chips em ordem de dependência: o filho sempre vem antes de quem o usa. */
  order: readonly DlsImportStep[]
  refused: readonly DlsImportRefusal[]
}

export interface DlsImportReport {
  imported: readonly { id: number; name: string }[]
  /** Chips que já estavam na biblioteca e foram reaproveitados no lugar de duplicados. */
  reused: readonly { id: number; name: string }[]
  refused: readonly DlsImportRefusal[]
}

/**
 * O único primitivo do DLS que o Veritas tem nativo.
 *
 * Os índices de pino são convenção do próprio DLS — entradas 0 e 1, saída 2 —
 * e valem para toda a biblioteca.
 */
const NAND_NAMES = new Set(['NAND', 'Nand'])
const NAND_INPUT_PIN_IDS = [0, 1]
const NAND_OUTPUT_PIN_IDS = [2]

/** O DLS trabalha em unidades de grade; o canvas do Veritas, em pixels. */
const DLS_UNIT_IN_PIXELS = 48
const CANVAS_MARGIN = 40

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readPins(value: unknown): DlsPin[] | null {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) return null
  const pins: DlsPin[] = []
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.ID !== 'number') return null
    pins.push(entry as unknown as DlsPin)
  }
  return pins
}

/** Lê a forma de um chip do DLS, ou explica o que faltou. */
export function parseDlsChip(value: unknown): { chip: DlsChip } | { reason: string } {
  if (!isRecord(value)) return { reason: 'O arquivo não contém um objeto JSON.' }
  if (typeof value.Name !== 'string' || value.Name.trim().length === 0) {
    return { reason: 'O arquivo não tem o campo "Name" de um chip do Digital Logic Sim.' }
  }
  const inputs = readPins(value.InputPins)
  const outputs = readPins(value.OutputPins)
  if (!inputs || !outputs) return { reason: 'Os pinos do chip não estão no formato esperado.' }

  const subChips: DlsSubChip[] = []
  if (Array.isArray(value.SubChips)) {
    for (const entry of value.SubChips) {
      if (!isRecord(entry) || typeof entry.ID !== 'number' || typeof entry.Name !== 'string') {
        return { reason: 'Um dos sub-chips não tem ID ou nome.' }
      }
      subChips.push(entry as unknown as DlsSubChip)
    }
  }

  const wires: DlsWire[] = []
  if (Array.isArray(value.Wires)) {
    for (const entry of value.Wires) {
      if (!isRecord(entry) || !isAddress(entry.SourcePinAddress) || !isAddress(entry.TargetPinAddress)) {
        return { reason: 'Um dos fios não tem origem ou destino no formato esperado.' }
      }
      wires.push(entry as unknown as DlsWire)
    }
  }

  return {
    chip: { Name: value.Name, InputPins: inputs, OutputPins: outputs, SubChips: subChips, Wires: wires },
  }
}

function isAddress(value: unknown): boolean {
  return isRecord(value) && typeof value.PinID === 'number' && typeof value.PinOwnerID === 'number'
}

/** Motivo pelo qual um chip não pode virar documento, ou null se pode. */
function staticRefusal(chip: DlsChip, known: ReadonlySet<string>): string | null {
  const inputs = chip.InputPins ?? []
  const outputs = chip.OutputPins ?? []
  if (inputs.length === 0) return 'O chip não tem pinos de entrada.'
  if (outputs.length === 0) return 'O chip não tem pinos de saída.'

  for (const pin of [...inputs, ...outputs]) {
    const bits = pin.BitCount ?? 1
    if (bits !== 1) {
      return `O pino "${pin.Name ?? pin.ID}" tem ${bits} bits, e esta versão liga só sinais de 1 bit.`
    }
  }

  for (const sub of chip.SubChips ?? []) {
    if (NAND_NAMES.has(sub.Name) || known.has(sub.Name)) continue
    return `Usa "${sub.Name}", um componente do Digital Logic Sim que o Veritas ainda não tem.`
  }

  return null
}

/**
 * Decide o que dá para importar e em que ordem.
 *
 * A ordem importa porque a hierarquia é por referência: para montar o pai é
 * preciso já ter o ID do filho na biblioteca.
 */
export function planDlsImport(sources: readonly unknown[]): DlsImportPlan {
  const refused: DlsImportRefusal[] = []
  const chips = new Map<string, DlsChip>()

  sources.forEach((source, index) => {
    const parsed = parseDlsChip(source)
    if ('reason' in parsed) {
      refused.push({ name: `arquivo ${index + 1}`, reason: parsed.reason })
      return
    }
    // Um nome repetido significaria dois chips diferentes disputando a mesma
    // referência nos fios de quem os usa; ficar com o primeiro seria escolher
    // por acaso.
    if (chips.has(parsed.chip.Name)) {
      refused.push({ name: parsed.chip.Name, reason: 'Há mais de um chip com este nome na seleção.' })
      return
    }
    chips.set(parsed.chip.Name, parsed.chip)
  })

  const known = new Set(chips.keys())
  const blocked = new Map<string, string>()
  for (const [name, chip] of chips) {
    const reason = staticRefusal(chip, known)
    if (reason) blocked.set(name, reason)
  }

  const dependenciesOf = (chip: DlsChip): string[] => {
    const names = new Set<string>()
    for (const sub of chip.SubChips ?? []) {
      if (!NAND_NAMES.has(sub.Name)) names.add(sub.Name)
    }
    return [...names]
  }

  const order: DlsImportStep[] = []
  const placed = new Set<string>()
  const visiting: string[] = []

  const visit = (name: string): boolean => {
    if (placed.has(name)) return true
    if (blocked.has(name)) return false

    const cycleAt = visiting.indexOf(name)
    if (cycleAt >= 0) {
      const chain = [...visiting.slice(cycleAt), name].join(' → ')
      for (const member of visiting.slice(cycleAt)) {
        blocked.set(member, `Faz parte de um ciclo de dependência entre chips: ${chain}.`)
      }
      return false
    }

    const chip = chips.get(name)
    if (!chip) return false

    visiting.push(name)
    const dependencies = dependenciesOf(chip)
    let missing: string | null = null
    for (const dependency of dependencies) {
      if (!visit(dependency)) {
        missing = dependency
        break
      }
    }
    visiting.pop()

    // O ciclo já marcou este chip; não sobrescreve com o motivo do filho.
    if (blocked.has(name)) return false
    if (missing !== null) {
      blocked.set(name, `Depende de "${missing}", que não pôde ser importado.`)
      return false
    }

    placed.add(name)
    order.push({ name, chip, dependencies })
    return true
  }

  for (const name of chips.keys()) visit(name)

  for (const [name, reason] of blocked) refused.push({ name, reason })
  return { order, refused }
}

interface PinSlots {
  inputs: readonly number[]
  outputs: readonly number[]
}

/** Em que porta do Veritas cai cada pino do DLS, para cada tipo de sub-chip. */
function slotsOf(name: string, chips: ReadonlyMap<string, DlsChip>): PinSlots {
  if (NAND_NAMES.has(name)) {
    return { inputs: NAND_INPUT_PIN_IDS, outputs: NAND_OUTPUT_PIN_IDS }
  }
  const chip = chips.get(name)
  return {
    inputs: (chip?.InputPins ?? []).map((pin) => pin.ID),
    outputs: (chip?.OutputPins ?? []).map((pin) => pin.ID),
  }
}

function slotId(prefix: string, index: number, total: number): string {
  // Zeros à esquerda para a ordem textual dos IDs bater com a ordem em que o
  // autor declarou os pinos: é essa ordem que vira o índice de porta.
  const width = Math.max(2, String(Math.max(total - 1, 0)).length)
  return `${prefix}-${String(index).padStart(width, '0')}`
}

function label(name: string | undefined, fallback: string): string {
  const text = (name ?? '').trim()
  if (text.length === 0) return fallback
  return text.slice(0, MAX_CIRCUIT_LABEL_LENGTH)
}

/**
 * Converte um chip do plano em documento.
 *
 * `idByName` traz os IDs que os filhos já receberam na biblioteca — por isso a
 * conversão só funciona na ordem que o plano definiu.
 */
export function buildDlsChipDocument(
  step: DlsImportStep,
  idByName: ReadonlyMap<string, number>,
  library: ReadonlyMap<string, DlsChip>,
): CircuitDocument {
  const { chip } = step
  const inputs = chip.InputPins ?? []
  const outputs = chip.OutputPins ?? []
  const subChips = chip.SubChips ?? []

  const nodes: CircuitNode[] = []
  /** PinOwnerID do DLS → nó do Veritas. */
  const owners = new Map<number, { id: string; slots: PinSlots }>()

  inputs.forEach((pin, index) => {
    const id = slotId('in', index, inputs.length)
    nodes.push({ id, type: 'input', position: positionOf(pin.Position), label: label(pin.Name, id) })
    // Um pino do próprio chip é dono de si mesmo e tem uma porta só.
    owners.set(pin.ID, { id, slots: { inputs: [0], outputs: [0] } })
  })

  outputs.forEach((pin, index) => {
    const id = slotId('out', index, outputs.length)
    nodes.push({ id, type: 'output', position: positionOf(pin.Position), label: label(pin.Name, id) })
    owners.set(pin.ID, { id, slots: { inputs: [0], outputs: [0] } })
  })

  subChips.forEach((sub, index) => {
    const id = slotId('sub', index, subChips.length)
    const slots = slotsOf(sub.Name, library)
    const position = positionOf(sub.Position)
    if (NAND_NAMES.has(sub.Name)) {
      nodes.push({ id, type: 'nand', position, label: label(sub.Label, 'NAND') })
    } else {
      const customChipId = idByName.get(sub.Name)
      if (customChipId === undefined) {
        throw new Error(`O chip "${sub.Name}", usado por "${chip.Name}", ainda não está na biblioteca.`)
      }
      nodes.push({
        id,
        type: 'custom-chip',
        position,
        label: label(sub.Label, sub.Name),
        options: { customChipId },
      })
    }
    owners.set(sub.ID, { id, slots })
  })

  const connections: CircuitConnection[] = []
  for (const wire of chip.Wires ?? []) {
    const source = owners.get(wire.SourcePinAddress.PinOwnerID)
    const target = owners.get(wire.TargetPinAddress.PinOwnerID)
    if (!source || !target) {
      throw new Error(`Um fio de "${chip.Name}" aponta para um pino que não existe no arquivo.`)
    }
    const sourcePort = source.slots.outputs.indexOf(wire.SourcePinAddress.PinID)
    const targetPort = target.slots.inputs.indexOf(wire.TargetPinAddress.PinID)
    if (sourcePort < 0 || targetPort < 0) {
      throw new Error(`Um fio de "${chip.Name}" liga um pino que o componente de destino não declara.`)
    }
    connections.push({
      source: { node: source.id, ...(sourcePort === 0 ? {} : { port: sourcePort }) },
      target: { node: target.id, port: targetPort },
    })
  }

  return shiftIntoCanvas({
    format: 'veritas-circuit',
    version: 1,
    name: chip.Name,
    nodes,
    connections,
  })
}

function positionOf(position: { x: number; y: number } | undefined): { x: number; y: number } {
  if (!position) return { x: 0, y: 0 }
  // O eixo vertical do DLS cresce para cima; o do canvas, para baixo.
  return { x: position.x * DLS_UNIT_IN_PIXELS, y: -position.y * DLS_UNIT_IN_PIXELS }
}

/** Traz o desenho todo para coordenadas positivas, sem mudar o arranjo. */
function shiftIntoCanvas(document: CircuitDocument): CircuitDocument {
  if (document.nodes.length === 0) return document
  const minX = Math.min(...document.nodes.map((node) => node.position.x))
  const minY = Math.min(...document.nodes.map((node) => node.position.y))
  const dx = CANVAS_MARGIN - minX
  const dy = CANVAS_MARGIN - minY
  return {
    ...document,
    nodes: document.nodes.map((node) => ({
      ...node,
      position: { x: Math.round(node.position.x + dx), y: Math.round(node.position.y + dy) },
    })),
  }
}

export interface DlsImportRun {
  /** Próximo chip a construir, ou null quando não sobrou nenhum. */
  next(): DlsImportStep | null
  /** Documento do passo, com os filhos apontando para os IDs que já receberam. */
  document(step: DlsImportStep): CircuitDocument
  /** Registra que o chip entrou na biblioteca com este ID. */
  succeeded(step: DlsImportStep, id: number): void
  /** Registra que o chip já existia com este ID e foi aproveitado. */
  reused(step: DlsImportStep, id: number): void
  /** Registra a recusa e cascateia para quem dependia dele. */
  failed(step: DlsImportStep, reason: string): void
  report(): DlsImportReport
}

/**
 * Percorre o plano deixando quem salva decidir o ID de cada chip.
 *
 * Os IDs da biblioteca vêm do banco, um de cada vez, então a conversão não tem
 * como saber de antemão para onde apontar. O laço fica aqui para a cascata de
 * recusa — um chip que o Veritas rejeita derruba quem depende dele — ter uma
 * implementação só.
 */
export function createDlsImportRun(plan: DlsImportPlan): DlsImportRun {
  const library = new Map(plan.order.map((step) => [step.name, step.chip] as const))
  const idByName = new Map<string, number>()
  const failed = new Map<string, string>()
  const refused: DlsImportRefusal[] = [...plan.refused]
  const imported: { id: number; name: string }[] = []
  const reused: { id: number; name: string }[] = []
  let cursor = 0

  const record = (name: string, reason: string): void => {
    failed.set(name, reason)
    refused.push({ name, reason })
  }

  return {
    next() {
      while (cursor < plan.order.length) {
        const step = plan.order[cursor]
        const broken = step.dependencies.find((dependency) => failed.has(dependency))
        if (broken !== undefined) {
          cursor += 1
          record(step.name, `Depende de "${broken}", que não pôde ser importado.`)
          continue
        }
        cursor += 1
        return step
      }
      return null
    },
    document(step) {
      return buildDlsChipDocument(step, idByName, library)
    },
    succeeded(step, id) {
      idByName.set(step.name, id)
      imported.push({ id, name: step.name })
    },
    reused(step, id) {
      idByName.set(step.name, id)
      reused.push({ id, name: step.name })
    },
    failed(step, reason) {
      record(step.name, reason)
    },
    report() {
      return { imported, reused, refused }
    },
  }
}
