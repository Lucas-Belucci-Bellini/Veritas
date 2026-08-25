import { describe, expect, it } from 'vitest'
import { evaluateCircuit } from '../circuit'
import { catalogChipToCircuitDocument } from './catalogCircuit'
import type { ChipEntry } from './types'

function andChip(): ChipEntry {
  return {
    name: 'AND catalogado',
    category: 'Portas lógicas',
    in: 2,
    out: 1,
    pins: { in: ['A', 'B'], out: ['Y'] },
    parts: { AND: 1 },
    partCount: 1,
    wireCount: 3,
    variables: ['A', 'B'],
    derivedOutputs: [{ name: 'Y', expression: 'A AND B' }],
  }
}

describe('catalogChipToCircuitDocument', () => {
  it('materializa um chip derivado como documento editável e executável', () => {
    const document = catalogChipToCircuitDocument(andChip())
    expect(document).not.toBeNull()
    expect(document?.nodes.filter((node) => node.type === 'input').map((node) => node.label)).toEqual(['A', 'B'])
    expect(document?.nodes.find((node) => node.type === 'output')?.label).toBe('Y')
    expect(evaluateCircuit(document!, { 'input-1': true, 'input-2': false }).outputs).toEqual({ 'output-1-out_4': false })
    expect(JSON.stringify(document)).toBe(JSON.stringify(catalogChipToCircuitDocument(andChip())))
  })

  it('recusa barramento ou saída sem expressão derivada', () => {
    expect(catalogChipToCircuitDocument({ ...andChip(), widths: [1, 8] })).toBeNull()
    expect(catalogChipToCircuitDocument({ ...andChip(), derivedOutputs: [{ name: 'Y', expression: null }] })).toBeNull()
  })
})
