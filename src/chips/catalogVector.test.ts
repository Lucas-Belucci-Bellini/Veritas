import { describe, expect, it } from 'vitest'
import {
  buildCustomChipDefinition,
  createCircuitDocument,
  evaluateCircuitVectors,
  exportVerilog,
  exportVhdl,
  validateCircuit,
} from '../circuit'
import { toBinary } from '../bus'
import { catalogVectorChipToCircuitDocument } from './catalogVector'
import { loadCatalog, type ChipEntry } from './types'

function vectorChip(name: string, gate: 'AND' | 'OR' | 'XOR' | 'NAND' = 'AND'): ChipEntry {
  const parts: Record<string, number> = name === 'OR-8 Bits'
    ? { 'NOT-8 Bits': 2, 'NAND-8Bits': 1, '8-1BIT': 2, '1-8BIT': 1 }
    : name === 'XOR - 8 BIT'
      ? { 'NAND-8Bits': 3, 'NOT-8 Bits': 2, '8-1BIT': 2, '1-8BIT': 1 }
      : name === 'NAND-8Bits'
        ? { AND: 8, NOT: 8, '8-1BIT': 2, '1-8BIT': 1 }
        : { [gate]: 8, '8-1BIT': 2, '1-8BIT': 1 }
  return {
    name,
    category: 'Bancos de portas',
    in: 2,
    out: 1,
    pins: { in: ['A', 'B'], out: ['OUT'] },
    widths: [8],
    parts,
    partCount: Object.keys(parts).length,
    wireCount: 0,
  }
}

describe('catalogVectorChipToCircuitDocument', () => {
  it('materializa um banco AND de 8 bits com split, portas e combiner', () => {
    const document = catalogVectorChipToCircuitDocument(vectorChip('AND-8 Bits'))

    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'input')).toHaveLength(2)
    expect(document?.nodes.filter((node) => node.type === 'splitter')).toHaveLength(2)
    expect(document?.nodes.filter((node) => node.type === 'and')).toHaveLength(8)
    expect(document?.nodes.find((node) => node.type === 'combiner')?.options).toEqual({
      width: 8,
      widths: [1, 1, 1, 1, 1, 1, 1, 1],
    })
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })

  it.each([
    ['OR-8 Bits', 'or'],
    ['XOR - 8 BIT', 'xor'],
    ['NAND-8Bits', 'nand'],
  ] as const)('materializa %s com o tipo vetorial %s', (name, type) => {
    const document = catalogVectorChipToCircuitDocument(vectorChip(name, type === 'nand' ? 'AND' : type.toUpperCase() as 'OR' | 'XOR'))
    expect(document?.nodes.filter((node) => node.type === type)).toHaveLength(8)
  })

  it('recusa chips com largura, portas ou partes incompatíveis', () => {
    expect(catalogVectorChipToCircuitDocument({ ...vectorChip('AND-8 Bits'), widths: [4] })).toBeNull()
    expect(catalogVectorChipToCircuitDocument({ ...vectorChip('AND-8 Bits'), in: 1 })).toBeNull()
    expect(catalogVectorChipToCircuitDocument({ ...vectorChip('AND-8 Bits'), parts: { AND: 7, '8-1BIT': 2, '1-8BIT': 1 } })).toBeNull()
    expect(catalogVectorChipToCircuitDocument({ ...vectorChip('AND-8 Bits'), name: 'desconhecido' })).toBeNull()
  })
})

function fourBitAdderChip(): ChipEntry {
  return {
    name: '4-ADD',
    category: 'Aritmética',
    in: 3,
    out: 2,
    pins: { in: ['A', 'B', 'CARRY'], out: ['OUT', 'CARRY'] },
    widths: [4],
    parts: { '1-ADD': 4, '4-1BIT': 2, '1-4BIT': 1 },
    partCount: 7,
    wireCount: 18,
  }
}

