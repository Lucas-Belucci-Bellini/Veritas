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

describe('AND-3 8 bits importado do catálogo DLS', () => {
  async function loadRealChip(): Promise<ChipEntry> {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === 'AND-3 8 bits')
    expect(chip).toMatchObject({
      name: 'AND-3 8 bits',
      in: 3,
      out: 1,
      widths: [8],
      pins: { in: ['IN', 'IN', 'IN'], out: ['OUT'] },
    })
    expect(chip).toBeDefined()
    return chip!
  }

  it('materializa três Splitters, dezesseis AND e um Combiner', async () => {
    const chip = await loadRealChip()
    const document = catalogVectorChipToCircuitDocument(chip)

    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'input')).toHaveLength(3)
    expect(document?.nodes.filter((node) => node.type === 'splitter')).toHaveLength(3)
    expect(document?.nodes.filter((node) => node.type === 'and')).toHaveLength(16)
    expect(document?.nodes.filter((node) => node.type === 'combiner')).toHaveLength(1)
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })

  it.each([
    [0xaa, 0xcc, 0xf0, '10000000'],
    [0xff, 0xaa, 0x0f, '00001010'],
    [0xff, 0xff, 0xff, '11111111'],
  ])('avalia %s AND %s AND %s como %s', async (a, b, c, expected) => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const result = evaluateCircuitVectors(document, {
      'input-1': a,
      'input-2': b,
      'input-3': c,
    })

    expect(toBinary(result.outputs['output-1']!)).toBe(expected)
  })

  it('preserva três entradas de 8 bits e normaliza IN duplicado no chip local', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const definition = buildCustomChipDefinition(document, 'AND-3 8 bits importado')

    expect(definition.inputs.map((port) => [port.name, port.width])).toEqual([
      ['IN', 8],
      ['IN_2', 8],
      ['IN_3', 8],
    ])
    expect(definition.outputs.map((port) => [port.name, port.width])).toEqual([['OUT', 8]])
  })

  it('exporta o AND-3 vetorial para Verilog e VHDL', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const verilog = exportVerilog(document)
    const vhdl = exportVhdl(document)

    expect(verilog).toContain('module AND_3_8_bits')
    expect(verilog).toContain('[7:0]')
    expect(vhdl).toContain('entity AND_3_8_bits is')
    expect(vhdl).toContain('std_logic_vector(7 downto 0)')
  })

  it('recusa a assinatura quando falta um AND do fixture real', async () => {
    const chip = await loadRealChip()
    expect(catalogVectorChipToCircuitDocument({
      ...chip,
      parts: { ...chip.parts, AND: 15 },
    })).toBeNull()
  })
})


describe('Full Adder - 8 Bits importado do catálogo DLS', () => {
  async function loadRealChip(): Promise<ChipEntry> {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === 'Full Adder - 8 Bits')
    expect(chip).toMatchObject({
      name: 'Full Adder - 8 Bits',
      in: 3,
      out: 2,
      widths: [8],
      pins: {
        in: ['Carry IN', 'IN A', 'IN B'],
        out: ['BIT-8 Bits', 'Carry Out-8Bits'],
      },
      parts: { 'AND-8 Bits': 2, 'XOR - 8 BIT': 2, 'OR-8 Bits': 1 },
    })
    expect(chip).toBeDefined()
    return chip!
  }

  it('materializa três Splitters, dois barramentos de saída e oito somadores completos bit a bit', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())

    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'input')).toHaveLength(3)
    expect(document?.nodes.filter((node) => node.type === 'splitter')).toHaveLength(3)
    expect(document?.nodes.filter((node) => node.type === 'xor')).toHaveLength(16)
    expect(document?.nodes.filter((node) => node.type === 'and')).toHaveLength(16)
    expect(document?.nodes.filter((node) => node.type === 'or')).toHaveLength(8)
    expect(document?.nodes.filter((node) => node.type === 'combiner')).toHaveLength(2)
    expect(document?.nodes.filter((node) => node.type === 'output')).toHaveLength(2)
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })

  it.each([
    [0x00, 0x00, 0x00, '00000000', '00000000'],
    [0xaa, 0xcc, 0xf0, '10010110', '11101000'],
    [0xff, 0xff, 0x00, '00000000', '11111111'],
    [0xff, 0xff, 0xff, '11111111', '11111111'],
  ])('avalia carry %s, A %s e B %s como soma %s e carry %s', async (carry, a, b, expectedSum, expectedCarry) => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const result = evaluateCircuitVectors(document, {
      'input-0-carry': carry,
      'input-1-a': a,
      'input-2-b': b,
    })

    expect(toBinary(result.outputs['output-0-sum']!)).toBe(expectedSum)
    expect(toBinary(result.outputs['output-1-carry']!)).toBe(expectedCarry)
  })

  it('preserva as três entradas e as duas saídas vetoriais no chip local', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const definition = buildCustomChipDefinition(document, 'Full Adder - 8 Bits importado')

    expect(definition.inputs.map((port) => [port.name, port.width])).toEqual([
      ['Carry IN', 8],
      ['IN A', 8],
      ['IN B', 8],
    ])
    expect(definition.outputs.map((port) => [port.name, port.width])).toEqual([
      ['BIT-8 Bits', 8],
      ['Carry Out-8Bits', 8],
    ])
  })

  it('exporta os dois barramentos do full adder para Verilog e VHDL', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const verilog = exportVerilog(document)
    const vhdl = exportVhdl(document)

    expect(verilog).toContain('[7:0]')
    expect(vhdl).toContain('std_logic_vector(7 downto 0)')
  })

  it('recusa a assinatura quando falta um bloco AND do fixture real', async () => {
    const chip = await loadRealChip()
    expect(catalogVectorChipToCircuitDocument({
      ...chip,
      parts: { ...chip.parts, 'AND-8 Bits': 1 },
    })).toBeNull()
  })
})


