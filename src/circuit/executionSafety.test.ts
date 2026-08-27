import { describe, expect, it } from 'vitest'
import { analyzeCircuitExecutionSafety, createCircuitDocument, type CircuitDocument } from '.'

function documentWith(
  nodes: CircuitDocument['nodes'],
  connections: CircuitDocument['connections'],
): CircuitDocument {
  return {
    ...createCircuitDocument('Execution Safety'),
    nodes,
    connections,
  }
}

describe('analyzeCircuitExecutionSafety', () => {
  it('classifica um ciclo combinacional de forma determinística', () => {
    const report = analyzeCircuitExecutionSafety(documentWith(
      [
        { id: 'a', type: 'not', position: { x: 0, y: 0 } },
        { id: 'b', type: 'not', position: { x: 120, y: 0 } },
      ],
      [
        { source: { node: 'a' }, target: { node: 'b', port: 0 } },
        { source: { node: 'b' }, target: { node: 'a', port: 0 } },
      ],
    ))

    expect(report.status).toBe('combinational-cycle')
    expect(report.cycles).toEqual([{ kind: 'combinational-cycle', nodeIds: ['a', 'b'] }])
    expect(report.issues).toHaveLength(1)
  })

  it('classifica feedback com flip-flop como temporal', () => {
    const report = analyzeCircuitExecutionSafety(documentWith(
      [
        { id: 'clk', type: 'input', position: { x: 0, y: 0 } },
        { id: 'ff', type: 'dff', position: { x: 120, y: 0 } },
      ],
      [
        { source: { node: 'ff', port: 1 }, target: { node: 'ff', port: 0 } },
        { source: { node: 'clk' }, target: { node: 'ff', port: 1 } },
      ],
    ))

    expect(report.status).toBe('temporal-feedback')
    expect(report.cycles).toEqual([{ kind: 'temporal-feedback', nodeIds: ['ff'] }])
    expect(report.issues).toEqual([])
  })

  it('não presume que um custom chip seja combinacional', () => {
    const report = analyzeCircuitExecutionSafety(documentWith(
      [
        { id: 'chip', type: 'custom-chip', position: { x: 0, y: 0 }, options: { customChipId: 1 } },
        { id: 'out', type: 'output', position: { x: 120, y: 0 } },
      ],
      [
        { source: { node: 'chip' }, target: { node: 'out', port: 0 } },
        { source: { node: 'out' }, target: { node: 'chip', port: 0 } },
      ],
    ), { customChips: [{
      id: 1,
      definition: {
        format: 'veritas-custom-chip',
        version: 1,
        name: 'Desconhecido',
        inputs: [{ id: 'in', name: 'IN', width: 1 }],
        outputs: [{ id: 'out', name: 'OUT', width: 1 }],
        document: createCircuitDocument('Interno'),
      },
    }] })

    expect(report.status).toBe('unclassified-cycle')
    expect(report.cycles).toEqual([{ kind: 'unclassified-cycle', nodeIds: ['chip', 'out'] }])
  })

  it('retorna acyclic para topologia válida sem ciclos', () => {
    const report = analyzeCircuitExecutionSafety(documentWith(
      [
        { id: 'in', type: 'input', position: { x: 0, y: 0 } },
        { id: 'not', type: 'not', position: { x: 120, y: 0 } },
        { id: 'out', type: 'output', position: { x: 240, y: 0 } },
      ],
      [
        { source: { node: 'in' }, target: { node: 'not', port: 0 } },
        { source: { node: 'not' }, target: { node: 'out', port: 0 } },
      ],
    ))

    expect(report).toMatchObject({ status: 'acyclic', issues: [], cycles: [], nodeCount: 3, connectionCount: 2 })
  })

  it('falha antes da execução quando há documento inválido além de ciclo', () => {
    const report = analyzeCircuitExecutionSafety(documentWith(
      [
        { id: 'a', type: 'not', position: { x: 0, y: 0 } },
        { id: 'b', type: 'not', position: { x: 120, y: 0 } },
      ],
      [
        { source: { node: 'a' }, target: { node: 'b', port: 0 } },
        { source: { node: 'b' }, target: { node: 'a', port: 0 } },
        { source: { node: 'missing' }, target: { node: 'a', port: 0 } },
      ],
    ))

    expect(report.status).toBe('invalid')
    expect(report.cycles).toEqual([{ kind: 'combinational-cycle', nodeIds: ['a', 'b'] }])
    expect(report.issues.some((issue) => issue.code === 'missing-node')).toBe(true)
  })

  it('mantém a ordem de componentes fortemente conectados independente da ordem dos nós', () => {
    const report = analyzeCircuitExecutionSafety(documentWith(
      [
        { id: 'z', type: 'not', position: { x: 120, y: 0 } },
        { id: 'a', type: 'not', position: { x: 0, y: 0 } },
        { id: 'm', type: 'not', position: { x: 240, y: 0 } },
        { id: 'b', type: 'not', position: { x: 360, y: 0 } },
      ],
      [
        { source: { node: 'a' }, target: { node: 'z', port: 0 } },
        { source: { node: 'z' }, target: { node: 'a', port: 0 } },
        { source: { node: 'm' }, target: { node: 'b', port: 0 } },
        { source: { node: 'b' }, target: { node: 'm', port: 0 } },
      ],
    ))

    expect(report.cycles.map((cycle) => cycle.nodeIds)).toEqual([['a', 'z'], ['b', 'm']])
  })
})
