import { describe, expect, it } from 'vitest'
import { topologicalOrder, type TopologyNode } from './topology'

describe('topologicalOrder', () => {
  it('retorna ordem determinística por dependência e nodeId', () => {
    const nodes: TopologyNode[] = [
      { id: 'out', inputs: [{ node: 'gate' }] },
      { id: 'gate', inputs: [{ node: 'b' }, { node: 'a' }] },
      { id: 'b' },
      { id: 'a' },
    ]

    expect(topologicalOrder(nodes)).toEqual(['a', 'b', 'gate', 'out'])
  })

  it('rejeita referência para componente inexistente', () => {
    expect(() => topologicalOrder([{ id: 'out', inputs: [{ node: 'missing' }] }])).toThrow('não existe')
  })

  it('rejeita componente duplicado', () => {
    expect(() => topologicalOrder([{ id: 'a' }, { id: 'a' }])).toThrow('duplicado')
  })

  it('rejeita ciclo combinacional', () => {
    const nodes: TopologyNode[] = [
      { id: 'a', inputs: [{ node: 'b' }] },
      { id: 'b', inputs: [{ node: 'a' }] },
    ]

    expect(() => topologicalOrder(nodes)).toThrow('ciclo')
  })
})