describe('(8 Bits) 8-bit Adder importado do catálogo DLS', () => {
  async function loadRealChip(): Promise<ChipEntry> {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === '(8 Bits) 8-bit Adder')
    expect(chip).toMatchObject({
      name: '(8 Bits) 8-bit Adder',
      in: 3,
      out: 2,
      widths: [1, 8],
      pins: {
        in: ['IN A 1-8', 'IN B 1-8', 'Carry IN'],
        out: ['OUT', 'Carry OUT'],
      },
      parts: { '1-8BIT': 1, '8-1BIT': 2, '8-bit Adder': 1 },
    })
    expect(chip).toBeDefined()
    return chip!
  }

  it('materializa dois Splitters, oito estágios ripple-carry e duas saídas heterogêneas', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())

    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'input')).toHaveLength(3)
    expect(document?.nodes.filter((node) => node.type === 'splitter')).toHaveLength(2)
    expect(document?.nodes.filter((node) => node.type === 'xor')).toHaveLength(16)
    expect(document?.nodes.filter((node) => node.type === 'and')).toHaveLength(16)
    expect(document?.nodes.filter((node) => node.type === 'or')).toHaveLength(8)
    expect(document?.nodes.filter((node) => node.type === 'combiner')).toHaveLength(1)
    expect(document?.nodes.find((node) => node.id === 'input-2-carry')?.options).toBeUndefined()
    expect(document?.nodes.find((node) => node.id === 'output-1-carry')?.options).toBeUndefined()
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })

  it.each([
    [0x00, 0x00, 0, '00000000', '0'],
    [0xaa, 0xcc, 1, '01110111', '1'],
    [0xff, 0x00, 1, '00000000', '1'],
    [0x7f, 0x80, 0, '11111111', '0'],
  ])('avalia A %s, B %s e carry %s como soma %s e carry %s', async (a, b, carryIn, expectedSum, expectedCarry) => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const result = evaluateCircuitVectors(document, {
      'input-0-a': a,
      'input-1-b': b,
      'input-2-carry': carryIn,
    })

    expect(toBinary(result.outputs['output-0-sum']!)).toBe(expectedSum)
    expect(toBinary(result.outputs['output-1-carry']!)).toBe(expectedCarry)
  })

  it('preserva a ordem pública e as larguras heterogêneas no chip local', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const definition = buildCustomChipDefinition(document, '(8 Bits) 8-bit Adder importado')

    expect(definition.inputs.map((port) => [port.name, port.width])).toEqual([
      ['IN A 1-8', 8],
      ['IN B 1-8', 8],
      ['Carry IN', 1],
    ])
    expect(definition.outputs.map((port) => [port.name, port.width])).toEqual([
      ['OUT', 8],
      ['Carry OUT', 1],
    ])
  })

  it('exporta o alias real de 8 bits para Verilog e VHDL', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const verilog = exportVerilog(document)
    const vhdl = exportVhdl(document)

    expect(verilog).toContain('[7:0]')
    expect(vhdl).toContain('std_logic_vector(7 downto 0)')
  })

  it('recusa o alias quando a dependência 8-bit Adder não coincide', async () => {
    const chip = await loadRealChip()
    expect(catalogVectorChipToCircuitDocument({
      ...chip,
      parts: { ...chip.parts, '8-bit Adder': 2 },
    })).toBeNull()
  })
})


