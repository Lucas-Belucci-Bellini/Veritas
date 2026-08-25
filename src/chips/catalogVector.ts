import {
  createCircuitDocument,
  type CircuitDocument,
  type CircuitNode,
} from '../circuit'
import type { ChipEntry } from './types'

type VectorGate = 'and' | 'or' | 'xor' | 'nand'

interface VectorGateModel {
  gate: VectorGate
  inputCount: number
  primitive: string
}

const BUS_WIDTH = 8
const ADDER_WIDTH = 4

/**
 * Materializa a primeira família estrutural de chips multi-bit importados.
 *
 * O adaptador aceita somente perfis conhecidos do catálogo DLS cujo formato é
 * verificável. O circuito gerado é explícito, local e serializável: não há
 * execução de JSON, código ou dependência de rede durante a importação.
 */
export function catalogMultiBitChipToCircuitDocument(chip: ChipEntry): CircuitDocument | null {
  const gate = vectorGateModel(chip)
  if (gate) return buildVectorGateDocument(chip, gate)
  if (isFourBitAdder(chip)) return buildFourBitAdderDocument(chip)
  if (isEightBitFullAdder(chip)) return buildEightBitFullAdderDocument(chip)
  if (isEightBitAdder(chip)) return buildEightBitAdderDocument(chip)
  if (isEightBitMask(chip)) return buildEightBitMaskDocument(chip)
  if (isFourBitEqual(chip)) return buildFourBitEqualDocument(chip)
  return null
}

/** Compatibilidade com o nome usado pelo primeiro incremento vetorial. */
export const catalogVectorChipToCircuitDocument = catalogMultiBitChipToCircuitDocument

export function isCatalogMultiBitChipImportable(chip: ChipEntry): boolean {
  return catalogMultiBitChipToCircuitDocument(chip) !== null
}

function vectorGateModel(chip: ChipEntry): VectorGateModel | null {
  if (chip.out !== 1 || !hasOnlyBusWidth(chip, BUS_WIDTH)) return null

  if (chip.name === 'AND-3 8 bits') {
    return chip.in === 3
      && chip.parts.AND === BUS_WIDTH * 2
      && chip.parts['8-1BIT'] === 3
      && chip.parts['1-8BIT'] === 1
      ? { gate: 'and', inputCount: 3, primitive: 'AND' }
      : null
  }

  if (chip.in !== 2 || chip.parts['8-1BIT'] !== 2 || chip.parts['1-8BIT'] !== 1) return null

  if (chip.name === 'AND-8 Bits' || chip.name === '8x2-AND') {
    return chip.parts.AND === BUS_WIDTH ? { gate: 'and', inputCount: 2, primitive: 'AND' } : null
  }
  if (chip.name === 'NAND-8Bits') {
    return chip.parts.AND === BUS_WIDTH && chip.parts.NOT === BUS_WIDTH
      ? { gate: 'nand', inputCount: 2, primitive: 'AND' }
      : null
  }
  if (chip.name === 'OR-8 Bits') {
    return chip.parts['NOT-8 Bits'] === 2 && chip.parts['NAND-8Bits'] === 1
      ? { gate: 'or', inputCount: 2, primitive: 'NAND-8Bits' }
      : null
  }
  if (chip.name === 'XOR - 8 BIT') {
    return chip.parts['NAND-8Bits'] === 3 && chip.parts['NOT-8 Bits'] === 2
      ? { gate: 'xor', inputCount: 2, primitive: 'NAND-8Bits' }
      : null
  }
  if (chip.name === '8x2-OR') {
    return chip.parts.OR === BUS_WIDTH ? { gate: 'or', inputCount: 2, primitive: 'OR' } : null
  }
  if (chip.name === '8x2-XOR') {
    return chip.parts.XOR === BUS_WIDTH ? { gate: 'xor', inputCount: 2, primitive: 'XOR' } : null
  }
  return null
}

function isFourBitAdder(chip: ChipEntry): boolean {
  return chip.name === '4-ADD'
    && chip.in === 3
    && chip.out === 2
    && hasScalarAndBusWidth(chip, ADDER_WIDTH)
    && chip.parts['1-ADD'] === 4
    && chip.parts['4-1BIT'] === 2
    && chip.parts['1-4BIT'] === 1
}

