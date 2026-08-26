import { describe, expect, it } from 'vitest'
import {
  clampStepTicks,
  createCombinationalCase,
  createSequentialCase,
  cycleStepInput,
  toggleExpectedOutput,
  toTestbenchCases,
  type DraftPortNames,
} from './testbenchDraft'

const PORTS: DraftPortNames = {
  inputs: ['CLK', 'D'],
  outputs: ['Q'],
}

describe('testbenchDraft', () => {
  it('cria casos vazios com as portas do circuito', () => {
    expect(createCombinationalCase(PORTS)).toEqual({
      mode: 'combinational',
      inputs: { CLK: false, D: false },
      expect: { Q: false },
    })
    expect(createSequentialCase(PORTS)).toEqual({
      mode: 'sequential',
      steps: [
        {
          set: { CLK: false, D: false },
          ticks: 1,
          expect: { Q: false },
        },
      ],
    })
  })

  it('cicla entrada sequencial entre 0, 1 e manter', () => {
    const initial = createSequentialCase(PORTS).steps[0]!
    const one = cycleStepInput(initial, 'D')
    const maintain = cycleStepInput(one, 'D')

    expect(one.set.D).toBe(true)
    expect(maintain.set).not.toHaveProperty('D')
    expect(initial.set).toEqual({ CLK: false, D: false })
  })

  it('altera expectativa sem mutar o passo e limita ticks', () => {
    const initial = createSequentialCase(PORTS).steps[0]!
    const changed = toggleExpectedOutput(initial, 'Q')

    expect(changed.expect).toEqual({ Q: true })
    expect(initial.expect).toEqual({ Q: false })
    expect(clampStepTicks('0')).toBe(1)
    expect(clampStepTicks('12')).toBe(12)
    expect(clampStepTicks('999')).toBe(200)
    expect(clampStepTicks('invalid')).toBe(1)
  })

  it('converte os dois modos para o documento declarativo do domínio', () => {
    const cases = [createCombinationalCase(PORTS), createSequentialCase(PORTS)]
    const documentCases = toTestbenchCases(cases)

    expect(documentCases).toEqual([
      {
        name: '#1',
        inputs: { CLK: false, D: false },
        expect: { Q: false },
      },
      {
        name: '#2',
        steps: [
          {
            set: { CLK: false, D: false },
            ticks: 1,
            expect: { Q: false },
          },
        ],
      },
    ])
  })
})