describe('bancos base de barramento de 8 bits importados do catálogo DLS', () => {
  it.each([
    ['AND-8 Bits', 'and', { '1-8BIT': 1, '8-1BIT': 2, AND: 8 }, '10001000'],
    ['NAND-8Bits', 'nand', { '1-8BIT': 1, '8-1BIT': 2, AND: 8, NOT: 8 }, '01110111'],
    ['OR-8 Bits', 'or', { 'NAND-8Bits': 1, 'NOT-8 Bits': 2 }, '11101110'],
    ['XOR - 8 BIT', 'xor', { 'NAND-8Bits': 3, 'NOT-8 Bits': 2 }, '01100110'],
  ] as const)('materializa e avalia o fixture real %s', async (name, nodeType, parts, expected) => {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === name)

    expect(chip).toMatchObject({
      name,
      in: 2,
      out: 1,
      widths: [8],
      pins: { in: ['IN', 'IN'], out: ['OUT'] },
      parts,
    })
    expect(chip).toBeDefined()

    const document = catalogVectorChipToCircuitDocument(chip!)
    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'splitter')).toHaveLength(2)
    expect(document?.nodes.filter((node) => node.type === nodeType)).toHaveLength(8)
    expect(document?.nodes.filter((node) => node.type === 'combiner')).toHaveLength(1)
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

  it('recusa o fixture NAND real quando a máscara NOT está incompleta', async () => {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === 'NAND-8Bits')!

    expect(catalogVectorChipToCircuitDocument({
      ...chip,
      parts: { ...chip.parts, NOT: 7 },
    })).toBeNull()
  })
})


describe('1-8MUX importado do catálogo DLS', () => {
  async function loadRealChip(): Promise<ChipEntry> {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === '1-8MUX')
    expect(chip).toMatchObject({
      name: '1-8MUX',
      in: 3,
      out: 1,
      widths: [1, 8],
      pins: { in: ['IN', 'IN', 'IN'], out: ['OUT'] },
      parts: { '8-1AND': 2, '8x2-OR': 1, NOT: 1 },
    })
    expect(chip).toBeDefined()
    return chip!
  }

  it('materializa dois Splitters, NOT de seleção, dezesseis AND, oito OR e um Combiner', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())

    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'input')).toHaveLength(3)
    expect(document?.nodes.filter((node) => node.type === 'splitter')).toHaveLength(2)
    expect(document?.nodes.filter((node) => node.type === 'not')).toHaveLength(1)
    expect(document?.nodes.filter((node) => node.type === 'and')).toHaveLength(16)
    expect(document?.nodes.filter((node) => node.type === 'or')).toHaveLength(8)
    expect(document?.nodes.filter((node) => node.type === 'combiner')).toHaveLength(1)
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })

  it.each([
    [0, 0xaa, 0xcc, '11001100'],
    [1, 0xaa, 0xcc, '10101010'],
    [0, 0x00, 0xff, '11111111'],
    [1, 0x00, 0xff, '00000000'],
  ])('seleciona A/B com select %s: A=%s, B=%s → %s', async (select, a, b, expected) => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const result = evaluateCircuitVectors(document, {
      'input-0-select': select,
      'input-1-a': a,
      'input-2-b': b,
    })

    expect(toBinary(result.outputs['output-1']!)).toBe(expected)
  })

  it('preserva as três entradas heterogêneas e normaliza IN no chip local', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const definition = buildCustomChipDefinition(document, '1-8MUX importado')

    expect(definition.inputs.map((port) => [port.name, port.width])).toEqual([
      ['IN', 1],
      ['IN_2', 8],
      ['IN_3', 8],
    ])
    expect(definition.outputs.map((port) => [port.name, port.width])).toEqual([['OUT', 8]])
  })

  it('exporta o multiplexador vetorial para Verilog e VHDL', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const verilog = exportVerilog(document)
    const vhdl = exportVhdl(document)

    expect(verilog).toContain('[7:0]')
    expect(vhdl).toContain('std_logic_vector(7 downto 0)')
  })

  it('recusa o fixture quando falta uma das máscaras 8-1AND', async () => {
    const chip = await loadRealChip()
    expect(catalogVectorChipToCircuitDocument({
      ...chip,
      parts: { ...chip.parts, '8-1AND': 1 },
    })).toBeNull()
  })
})


