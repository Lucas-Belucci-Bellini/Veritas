import { describe, expect, test } from 'vitest'
import { evaluateCircuit, toNetlist, validateCircuit } from '../circuit'
import {
  createLogicScalePlan,
  createNotChainDocument,
  createNotChainNetlist,
  LOGIC_SCALE_TARGETS,
  maxSupportedNotChainGates,
} from './logicScale'

describe('logic scale benchmark fixtures', () => {
  test('declares the requested targets and the current supported boundary', () => {
    const plan = createLogicScalePlan()

    expect(plan.map((entry) => entry.gates)).toEqual([...LOGIC_SCALE_TARGETS])
    expect(maxSupportedNotChainGates()).toBe(254)
    expect(plan.filter((entry) => entry.supported).map((entry) => entry.gates)).toEqual([10, 100])
    expect(plan.filter((entry) => !entry.supported).map((entry) => entry.gates)).toEqual([500, 1000, 5000])
    expect(plan.filter((entry) => !entry.supported).every((entry) => entry.reason)).toBe(true)
  })

  test('builds a valid deterministic NOT chain with the expected shape', () => {
    const document = createNotChainDocument(10)
    const netlist = toNetlist(document)

    expect(validateCircuit(document)).toEqual([])
    expect(document.nodes).toHaveLength(12)
    expect(document.connections).toHaveLength(11)
    expect(netlist.components.map((component) => component.id)).toEqual([
      'input',
      'not-0',
      'not-1',
      'not-2',
      'not-3',
      'not-4',
      'not-5',
      'not-6',
      'not-7',
      'not-8',
      'not-9',
      'output',
    ])
    expect(document).toEqual(createNotChainDocument(10))
  })

  test('preserves the expected output parity for supported fixtures', () => {
    expect(evaluateCircuit(createNotChainDocument(10), { input: true }).outputs.output).toBe(true)
    expect(evaluateCircuit(createNotChainDocument(11), { input: true }).outputs.output).toBe(false)
    expect(evaluateCircuit(createNotChainDocument(100), { input: false }).outputs.output).toBe(false)
  })

  test('builds large deterministic raw netlists without changing document limits', () => {
    for (const gates of [500, 1000, 5000]) {
      const netlist = createNotChainNetlist(gates)
      expect(netlist.components).toHaveLength(gates + 2)
      expect(netlist.components[0]).toEqual({ id: 'input', type: 'input' })
      expect(netlist.components.at(-1)).toEqual({
        id: 'output',
        type: 'output',
        inputs: [{ node: `not-${gates - 1}` }],
      })
      expect(JSON.stringify(netlist)).toBe(JSON.stringify(createNotChainNetlist(gates)))
    }
  })

  test('accepts the maximum linear chain allowed by the current document limit', () => {
    const document = createNotChainDocument(maxSupportedNotChainGates())

    expect(validateCircuit(document)).toEqual([])
    expect(document.nodes).toHaveLength(256)
    expect(document.connections).toHaveLength(255)
  })

  test('fails closed when a requested chain exceeds the document contract', () => {
    expect(() => createNotChainDocument(255)).toThrow(/limita/i)
    expect(() => createNotChainDocument(500)).toThrow(/limita/i)
  })
})