describe('4-ADD importado do catálogo DLS', () => {
  it('materializa uma soma ripple-carry 4-bit com duas saídas', () => {
    const document = catalogVectorChipToCircuitDocument(fourBitAdderChip())

    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'splitter')).toHaveLength(2)
    expect(document?.nodes.filter((node) => node.type === 'combiner')).toHaveLength(1)
    expect(document?.nodes.filter((node) => node.type === 'xor')).toHaveLength(8)
    expect(document?.nodes.filter((node) => node.type === 'and')).toHaveLength(8)
    expect(document?.nodes.filter((node) => node.type === 'or')).toHaveLength(4)
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])

    const result = evaluateCircuitVectors(document!, {
      'input-a': '0111',
      'input-b': '1001',
      'input-carry': 0,
    })
    expect(toBinary(result.outputs['output-0-sum']!)).toBe('0000')
    expect(toBinary(result.outputs['output-1-carry']!)).toBe('1')
  })

  it('confere todas as 512 combinações de soma e carry', () => {
    const document = catalogVectorChipToCircuitDocument(fourBitAdderChip())!
    for (let a = 0; a < 16; a += 1) {
      for (let b = 0; b < 16; b += 1) {
        for (let carryIn = 0; carryIn < 2; carryIn += 1) {
          const total = a + b + carryIn
          const result = evaluateCircuitVectors(document, {
            'input-a': a,
            'input-b': b,
            'input-carry': carryIn,
          })
          expect(Number(result.outputs['output-0-sum']!.bits.reduce((value, bit) => (value << 1) | (bit ? 1 : 0), 0))).toBe(total & 0b1111)
          expect(Number(result.outputs['output-1-carry']!.bits[0] ? 1 : 0)).toBe(total > 15 ? 1 : 0)
        }
      }
    }
  })

  it('preserva as larguras heterogêneas ao virar chip customizado local', () => {
    const document = catalogVectorChipToCircuitDocument(fourBitAdderChip())!
    const definition = buildCustomChipDefinition(document, '4-ADD importado')

    expect(definition.inputs.map((port) => [port.name, port.width])).toEqual([
      ['A', 4],
      ['B', 4],
      ['CARRY', 1],
    ])
    expect(definition.outputs.map((port) => [port.name, port.width])).toEqual([
      ['OUT', 4],
      ['CARRY', 1],
    ])

    const parent = {
      ...createCircuitDocument('pai do 4-ADD'),
      nodes: [
        { id: 'a', type: 'input' as const, position: { x: 0, y: 0 }, options: { width: 4 } },
        { id: 'b', type: 'input' as const, position: { x: 0, y: 80 }, options: { width: 4 } },
        { id: 'cin', type: 'input' as const, position: { x: 0, y: 160 } },
        { id: 'chip', type: 'custom-chip' as const, position: { x: 240, y: 80 }, options: { customChipId: 41 } },
        { id: 'sum', type: 'output' as const, position: { x: 480, y: 0 }, options: { width: 4 } },
        { id: 'carry', type: 'output' as const, position: { x: 480, y: 160 } },
      ],
      connections: [
        { source: { node: 'a' }, target: { node: 'chip', port: 0 } },
        { source: { node: 'b' }, target: { node: 'chip', port: 1 } },
        { source: { node: 'cin' }, target: { node: 'chip', port: 2 } },
        { source: { node: 'chip', port: 0 }, target: { node: 'sum', port: 0 } },
        { source: { node: 'chip', port: 1 }, target: { node: 'carry', port: 0 } },
      ],
    }
    expect(validateCircuit(parent, { allowBuses: true, customChips: [{ id: 41, definition }] })).toEqual([])
    const result = evaluateCircuitVectors(parent, { a: '0101', b: '0110', cin: 1 }, { customChips: [{ id: 41, definition }] })
    expect(toBinary(result.outputs.sum!)).toBe('1100')
    expect(toBinary(result.outputs.carry!)).toBe('0')
  })

  it('exporta o 4-ADD importado para Verilog e VHDL', () => {
    const document = catalogVectorChipToCircuitDocument(fourBitAdderChip())!
    const verilog = exportVerilog(document)
    const vhdl = exportVhdl(document)

    expect(verilog).toContain('module n_4_ADD')
    expect(verilog).toContain('[3:0]')
    expect(vhdl).toContain('entity n_4_ADD is')
    expect(vhdl).toContain('std_logic_vector(3 downto 0)')
  })

  it('reconhece a entrada 4-ADD do catálogo gerado a partir do DLS', async () => {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === '4-ADD')

    expect(chip).toBeDefined()
    const document = catalogVectorChipToCircuitDocument(chip!)
    expect(document).not.toBeNull()
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })
})


function fourBitEqualChip(): ChipEntry {
  return {
    name: 'EQUAL-4',
    category: 'Comparadores',
    in: 2,
    out: 1,
    pins: { in: ['IN', 'IN'], out: ['OUT'] },
    widths: [1, 4],
    parts: { XNOR: 4, AND: 3, '4-1BIT': 2 },
    partCount: 9,
    wireCount: 17,
  }
}