describe('NOT-8 Bits importado do catálogo DLS', () => {
  async function loadRealChip(): Promise<ChipEntry> {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === 'NOT-8 Bits')
    expect(chip).toMatchObject({
      name: 'NOT-8 Bits',
      in: 1,
      out: 1,
      widths: [8],
      pins: { in: ['IN'], out: ['OUT'] },
      parts: { 'NAND-8Bits': 1 },
    })
    expect(chip).toBeDefined()
    return chip!
  }

  it('materializa um Splitter, oito NOT, um Combiner e uma saída vetorial', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())

    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'input')).toHaveLength(1)
    expect(document?.nodes.filter((node) => node.type === 'splitter')).toHaveLength(1)
    expect(document?.nodes.filter((node) => node.type === 'not')).toHaveLength(8)
    expect(document?.nodes.filter((node) => node.type === 'combiner')).toHaveLength(1)
    expect(document?.nodes.filter((node) => node.type === 'output')).toHaveLength(1)
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })

  it.each([
    [0x00, '11111111'],
    [0xaa, '01010101'],
    [0xcc, '00110011'],
    [0xff, '00000000'],
  ])('inverte IN=%s para OUT=%s', async (input, expected) => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const result = evaluateCircuitVectors(document, { 'input-1': input })

    expect(toBinary(result.outputs['output-1']!)).toBe(expected)
  })

  it('preserva uma entrada e uma saída de 8 bits no chip local', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const definition = buildCustomChipDefinition(document, 'NOT-8 Bits importado')

    expect(definition.inputs.map((port) => [port.name, port.width])).toEqual([['IN', 8]])
    expect(definition.outputs.map((port) => [port.name, port.width])).toEqual([['OUT', 8]])
  })

  it('exporta o inversor vetorial para Verilog e VHDL', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const verilog = exportVerilog(document)
    const vhdl = exportVhdl(document)

    expect(verilog).toContain('[7:0]')
    expect(vhdl).toContain('std_logic_vector(7 downto 0)')
  })

  it('recusa o alias quando o NAND-8Bits real está ausente', async () => {
    const chip = await loadRealChip()
    expect(catalogVectorChipToCircuitDocument({
      ...chip,
      parts: { ...chip.parts, 'NAND-8Bits': 0 },
    })).toBeNull()
  })
})


describe('NEGATE-8 importado do catálogo DLS', () => {
  async function loadRealChip(): Promise<ChipEntry> {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === 'NEGATE-8')
    expect(chip).toMatchObject({
      name: 'NEGATE-8',
      in: 2,
      out: 1,
      widths: [1, 8],
      pins: { in: ['IN', 'IN'], out: ['OUT'] },
      parts: { '8-1BIT': 1, '1-8BIT': 1, XOR: 8 },
    })
    expect(chip).toBeDefined()
    return chip!
  }

  it('materializa um Splitter, oito XOR, um Combiner e uma saída vetorial', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())

    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'input')).toHaveLength(2)
    expect(document?.nodes.filter((node) => node.type === 'splitter')).toHaveLength(1)
    expect(document?.nodes.filter((node) => node.type === 'xor')).toHaveLength(8)
    expect(document?.nodes.filter((node) => node.type === 'combiner')).toHaveLength(1)
    expect(document?.nodes.filter((node) => node.type === 'output')).toHaveLength(1)
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })

  it.each([
    [0x00, 0, '00000000'],
    [0xaa, 0, '10101010'],
    [0xaa, 1, '01010101'],
    [0xff, 1, '00000000'],
  ])('aplica controle %s ao barramento IN=%s e produz OUT=%s', async (input, control, expected) => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const result = evaluateCircuitVectors(document, {
      'input-1-bus': input,
      'input-2-control': control,
    })

    expect(toBinary(result.outputs['output-1']!)).toBe(expected)
  })

  it('preserva as larguras heterogêneas 8/1 e normaliza IN no chip local', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const definition = buildCustomChipDefinition(document, 'NEGATE-8 importado')

    expect(definition.inputs.map((port) => [port.name, port.width])).toEqual([
      ['IN', 8],
      ['IN_2', 1],
    ])
    expect(definition.outputs.map((port) => [port.name, port.width])).toEqual([['OUT', 8]])
  })

  it('exporta o negador condicional vetorial para Verilog e VHDL', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const verilog = exportVerilog(document)
    const vhdl = exportVhdl(document)

    expect(verilog).toContain('[7:0]')
    expect(vhdl).toContain('std_logic_vector(7 downto 0)')
  })

  it('recusa o alias quando o XOR real está incompleto', async () => {
    const chip = await loadRealChip()
    expect(catalogVectorChipToCircuitDocument({
      ...chip,
      parts: { ...chip.parts, XOR: 7 },
    })).toBeNull()
  })
})


