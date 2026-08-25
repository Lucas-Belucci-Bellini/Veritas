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
  if (isEightBitRippleAdderAlias(chip)) return buildEightBitAdderDocument(chip)
  if (isEightBitAdder(chip)) return buildEightBitAdderDocument(chip)
  if (isEightBitMux(chip)) return buildEightBitMuxDocument(chip)
  if (isEightBitNot(chip)) return buildEightBitNotDocument(chip)
  if (isEightBitNegate(chip)) return buildEightBitNegateDocument(chip)
  if (isSixteenInputBusRouter(chip)) return buildSixteenInputBusRouterDocument(chip)
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

  // OR/XOR reais do DLS encapsulam NAND-8Bits/NOT-8 Bits. A materialização
  // local usa a forma booleana equivalente, sem executar a hierarquia JSON.
  if (chip.name === 'OR-8 Bits') {
    return chip.in === 2
      && chip.parts['NAND-8Bits'] === 1
      && chip.parts['NOT-8 Bits'] === 2
      ? { gate: 'or', inputCount: 2, primitive: 'NAND-8Bits' }
      : null
  }
  if (chip.name === 'XOR - 8 BIT') {
    return chip.in === 2
      && chip.parts['NAND-8Bits'] === 3
      && chip.parts['NOT-8 Bits'] === 2
      ? { gate: 'xor', inputCount: 2, primitive: 'NAND-8Bits' }
      : null
  }

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