describe('EQUAL-4 importado do catálogo DLS', () => {
  it('materializa dois barramentos, quatro XNOR e uma redução AND', () => {
    const document = catalogVectorChipToCircuitDocument(fourBitEqualChip())

    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'splitter')).toHaveLength(2)
    expect(document?.nodes.filter((node) => node.type === 'xnor')).toHaveLength(4)
    expect(document?.nodes.filter((node) => node.type === 'and')).toHaveLength(3)
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })

  it.each([
    ['0101', '0101', '1'],
    ['0101', '0111', '0'],
    ['1111', '1111', '1'],
    ['0000', '1000', '0'],
  ])('avalia %s == %s como %s', (left, right, expected) => {
    const document = catalogVectorChipToCircuitDocument(fourBitEqualChip())!
    const result = evaluateCircuitVectors(document, { 'input-a': left, 'input-b': right })
    expect(toBinary(result.outputs['output-0']!)).toBe(expected)
  })

  it('preserva portas duplicadas do DLS com IDs e larguras determinísticos', () => {
    const document = catalogVectorChipToCircuitDocument(fourBitEqualChip())!
    const definition = buildCustomChipDefinition(document, 'EQUAL-4 importado')

    expect(definition.inputs.map((port) => [port.name, port.width])).toEqual([
      ['IN', 4],
      ['IN_2', 4],
    ])
    expect(definition.outputs.map((port) => [port.name, port.width])).toEqual([['OUT', 1]])
  })

  it('exporta o comparador multi-bit para Verilog e VHDL', () => {
    const document = catalogVectorChipToCircuitDocument(fourBitEqualChip())!
    const verilog = exportVerilog(document)
    const vhdl = exportVhdl(document)

    expect(verilog).toContain('module EQUAL_4')
    expect(verilog).toContain('[3:0]')
    expect(vhdl).toContain('entity EQUAL_4 is')
    expect(vhdl).toContain('std_logic_vector(3 downto 0)')
  })

  it('reconhece a entrada EQUAL-4 do catálogo gerado a partir do DLS', async () => {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === 'EQUAL-4')

    expect(chip).toBeDefined()
    const document = catalogVectorChipToCircuitDocument(chip!)
    expect(document).not.toBeNull()
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })
})


function eightBitAdderChip(): ChipEntry {
  return {
    name: '8-ADD',
    category: 'Somadores',
    in: 3,
    out: 2,
    pins: { in: ['CARRY', 'IN', 'IN'], out: ['OUT', 'CARRY'] },
    widths: [1, 8],
    parts: { '1-ADD': 8, '8-1BIT': 2, '1-8BIT': 1 },
    partCount: 11,
    wireCount: 36,
  }
}

describe('8-ADD importado do catálogo DLS', () => {
  it('materializa um ripple-carry de oito bits com duas saídas', () => {
    const document = catalogVectorChipToCircuitDocument(eightBitAdderChip())

    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'input').map((node) => node.label)).toEqual(['CARRY', 'IN', 'IN'])
    expect(document?.nodes.filter((node) => node.type === 'splitter')).toHaveLength(2)
    expect(document?.nodes.filter((node) => node.type === 'xor')).toHaveLength(16)
    expect(document?.nodes.filter((node) => node.type === 'and')).toHaveLength(16)
    expect(document?.nodes.filter((node) => node.type === 'or')).toHaveLength(8)
    expect(document?.nodes.filter((node) => node.type === 'combiner')).toHaveLength(1)
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })

  it.each([
    [0x00, 0x00, 0, '00000000', '0'],
    [0xff, 0x00, 0, '11111111', '0'],
    [0xff, 0x01, 0, '00000000', '1'],
    [0x7f, 0x80, 0, '11111111', '0'],
    [0xff, 0xff, 1, '11111111', '1'],
  ])('avalia %s + %s + carry %s como %s e carry %s', (a, b, carryIn, expectedSum, expectedCarry) => {
    const document = catalogVectorChipToCircuitDocument(eightBitAdderChip())!
    const result = evaluateCircuitVectors(document, {
      'input-1-a': a,
      'input-2-b': b,
      'input-0-carry': carryIn,
    })
    expect(toBinary(result.outputs['output-0-sum']!)).toBe(expectedSum)
    expect(toBinary(result.outputs['output-1-carry']!)).toBe(expectedCarry)
  })

  it('preserva a ordem pública do DLS e normaliza o segundo IN ao virar chip local', () => {
    const document = catalogVectorChipToCircuitDocument(eightBitAdderChip())!
    const definition = buildCustomChipDefinition(document, '8-ADD importado')

    expect(definition.inputs.map((port) => [port.name, port.width])).toEqual([
      ['CARRY', 1],
      ['IN', 8],
      ['IN_2', 8],
    ])
    expect(definition.outputs.map((port) => [port.name, port.width])).toEqual([
      ['OUT', 8],
      ['CARRY', 1],
    ])
  })

  it('reconhece a entrada 8-ADD do catálogo gerado a partir do DLS', async () => {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === '8-ADD')

    expect(chip).toBeDefined()
    const document = catalogVectorChipToCircuitDocument(chip!)
    expect(document).not.toBeNull()
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })
})