describe('16 para 8 e 4 bits importado do catálogo DLS', () => {
  async function loadRealChip(): Promise<ChipEntry> {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === '16 para 8 e 4 bits')
    expect(chip).toMatchObject({
      name: '16 para 8 e 4 bits',
      in: 16,
      out: 10,
      widths: [1, 4, 8],
      parts: { '1-8BIT': 2, '8-4BIT': 1, '8x2-AND': 1 },
    })
    expect(chip).toBeDefined()
    return chip!
  }

  it('materializa os dois barramentos, AND vetorial, nibbles e dez saídas públicas', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())

    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'input')).toHaveLength(16)
    expect(document?.nodes.filter((node) => node.type === 'combiner')).toHaveLength(3)
    expect(document?.nodes.filter((node) => node.type === 'splitter')).toHaveLength(3)
    expect(document?.nodes.filter((node) => node.type === 'and')).toHaveLength(8)
    expect(document?.nodes.filter((node) => node.type === 'output')).toHaveLength(10)
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })

  it('preserva a ordem real dos dez outputs e as duplicações de barramento', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const values = '11110011' + '01011010'
    const inputs = Object.fromEntries([...values].map((bit, index) => [
      `input-${String(index + 1).padStart(2, '0')}`,
      Number(bit),
    ]))
    const result = evaluateCircuitVectors(document, inputs)

    expect(toBinary(result.outputs['output-01']!)).toBe('11110011')
    expect(toBinary(result.outputs['output-02']!)).toBe('11110011')
    expect(toBinary(result.outputs['output-03']!)).toBe('0101')
    expect(toBinary(result.outputs['output-04']!)).toBe('11110011')
    expect(toBinary(result.outputs['output-05']!)).toBe('0101')
    expect(toBinary(result.outputs['output-06']!)).toBe('0010')
    expect(toBinary(result.outputs['output-07']!)).toBe('0010')
    expect(toBinary(result.outputs['output-08']!)).toBe('01011010')
    expect(toBinary(result.outputs['output-09']!)).toBe('01011010')
    expect(toBinary(result.outputs['output-10']!)).toBe('01011010')
  })

  it('preserva as dezesseis entradas escalares e as larguras públicas mistas', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const definition = buildCustomChipDefinition(document, '16 para 8 e 4 bits importado')

    expect(definition.inputs.map((port) => [port.name, port.width])).toEqual(
      Array.from({ length: 16 }, (_, index) => [`IN${index === 0 ? '' : `_${index + 1}`}`, 1]),
    )
    expect(definition.outputs.map((port) => [port.name, port.width])).toEqual([
      ['OUT', 8],
      ['OUT_2', 8],
      ['OUT_3', 4],
      ['OUT_4', 8],
      ['OUT_5', 4],
      ['OUT_6', 4],
      ['OUT_7', 4],
      ['OUT_8', 8],
      ['OUT_9', 8],
      ['OUT_10', 8],
    ])
  })

  it('exporta os barramentos e os nibbles para Verilog e VHDL', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const verilog = exportVerilog(document)
    const vhdl = exportVhdl(document)

    expect(verilog).toContain('[7:0]')
    expect(verilog).toContain('[3:0]')
    expect(vhdl).toContain('std_logic_vector(7 downto 0)')
    expect(vhdl).toContain('std_logic_vector(3 downto 0)')
  })

  it('recusa o roteador quando a dependência 8-4BIT real está ausente', async () => {
    const chip = await loadRealChip()
    expect(catalogVectorChipToCircuitDocument({
      ...chip,
      parts: { ...chip.parts, '8-4BIT': 0 },
    })).toBeNull()
  })
})

describe('ZEXT-4-8 importado do catálogo DLS', () => {
  async function loadRealChip(): Promise<ChipEntry> {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === 'ZEXT-4-8')
    expect(chip).toMatchObject({
      name: 'ZEXT-4-8',
      category: 'Outros',
      in: 4,
      out: 8,
      pins: {
        in: ['A0', 'A1', 'A2', 'A3'],
        out: ['O0', 'O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'],
      },
      parts: { '0': 1 },
      partCount: 1,
      wireCount: 8,
    })
    expect(chip).toBeDefined()
    return chip!
  }

  it('materializa quatro inputs, uma constante, um combiner e uma saída vetorial', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())

    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'input')).toHaveLength(4)
    expect(document?.nodes.filter((node) => node.type === 'constant')).toHaveLength(1)
    expect(document?.nodes.filter((node) => node.type === 'combiner')).toHaveLength(1)
    expect(document?.nodes.filter((node) => node.type === 'output')).toHaveLength(1)
    expect(document?.connections).toHaveLength(9)
    expect(document?.nodes.find((node) => node.id === 'combiner-zext')?.options).toEqual({
      width: 8,
      widths: [1, 1, 1, 1, 1, 1, 1, 1],
    })
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })

  it('preserva os quatro bits de entrada e acrescenta quatro zeros em MSB→LSB', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const inputs = Object.fromEntries(['1', '0', '1', '1'].map((bit, index) => [
      `input-${String(index + 1).padStart(2, '0')}`,
      Number(bit),
    ]))
    const result = evaluateCircuitVectors(document, inputs)

    expect(toBinary(result.outputs['output-01']!)).toBe('10110000')
  })

  it('preserva as portas escalares e a saída de 8 bits no chip local', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const definition = buildCustomChipDefinition(document, 'ZEXT-4-8 importado')

    expect(definition.inputs.map((port) => [port.name, port.width])).toEqual([
      ['A0', 1],
      ['A1', 1],
      ['A2', 1],
      ['A3', 1],
    ])
    expect(definition.outputs.map((port) => [port.name, port.width])).toEqual([
      ['O0', 8],
    ])
  })

  it('exporta a saída vetorial para Verilog e VHDL', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const verilog = exportVerilog(document)
    const vhdl = exportVhdl(document)

    expect(verilog).toContain('[7:0]')
    expect(vhdl).toContain('std_logic_vector(7 downto 0)')
  })

  it('recusa o expansor quando a constante real está ausente', async () => {
    const chip = await loadRealChip()
    expect(catalogVectorChipToCircuitDocument({
      ...chip,
      parts: { ...chip.parts, '0': 0 },
    })).toBeNull()
  })
})