function isEightBitRippleAdderAlias(chip: ChipEntry): boolean {
  return chip.name === '(8 Bits) 8-bit Adder'
    && chip.in === 3
    && chip.out === 2
    && hasScalarAndBusWidth(chip, BUS_WIDTH)
    && chip.parts['8-bit Adder'] === 1
    && chip.parts['8-1BIT'] === 2
    && chip.parts['1-8BIT'] === 1
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

function isEightBitMux(chip: ChipEntry): boolean {
  return chip.name === '1-8MUX'
    && chip.in === 3
    && chip.out === 1
    && hasScalarAndBusWidth(chip, BUS_WIDTH)
    && chip.parts['8-1AND'] === 2
    && chip.parts['8x2-OR'] === 1
    && chip.parts.NOT === 1
}

function isEightBitNot(chip: ChipEntry): boolean {
  return chip.name === 'NOT-8 Bits'
    && chip.in === 1
    && chip.out === 1
    && hasOnlyBusWidth(chip, BUS_WIDTH)
    && chip.parts['NAND-8Bits'] === 1
}

function isEightBitNegate(chip: ChipEntry): boolean {
  return chip.name === 'NEGATE-8'
    && chip.in === 2
    && chip.out === 1
    && hasScalarAndBusWidth(chip, BUS_WIDTH)
    && chip.parts['8-1BIT'] === 1
    && chip.parts['1-8BIT'] === 1
    && chip.parts.XOR === BUS_WIDTH
}

function isSixteenInputBusRouter(chip: ChipEntry): boolean {
  const widths = [...(chip.widths || [])].sort((left, right) => left - right)
  return chip.name === '16 para 8 e 4 bits'
    && chip.in === 16
    && chip.out === 10
    && widths.join(',') === '1,4,8'
    && chip.parts['1-8BIT'] === 2
    && chip.parts['8-4BIT'] === 1
    && chip.parts['8x2-AND'] === 1
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
  const aliasHasCarryLast = chip.name === '(8 Bits) 8-bit Adder'
  const inputLabels = chip.pins?.in?.length === 3
    ? chip.pins.in
    : aliasHasCarryLast
      ? ['IN A', 'IN B', 'Carry IN']
      : ['CARRY', 'IN', 'IN']
  const outputLabels = chip.pins?.out?.length === 2 ? chip.pins.out : ['OUT', 'CARRY']
  const carryInputId = aliasHasCarryLast ? 'input-2-carry' : 'input-0-carry'
  const inputAId = aliasHasCarryLast ? 'input-0-a' : 'input-1-a'
  const inputBId = aliasHasCarryLast ? 'input-1-b' : 'input-2-b'
  const carryLabel = aliasHasCarryLast ? inputLabels[2] : inputLabels[0]
  const inputALabel = aliasHasCarryLast ? inputLabels[0] : inputLabels[1]
  const inputBLabel = aliasHasCarryLast ? inputLabels[1] : inputLabels[2]
  const nodes: CircuitNode[] = [
    {
      id: carryInputId,
      type: 'input',
      position: { x: 0, y: 700 },
      label: carryLabel || 'CARRY',
    },
    {
      id: inputAId,
      type: 'input',
      position: { x: 0, y: 80 },
      label: inputALabel || 'IN',
      options: { width: BUS_WIDTH },
    },
    {
      id: inputBId,
      type: 'input',
      position: { x: 0, y: 320 },
      label: inputBLabel || 'IN',
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
  // Os dois barramentos ocupam as entradas públicas de dados em ambos os aliases.
  const connections: CircuitDocument['connections'] = [
    { source: { node: inputAId }, target: { node: 'splitter-a', port: 0 } },
    { source: { node: inputBId }, target: { node: 'splitter-b', port: 0 } },
  ]

  let incomingCarry = carryInputId
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

function buildEightBitMuxDocument(chip: ChipEntry): CircuitDocument {
  const document = createCircuitDocument(chip.name)
  const inputLabels = chip.pins?.in?.length === 3 ? chip.pins.in : ['IN', 'IN', 'IN']
  const outputLabel = chip.pins?.out?.[0] || 'OUT'
  const nodes: CircuitNode[] = [
    {
      id: 'input-0-select',
      type: 'input',
      position: { x: 0, y: 700 },
      label: inputLabels[0] || 'IN',
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
    {
      id: 'not-select',
      type: 'not',
      position: { x: 250, y: 700 },
      label: 'NOT select',
    },
  ]
  const connections: CircuitDocument['connections'] = [
    { source: { node: 'input-1-a' }, target: { node: 'splitter-a', port: 0 } },
    { source: { node: 'input-2-b' }, target: { node: 'splitter-b', port: 0 } },
    { source: { node: 'input-0-select' }, target: { node: 'not-select', port: 0 } },
  ]

  for (let bit = 0; bit < BUS_WIDTH; bit += 1) {
    const selectedAnd = `mux-and-selected-${bit}`
    const invertedAnd = `mux-and-inverted-${bit}`
    const outputOr = `mux-or-${bit}`
    const y = 30 + bit * 100
    nodes.push(
      { id: selectedAnd, type: 'and', position: { x: 430, y }, label: `MUX A bit ${bit + 1}` },
      { id: invertedAnd, type: 'and', position: { x: 430, y: y + 50 }, label: `MUX B bit ${bit + 1}` },
      { id: outputOr, type: 'or', position: { x: 650, y: y + 25 }, label: `MUX OR bit ${bit + 1}` },
    )
    connections.push(
      { source: { node: 'splitter-a', port: bit }, target: { node: selectedAnd, port: 0 } },
      { source: { node: 'input-0-select' }, target: { node: selectedAnd, port: 1 } },
      { source: { node: 'splitter-b', port: bit }, target: { node: invertedAnd, port: 0 } },
      { source: { node: 'not-select' }, target: { node: invertedAnd, port: 1 } },
      { source: { node: selectedAnd }, target: { node: outputOr, port: 0 } },
      { source: { node: invertedAnd }, target: { node: outputOr, port: 1 } },
    )
  }

  const combinerId = 'combiner-1'
  const outputId = 'output-1'
  nodes.push(
    {
      id: combinerId,
      type: 'combiner',
      position: { x: 870, y: 340 },
      label: 'Combiner OUT',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
    {
      id: outputId,
      type: 'output',
      position: { x: 1090, y: 340 },
      label: outputLabel,
      options: { width: BUS_WIDTH },
    },
  )
  for (let bit = 0; bit < BUS_WIDTH; bit += 1) {
    connections.push({ source: { node: `mux-or-${bit}` }, target: { node: combinerId, port: bit } })
  }
  connections.push({ source: { node: combinerId }, target: { node: outputId, port: 0 } })

  return { ...document, nodes, connections }
}

function buildEightBitNotDocument(chip: ChipEntry): CircuitDocument {
  const document = createCircuitDocument(chip.name)
  const inputLabel = chip.pins?.in?.[0] || 'IN'
  const outputLabel = chip.pins?.out?.[0] || 'OUT'
  const splitterId = 'splitter-1'
  const combinerId = 'combiner-1'
  const outputId = 'output-1'
  const nodes: CircuitNode[] = [
    {
      id: 'input-1',
      type: 'input',
      position: { x: 0, y: 300 },
      label: inputLabel,
      options: { width: BUS_WIDTH },
    },
    {
      id: splitterId,
      type: 'splitter',
      position: { x: 190, y: 300 },
      label: 'Split IN',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
  ]
  const connections: CircuitDocument['connections'] = [
    { source: { node: 'input-1' }, target: { node: splitterId, port: 0 } },
  ]

  for (let bit = 0; bit < BUS_WIDTH; bit += 1) {
    const notId = `not-${bit + 1}`
    nodes.push({
      id: notId,
      type: 'not',
      position: { x: 430, y: 40 + bit * 80 },
      label: `NOT bit ${bit + 1}`,
    })
    connections.push(
      { source: { node: splitterId, port: bit }, target: { node: notId, port: 0 } },
      { source: { node: notId }, target: { node: combinerId, port: bit } },
    )
  }

  nodes.push(
    {
      id: combinerId,
      type: 'combiner',
      position: { x: 700, y: 300 },
      label: 'Combiner OUT',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
    {
      id: outputId,
      type: 'output',
      position: { x: 920, y: 300 },
      label: outputLabel,
      options: { width: BUS_WIDTH },
    },
  )
  connections.push({ source: { node: combinerId }, target: { node: outputId, port: 0 } })

  return { ...document, nodes, connections }
}

function buildEightBitNegateDocument(chip: ChipEntry): CircuitDocument {
  const document = createCircuitDocument(chip.name)
  const inputLabels = chip.pins?.in?.length === 2 ? chip.pins.in : ['IN', 'CONTROL']
  const outputLabel = chip.pins?.out?.[0] || 'OUT'
  const splitterId = 'splitter-1'
  const combinerId = 'combiner-1'
  const outputId = 'output-1'
  const nodes: CircuitNode[] = [
    {
      id: 'input-1-bus',
      type: 'input',
      position: { x: 0, y: 160 },
      label: inputLabels[0] || 'IN',
      options: { width: BUS_WIDTH },
    },
    {
      id: 'input-2-control',
      type: 'input',
      position: { x: 0, y: 680 },
      label: inputLabels[1] || 'CONTROL',
    },
    {
      id: splitterId,
      type: 'splitter',
      position: { x: 190, y: 160 },
      label: 'Split IN',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
  ]
  const connections: CircuitDocument['connections'] = [
    { source: { node: 'input-1-bus' }, target: { node: splitterId, port: 0 } },
  ]

  for (let bit = 0; bit < BUS_WIDTH; bit += 1) {
    const xorId = `negate-xor-${bit + 1}`
    nodes.push({
      id: xorId,
      type: 'xor',
      position: { x: 430, y: 40 + bit * 80 },
      label: `NEGATE XOR bit ${bit + 1}`,
    })
    connections.push(
      { source: { node: splitterId, port: bit }, target: { node: xorId, port: 0 } },
      { source: { node: 'input-2-control' }, target: { node: xorId, port: 1 } },
      { source: { node: xorId }, target: { node: combinerId, port: bit } },
    )
  }

  nodes.push(
    {
      id: combinerId,
      type: 'combiner',
      position: { x: 700, y: 320 },
      label: 'Combiner OUT',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
    {
      id: outputId,
      type: 'output',
      position: { x: 920, y: 320 },
      label: outputLabel,
      options: { width: BUS_WIDTH },
    },
  )
  connections.push({ source: { node: combinerId }, target: { node: outputId, port: 0 } })

  return { ...document, nodes, connections }
}

function buildSixteenInputBusRouterDocument(chip: ChipEntry): CircuitDocument {
  const document = createCircuitDocument(chip.name)
  const inputLabels = chip.pins?.in?.length === 16
    ? chip.pins.in
    : Array.from({ length: 16 }, () => 'IN')
  const outputLabels = chip.pins?.out?.length === 10
    ? chip.pins.out
    : Array.from({ length: 10 }, () => 'OUT')
  const nodes: CircuitNode[] = []
  const connections: CircuitDocument['connections'] = []

  for (let inputIndex = 0; inputIndex < 16; inputIndex += 1) {
    nodes.push({
      id: `input-${String(inputIndex + 1).padStart(2, '0')}`,
      type: 'input',
      position: { x: 0, y: 40 + inputIndex * 55 },
      label: inputLabels[inputIndex] || 'IN',
    })
  }

  const combinerA = 'combiner-a'
  const combinerB = 'combiner-b'
  const splitterA = 'splitter-a'
  const splitterB = 'splitter-b'
  const andCombiner = 'combiner-and'
  const andSplitter = 'splitter-and'
  nodes.push(
    {
      id: combinerA,
      type: 'combiner',
      position: { x: 210, y: 180 },
      label: 'Combiner A',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
    {
      id: combinerB,
      type: 'combiner',
      position: { x: 210, y: 580 },
      label: 'Combiner B',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
    {
      id: splitterA,
      type: 'splitter',
      position: { x: 430, y: 180 },
      label: 'Split A',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
    {
      id: splitterB,
      type: 'splitter',
      position: { x: 430, y: 580 },
      label: 'Split B',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
  )

  for (let inputIndex = 0; inputIndex < 16; inputIndex += 1) {
    const combinerId = inputIndex < BUS_WIDTH ? combinerA : combinerB
    const port = inputIndex % BUS_WIDTH
    connections.push({
      source: { node: `input-${String(inputIndex + 1).padStart(2, '0')}` },
      target: { node: combinerId, port },
    })
  }
  connections.push(
    { source: { node: combinerA }, target: { node: splitterA, port: 0 } },
    { source: { node: combinerB }, target: { node: splitterB, port: 0 } },
  )

  for (let bit = 0; bit < BUS_WIDTH; bit += 1) {
    const gateId = `router-and-${bit + 1}`
    nodes.push({
      id: gateId,
      type: 'and',
      position: { x: 660, y: 40 + bit * 90 },
      label: `AND bit ${bit + 1}`,
    })
    connections.push(
      { source: { node: splitterA, port: bit }, target: { node: gateId, port: 0 } },
      { source: { node: splitterB, port: bit }, target: { node: gateId, port: 1 } },
      { source: { node: gateId }, target: { node: andCombiner, port: bit } },
    )
  }

  nodes.push(
    {
      id: andCombiner,
      type: 'combiner',
      position: { x: 900, y: 280 },
      label: 'Combiner AND',
      options: { width: BUS_WIDTH, widths: unitWidths(BUS_WIDTH) },
    },
    {
      id: andSplitter,
      type: 'splitter',
      position: { x: 1100, y: 280 },
      label: 'Split AND 4+4',
      options: { width: BUS_WIDTH, widths: [4, 4] },
    },
  )
  connections.push({ source: { node: andCombiner }, target: { node: andSplitter, port: 0 } })

  const outputWidths = [8, 8, 4, 8, 4, 4, 4, 8, 8, 8]
  for (let outputIndex = 0; outputIndex < outputWidths.length; outputIndex += 1) {
    const outputId = `output-${String(outputIndex + 1).padStart(2, '0')}`
    nodes.push({
      id: outputId,
      type: 'output',
      position: { x: 1540, y: 40 + outputIndex * 90 },
      label: outputLabels[outputIndex] || 'OUT',
      options: { width: outputWidths[outputIndex] },
    })
  }
  const outputSources = [
    { node: combinerA },
    { node: combinerA },
    { node: andSplitter, port: 0 },
    { node: combinerA },
    { node: andSplitter, port: 0 },
    { node: andSplitter, port: 1 },
    { node: andSplitter, port: 1 },
    { node: combinerB },
    { node: combinerB },
    { node: combinerB },
  ]
  for (let outputIndex = 0; outputIndex < outputSources.length; outputIndex += 1) {
    connections.push({
      source: outputSources[outputIndex],
      target: { node: `output-${String(outputIndex + 1).padStart(2, '0')}`, port: 0 },
    })
  }

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
