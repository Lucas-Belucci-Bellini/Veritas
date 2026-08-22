import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = process.env.WASM_TARGET ?? 'wasm32-unknown-unknown'
const feature = 'wasm-netlist-abi'
const artifactDir = path.join(repoRoot, process.env.WASM_ARTIFACT_DIR ?? 'artifacts')
const wasmPath = path.join(repoRoot, 'engine-rs', 'target', target, 'release', 'veritas_engine.wasm')
const fixturePath = path.join(repoRoot, 'tests', 'fixtures', 'wasm', 'netlist-parity.json')
const reportPath = path.join(artifactDir, 'wasm-netlist-parity.md')
const jsonPath = path.join(artifactDir, 'wasm-netlist-parity.json')
const expectedExports = new Set([
  '__data_end',
  '__heap_base',
  'memory',
  'veritas_wasm_abi_version',
  'veritas_wasm_capabilities',
  'veritas_wasm_buffer_ptr',
  'veritas_wasm_buffer_capacity',
  'veritas_wasm_last_error_code',
  'veritas_wasm_evaluate',
])

fs.mkdirSync(artifactDir, { recursive: true })

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim().slice(-4000)
    throw new Error(`${command} exited with ${result.status}${details ? `\n${details}` : ''}`)
  }
}

function encodeFixture(fixture) {
  const components = fixture.netlist.components
  const ids = components.map((component) => component.id)
  const indexes = new Map(ids.map((id, index) => [id, index]))
  const bytes = []
  pushAscii(bytes, 'VNET')
  bytes.push(1, fixture.width)
  pushU16(bytes, components.length)
  for (const component of components) {
    const kind = {
      input: 0,
      constant: 1,
      and: 2,
      nand: 3,
      or: 4,
      nor: 5,
      xor: 6,
      xnor: 7,
      not: 8,
      output: 9,
    }[component.type]
    if (kind === undefined) throw new Error(`fixture has unsupported type ${component.type}`)
    const value = component.type === 'input'
      ? component.options?.initial ? 1n : 0n
      : component.type === 'constant'
        ? component.options?.value ? 1n : 0n
        : 0n
    const inputs = component.inputs ?? []
    pushId(bytes, component.id)
    bytes.push(kind)
    pushU64(bytes, value)
    bytes.push(inputs.length)
    for (const input of inputs) {
      const index = indexes.get(input.node)
      if (index === undefined) throw new Error(`fixture references missing node ${input.node}`)
      pushU16(bytes, index)
    }
  }
  const overrides = Object.entries(fixture.overrides)
  pushU16(bytes, overrides.length)
  for (const [id, literal] of overrides) {
    const index = indexes.get(id)
    if (index === undefined) throw new Error(`fixture override references missing node ${id}`)
    pushU16(bytes, index)
    pushU64(bytes, BigInt(literal))
  }
  return Uint8Array.from(bytes)
}

function decodeResult(bytes, fixture) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0
  const readU8 = () => view.getUint8(offset++)
  const readU16 = () => {
    const value = view.getUint16(offset, true)
    offset += 2
    return value
  }
  const readU64 = () => {
    const value = view.getBigUint64(offset, true)
    offset += 8
    return value
  }
  const magic = String.fromCharCode(readU8(), readU8(), readU8(), readU8())
  if (magic !== 'VRES' || readU8() !== 1 || readU8() !== fixture.width) {
    throw new Error('VRES header differs from the versioned contract')
  }
  const nodeCount = readU16()
  if (nodeCount !== fixture.netlist.components.length) throw new Error('VRES node count differs from fixture')
  const values = {}
  for (const component of fixture.netlist.components) values[component.id] = readU64()
  const orderCount = readU16()
  if (orderCount !== nodeCount) throw new Error('VRES order count differs from fixture')
  const order = []
  const seen = new Set()
  for (let index = 0; index < orderCount; index += 1) {
    const nodeIndex = readU16()
    if (nodeIndex >= nodeCount || seen.has(nodeIndex)) throw new Error('VRES order is not a permutation')
    seen.add(nodeIndex)
    order.push(fixture.netlist.components[nodeIndex].id)
  }
  if (offset !== bytes.byteLength) throw new Error('VRES contains trailing bytes')
  return { values, order }
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function assertGolden(result, fixture) {
  for (const [id, expected] of Object.entries(fixture.expected.values)) {
    const actual = result.values[id]?.toString(16).toUpperCase().padStart(2, '0')
    if (actual !== expected) throw new Error(`golden value differs for ${id}: expected ${expected}, got ${actual}`)
  }
  const expectedOrder = JSON.stringify(fixture.expected.order)
  if (JSON.stringify(result.order) !== expectedOrder) {
    throw new Error(`golden order differs: expected ${expectedOrder}, got ${JSON.stringify(result.order)}`)
  }
}

function pushAscii(bytes, value) {
  for (const character of value) bytes.push(character.charCodeAt(0))
}

function pushId(bytes, id) {
  const encoded = new TextEncoder().encode(id)
  bytes.push(encoded.length, ...encoded)
}