describe('SEXT-4-8 importado do catálogo DLS', () => {
  async function loadRealChip(): Promise<ChipEntry> {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === 'SEXT-4-8')
    expect(chip).toMatchObject({
      name: 'SEXT-4-8',
      category: 'Outros',
      in: 4,
      out: 8,
      pins: {
        in: ['A0', 'A1', 'A2', 'A3'],
        out: ['O0', 'O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'],
      },
      parts: {},
      partCount: 0,
      wireCount: 8,
    })
    expect(chip).toBeDefined()
    return chip!
  }

  it('materializa quatro inputs, fan-out do sinal, um combiner e uma saída vetorial', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())

    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'input')).toHaveLength(4)
    expect(document?.nodes.filter((node) => node.type === 'constant')).toHaveLength(0)
    expect(document?.nodes.filter((node) => node.type === 'combiner')).toHaveLength(1)
    expect(document?.nodes.filter((node) => node.type === 'output')).toHaveLength(1)
    expect(document?.connections).toHaveLength(9)
    expect(document?.nodes.find((node) => node.id === 'combiner-sext')?.options).toEqual({
      width: 8,
      widths: [1, 1, 1, 1, 1, 1, 1, 1],
    })
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })

  it.each([
    [['1', '0', '1', '0'], '10100000'],
    [['0', '1', '0', '1'], '01011111'],
    [['1', '1', '1', '1'], '11111111'],
    [['0', '0', '0', '0'], '00000000'],
  ] as const)('replica o bit de sinal na extensão %s → %s', async (bits, expected) => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const inputs = Object.fromEntries(bits.map((bit, index) => [
      `input-${String(index + 1).padStart(2, '0')}`,
      Number(bit),
    ]))
    const result = evaluateCircuitVectors(document, inputs)

    expect(toBinary(result.outputs['output-01']!)).toBe(expected)
  })

  it('preserva as portas escalares e a saída de 8 bits no chip local', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const definition = buildCustomChipDefinition(document, 'SEXT-4-8 importado')

    expect(definition.inputs.map((port) => [port.name, port.width])).toEqual([
      ['A0', 1],
      ['A1', 1],
      ['A2', 1],
      ['A3', 1],
    ])
    expect(definition.outputs.map((port) => [port.name, port.width])).toEqual([
      ['O0', 8],
    ])
  })

  it('exporta a saída vetorial para Verilog e VHDL', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const verilog = exportVerilog(document)
    const vhdl = exportVhdl(document)

    expect(verilog).toContain('[7:0]')
    expect(vhdl).toContain('std_logic_vector(7 downto 0)')
  })

  it('recusa o expansor quando a assinatura real é alterada', async () => {
    const chip = await loadRealChip()

    expect(catalogVectorChipToCircuitDocument({ ...chip, wireCount: 7 })).toBeNull()
    expect(catalogVectorChipToCircuitDocument({ ...chip, parts: { '0': 1 } })).toBeNull()
    expect(catalogVectorChipToCircuitDocument({ ...chip, name: 'SEXT-4-16' })).toBeNull()
  })
})