function hasOnlyBusWidth(chip: ChipEntry, width: number): boolean {
  return Boolean(chip.widths?.length) && chip.widths?.every((candidate) => candidate === width) === true
}

function hasScalarAndBusWidth(chip: ChipEntry, width: number): boolean {
  return chip.widths?.includes(width) === true && chip.widths.every((candidate) => candidate === 1 || candidate === width)
}

function isEightBitAdder(chip: ChipEntry): boolean {
  return chip.name === '8-ADD'
    && chip.in === 3
    && chip.out === 2
    && hasScalarAndBusWidth(chip, BUS_WIDTH)
    && chip.parts['1-ADD'] === BUS_WIDTH
    && chip.parts['8-1BIT'] === 2
    && chip.parts['1-8BIT'] === 1
}

function isEightBitFullAdder(chip: ChipEntry): boolean {
  return chip.name === 'Full Adder - 8 Bits'
    && chip.in === 3
    && chip.out === 2
    && hasOnlyBusWidth(chip, BUS_WIDTH)
    && chip.parts['AND-8 Bits'] === 2
    && chip.parts['XOR - 8 BIT'] === 2
    && chip.parts['OR-8 Bits'] === 1
}

function isEightBitMask(chip: ChipEntry): boolean {
  return chip.name === '8-1AND'
    && chip.in === 2
    && chip.out === 1
    && hasScalarAndBusWidth(chip, BUS_WIDTH)
    && chip.parts.AND === BUS_WIDTH
    && chip.parts['8-1BIT'] === 1
    && chip.parts['1-8BIT'] === 1
}

function isFourBitEqual(chip: ChipEntry): boolean {
  return chip.name === 'EQUAL-4'
    && chip.in === 2
    && chip.out === 1
    && hasScalarAndBusWidth(chip, ADDER_WIDTH)
    && chip.parts.XNOR === 4
    && chip.parts.AND === 3
    && chip.parts['4-1BIT'] === 2
}

