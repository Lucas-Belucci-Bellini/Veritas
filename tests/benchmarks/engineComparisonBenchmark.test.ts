import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { bitVector, toBigInt, type BitVector } from '../../src/bus/bitVector'
import { evaluateVectorNetlist } from '../../src/circuit/evaluate'
import { toNetlist, type CircuitDocument } from '../../src/circuit/editorModel'

interface Scenario {
  name: string
  width: number
  iterations: number
  inputA: bigint
  inputB: bigint
  expectedOutput: bigint
}

interface BenchmarkResult {
  name: string
  width: number
  iterations: number
  expected_bits: string
  output_bits: string
  checksum: string
  elapsed_ns: number
}

const fixturePath = fileURLToPath(new URL('../fixtures/rust-engine/engine-comparison.tsv', import.meta.url))
const scenarios = loadScenarios(fixturePath)

function loadScenarios(path: string): Scenario[] {
  return fs.readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trimStart().startsWith('#'))
    .map((line) => {
      const [name, width, iterations, inputA, inputB, expectedOutput] = line.trim().split(/\s+/)
      return {
        name,
        width: Number(width),
        iterations: Number(iterations),
        inputA: BigInt(inputA),
        inputB: BigInt(inputB),
        expectedOutput: BigInt(expectedOutput),
      }
    })
}

function benchmarkDocument(width: number): CircuitDocument {
  const nodes = [
    ['a', 'input'],
    ['b', 'input'],
    ['and', 'and'],
    ['xor', 'xor'],
    ['or', 'or'],
    ['nand', 'nand'],
    ['xnor', 'xnor'],
    ['not', 'not'],
    ['out', 'output'],
  ] as const
  return {
    format: 'veritas-circuit',
    version: 1,
    name: `RUST-002 benchmark ${width}-bit`,
    nodes: nodes.map(([id, type], index) => ({
      id,
      type,
      position: { x: index * 180, y: 0 },
      options: { width },
    })),
    connections: [
      { source: { node: 'a' }, target: { node: 'and', port: 0 } },
      { source: { node: 'b' }, target: { node: 'and', port: 1 } },
      { source: { node: 'a' }, target: { node: 'xor', port: 0 } },
      { source: { node: 'b' }, target: { node: 'xor', port: 1 } },
      { source: { node: 'and' }, target: { node: 'or', port: 0 } },
      { source: { node: 'xor' }, target: { node: 'or', port: 1 } },
      { source: { node: 'and' }, target: { node: 'nand', port: 0 } },
      { source: { node: 'or' }, target: { node: 'nand', port: 1 } },
      { source: { node: 'nand' }, target: { node: 'xnor', port: 0 } },
      { source: { node: 'xor' }, target: { node: 'xnor', port: 1 } },
      { source: { node: 'xnor' }, target: { node: 'not', port: 0 } },
      { source: { node: 'not' }, target: { node: 'out', port: 0 } },
    ],
  }
}

function benchmarkScenario(scenario: Scenario): BenchmarkResult {
  const document = benchmarkDocument(scenario.width)
  const netlist = toNetlist(document, { allowBuses: true })
  const inputs = {
    a: bitVector(scenario.width, scenario.inputA),
    b: bitVector(scenario.width, scenario.inputB),
  }
  const evaluate = (): BitVector => evaluateVectorNetlist(netlist, inputs).outputs.out

  for (let iteration = 0; iteration < 100; iteration += 1) evaluate()

  const started = process.hrtime.bigint()
  let output = 0n
  let checksum = 0n
  for (let iteration = 0; iteration < scenario.iterations; iteration += 1) {
    output = toBigInt(evaluate())
    checksum ^= output
  }
  const elapsedNs = Number(process.hrtime.bigint() - started)

  return {
    name: scenario.name,
    width: scenario.width,
    iterations: scenario.iterations,
    expected_bits: scenario.expectedOutput.toString(),
    output_bits: output.toString(),
    checksum: checksum.toString(),
    elapsed_ns: elapsedNs,
  }
}

describe('RUST-002 controlled engine benchmark', () => {
  const results = scenarios.map(benchmarkScenario)

  test('keeps the benchmark fixture valid and produces a stable output shape', () => {
    expect(results).toHaveLength(4)
    for (const result of results) {
      expect(result.iterations).toBeGreaterThan(0)
      expect(result.elapsed_ns).toBeGreaterThan(0)
      expect(result.expected_bits).toMatch(/^\d+$/)
      expect(result.output_bits).toBe(result.expected_bits)
      expect(result.checksum).toBe(result.output_bits)
    }
  })

  test('writes machine-readable results when requested by the comparison runner', () => {
    const outputPath = process.env.VERITAS_BENCHMARK_OUTPUT
    if (!outputPath) return
    fs.mkdirSync(new URL('.', `file://${outputPath}`).pathname, { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify({
      runtime: 'typescript',
      mode: 'vitest-esbuild',
      warmup_iterations: 100,
      scenarios: results,
    }, null, 2)}\n`)
  })
})
