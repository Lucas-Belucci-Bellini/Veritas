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
const expectedErrorCodes = {
  invalid_magic: 1,
  invalid_version: 2,
  invalid_width: 3,
  truncated_payload: 4,
  invalid_shape: 5,
  invalid_reference: 6,
  cycle: 7,
  buffer_overflow: 4,
}

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

function encodeFixture(testCase) {
  const components = testCase.netlist.components
  const ids = components.map((component) => component.id)
  const indexes = new Map(ids.map((id, index) => [id, index]))
  const bytes = []
  pushAscii(bytes, 'VNET')
  bytes.push(1, testCase.width)
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
  const overrides = Object.entries(testCase.overrides)
  pushU16(bytes, overrides.length)
  for (const [id, literal] of overrides) {
    const index = indexes.get(id)
    if (index === undefined) throw new Error(`fixture override references missing node ${id}`)
    pushU16(bytes, index)
    pushU64(bytes, BigInt(literal))
  }
  return Uint8Array.from(bytes)
}

function decodeResult(bytes, testCase) {
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
  if (magic !== 'VRES' || readU8() !== 1 || readU8() !== testCase.width) {
    throw new Error(`VRES header differs from the versioned contract for ${testCase.name}`)
  }
  const nodeCount = readU16()
  if (nodeCount !== testCase.netlist.components.length) throw new Error(`VRES node count differs for ${testCase.name}`)
  const values = {}
  for (const component of testCase.netlist.components) values[component.id] = readU64()
  const orderCount = readU16()
  if (orderCount !== nodeCount) throw new Error(`VRES order count differs for ${testCase.name}`)
  const order = []
  const seen = new Set()
  for (let index = 0; index < orderCount; index += 1) {
    const nodeIndex = readU16()
    if (nodeIndex >= nodeCount || seen.has(nodeIndex)) throw new Error(`VRES order is not a permutation for ${testCase.name}`)
    seen.add(nodeIndex)
    order.push(testCase.netlist.components[nodeIndex].id)
  }
  if (offset !== bytes.byteLength) throw new Error(`VRES contains trailing bytes for ${testCase.name}`)
  return { values, order }
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function formatHex(value, width) {
  return value.toString(16).toUpperCase().padStart(Math.ceil(width / 4), '0')
}

function assertGolden(result, testCase) {
  for (const [id, expected] of Object.entries(testCase.expected.values)) {
    const actual = formatHex(result.values[id], testCase.width)
    if (actual !== expected) throw new Error(`golden value differs for ${testCase.name}/${id}: expected ${expected}, got ${actual}`)
  }
  const expectedOrder = JSON.stringify(testCase.expected.order)
  if (JSON.stringify(result.order) !== expectedOrder) {
    throw new Error(`golden order differs for ${testCase.name}: expected ${expectedOrder}, got ${JSON.stringify(result.order)}`)
  }
}

function nodeFieldOffsets(payload) {
  const offsets = []
  const nodeCount = payload[6] | (payload[7] << 8)
  let offset = 8
  for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
    const idLength = payload[offset]
    const idStart = offset + 1
    const id = new TextDecoder().decode(payload.slice(idStart, idStart + idLength))
    const kindOffset = idStart + idLength
    const inputCountOffset = kindOffset + 1 + 8
    const inputStart = inputCountOffset + 1
    const inputCount = payload[inputCountOffset]
    offsets.push({ id, kindOffset, inputStart, inputCount })
    offset = inputStart + inputCount * 2
  }
  return offsets
}

function copyToBuffer(instance, payload, capacity) {
  const pointer = instance.exports.veritas_wasm_buffer_ptr()
  if (payload.byteLength > capacity) return { pointer, overflow: true }
  new Uint8Array(instance.exports.memory.buffer, pointer, payload.byteLength).set(payload)
  return { pointer, overflow: false }
}

function assertRuntimeError(instance, payload, expectedCode, capacity) {
  const { overflow } = copyToBuffer(instance, payload, capacity)
  const length = instance.exports.veritas_wasm_evaluate(overflow ? capacity + 1 : payload.byteLength)
  const actualCode = instance.exports.veritas_wasm_last_error_code()
  if (length !== 0 || actualCode !== expectedCode) {
    throw new Error(`expected WASM error ${expectedCode}, got length=${length}, code=${actualCode}`)
  }
}