function pushU16(bytes, value) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff)
}

function pushU64(bytes, value) {
  const buffer = new ArrayBuffer(8)
  new DataView(buffer).setBigUint64(0, value, true)
  bytes.push(...new Uint8Array(buffer))
}

try {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
  const buildStarted = process.hrtime.bigint()
  run('cargo', [
    'build',
    '--manifest-path',
    'engine-rs/Cargo.toml',
    '--target',
    target,
    '--release',
    '--locked',
    '--features',
    feature,
  ])
  const buildMs = Number(process.hrtime.bigint() - buildStarted) / 1e6
  const wasmBytes = fs.readFileSync(wasmPath)
  const module = await WebAssembly.compile(wasmBytes)
  const imports = WebAssembly.Module.imports(module)
  const exportEntries = WebAssembly.Module.exports(module)
  const exports = exportEntries.map((entry) => entry.name).sort()
  const missingExports = [...expectedExports].filter((name) => !exports.includes(name))
  const unexpectedExports = exports.filter((name) => !expectedExports.has(name))
  if (imports.length !== 0) throw new Error(`WASM-002 module has ${imports.length} imports; expected zero`)
  if (missingExports.length > 0 || unexpectedExports.length > 0) {
    throw new Error(`WASM-002 exports mismatch; missing=${missingExports.join(',')} unexpected=${unexpectedExports.join(',')}`)
  }

  const { instance } = await WebAssembly.instantiate(wasmBytes)
  const abiVersion = instance.exports.veritas_wasm_abi_version()
  const capabilities = instance.exports.veritas_wasm_capabilities()
  const capacity = instance.exports.veritas_wasm_buffer_capacity()
  if (abiVersion !== 1 || capabilities !== 3 || capacity !== 65_536) {
    throw new Error(`unexpected WASM-002 markers: version=${abiVersion}, capabilities=${capabilities}, capacity=${capacity}`)
  }
  const payload = encodeFixture(fixture)
  if (bytesToHex(payload) !== fixture.payload_hex) {
    throw new Error('VNET bytes differ from the registered golden fixture')
  }
  const pointer = instance.exports.veritas_wasm_buffer_ptr()
  if (payload.byteLength > capacity) throw new Error('fixture exceeds WASM-002 buffer capacity')
  new Uint8Array(instance.exports.memory.buffer, pointer, payload.byteLength).set(payload)
  const resultLength = instance.exports.veritas_wasm_evaluate(payload.byteLength)
  if (resultLength === 0 || instance.exports.veritas_wasm_last_error_code() !== 0) {
    throw new Error(`WASM-002 evaluation failed with code ${instance.exports.veritas_wasm_last_error_code()}`)
  }
  const resultBytes = new Uint8Array(instance.exports.memory.buffer, pointer, resultLength)
  if (bytesToHex(resultBytes) !== fixture.expected.result_hex) {
    throw new Error('VRES bytes differ from the registered golden fixture')
  }
  const result = decodeResult(resultBytes, fixture)
  assertGolden(result, fixture)
  const report = {
    schema: 'veritas-wasm-netlist-parity-v1',
    status: 'PASS',
    target,
    feature,
    artifact: path.relative(repoRoot, wasmPath),
    fixture: path.relative(repoRoot, fixturePath),
    imports_count: imports.length,
    exports,
    abi_version: abiVersion,
    capabilities,
    buffer_capacity: capacity,
    payload_bytes: payload.byteLength,
    result_bytes: resultLength,
    build_ms: Number(buildMs.toFixed(3)),
  }
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(reportPath, [
    '# WASM-002 — adapter/netlist ABI e golden parity',
    '',
    '- **Status:** PASS',
    `- **Target:** \`${target}\``,
    `- **Feature:** \`${feature}\``,
    `- **Fixture:** \`${report.fixture}\``,
    `- **Imports:** ${report.imports_count}`,
    `- **Exports:** ${report.exports.join(', ')}`,
    `- **ABI version:** ${report.abi_version}`,
    `- **Capabilities:** ${report.capabilities}`,
    `- **Buffer:** ${report.buffer_capacity} bytes`,
    `- **Payload VNET:** ${report.payload_bytes} bytes`,
    `- **Resultado VRES:** ${report.result_bytes} bytes`,
    `- **Build:** ${report.build_ms.toFixed(3)} ms`,
    '',
    'O mesmo fixture público foi codificado no payload VNET, executado pelo núcleo Rust/WASM e comparado ao resultado golden. A verificação conferiu zero imports, exports versionados, marcadores ABI, valores e ordem topológica.',
    '',
    'Esta é uma prova experimental fora do navegador, do MCP, do plugin e do build de produção. Ela não habilita execução de `CircuitDocument`, não usa rede, tokens, IndexedDB ou memória compartilhada e não declara superioridade de desempenho.',
    '',
  ].join('\n'))
  console.log(`WASM-002 PASS: golden parity validada; relatório em ${path.relative(repoRoot, reportPath)}`)
} catch (error) {
  console.error(`WASM-002 FAIL: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
