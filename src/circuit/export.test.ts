import { describe, expect, it } from 'vitest'
import { buildCustomChipDefinition, createCircuitDocument, CircuitValidationError, exportVerilog, exportVhdl, type CircuitDocument, type CustomChipLibraryEntry } from '.'

const document: CircuitDocument = {
  ...createCircuitDocument('Somador simples'),
  nodes: [
    { id: 'input-a', type: 'input', position: { x: 0, y: 0 }, label: 'A' },
    { id: 'input-b', type: 'input', position: { x: 0, y: 100 }, label: 'B' },
    { id: 'gate', type: 'and', position: { x: 200, y: 50 }, label: 'A&B' },
    { id: 'output', type: 'output', position: { x: 400, y: 50 }, label: 'Y' },
  ],
  connections: [
    { source: { node: 'input-a' }, target: { node: 'gate', port: 0 } },
    { source: { node: 'input-b' }, target: { node: 'gate', port: 1 } },
    { source: { node: 'gate' }, target: { node: 'output', port: 0 } },
  ],
}

function customChipLibrary(): CustomChipLibraryEntry[] {
  const definitionDocument: CircuitDocument = {
    ...createCircuitDocument('AND interno'),
    nodes: [
      { id: 'a', type: 'input', position: { x: 0, y: 0 }, label: 'A' },
      { id: 'b', type: 'input', position: { x: 0, y: 100 }, label: 'B' },
      { id: 'gate', type: 'and', position: { x: 160, y: 50 }, label: 'E' },
      { id: 'y', type: 'output', position: { x: 320, y: 50 }, label: 'Y' },
    ],
    connections: [
      { source: { node: 'a' }, target: { node: 'gate', port: 0 } },
      { source: { node: 'b' }, target: { node: 'gate', port: 1 } },
      { source: { node: 'gate' }, target: { node: 'y', port: 0 } },
    ],
  }
  return [{ id: 9, definition: buildCustomChipDefinition(definitionDocument, 'AND interno') }]
}

function busDocument(): CircuitDocument {
  return {
    ...createCircuitDocument('Barramento particionado'),
    nodes: [
      { id: 'bus', type: 'input', position: { x: 0, y: 0 }, label: 'BUS', options: { width: 8 } },
      { id: 'split', type: 'splitter', position: { x: 160, y: 0 }, options: { width: 8, widths: [3, 5] } },
      { id: 'combine', type: 'combiner', position: { x: 360, y: 0 }, options: { width: 8, widths: [3, 5] } },
      { id: 'out', type: 'output', position: { x: 540, y: 0 }, label: 'RESULT', options: { width: 8 } },
    ],
    connections: [
      { source: { node: 'bus' }, target: { node: 'split', port: 0 } },
      { source: { node: 'split', port: 0 }, target: { node: 'combine', port: 0 } },
      { source: { node: 'split', port: 1 }, target: { node: 'combine', port: 1 } },
      { source: { node: 'combine' }, target: { node: 'out', port: 0 } },
    ],
  }
}

function customChipDocument(): CircuitDocument {
  return {
    ...createCircuitDocument('AND instanciado'),
    nodes: [
      { id: 'x', type: 'input', position: { x: 0, y: 0 }, label: 'X' },
      { id: 'z', type: 'input', position: { x: 0, y: 100 }, label: 'Z' },
      { id: 'chip', type: 'custom-chip', position: { x: 180, y: 50 }, label: 'Meu AND', options: { customChipId: 9 } },
      { id: 'out', type: 'output', position: { x: 400, y: 50 }, label: 'Resultado' },
    ],
    connections: [
      { source: { node: 'x' }, target: { node: 'chip', port: 0 } },
      { source: { node: 'z' }, target: { node: 'chip', port: 1 } },
      { source: { node: 'chip', port: 0 }, target: { node: 'out', port: 0 } },
    ],
  }
}

