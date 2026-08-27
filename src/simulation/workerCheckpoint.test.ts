import { describe, expect, it } from 'vitest'
import { getSequentialDemo } from './workspace'
import { Simulator } from './simulator'
import {
  createSimulationWorkerCheckpoint,
  MAX_WORKER_CHECKPOINT_SERIALIZED_BYTES,
  parseSerializedSimulationWorkerCheckpoint,
  parseSimulationWorkerCheckpoint,
  serializeSimulationWorkerCheckpoint,
} from './workerCheckpoint'

const netlist = getSequentialDemo('dff-clock').netlist

function checkpointAfterTwoTicks() {
  const simulator = new Simulator(netlist)
  simulator.setInput('d', true)
  simulator.tick(2)
  return createSimulationWorkerCheckpoint(netlist, simulator.exportState(), simulator.operationCount)
}

describe('contrato isolado de checkpoint Worker', () => {
  it('faz round-trip determinístico do estado temporal', () => {
    const checkpoint = checkpointAfterTwoTicks()
    const serialized = serializeSimulationWorkerCheckpoint(checkpoint, netlist)
    const parsed = parseSerializedSimulationWorkerCheckpoint(serialized, netlist)

    expect('message' in parsed).toBe(false)
    if (!('message' in parsed)) {
      expect(parsed.checkpoint).toEqual(checkpoint)
      expect(parsed.checkpoint.state.tickCount).toBe(2)
      expect(parsed.checkpoint.state.operationCount).toBeGreaterThan(0)
    }
  })

  it('rejeita assinatura de netlist diferente antes de aceitar o estado', () => {
    const checkpoint = checkpointAfterTwoTicks()
    const otherNetlist = { components: [{ id: 'other', type: 'input' as const }] }
    const parsed = parseSimulationWorkerCheckpoint(checkpoint, otherNetlist)

    expect('message' in parsed && parsed.message).toContain('não corresponde')
  })

  it('rejeita campos desconhecidos no envelope e no nó', () => {
    const checkpoint = checkpointAfterTwoTicks()
    const envelope = { ...checkpoint, unexpected: true }
    const envelopeResult = parseSimulationWorkerCheckpoint(envelope, netlist)
    const node = checkpoint.state.nodes.d
    const nodeResult = parseSimulationWorkerCheckpoint({
      ...checkpoint,
      state: { ...checkpoint.state, nodes: { ...checkpoint.state.nodes, d: { ...node, unexpected: true } } },
    }, netlist)

    expect('message' in envelopeResult && envelopeResult.message).toContain('campos ausentes ou desconhecidos')
    expect('message' in nodeResult && nodeResult.message).toContain('campos ausentes ou desconhecidos')
  })

  it('rejeita valores não booleanos e shape de outputs alterado', () => {
    const checkpoint = checkpointAfterTwoTicks()
    const node = checkpoint.state.nodes.ff
    const invalidBoolean = parseSimulationWorkerCheckpoint({
      ...checkpoint,
      state: { ...checkpoint.state, nodes: { ...checkpoint.state.nodes, ff: { ...node, outputs: [true, 'invalid'] } } },
    }, netlist)
    const invalidShape = parseSimulationWorkerCheckpoint({
      ...checkpoint,
      state: { ...checkpoint.state, nodes: { ...checkpoint.state.nodes, ff: { ...node, outputs: [true] } } },
    }, netlist)

    expect('message' in invalidBoolean && invalidBoolean.message).toContain('somente booleanos')
    expect('message' in invalidShape && invalidShape.message).toContain('outputs deve possuir 2 itens')
  })

  it('rejeita tickCount, operationCount e serialized bytes acima dos limites pedidos', () => {
    const checkpoint = checkpointAfterTwoTicks()
    const invalidTicks = parseSimulationWorkerCheckpoint(checkpoint, netlist, { maxTicks: 1 })
    const invalidOperations = parseSimulationWorkerCheckpoint(checkpoint, netlist, { maxOperations: 1 })
    const oversized = parseSerializedSimulationWorkerCheckpoint(
      ' '.repeat(MAX_WORKER_CHECKPOINT_SERIALIZED_BYTES + 1),
      netlist,
    )

    expect('message' in invalidTicks && invalidTicks.message).toContain('tickCount')
    expect('message' in invalidOperations && invalidOperations.message).toContain('operationCount')
    expect('message' in oversized && oversized.message).toContain('excede')
  })

  it('rejeita contador de clock fora do período declarado', () => {
    const checkpoint = checkpointAfterTwoTicks()
    const clock = checkpoint.state.nodes.clk
    const parsed = parseSimulationWorkerCheckpoint({
      ...checkpoint,
      state: { ...checkpoint.state, nodes: { ...checkpoint.state.nodes, clk: { ...clock, counter: 2 } } },
    }, netlist)

    expect('message' in parsed && parsed.message).toContain('contador de clock')
  })

  it('rejeita JSON inválido e nunca interpreta o envelope como código', () => {
    const parsed = parseSerializedSimulationWorkerCheckpoint('not-json', netlist)

    expect('message' in parsed && parsed.message).toContain('JSON válido')
  })
})