function checkNegativeBoundary(instance, testCase, capacity) {
  const base = encodeFixture(testCase)
  const cases = {
    invalid_magic: Uint8Array.from(base),
    invalid_version: Uint8Array.from(base),
    invalid_width: Uint8Array.from(base),
    truncated_payload: base.slice(0, -1),
    invalid_shape: Uint8Array.from(base),
    invalid_reference: Uint8Array.from(base),
    cycle: Uint8Array.from(base),
  }
  cases.invalid_magic[0] = 0
  cases.invalid_version[4] = 2
  cases.invalid_width[5] = 0
  const offsets = nodeFieldOffsets(base)
  const firstGate = offsets.find((node) => node.inputCount > 0)
  const notNode = offsets.find((node) => node.id === 'not')
  cases.invalid_shape[firstGate.kindOffset] = 10
  cases.invalid_reference[firstGate.inputStart] = 0xff
  cases.invalid_reference[firstGate.inputStart + 1] = 0xff
  const notIndex = testCase.netlist.components.findIndex((component) => component.id === 'not')
  cases.cycle[notNode.inputStart] = notIndex & 0xff
  cases.cycle[notNode.inputStart + 1] = (notIndex >>> 8) & 0xff

  const errorCodes = {}
  for (const [name, payload] of Object.entries(cases)) {
    const expectedCode = expectedErrorCodes[name]
    assertRuntimeError(instance, payload, expectedCode, capacity)
    errorCodes[name] = expectedCode
  }
  assertRuntimeError(instance, new Uint8Array(capacity + 1), expectedErrorCodes.buffer_overflow, capacity)
  errorCodes.buffer_overflow = expectedErrorCodes.buffer_overflow
  return errorCodes
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
  if (fixture.schema !== 'veritas-wasm-netlist-golden-v1' || !Array.isArray(fixture.cases) || fixture.cases.length !== 4) {
    throw new Error('WASM-003 fixture must contain exactly four versioned cases')
  }
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
  if (imports.length !== 0) throw new Error(`WASM-003 module has ${imports.length} imports; expected zero`)
  if (missingExports.length > 0 || unexpectedExports.length > 0) {
    throw new Error(`WASM-003 exports mismatch; missing=${missingExports.join(',')} unexpected=${unexpectedExports.join(',')}`)
  }

  const { instance } = await WebAssembly.instantiate(wasmBytes)
  const abiVersion = instance.exports.veritas_wasm_abi_version()
  const capabilities = instance.exports.veritas_wasm_capabilities()
  const capacity = instance.exports.veritas_wasm_buffer_capacity()
  if (abiVersion !== 1 || capabilities !== 3 || capacity !== 65_536) {
    throw new Error(`unexpected WASM-003 markers: version=${abiVersion}, capabilities=${capabilities}, capacity=${capacity}`)
  }
  const cases = []
  for (const testCase of fixture.cases) {
    const payload = encodeFixture(testCase)
    if (bytesToHex(payload) !== testCase.payload_hex) {
      throw new Error(`VNET bytes differ from the registered golden fixture for ${testCase.name}`)
    }
    const { pointer, overflow } = copyToBuffer(instance, payload, capacity)
    if (overflow) throw new Error(`fixture ${testCase.name} exceeds WASM-003 buffer capacity`)
    const resultLength = instance.exports.veritas_wasm_evaluate(payload.byteLength)
    if (resultLength === 0 || instance.exports.veritas_wasm_last_error_code() !== 0) {
      throw new Error(`WASM-003 evaluation failed for ${testCase.name} with code ${instance.exports.veritas_wasm_last_error_code()}`)
    }
    const resultBytes = new Uint8Array(instance.exports.memory.buffer, pointer, resultLength)
    if (bytesToHex(resultBytes) !== testCase.expected.result_hex) {
      throw new Error(`VRES bytes differ from the registered golden fixture for ${testCase.name}`)
    }
    const result = decodeResult(resultBytes, testCase)
    assertGolden(result, testCase)
    cases.push({
      name: testCase.name,
      width: testCase.width,
      payload_bytes: payload.byteLength,
      result_bytes: resultLength,
      order: result.order,
    })
  }
  const errorCodes = checkNegativeBoundary(instance, fixture.cases[1], capacity)
  const report = {
    schema: 'veritas-wasm-netlist-parity-v2',
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
    cases,
    negative_error_codes: errorCodes,
    build_ms: Number(buildMs.toFixed(3)),
  }
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(reportPath, [
    '# WASM-003 — matriz golden e hardening de fronteira',
    '',
    '- **Status:** PASS',
    `- **Target:** \`${target}\``,
    `- **Feature:** \`${feature}\``,
    `- **Fixture:** \`${report.fixture}\``,
    `- **Casos golden:** ${report.cases.length} (${report.cases.map((testCase) => `${testCase.name}/${testCase.width} bits`).join(', ')})`,
    `- **Imports:** ${report.imports_count}`,
    `- **Exports:** ${report.exports.join(', ')}`,
    `- **ABI version:** ${report.abi_version}`,
    `- **Capabilities:** ${report.capabilities}`,
    `- **Buffer:** ${report.buffer_capacity} bytes`,
    `- **Erros end-to-end:** ${Object.entries(report.negative_error_codes).map(([name, code]) => `${name}=${code}`).join(', ')}`,
    `- **Build:** ${report.build_ms.toFixed(3)} ms`,
    '',
    'A matriz independente cobriu 1, 8, 32 e 64 bits. Cada payload VNET e resultado VRES foi comparado byte a byte, e os valores, saídas e a ordem topológica foram conferidos contra o golden.',
    '',
    'A fronteira também rejeitou magic/versão/largura inválidos, payload truncado, shape inválido, referência inválida, ciclo e buffer excedido com códigos estáveis. Esta prova continua fora do navegador, MCP, plugin e build produtivo.',
    '',
  ].join('\n'))
  console.log(`WASM-003 PASS: ${cases.length} casos golden e erros de fronteira validados; relatório em ${path.relative(repoRoot, reportPath)}`)
} catch (error) {
  console.error(`WASM-003 FAIL: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