function eightBitMaskChip(): ChipEntry {
  return {
    name: '8-1AND',
    category: 'Outros',
    in: 2,
    out: 1,
    pins: { in: ['IN', 'IN'], out: ['OUT'] },
    widths: [1, 8],
    parts: { AND: 8, '8-1BIT': 1, '1-8BIT': 1 },
    partCount: 10,
    wireCount: 26,
  }
}

describe('8-1AND importado do catálogo DLS', () => {
  it('materializa um mascarador escalar com split, oito AND e combiner', () => {
    const document = catalogVectorChipToCircuitDocument(eightBitMaskChip())

    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'input').map((node) => node.label)).toEqual(['IN', 'IN'])
    expect(document?.nodes.filter((node) => node.type === 'splitter')).toHaveLength(1)
    expect(document?.nodes.filter((node) => node.type === 'and')).toHaveLength(8)
    expect(document?.nodes.filter((node) => node.type === 'combiner')).toHaveLength(1)
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })

  it('aplica a máscara a todos os 256 valores do barramento', () => {
    const document = catalogVectorChipToCircuitDocument(eightBitMaskChip())!
    for (let bus = 0; bus < 256; bus += 1) {
      const enabled = evaluateCircuitVectors(document, { 'input-0-mask': 1, 'input-1-bus': bus })
      const disabled = evaluateCircuitVectors(document, { 'input-0-mask': 0, 'input-1-bus': bus })
      expect(Number(enabled.outputs['output-0']!.bits.reduce((value, bit) => (value << 1) | (bit ? 1 : 0), 0))).toBe(bus)
      expect(Number(disabled.outputs['output-0']!.bits.reduce((value, bit) => (value << 1) | (bit ? 1 : 0), 0))).toBe(0)
    }
  })

  it('preserva as larguras e normaliza os dois IN ao virar chip local', () => {
    const document = catalogVectorChipToCircuitDocument(eightBitMaskChip())!
    const definition = buildCustomChipDefinition(document, '8-1AND importado')

    expect(definition.inputs.map((port) => [port.name, port.width])).toEqual([
      ['IN', 1],
      ['IN_2', 8],
    ])
    expect(definition.outputs.map((port) => [port.name, port.width])).toEqual([['OUT', 8]])
  })

  it('exporta o mascarador multi-bit para Verilog e VHDL', () => {
    const document = catalogVectorChipToCircuitDocument(eightBitMaskChip())!
    const verilog = exportVerilog(document)
    const vhdl = exportVhdl(document)

    expect(verilog).toContain('module n_8_1AND')
    expect(verilog).toContain('[7:0]')
    expect(vhdl).toContain('entity n_8_1AND is')
    expect(vhdl).toContain('std_logic_vector(7 downto 0)')
  })

  it('reconhece a entrada 8-1AND do catálogo gerado a partir do DLS', async () => {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === '8-1AND')

    expect(chip).toBeDefined()
    const document = catalogVectorChipToCircuitDocument(chip!)
    expect(document).not.toBeNull()
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })
})


describe('operadores binários de barramento do catálogo DLS', () => {
  it.each([
    ['8x2-AND', '10001000'],
    ['8x2-OR', '11101110'],
    ['8x2-XOR', '01100110'],
  ] as const)('materializa e avalia o fixture real %s', async (name, expected) => {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === name)

    expect(chip).toMatchObject({
      name,
      in: 2,
      out: 1,
      widths: [8],
      pins: { in: ['IN', 'IN'], out: ['OUT'] },
    })
    expect(chip).toBeDefined()

    const document = catalogVectorChipToCircuitDocument(chip!)
    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'splitter')).toHaveLength(2)
    const gateType = name === '8x2-AND' ? 'and' : name === '8x2-OR' ? 'or' : 'xor'
    expect(document?.nodes.filter((node) => node.type === gateType)).toHaveLength(8)
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])

    const result = evaluateCircuitVectors(document!, { 'input-1': 0xaa, 'input-2': 0xcc })
    expect(toBinary(result.outputs['output-1']!)).toBe(expected)

    const definition = buildCustomChipDefinition(document!, `${name} importado`)
    expect(definition.inputs.map((port) => [port.name, port.width])).toEqual([
      ['IN', 8],
      ['IN_2', 8],
    ])
    expect(definition.outputs.map((port) => [port.name, port.width])).toEqual([['OUT', 8]])
  })
})
