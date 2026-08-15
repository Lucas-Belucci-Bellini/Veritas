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
    expect(output).toContain('A input')
    expect(output).toContain('B input')
    expect(output).toContain('Y output')
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

  it('recusa exportar circuito inválido', () => {
    const invalid = { ...document, connections: [] }

    expect(() => exportVerilog(invalid)).toThrow(CircuitValidationError)
    expect(() => exportVhdl(invalid)).toThrow('desconectada')
  })

  it('mantém exportadores escalares bloqueados para circuitos multi-bit', () => {
    const vector = {
      ...document,
      nodes: document.nodes.map((node) => ({ ...node, options: { width: 4 } })),
    }

    expect(() => exportVerilog(vector)).toThrow('somente sinais escalares')
    expect(() => exportVhdl(vector)).toThrow('somente sinais escalares')
  })
})