describe('ZEXT-4-16 importado do catálogo DLS', () => {
  async function loadRealChip(): Promise<ChipEntry> {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === 'ZEXT-4-16')
    expect(chip).toMatchObject({
      name: 'ZEXT-4-16',
      category: 'Outros',
      in: 4,
      out: 16,
      parts: { '0': 1 },
      partCount: 1,
      wireCount: 16,
    })
    expect(chip?.pins).toBeUndefined()
    expect(chip?.derivedOutputs?.map((output) => output.expression)).toEqual([
      'A', 'B', 'C', 'D',
      '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0',
    ])
    expect(chip).toBeDefined()
    return chip!
  }

  it('materializa quatro inputs, uma constante, um combiner de 16 partes e uma saída vetorial', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())

    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'input')).toHaveLength(4)
    expect(document?.nodes.filter((node) => node.type === 'constant')).toHaveLength(1)
    expect(document?.nodes.filter((node) => node.type === 'combiner')).toHaveLength(1)
    expect(document?.nodes.filter((node) => node.type === 'output')).toHaveLength(1)
    expect(document?.connections).toHaveLength(17)
    expect(document?.nodes.find((node) => node.id === 'combiner-zext-16')?.options).toEqual({
      width: 16,
      widths: Array.from({ length: 16 }, () => 1),
    })
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })

  it.each([
    [['1', '0', '1', '0'], '1010000000000000'],
    [['0', '1', '0', '1'], '0101000000000000'],
    [['1', '1', '1', '1'], '1111000000000000'],
    [['0', '0', '0', '0'], '0000000000000000'],
  ] as const)('preserva %s e acrescenta doze zeros em MSB→LSB, produzindo %s', async (bits, expected) => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const inputs = Object.fromEntries(bits.map((bit, index) => [
      `input-${String(index + 1).padStart(2, '0')}`,
      Number(bit),
    ]))
    const result = evaluateCircuitVectors(document, inputs)

    expect(toBinary(result.outputs['output-01']!)).toBe(expected)
  })

  it('preserva as quatro portas escalares e a saída de 16 bits no chip local', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const definition = buildCustomChipDefinition(document, 'ZEXT-4-16 importado')

    expect(definition.inputs.map((port) => [port.name, port.width])).toEqual([
      ['A0', 1],
      ['A1', 1],
      ['A2', 1],
      ['A3', 1],
    ])
    expect(definition.outputs.map((port) => [port.name, port.width])).toEqual([
      ['O0', 16],
    ])
  })

  it('exporta a saída vetorial de 16 bits para Verilog e VHDL', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const verilog = exportVerilog(document)
    const vhdl = exportVhdl(document)

    expect(verilog).toContain('[15:0]')
    expect(vhdl).toContain('std_logic_vector(15 downto 0)')
  })

  it('recusa o expansor quando a assinatura real é alterada', async () => {
    const chip = await loadRealChip()

    expect(catalogVectorChipToCircuitDocument({ ...chip, wireCount: 15 })).toBeNull()
    expect(catalogVectorChipToCircuitDocument({ ...chip, parts: { '0': 0 } })).toBeNull()
    expect(catalogVectorChipToCircuitDocument({
      ...chip,
      derivedOutputs: chip.derivedOutputs?.map((output, index) => index === 4 ? { ...output, expression: '1' } : output),
    })).toBeNull()
    expect(catalogVectorChipToCircuitDocument({ ...chip, name: 'SEXT-4-16' })).toBeNull()
  })
})


describe('SEXT-4-16 importado do catálogo DLS', () => {
  async function loadRealChip(): Promise<ChipEntry> {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === 'SEXT-4-16')
    expect(chip).toMatchObject({
      name: 'SEXT-4-16',
      category: 'Outros',
      in: 4,
      out: 16,
      parts: {},
      partCount: 0,
      wireCount: 16,
    })
    expect(chip?.pins).toBeUndefined()
    expect(chip?.derivedOutputs?.map((output) => output.expression)).toEqual([
      'A', 'B', 'C', 'D',
      'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D',
    ])
    expect(chip).toBeDefined()
    return chip!
  }

  it('materializa quatro inputs, fan-out do sinal, um combiner de 16 partes e uma saída vetorial', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())

    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'input')).toHaveLength(4)
    expect(document?.nodes.filter((node) => node.type === 'constant')).toHaveLength(0)
    expect(document?.nodes.filter((node) => node.type === 'combiner')).toHaveLength(1)
    expect(document?.nodes.filter((node) => node.type === 'output')).toHaveLength(1)
    expect(document?.connections).toHaveLength(17)
    expect(document?.nodes.find((node) => node.id === 'combiner-sext-16')?.options).toEqual({
      width: 16,
      widths: Array.from({ length: 16 }, () => 1),
    })
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })

  it.each([
    [['1', '0', '1', '0'], '1010000000000000'],
    [['0', '1', '0', '1'], '0101111111111111'],
    [['1', '1', '1', '1'], '1111111111111111'],
    [['0', '0', '0', '0'], '0000000000000000'],
  ] as const)('replica o bit de sinal %s nos doze canais superiores, produzindo %s', async (bits, expected) => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const inputs = Object.fromEntries(bits.map((bit, index) => [
      `input-${String(index + 1).padStart(2, '0')}`,
      Number(bit),
    ]))
    const result = evaluateCircuitVectors(document, inputs)

    expect(toBinary(result.outputs['output-01']!)).toBe(expected)
  })

  it('preserva as quatro portas escalares e a saída de 16 bits no chip local', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const definition = buildCustomChipDefinition(document, 'SEXT-4-16 importado')

    expect(definition.inputs.map((port) => [port.name, port.width])).toEqual([
      ['A0', 1],
      ['A1', 1],
      ['A2', 1],
      ['A3', 1],
    ])
    expect(definition.outputs.map((port) => [port.name, port.width])).toEqual([
      ['O0', 16],
    ])
  })

  it('exporta a saída vetorial de 16 bits para Verilog e VHDL', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const verilog = exportVerilog(document)
    const vhdl = exportVhdl(document)

    expect(verilog).toContain('[15:0]')
    expect(vhdl).toContain('std_logic_vector(15 downto 0)')
  })

  it('recusa o expansor quando a assinatura real é alterada', async () => {
    const chip = await loadRealChip()

    expect(catalogVectorChipToCircuitDocument({ ...chip, wireCount: 15 })).toBeNull()
    expect(catalogVectorChipToCircuitDocument({ ...chip, parts: { '0': 1 } })).toBeNull()
    expect(catalogVectorChipToCircuitDocument({
      ...chip,
      derivedOutputs: chip.derivedOutputs?.map((output, index) => index === 4 ? { ...output, expression: 'C' } : output),
    })).toBeNull()
    expect(catalogVectorChipToCircuitDocument({ ...chip, name: 'ZEXT-4-16' })).toBeNull()
  })
})