function buildVectorGateDocument(chip: ChipEntry, model: VectorGateModel): CircuitDocument {
  const document = createCircuitDocument(chip.name)
  const inputLabels = chip.pins?.in?.length === model.inputCount
    ? chip.pins.in
    : Array.from({ length: model.inputCount }, (_, index) => `IN ${index + 1}`)
  const outputLabel = chip.pins?.out?.[0] || 'OUT'
  const nodes: CircuitNode[] = []
  const connections: CircuitDocument['connections'] = []

  for (let inputIndex = 0; inputIndex < model.inputCount; inputIndex += 1) {
    const inputId = `input-${inputIndex + 1}`
    const splitterId = `splitter-${inputIndex + 1}`
    nodes.push(
      {
        id: inputId,
        type: 'input',
        position: { x: 0, y: inputIndex * 220 },
        label: inputLabels[inputIndex] || `IN ${inputIndex + 1}`,
        options: { width: BUS_WIDTH },
      },
      {
        id: splitterId,
        type: 'splitter',
        position: { x: 180, y: inputIndex * 220 },
        label: `Split ${inputIndex + 1}`,
        options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
      },
    )
    connections.push({ source: { node: inputId }, target: { node: splitterId, port: 0 } })
  }

  for (let bit = 0; bit < BUS_WIDTH; bit += 1) {
    let sourceNode = `splitter-1`
    for (let inputIndex = 1; inputIndex < model.inputCount; inputIndex += 1) {
      const gateId = model.inputCount === 2
        ? `gate-${bit + 1}`
        : `gate-${bit + 1}-${inputIndex}`
      nodes.push({
        id: gateId,
        type: model.gate,
        position: { x: 430 + (inputIndex - 1) * 170, y: 40 + bit * 70 },
        label: `${model.gate.toUpperCase()} bit ${bit + 1}${model.inputCount > 2 ? ` stage ${inputIndex}` : ''}`,
      })
      const leftSource = sourceNode.startsWith('splitter-')
        ? { node: sourceNode, port: bit }
        : { node: sourceNode }
      connections.push(
        { source: leftSource, target: { node: gateId, port: 0 } },
        { source: { node: `splitter-${inputIndex + 1}`, port: bit }, target: { node: gateId, port: 1 } },
      )
      sourceNode = gateId
    }
  }

  const combinerId = 'combiner-1'
  const outputId = 'output-1'
  nodes.push(
    {
      id: combinerId,
      type: 'combiner',
      position: { x: 700, y: 260 },
      label: 'Combiner',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
    {
      id: outputId,
      type: 'output',
      position: { x: 920, y: 260 },
      label: outputLabel,
      options: { width: BUS_WIDTH },
    },
  )
  for (let bit = 0; bit < BUS_WIDTH; bit += 1) {
    const finalGateId = model.inputCount === 2
      ? `gate-${bit + 1}`
      : `gate-${bit + 1}-${model.inputCount - 1}`
    connections.push({ source: { node: finalGateId }, target: { node: combinerId, port: bit } })
  }
  connections.push({ source: { node: combinerId }, target: { node: outputId, port: 0 } })

  return { ...document, nodes, connections }
}

function buildFourBitAdderDocument(chip: ChipEntry): CircuitDocument {
  const document = createCircuitDocument(chip.name)
  const inputLabels = chip.pins?.in?.length === 3 ? chip.pins.in : ['A', 'B', 'CARRY']
  const outputLabels = chip.pins?.out?.length === 2 ? chip.pins.out : ['OUT', 'CARRY']
  const nodes: CircuitNode[] = [
    {
      id: 'input-a',
      type: 'input',
      position: { x: 0, y: 80 },
      label: inputLabels[0] || 'A',
      options: { width: ADDER_WIDTH },
    },
    {
      id: 'input-b',
      type: 'input',
      position: { x: 0, y: 320 },
      label: inputLabels[1] || 'B',
      options: { width: ADDER_WIDTH },
    },
    {
      id: 'input-carry',
      type: 'input',
      position: { x: 0, y: 560 },
      label: inputLabels[2] || 'CARRY',
    },
    {
      id: 'splitter-a',
      type: 'splitter',
      position: { x: 190, y: 80 },
      label: 'Split A',
      options: { width: ADDER_WIDTH, widths: unitWidths(ADDER_WIDTH) },
    },
    {
      id: 'splitter-b',
      type: 'splitter',
      position: { x: 190, y: 320 },
      label: 'Split B',
      options: { width: ADDER_WIDTH, widths: unitWidths(ADDER_WIDTH) },
    },
  ]
  const connections: CircuitDocument['connections'] = [
    { source: { node: 'input-a' }, target: { node: 'splitter-a', port: 0 } },
    { source: { node: 'input-b' }, target: { node: 'splitter-b', port: 0 } },
  ]

  let incomingCarry = 'input-carry'
  for (let bit = ADDER_WIDTH - 1; bit >= 0; bit -= 1) {
    const xorOne = `sum-xor-1-${bit}`
    const xorTwo = `sum-xor-2-${bit}`
    const andAb = `carry-and-ab-${bit}`
    const andCarry = `carry-and-propagate-${bit}`
    const carryOut = `carry-or-${bit}`
    nodes.push(
      { id: xorOne, type: 'xor', position: { x: 430, y: 40 + bit * 160 }, label: `Sum XOR A${bit}` },
      { id: xorTwo, type: 'xor', position: { x: 600, y: 40 + bit * 160 }, label: `Sum XOR B${bit}` },
      { id: andAb, type: 'and', position: { x: 430, y: 110 + bit * 160 }, label: `Carry A${bit}B${bit}` },
      { id: andCarry, type: 'and', position: { x: 600, y: 110 + bit * 160 }, label: `Carry P${bit}` },
      { id: carryOut, type: 'or', position: { x: 770, y: 110 + bit * 160 }, label: `Carry out ${bit}` },
    )
    connections.push(
      { source: { node: 'splitter-a', port: bit }, target: { node: xorOne, port: 0 } },
      { source: { node: 'splitter-b', port: bit }, target: { node: xorOne, port: 1 } },
      { source: { node: xorOne }, target: { node: xorTwo, port: 0 } },
      { source: { node: incomingCarry }, target: { node: xorTwo, port: 1 } },
      { source: { node: 'splitter-a', port: bit }, target: { node: andAb, port: 0 } },
      { source: { node: 'splitter-b', port: bit }, target: { node: andAb, port: 1 } },
      { source: { node: xorOne }, target: { node: andCarry, port: 0 } },
      { source: { node: incomingCarry }, target: { node: andCarry, port: 1 } },
      { source: { node: andAb }, target: { node: carryOut, port: 0 } },
      { source: { node: andCarry }, target: { node: carryOut, port: 1 } },
    )
    incomingCarry = carryOut
  }

  const combinerId = 'combiner-sum'
  // Os IDs carregam a ordem pública porque buildCustomChipDefinition os ordena.
  const outputSumId = 'output-0-sum'
  const outputCarryId = 'output-1-carry'
  nodes.push(
    {
      id: combinerId,
      type: 'combiner',
      position: { x: 980, y: 280 },
      label: 'Combiner OUT',
      options: { width: ADDER_WIDTH, widths: unitWidths(ADDER_WIDTH) },
    },
    {
      id: outputSumId,
      type: 'output',
      position: { x: 1190, y: 280 },
      label: outputLabels[0] || 'OUT',
      options: { width: ADDER_WIDTH },
    },
    {
      id: outputCarryId,
      type: 'output',
      position: { x: 980, y: 720 },
      label: outputLabels[1] || 'CARRY',
    },
  )
  for (let bit = 0; bit < ADDER_WIDTH; bit += 1) {
    connections.push({ source: { node: `sum-xor-2-${bit}` }, target: { node: combinerId, port: bit } })
  }
  connections.push(
    { source: { node: combinerId }, target: { node: outputSumId, port: 0 } },
    { source: { node: incomingCarry }, target: { node: outputCarryId, port: 0 } },
  )

  return { ...document, nodes, connections }
}

function buildEightBitAdderDocument(chip: ChipEntry): CircuitDocument {
  const document = createCircuitDocument(chip.name)
  const inputLabels = chip.pins?.in?.length === 3 ? chip.pins.in : ['CARRY', 'IN', 'IN']
  const outputLabels = chip.pins?.out?.length === 2 ? chip.pins.out : ['OUT', 'CARRY']
  // A ordem pública do fixture DLS é CARRY, IN, IN.
  const nodes: CircuitNode[] = [
    {
      id: 'input-0-carry',
      type: 'input',
      position: { x: 0, y: 700 },
      label: inputLabels[0] || 'CARRY',
    },
    {
      id: 'input-1-a',
      type: 'input',
      position: { x: 0, y: 80 },
      label: inputLabels[1] || 'IN',
      options: { width: BUS_WIDTH },
    },
    {
      id: 'input-2-b',
      type: 'input',
      position: { x: 0, y: 320 },
      label: inputLabels[2] || 'IN',
      options: { width: BUS_WIDTH },
    },
    {
      id: 'splitter-a',
      type: 'splitter',
      position: { x: 190, y: 80 },
      label: 'Split A',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
    {
      id: 'splitter-b',
      type: 'splitter',
      position: { x: 190, y: 320 },
      label: 'Split B',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
  ]
  // Conexões do 8-ADD: os dois barramentos ocupam as entradas 1 e 2.
  const connections: CircuitDocument['connections'] = [
    { source: { node: 'input-1-a' }, target: { node: 'splitter-a', port: 0 } },
    { source: { node: 'input-2-b' }, target: { node: 'splitter-b', port: 0 } },
  ]

  let incomingCarry = 'input-0-carry'
  for (let bit = BUS_WIDTH - 1; bit >= 0; bit -= 1) {
    const xorOne = `sum-xor-1-${bit}`
    const xorTwo = `sum-xor-2-${bit}`
    const andAb = `carry-and-ab-${bit}`
    const andCarry = `carry-and-propagate-${bit}`
    const carryOut = `carry-or-${bit}`
    nodes.push(
      { id: xorOne, type: 'xor', position: { x: 430, y: 30 + (BUS_WIDTH - 1 - bit) * 100 }, label: `Sum XOR A${bit}` },
      { id: xorTwo, type: 'xor', position: { x: 600, y: 30 + (BUS_WIDTH - 1 - bit) * 100 }, label: `Sum XOR B${bit}` },
      { id: andAb, type: 'and', position: { x: 430, y: 80 + (BUS_WIDTH - 1 - bit) * 100 }, label: `Carry A${bit}B${bit}` },
      { id: andCarry, type: 'and', position: { x: 600, y: 80 + (BUS_WIDTH - 1 - bit) * 100 }, label: `Carry P${bit}` },
      { id: carryOut, type: 'or', position: { x: 770, y: 80 + (BUS_WIDTH - 1 - bit) * 100 }, label: `Carry out ${bit}` },
    )
    connections.push(
      { source: { node: 'splitter-a', port: bit }, target: { node: xorOne, port: 0 } },
      { source: { node: 'splitter-b', port: bit }, target: { node: xorOne, port: 1 } },
      { source: { node: xorOne }, target: { node: xorTwo, port: 0 } },
      { source: { node: incomingCarry }, target: { node: xorTwo, port: 1 } },
      { source: { node: 'splitter-a', port: bit }, target: { node: andAb, port: 0 } },
      { source: { node: 'splitter-b', port: bit }, target: { node: andAb, port: 1 } },
      { source: { node: xorOne }, target: { node: andCarry, port: 0 } },
      { source: { node: incomingCarry }, target: { node: andCarry, port: 1 } },
      { source: { node: andAb }, target: { node: carryOut, port: 0 } },
      { source: { node: andCarry }, target: { node: carryOut, port: 1 } },
    )
    incomingCarry = carryOut
  }

  const combinerId = 'combiner-sum'
  const outputSumId = 'output-0-sum'
  const outputCarryId = 'output-1-carry'
  nodes.push(
    {
      id: combinerId,
      type: 'combiner',
      position: { x: 980, y: 390 },
      label: 'Combiner OUT',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
    {
      id: outputSumId,
      type: 'output',
      position: { x: 1190, y: 390 },
      label: outputLabels[0] || 'OUT',
      options: { width: BUS_WIDTH },
    },
    {
      id: outputCarryId,
      type: 'output',
      position: { x: 980, y: 780 },
      label: outputLabels[1] || 'CARRY',
    },
  )
  for (let bit = 0; bit < BUS_WIDTH; bit += 1) {
    connections.push({ source: { node: `sum-xor-2-${bit}` }, target: { node: combinerId, port: bit } })
  }
  connections.push(
    { source: { node: combinerId }, target: { node: outputSumId, port: 0 } },
    { source: { node: incomingCarry }, target: { node: outputCarryId, port: 0 } },
  )

  return { ...document, nodes, connections }
}

function buildEightBitFullAdderDocument(chip: ChipEntry): CircuitDocument {
  const document = createCircuitDocument(chip.name)
  const inputLabels = chip.pins?.in?.length === 3 ? chip.pins.in : ['Carry IN', 'IN A', 'IN B']
  const outputLabels = chip.pins?.out?.length === 2 ? chip.pins.out : ['BIT-8 Bits', 'Carry Out-8Bits']
  const nodes: CircuitNode[] = [
    {
      id: 'input-0-carry',
      type: 'input',
      position: { x: 0, y: 700 },
      label: inputLabels[0] || 'Carry IN',
      options: { width: BUS_WIDTH },
    },
    {
      id: 'input-1-a',
      type: 'input',
      position: { x: 0, y: 80 },
      label: inputLabels[1] || 'IN A',
      options: { width: BUS_WIDTH },
    },
    {
      id: 'input-2-b',
      type: 'input',
      position: { x: 0, y: 320 },
      label: inputLabels[2] || 'IN B',
      options: { width: BUS_WIDTH },
    },
    {
      id: 'splitter-carry',
      type: 'splitter',
      position: { x: 190, y: 700 },
      label: 'Split Carry IN',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
    {
      id: 'splitter-a',
      type: 'splitter',
      position: { x: 190, y: 80 },
      label: 'Split IN A',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
    {
      id: 'splitter-b',
      type: 'splitter',
      position: { x: 190, y: 320 },
      label: 'Split IN B',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
  ]
  const connections: CircuitDocument['connections'] = [
    { source: { node: 'input-0-carry' }, target: { node: 'splitter-carry', port: 0 } },
    { source: { node: 'input-1-a' }, target: { node: 'splitter-a', port: 0 } },
    { source: { node: 'input-2-b' }, target: { node: 'splitter-b', port: 0 } },
  ]

  for (let bit = 0; bit < BUS_WIDTH; bit += 1) {
    const xorAb = `sum-xor-ab-${bit}`
    const xorCarry = `sum-xor-carry-${bit}`
    const andAb = `carry-and-ab-${bit}`
    const andCarry = `carry-and-carry-${bit}`
    const carryOr = `carry-or-${bit}`
    const y = 30 + bit * 100
    nodes.push(
      { id: xorAb, type: 'xor', position: { x: 430, y }, label: `Sum XOR A/B bit ${bit + 1}` },
      { id: xorCarry, type: 'xor', position: { x: 600, y }, label: `Sum XOR carry bit ${bit + 1}` },
      { id: andAb, type: 'and', position: { x: 430, y: y + 50 }, label: `Carry A/B bit ${bit + 1}` },
      { id: andCarry, type: 'and', position: { x: 600, y: y + 50 }, label: `Carry XOR/carry bit ${bit + 1}` },
      { id: carryOr, type: 'or', position: { x: 770, y: y + 50 }, label: `Carry OR bit ${bit + 1}` },
    )
    connections.push(
      { source: { node: 'splitter-a', port: bit }, target: { node: xorAb, port: 0 } },
      { source: { node: 'splitter-b', port: bit }, target: { node: xorAb, port: 1 } },
      { source: { node: xorAb }, target: { node: xorCarry, port: 0 } },
      { source: { node: 'splitter-carry', port: bit }, target: { node: xorCarry, port: 1 } },
      { source: { node: 'splitter-a', port: bit }, target: { node: andAb, port: 0 } },
      { source: { node: 'splitter-b', port: bit }, target: { node: andAb, port: 1 } },
      { source: { node: xorAb }, target: { node: andCarry, port: 0 } },
      { source: { node: 'splitter-carry', port: bit }, target: { node: andCarry, port: 1 } },
      { source: { node: andAb }, target: { node: carryOr, port: 0 } },
      { source: { node: andCarry }, target: { node: carryOr, port: 1 } },
    )
  }

  const sumCombinerId = 'combiner-sum'
  const carryCombinerId = 'combiner-carry'
  const sumOutputId = 'output-0-sum'
  const carryOutputId = 'output-1-carry'
  nodes.push(
    {
      id: sumCombinerId,
      type: 'combiner',
      position: { x: 980, y: 280 },
      label: 'Combiner BIT',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
    {
      id: carryCombinerId,
      type: 'combiner',
      position: { x: 980, y: 760 },
      label: 'Combiner Carry',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
    {
      id: sumOutputId,
      type: 'output',
      position: { x: 1190, y: 280 },
      label: outputLabels[0] || 'BIT-8 Bits',
      options: { width: BUS_WIDTH },
    },
    {
      id: carryOutputId,
      type: 'output',
      position: { x: 1190, y: 760 },
      label: outputLabels[1] || 'Carry Out-8Bits',
      options: { width: BUS_WIDTH },
    },
  )
  for (let bit = 0; bit < BUS_WIDTH; bit += 1) {
    connections.push(
      { source: { node: `sum-xor-carry-${bit}` }, target: { node: sumCombinerId, port: bit } },
      { source: { node: `carry-or-${bit}` }, target: { node: carryCombinerId, port: bit } },
    )
  }
  connections.push(
    { source: { node: sumCombinerId }, target: { node: sumOutputId, port: 0 } },
    { source: { node: carryCombinerId }, target: { node: carryOutputId, port: 0 } },
  )

  return { ...document, nodes, connections }
}

function buildEightBitMaskDocument(chip: ChipEntry): CircuitDocument {
  const document = createCircuitDocument(chip.name)
  const inputLabels = chip.pins?.in?.length === 2 ? chip.pins.in : ['IN', 'IN']
  const outputLabel = chip.pins?.out?.[0] || 'OUT'
  const nodes: CircuitNode[] = [
    {
      id: 'input-0-mask',
      type: 'input',
      position: { x: 0, y: 560 },
      label: inputLabels[0] || 'IN',
    },
    {
      id: 'input-1-bus',
      type: 'input',
      position: { x: 0, y: 120 },
      label: inputLabels[1] || 'IN',
      options: { width: BUS_WIDTH },
    },
    {
      id: 'splitter-bus',
      type: 'splitter',
      position: { x: 190, y: 120 },
      label: 'Split IN',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
  ]
  const connections: CircuitDocument['connections'] = [
    { source: { node: 'input-1-bus' }, target: { node: 'splitter-bus', port: 0 } },
  ]

  for (let bit = 0; bit < BUS_WIDTH; bit += 1) {
    const andId = `and-mask-${bit}`
    nodes.push({
      id: andId,
      type: 'and',
      position: { x: 430, y: 30 + bit * 100 },
      label: `AND mask bit ${bit + 1}`,
    })
    connections.push(
      { source: { node: 'input-0-mask' }, target: { node: andId, port: 0 } },
      { source: { node: 'splitter-bus', port: bit }, target: { node: andId, port: 1 } },
    )
  }

  const combinerId = 'combiner-out'
  const outputId = 'output-0'
  nodes.push(
    {
      id: combinerId,
      type: 'combiner',
      position: { x: 700, y: 380 },
      label: 'Combiner OUT',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
    {
      id: outputId,
      type: 'output',
      position: { x: 920, y: 380 },
      label: outputLabel,
      options: { width: BUS_WIDTH },
    },
  )
  for (let bit = 0; bit < BUS_WIDTH; bit += 1) {
    connections.push({ source: { node: `and-mask-${bit}` }, target: { node: combinerId, port: bit } })
  }
  connections.push({ source: { node: combinerId }, target: { node: outputId, port: 0 } })

  return { ...document, nodes, connections }
}

function buildFourBitEqualDocument(chip: ChipEntry): CircuitDocument {
  const document = createCircuitDocument(chip.name)
  const inputLabels = chip.pins?.in?.length === 2 ? chip.pins.in : ['IN', 'IN']
  const outputLabel = chip.pins?.out?.[0] || 'OUT'
  const nodes: CircuitNode[] = [
    {
      id: 'input-a',
      type: 'input',
      position: { x: 0, y: 120 },
      label: inputLabels[0] || 'IN',
      options: { width: ADDER_WIDTH },
    },
    {
      id: 'input-b',
      type: 'input',
      position: { x: 0, y: 360 },
      label: inputLabels[1] || 'IN',
      options: { width: ADDER_WIDTH },
    },
    {
      id: 'splitter-a',
      type: 'splitter',
      position: { x: 190, y: 120 },
      label: 'Split A',
      options: { width: ADDER_WIDTH, widths: unitWidths(ADDER_WIDTH) },
    },
    {
      id: 'splitter-b',
      type: 'splitter',
      position: { x: 190, y: 360 },
      label: 'Split B',
      options: { width: ADDER_WIDTH, widths: unitWidths(ADDER_WIDTH) },
    },
  ]
  const connections: CircuitDocument['connections'] = [
    { source: { node: 'input-a' }, target: { node: 'splitter-a', port: 0 } },
    { source: { node: 'input-b' }, target: { node: 'splitter-b', port: 0 } },
  ]

  for (let bit = 0; bit < ADDER_WIDTH; bit += 1) {
    const xnorId = `xnor-${bit}`
    nodes.push({
      id: xnorId,
      type: 'xnor',
      position: { x: 430, y: 40 + bit * 150 },
      label: `XNOR bit ${bit + 1}`,
    })
    connections.push(
      { source: { node: 'splitter-a', port: bit }, target: { node: xnorId, port: 0 } },
      { source: { node: 'splitter-b', port: bit }, target: { node: xnorId, port: 1 } },
    )
  }

  nodes.push(
    { id: 'and-01', type: 'and', position: { x: 680, y: 100 }, label: 'AND bits 1+2' },
    { id: 'and-23', type: 'and', position: { x: 680, y: 400 }, label: 'AND bits 3+4' },
    { id: 'and-final', type: 'and', position: { x: 850, y: 250 }, label: 'AND igualdade' },
    {
      id: 'output-0',
      type: 'output',
      position: { x: 1030, y: 250 },
      label: outputLabel,
    },
  )
  connections.push(
    { source: { node: 'xnor-0' }, target: { node: 'and-01', port: 0 } },
    { source: { node: 'xnor-1' }, target: { node: 'and-01', port: 1 } },
    { source: { node: 'xnor-2' }, target: { node: 'and-23', port: 0 } },
    { source: { node: 'xnor-3' }, target: { node: 'and-23', port: 1 } },
    { source: { node: 'and-01' }, target: { node: 'and-final', port: 0 } },
    { source: { node: 'and-23' }, target: { node: 'and-final', port: 1 } },
    { source: { node: 'and-final' }, target: { node: 'output-0', port: 0 } },
  )

  return { ...document, nodes, connections }
}

function unitWidths(count: number): number[] {
  return Array.from({ length: count }, () => 1)
}
