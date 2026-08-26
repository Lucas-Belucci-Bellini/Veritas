import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { hrtime, memoryUsage } from 'node:process'
import { describe, expect, test } from 'vitest'
import { createDocumentRuntime } from '../../src/simulation/documentRuntime'
import {
  createLogicScalePlan,
  createNotChainDocument,
  createNotChainNetlist,
  LOGIC_SCALE_TARGETS,
} from '../../src/benchmark/logicScale'
import { Simulator } from '../../src/simulation/simulator'
import { toNetlist, validateCircuit } from '../../src/circuit'
import type { Netlist } from '../../src/simulation/components'

const DOCUMENT_WARMUP_ITERATIONS = 3
const DOCUMENT_MEASURED_ITERATIONS = 20
const RAW_WARMUP_ITERATIONS = 1

interface RuntimeMeasurement {
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

type DocumentMeasurement = RuntimeMeasurement | UnsupportedMeasurement

function rssKb(): number {
  return Math.round(memoryUsage().rss / 1024)
}

function expectedOutput(gates: number, input: boolean): boolean {
  return gates % 2 === 0 ? input : !input
}

function rawMeasuredIterations(gates: number): number {
  if (gates >= 5000) return 3
  if (gates >= 1000) return 5
  if (gates >= 500) return 10
  return 20
}

function measureRuntime(
  gates: number,
  netlist: Netlist,
  createRuntime: () => Simulator,
  warmupIterations: number,
  measuredIterations: number,
): RuntimeMeasurement {
  const ticksPerIteration = gates + 1
  const runtimeStarted = hrtime.bigint()
  const runtime = createRuntime()
  const runtimeInitElapsedNs = Number(hrtime.bigint() - runtimeStarted)

  for (let iteration = 0; iteration < warmupIterations; iteration += 1) {
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
  for (let iteration = 0; iteration < measuredIterations; iteration += 1) {
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
    connections: gates + 1,
    warmup_iterations: warmupIterations,
    iterations: measuredIterations,
    ticks_per_iteration: ticksPerIteration,
    total_ticks: measuredIterations * ticksPerIteration,
    expected_outputs: expectedOutputs.join(''),
    observed_outputs: observed,
    output_checksum_sha256: createHash('sha256').update(observed).digest('hex'),
    elapsed_ns: elapsedNs,
    average_ns_per_tick: elapsedNs / (measuredIterations * ticksPerIteration),
    rss_before_kb: rssBeforeKb,
    rss_after_kb: rssAfterKb,
    rss_delta_kb: rssAfterKb - rssBeforeKb,
    runtime_init_elapsed_ns: runtimeInitElapsedNs,
  }
}

function measureDocumentTarget(gates: number): DocumentMeasurement {
  const plan = createLogicScalePlan([gates])[0]
  if (!plan.supported) {
    return {
      gates,
      status: 'NOT SUPPORTED',
      nodes: plan.nodes,
      connections: plan.connections,
      reason: plan.reason ?? 'A escala excede os limites atuais do documento.',
    }
  }

  const document = createNotChainDocument(gates)
  if (validateCircuit(document).length > 0) throw new Error(`Fixture inválido para ${gates} gates.`)
  const netlist = toNetlist(document)
  return measureRuntime(
    gates,
    netlist,
    () => createDocumentRuntime(document),
    DOCUMENT_WARMUP_ITERATIONS,
    DOCUMENT_MEASURED_ITERATIONS,
  )
}

function measureRawTarget(gates: number): RuntimeMeasurement {
  const netlist = createNotChainNetlist(gates)
  return measureRuntime(
    gates,
    netlist,
    () => new Simulator(netlist),
    RAW_WARMUP_ITERATIONS,
    rawMeasuredIterations(gates),
  )
}

const documentMeasurements = LOGIC_SCALE_TARGETS.map(measureDocumentTarget)
const rawNetlistMeasurements = LOGIC_SCALE_TARGETS.map(measureRawTarget)

function writeMeasurementsIfRequested(): void {
  const outputPath = process.env.VERITAS_LOGIC_SCALE_OUTPUT
  if (!outputPath) return
  fs.mkdirSync(new URL('.', `file://${outputPath}`).pathname, { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify({
    schema: 'veritas-logic-scale-measurements-v2',
    benchmark: 'deterministic-not-chain',
    document_warmup_iterations: DOCUMENT_WARMUP_ITERATIONS,
    document_measured_iterations: DOCUMENT_MEASURED_ITERATIONS,
    raw_warmup_iterations: RAW_WARMUP_ITERATIONS,
    document_measurements: documentMeasurements,
    raw_netlist_measurements: rawNetlistMeasurements,
  }, null, 2)}\n`)
}

describe('logic scale benchmark', () => {
  test('measures product targets and raw runtime capacity without fabricating data', () => {
    expect(documentMeasurements).toHaveLength(5)
    expect(rawNetlistMeasurements).toHaveLength(5)
    expect(documentMeasurements.map((measurement) => measurement.gates)).toEqual([10, 100, 500, 1000, 5000])
    expect(rawNetlistMeasurements.map((measurement) => measurement.gates)).toEqual([10, 100, 500, 1000, 5000])

    for (const measurement of documentMeasurements) {
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

    for (const measurement of rawNetlistMeasurements) {
      expect(measurement.status).toBe('MEASURED')
      expect(measurement.nodes).toBe(measurement.gates + 2)
      expect(measurement.connections).toBe(measurement.gates + 1)
      expect(measurement.observed_outputs).toBe(measurement.expected_outputs)
      expect(measurement.output_checksum_sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(measurement.elapsed_ns).toBeGreaterThan(0)
      expect(measurement.average_ns_per_tick).toBeGreaterThan(0)
      expect(measurement.ticks_per_iteration).toBe(measurement.gates + 1)
      expect(measurement.total_ticks).toBe(measurement.iterations * measurement.ticks_per_iteration)
    }
    writeMeasurementsIfRequested()
  })
})
