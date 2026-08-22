import { describe, expect, it } from 'vitest'
import { createCircuitDocument, CircuitValidationError, exportVerilog, exportVhdl, type CircuitDocument } from '.'

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
