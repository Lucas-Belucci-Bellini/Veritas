import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { hrtime, memoryUsage } from 'node:process'
import { describe, expect, test } from 'vitest'
import { createDocumentRuntime } from '../../src/simulation/documentRuntime'
import { createLogicScalePlan, createNotChainDocument, LOGIC_SCALE_TARGETS } from '../../src/benchmark/logicScale'
import { toNetlist, validateCircuit } from '../../src/circuit'

const WARMUP_ITERATIONS = 3
const MEASURED_ITERATIONS = 20

interface SupportedMeasurement {
  gates: number
  status: 'MEASURED'
  nodes: number
  connections: number
  warmup_iterations: number
  iterations: number
  ticks_per_iteration: number
  total_ticks: number
  expected_outputs: string
  observed_outputs: string
  output_checksum_sha256: string
  elapsed_ns: number
  average_ns_per_tick: number
  rss_before_kb: number
  rss_after_kb: number
  rss_delta_kb: number
  runtime_init_elapsed_ns: number
}

interface UnsupportedMeasurement {
  gates: number
  status: 'NOT SUPPORTED'
  nodes: number
  connections: number
  reason: string
}

type Measurement = SupportedMeasurement | UnsupportedMeasurement

function rssKb(): number {
  return Math.round(memoryUsage().rss / 1024)
}

function expectedOutput(gates: number, input: boolean): boolean {
  return gates % 2 === 0 ? input : !input
}

function measureSupported(gates: number): SupportedMeasurement {
  const document = createNotChainDocument(gates)
  if (validateCircuit(document).length > 0) throw new Error(`Fixture inválido para ${gates} gates.`)
  const netlist = toNetlist(document)
  const ticksPerIteration = gates + 1
  const runtimeStarted = hrtime.bigint()
  const runtime = createDocumentRuntime(document)
  const runtimeInitElapsedNs = Number(hrtime.bigint() - runtimeStarted)

  for (let iteration = 0; iteration < WARMUP_ITERATIONS; iteration += 1) {
    const input = iteration % 2 === 0
    runtime.setInput('input', input)
    runtime.tick(ticksPerIteration)
    if (runtime.read('output') !== expectedOutput(gates, input)) {
      throw new Error(`Saída incorreta durante warmup em ${gates} gates.`)
    }
  }

  const rssBeforeKb = rssKb()
  const observedOutputs: string[] = []
  const expectedOutputs: string[] = []
  const started = hrtime.bigint()
  for (let iteration = 0; iteration < MEASURED_ITERATIONS; iteration += 1) {
    const input = iteration % 2 === 0
    const expected = expectedOutput(gates, input)
    runtime.setInput('input', input)
    runtime.tick(ticksPerIteration)
    const output = runtime.read('output')
    if (output !== expected) throw new Error(`Saída incorreta em ${gates} gates, iteração ${iteration}.`)
    expectedOutputs.push(expected ? '1' : '0')
    observedOutputs.push(output ? '1' : '0')
  }
  const elapsedNs = Number(hrtime.bigint() - started)
  const rssAfterKb = rssKb()
  const observed = observedOutputs.join('')

  return {
    gates,
    status: 'MEASURED',
    nodes: netlist.components.length,
    connections: document.connections.length,
    warmup_iterations: WARMUP_ITERATIONS,
    iterations: MEASURED_ITERATIONS,
    ticks_per_iteration: ticksPerIteration,
    total_ticks: MEASURED_ITERATIONS * ticksPerIteration,
    expected_outputs: expectedOutputs.join(''),
    observed_outputs: observed,
    output_checksum_sha256: createHash('sha256').update(observed).digest('hex'),
    elapsed_ns: elapsedNs,
    average_ns_per_tick: elapsedNs / (MEASURED_ITERATIONS * ticksPerIteration),
    rss_before_kb: rssBeforeKb,
    rss_after_kb: rssAfterKb,
    rss_delta_kb: rssAfterKb - rssBeforeKb,
    runtime_init_elapsed_ns: runtimeInitElapsedNs,
  }
}

function measureTarget(gates: number): Measurement {
  const plan = createLogicScalePlan([gates])[0]
  return plan.supported
    ? measureSupported(gates)
    : {
        gates,
        status: 'NOT SUPPORTED',
        nodes: plan.nodes,
        connections: plan.connections,
        reason: plan.reason ?? 'A escala excede os limites atuais do documento.',
      }
}

const measurements = LOGIC_SCALE_TARGETS.map(measureTarget)

function writeMeasurementsIfRequested(): void {
  const outputPath = process.env.VERITAS_LOGIC_SCALE_OUTPUT
  if (!outputPath) return
  fs.mkdirSync(new URL('.', `file://${outputPath}`).pathname, { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify({
    schema: 'veritas-logic-scale-measurements-v1',
    benchmark: 'deterministic-not-chain',
    warmup_iterations: WARMUP_ITERATIONS,
    measured_iterations: MEASURED_ITERATIONS,
    measurements,
  }, null, 2)}\n`)
}

describe('logic scale benchmark', () => {
  test('measures supported targets and reports unsupported targets without fabricating data', () => {
    expect(measurements).toHaveLength(5)
    expect(measurements.map((measurement) => measurement.gates)).toEqual([10, 100, 500, 1000, 5000])
    for (const measurement of measurements) {
      expect(measurement.nodes).toBe(measurement.gates + 2)
      expect(measurement.connections).toBe(measurement.gates + 1)
      if (measurement.status === 'MEASURED') {
        expect(measurement.observed_outputs).toBe(measurement.expected_outputs)
        expect(measurement.output_checksum_sha256).toMatch(/^[a-f0-9]{64}$/)
        expect(measurement.elapsed_ns).toBeGreaterThan(0)
        expect(measurement.average_ns_per_tick).toBeGreaterThan(0)
        expect(measurement.ticks_per_iteration).toBe(measurement.gates + 1)
        expect(measurement.total_ticks).toBe(measurement.iterations * measurement.ticks_per_iteration)
      } else {
        expect(measurement.reason).toMatch(/limita/i)
      }
    }
    writeMeasurementsIfRequested()
  })
})