describe('exportCircuit', () => {
  it('gera Verilog-2001 com portas, fio interno e atribuições', () => {
    const output = exportVerilog(document)

    expect(output).toContain('module Somador_simples (')
    expect(output).toContain('input A')
    expect(output).toContain('input B')
    expect(output).toContain('output Y')
    expect(output).toContain('wire A_B;')
    expect(output).toContain('assign A_B = A & B;')
    expect(output).toContain('assign Y = A_B;')
    expect(output).toContain('endmodule')
  })

  it('gera VHDL com entity, architecture e std_logic', () => {
    const output = exportVhdl(document)

    expect(output).toContain('entity Somador_simples is')
    expect(output).toContain('A : in std_logic')
    expect(output).toContain('Y : out std_logic')
    expect(output).toContain('signal A_B : std_logic;')
    expect(output).toContain('A_B <= A and B;')
    expect(output).toContain('Y <= A_B;')
    expect(output).toContain('end architecture rtl;')
  })

  it('exporta NAND, NOR e XNOR com negação da operação correta', () => {
    const cases = [
      { type: 'nand' as const, verilog: '~(A & B)', vhdl: 'not (A and B)' },
      { type: 'nor' as const, verilog: '~(A | B)', vhdl: 'not (A or B)' },
      { type: 'xnor' as const, verilog: '~(A ^ B)', vhdl: 'not (A xor B)' },
    ]

    for (const { type, verilog, vhdl } of cases) {
      const gateDocument = {
        ...document,
        name: `${type} export`,
        nodes: document.nodes.map((node) => node.id === 'gate' ? { ...node, type } : node),
      }

      expect(exportVerilog(gateDocument)).toContain(`assign A_B = ${verilog};`)
      expect(exportVhdl(gateDocument)).toContain(`A_B <= ${vhdl};`)
    }
  })

  it('normaliza nome, IDs e referências antes de exportar', () => {
    const spaced = {
      ...document,
      name: '  Somador simples  ',
      nodes: document.nodes.map((node) => ({
        ...node,
        id: `  ${node.id}  `,
      })),
      connections: document.connections.map((connection) => ({
        source: { ...connection.source, node: `  ${connection.source.node}  ` },
        target: { ...connection.target, node: `  ${connection.target.node}  ` },
      })),
    }

    expect(exportVerilog(spaced)).toContain('module Somador_simples (')
    expect(exportVerilog(spaced)).toContain('assign A_B = A & B;')
    expect(exportVhdl(spaced)).toContain('entity Somador_simples is')
  })

  it('recusa exportar circuito inválido', () => {
    const invalid = { ...document, connections: [] }

    expect(() => exportVerilog(invalid)).toThrow(CircuitValidationError)
    expect(() => exportVhdl(invalid)).toThrow('desconectada')
  })

  it('exporta transmitter e receiver como sinais internos do canal wireless', () => {
    const wireless: CircuitDocument = {
      ...document,
      name: 'Wireless simples',
      nodes: [
        { id: 'input', type: 'input', position: { x: 0, y: 0 }, label: 'I' },
        { id: 'tx', type: 'transmitter', position: { x: 120, y: 0 }, options: { channel: 'bus-a' } },
        { id: 'rx', type: 'receiver', position: { x: 240, y: 0 }, options: { channel: 'bus-a' } },
        { id: 'out', type: 'output', position: { x: 360, y: 0 }, label: 'Y' },
      ],
      connections: [
        { source: { node: 'input' }, target: { node: 'tx', port: 0 } },
        { source: { node: 'rx' }, target: { node: 'out', port: 0 } },
      ],
    }

    const verilog = exportVerilog(wireless)
    const vhdl = exportVhdl(wireless)

    expect(verilog).toContain('wire rx;')
    expect(verilog).toContain('wire tx;')
    expect(verilog).toContain('assign tx = I;')
    expect(verilog).toContain('assign Y = rx;')
    expect(vhdl).toContain('signal rx : std_logic;')
    expect(vhdl).toContain('rx <= tx;')
    expect(vhdl).toContain('Y <= rx;')
  })

  it('exporta Splitter e Combiner vetoriais em Verilog e VHDL', () => {
    const verilog = exportVerilog(busDocument())
    const vhdl = exportVhdl(busDocument())

    expect(verilog).toContain('wire [2:0] split_out1;')
    expect(verilog).toContain('wire [4:0] split_out2;')
    expect(verilog).toContain('assign split_out1 = BUS[7:5];')
    expect(verilog).toContain('assign split_out2 = BUS[4:0];')
    expect(verilog).toContain('assign combine = {split_out1, split_out2};')
    expect(verilog).toContain('assign RESULT = combine;')

    expect(vhdl).toContain('signal split_out1 : std_logic_vector(2 downto 0);')
    expect(vhdl).toContain('signal split_out2 : std_logic_vector(4 downto 0);')
    expect(vhdl).toContain('split_out1 <= BUS(7 downto 5);')
    expect(vhdl).toContain('split_out2 <= BUS(4 downto 0);')
    expect(vhdl).toContain('combine <= split_out1 & split_out2;')
    expect(vhdl).toContain('RESULT <= combine;')
  })

  it('elabora instâncias customizadas em Verilog e VHDL sem expor portas internas', () => {
    const library = customChipLibrary()
    const verilog = exportVerilog(customChipDocument(), { customChips: library })
    const vhdl = exportVhdl(customChipDocument(), { customChips: library })

    expect(verilog).toContain('input X')
    expect(verilog).toContain('input Z')
    expect(verilog).toContain('output Resultado')
    expect(verilog).toContain('assign A = X;')
    expect(verilog).toContain('assign B = Z;')
    expect(verilog).toContain('assign E = A & B;')
    expect(verilog).toContain('assign Resultado = Y;')
    expect(verilog).not.toContain('input A')
    expect(verilog).not.toContain('output Y')

    expect(vhdl).toContain('X : in std_logic')
    expect(vhdl).toContain('Z : in std_logic')
    expect(vhdl).toContain('Resultado : out std_logic')
    expect(vhdl).toContain('A <= X;')
    expect(vhdl).toContain('E <= A and B;')
    expect(vhdl).toContain('Resultado <= Y;')
    expect(vhdl).not.toContain('A : in std_logic')
    expect(vhdl).not.toContain('Y : out std_logic')
  })

  it('recusa elaborar uma instância sem definição local', () => {
    expect(() => exportVerilog(customChipDocument())).toThrow('definição local')
  })

  it('gera portas e sinais vetoriais em Verilog e VHDL', () => {
    const vector = {
      ...document,
      nodes: document.nodes.map((node) => ({ ...node, options: { width: 4 } })),
    }
    const verilog = exportVerilog(vector)
    const vhdl = exportVhdl(vector)

    expect(verilog).toContain('input [3:0] A')
    expect(verilog).toContain('output [3:0] Y')
    expect(verilog).toContain('wire [3:0] A_B;')
    expect(verilog).toContain('assign A_B = A & B;')
    expect(vhdl).toContain('A : in std_logic_vector(3 downto 0)')
    expect(vhdl).toContain('Y : out std_logic_vector(3 downto 0)')
    expect(vhdl).toContain('signal A_B : std_logic_vector(3 downto 0);')
    expect(vhdl).toContain('A_B <= A and B;')
  })
})
