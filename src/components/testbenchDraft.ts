import type { TestbenchCase } from '../circuit'

export interface DraftPortNames {
  inputs: string[]
  outputs: string[]
}

export interface DraftCombinationalCase {
  mode: 'combinational'
  inputs: Record<string, boolean>
  expect: Record<string, boolean>
}

export interface DraftStep {
  /** Valor ausente significa que a entrada mantém o estado anterior. */
  set: Record<string, boolean>
  ticks: number
  expect: Record<string, boolean>
}

export interface DraftSequentialCase {
  mode: 'sequential'
  steps: DraftStep[]
}

export type DraftCase = DraftCombinationalCase | DraftSequentialCase

export function createCombinationalCase(
  ports: DraftPortNames,
): DraftCombinationalCase {
  return {
    mode: 'combinational',
    inputs: valuesFor(ports.inputs),
    expect: valuesFor(ports.outputs),
  }
}

export function createSequentialCase(
  ports: DraftPortNames,
): DraftSequentialCase {
  return {
    mode: 'sequential',
    steps: [createStep(ports)],
  }
}

export function createStep(ports: DraftPortNames): DraftStep {
  return {
    set: valuesFor(ports.inputs),
    ticks: 1,
    expect: valuesFor(ports.outputs),
  }
}

export function valuesFor(names: string[]): Record<string, boolean> {
  return Object.fromEntries(names.map((name) => [name, false]))
}

/** Cycle a step input through 0 → 1 → maintain, preserving the 3-state UI. */
export function cycleStepInput(step: DraftStep, name: string): DraftStep {
  const set = { ...step.set }
  if (!(name in set)) set[name] = false
  else if (!set[name]) set[name] = true
  else delete set[name]
  return { ...step, set }
}

export function toggleExpectedOutput(step: DraftStep, name: string): DraftStep {
  return { ...step, expect: { ...step.expect, [name]: !step.expect[name] } }
}

export function clampStepTicks(value: string): number {
  return Math.min(200, Math.max(1, Number(value) || 1))
}

export function toTestbenchCases(cases: DraftCase[]): TestbenchCase[] {
  return cases.map((item, index) =>
    item.mode === 'sequential'
      ? {
          name: `#${index + 1}`,
          steps: item.steps.map((step) => ({
            set: step.set,
            ticks: step.ticks,
            expect: step.expect,
          })),
        }
      : {
          name: `#${index + 1}`,
          inputs: item.inputs,
          expect: item.expect,
        },
  )
}