describe('BITREV-4 importado do catálogo DLS', () => {
  async function loadRealChip(): Promise<ChipEntry> {
    const catalog = await loadCatalog()
    const chip = catalog.chips.find((candidate) => candidate.name === 'BITREV-4')
    expect(chip).toMatchObject({
      name: 'BITREV-4',
      category: 'Outros',
      in: 4,
      out: 4,
      parts: {},
      partCount: 0,
      wireCount: 4,
      pins: {
        in: ['A0', 'A1', 'A2', 'A3'],
        out: ['O0', 'O1', 'O2', 'O3'],
      },
      variables: ['A', 'B', 'C', 'D'],
    })
    expect(chip?.derivedOutputs?.map((output) => [output.name, output.expression])).toEqual([
      ['O0', 'D'],
      ['O1', 'C'],
      ['O2', 'B'],
      ['O3', 'A'],
    ])
    expect(chip).toBeDefined()
    return chip!
  }

  it('materializa quatro inputs, quatro outputs e quatro conexões diretas', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())

    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'input')).toHaveLength(4)
    expect(document?.nodes.filter((node) => node.type === 'output')).toHaveLength(4)
    expect(document?.nodes.filter((node) => node.type === 'combiner')).toHaveLength(0)
    expect(document?.connections.map(({ source, target }) => [source.node, target.node])).toEqual([
      ['input-04', 'output-01'],
      ['input-03', 'output-02'],
      ['input-02', 'output-03'],
      ['input-01', 'output-04'],
    ])
    expect(validateCircuit(document!, { allowBuses: true })).toEqual([])
  })

  it.each([
    [['1', '0', '1', '0'], ['0', '1', '0', '1']],
    [['0', '1', '0', '1'], ['1', '0', '1', '0']],
    [['1', '1', '1', '1'], ['1', '1', '1', '1']],
    [['0', '0', '0', '0'], ['0', '0', '0', '0']],
  ] as const)('inverte a ordem dos bits %s, produzindo %s', async (bits, expected) => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const inputs = Object.fromEntries(bits.map((bit, index) => [
      `input-${String(index + 1).padStart(2, '0')}`,
      Number(bit),
    ]))
    const result = evaluateCircuitVectors(document, inputs)

    expect(['output-01', 'output-02', 'output-03', 'output-04'].map((id) => toBinary(result.outputs[id]!))).toEqual(expected)
  })

  it('preserva as quatro portas escalares e as quatro saídas escalares no chip local', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const definition = buildCustomChipDefinition(document, 'BITREV-4 importado')

    expect(definition.inputs.map((port) => [port.name, port.width])).toEqual([
      ['A0', 1],
      ['A1', 1],
      ['A2', 1],
      ['A3', 1],
    ])
    expect(definition.outputs.map((port) => [port.name, port.width])).toEqual([
      ['O0', 1],
      ['O1', 1],
      ['O2', 1],
      ['O3', 1],
    ])
  })

  it('exporta as quatro portas escalares para Verilog e VHDL', async () => {
    const document = catalogVectorChipToCircuitDocument(await loadRealChip())!
    const verilog = exportVerilog(document)
    const vhdl = exportVhdl(document)

    expect(verilog).toContain('module BITREV_4')
    expect(verilog).toContain('input A0')
    expect(verilog).toContain('output O3')
    expect(vhdl).toContain('entity BITREV_4 is')
    expect(vhdl).toContain('A0 : in std_logic')
    expect(vhdl).toContain('O3 : out std_logic')
  })

  it('recusa o fixture quando a topologia ou assinatura real é alterada', async () => {
    const chip = await loadRealChip()

    expect(catalogVectorChipToCircuitDocument({ ...chip, wireCount: 3 })).toBeNull()
    expect(catalogVectorChipToCircuitDocument({ ...chip, parts: { AND: 1 } })).toBeNull()
    expect(catalogVectorChipToCircuitDocument({
      ...chip,
      derivedOutputs: chip.derivedOutputs?.map((output, index) => index === 0 ? { ...output, expression: 'A' } : output),
    })).toBeNull()
    expect(catalogVectorChipToCircuitDocument({
      ...chip,
      pins: { ...chip.pins!, out: ['O0', 'O1', 'O2', 'WRONG'] },
    })).toBeNull()
  })
})
