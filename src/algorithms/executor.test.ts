import { describe, expect, it } from 'vitest'
import {
  createAlgorithmDocument,
  createExecutionState,
  provideInput,
  runAlgorithm,
  stepAlgorithm,
  setBreakpoint,
} from './index'

function branchingDocument() {
  return {
    ...createAlgorithmDocument('Classificar número'),
    nodes: [
      { id: 'start', type: 'start' as const, position: { x: 0, y: 0 }, next: 'declare-x' },
      {
        id: 'declare-x',
        type: 'declare' as const,
        position: { x: 160, y: 0 },
        variable: 'x',
        valueType: 'number' as const,
        initialValue: 0,
        next: 'input-x',
      },
      {
        id: 'input-x',
        type: 'input' as const,
        position: { x: 320, y: 0 },
        variable: 'x',
        next: 'if-positive',
      },
      {
        id: 'if-positive',
        type: 'if' as const,
        position: { x: 480, y: 0 },
        condition: 'x > 0',
        thenNext: 'positive',
        elseNext: 'not-positive',
      },
      {
        id: 'positive',
        type: 'output' as const,
        position: { x: 640, y: -80 },
        expression: "'positivo'",
        next: 'end',
      },
      {
        id: 'not-positive',
        type: 'output' as const,
        position: { x: 640, y: 80 },
        expression: "'não positivo'",
        next: 'end',
      },
      { id: 'end', type: 'end' as const, position: { x: 800, y: 0 } },
    ],
  }
}

describe('executor ALGO-001', () => {
  it('transita de ready para paused e depois finaliza determinísticamente', () => {
    const document = branchingDocument()
    let state = createExecutionState(document, { inputQueues: { x: [3] } })

    expect(state).toMatchObject({ status: 'ready', activeNodeId: 'start', stepIndex: 0 })
    state = stepAlgorithm(document, state)
    expect(state).toMatchObject({ status: 'paused', activeNodeId: 'declare-x', stepIndex: 1 })

    const result = runAlgorithm(document, state)
    expect(result.status).toBe('finished')
    expect(result.activeNodeId).toBeNull()
    expect(result.variables.x).toBe(3)
    expect(result.output).toEqual(['positivo'])
    expect(result.watch).toEqual([
      {
        name: 'x',
        type: 'number',
        value: 3,
        previousValue: 0,
        changedAtStep: 3,
        scope: 'global',
      },
    ])
    expect(result.branches).toEqual([
      {
        nodeId: 'if-positive',
        expression: 'x > 0',
        operands: { x: 3 },
        result: true,
        selectedBranch: 'then',
        step: 4,
      },
    ])
    expect(result.trace.map((entry) => entry.nodeId)).toEqual([
      'start',
      'declare-x',
      'input-x',
      'if-positive',
      'positive',
      'end',
    ])
  })

  it('permite observar awaiting-input e retomar após fornecer entrada', () => {
    const document = branchingDocument()
    let state = createExecutionState(document)

    state = runAlgorithm(document, state)
    expect(state.status).toBe('awaiting-input')
    expect(state.activeNodeId).toBe('input-x')

    state = provideInput(state, 'x', -2)
    expect(state.status).toBe('paused')
    state = runAlgorithm(document, state)
    expect(state.status).toBe('finished')
    expect(state.output).toEqual(['não positivo'])
  })

  it('não executa um documento estruturalmente inválido', () => {
    const document = {
      ...createAlgorithmDocument(),
      nodes: [{ id: 'start', type: 'start' as const, position: { x: 0, y: 0 }, next: 'missing' }],
    }
    expect(() => createExecutionState(document)).toThrow('não existe')
  })

  it('pausa antes de um breakpoint e Continue executa o nó marcado', () => {
    const document = branchingDocument()
    let state = createExecutionState(document, { inputQueues: { x: [3] } })
    state = setBreakpoint(state, 'if-positive')

    state = runAlgorithm(document, state)
    expect(state.status).toBe('paused')
    expect(state.activeNodeId).toBe('if-positive')
    expect(state.debug.lastPauseReason).toBe('breakpoint')
    expect(state.trace.map((entry) => entry.nodeId)).toEqual(['start', 'declare-x', 'input-x'])

    state = runAlgorithm(document, state)
    expect(state.status).toBe('finished')
    expect(state.output).toEqual(['positivo'])
  })

  it('executa While, registra cada decisão e termina no ramo de saída', () => {
    const document = {
      ...createAlgorithmDocument('Contador'),
      nodes: [
        { id: 'start', type: 'start' as const, position: { x: 0, y: 0 }, next: 'declare-i' },
        {
          id: 'declare-i',
          type: 'declare' as const,
          position: { x: 120, y: 0 },
          variable: 'i',
          valueType: 'number' as const,
          initialValue: 0,
          next: 'while-i',
        },
        {
          id: 'while-i',
          type: 'while' as const,
          position: { x: 240, y: 0 },
          condition: 'i < 3',
          bodyNext: 'increment-i',
          exitNext: 'output-i',
        },
        {
          id: 'increment-i',
          type: 'assign' as const,
          position: { x: 360, y: 80 },
          variable: 'i',
          expression: 'i + 1',
          next: 'while-i',
        },
        {
          id: 'output-i',
          type: 'output' as const,
          position: { x: 360, y: -80 },
          expression: 'i',
          next: 'end',
        },
        { id: 'end', type: 'end' as const, position: { x: 480, y: 0 } },
      ],
    }

    const result = runAlgorithm(document)
    expect(result.status).toBe('finished')
    expect(result.output).toEqual([3])
    expect(result.branches.map((entry) => entry.result)).toEqual([true, true, true, false])
    expect(result.watch.find((entry) => entry.name === 'i')?.value).toBe(3)
  })

  it('interrompe loops acidentais pelo limite de passos', () => {
    const document = {
      ...createAlgorithmDocument('Loop controlado'),
      nodes: [
        { id: 'start', type: 'start' as const, position: { x: 0, y: 0 }, next: 'loop' },
        {
          id: 'loop',
          type: 'if' as const,
          position: { x: 120, y: 0 },
          condition: 'TRUE',
          thenNext: 'loop',
          elseNext: 'end',
        },
        { id: 'end', type: 'end' as const, position: { x: 240, y: 0 } },
      ],
    }
    const result = runAlgorithm(document, undefined, { maxSteps: 4 })
    expect(result.status).toBe('error')
    expect(result.error).toContain('limite de 4 passos')
    expect(result.debug.lastPauseReason).toBe('max-steps')
  })
})
