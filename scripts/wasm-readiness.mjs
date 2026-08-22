import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'
import {
  validateWasmModuleShape,
  WASM_EXPECTED_ABI_VERSION,
  WASM_EXPECTED_CAPABILITIES,
} from './wasm-readiness-contract.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = process.env.WASM_TARGET ?? 'wasm32-unknown-unknown'
const artifactDir = path.join(repoRoot, process.env.WASM_ARTIFACT_DIR ?? 'artifacts')
const wasmPath = path.join(repoRoot, 'engine-rs', 'target', target, 'release', 'veritas_engine.wasm')
const reportPath = path.join(artifactDir, 'wasm-readiness.md')
const jsonPath = path.join(artifactDir, 'wasm-readiness.json')
const repeatCount = 100

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

function milliseconds(nanoseconds) {
  return Number(nanoseconds) / 1e6
}

function renderReport(result) {
  return [
    '# WASM-001 — readiness experimental',
    '',
    '- **Status:** PASS',
    `- **Target:** \`${result.target}\``,
    `- **Artefato:** \`${result.artifact}\``,
    `- **Tamanho bruto:** ${result.size_bytes} bytes`,
    `- **Tamanho gzip:** ${result.gzip_bytes} bytes`,
    `- **Imports:** ${result.imports_count}`,
    `- **Exports:** ${result.exports.join(', ')}`,
    `- **ABI version:** ${result.abi_version}`,
    `- **Capabilities:** ${result.capabilities}`,
    `- **Cold start (compile + instantiate):** ${result.cold_start_ms.toFixed(3)} ms`,
    `- **${result.repeat_count} instanciações repetidas:** ${result.repeat_total_ms.toFixed(3)} ms`,
    '',
    'O gate confirma apenas que o artefato experimental compila para o target, não depende de imports externos, expõe somente o ABI mínimo documentado e pode ser instanciado pelo Node. Tamanho e tempos são observações desta execução, não uma comparação entre máquinas nem uma promessa de desempenho.',
    '',
    'O módulo não é incluído no bundle do navegador, não recebe documentos, tokens, rede ou IndexedDB e não substitui o runtime TypeScript. A avaliação de netlists continua fora desta ABI até existir um adaptador formal e uma prova de paridade WASM dedicada.',
    '',
  ].join('\n')
}

try {
  run('cargo', [
    'build',
    '--manifest-path',
    'engine-rs/Cargo.toml',
    '--target',
    target,
    '--release',
    '--locked',
  ])

  const wasmBytes = fs.readFileSync(wasmPath)
  const module = await WebAssembly.compile(wasmBytes)
  const imports = WebAssembly.Module.imports(module)
  const exportEntries = WebAssembly.Module.exports(module)
  const shape = validateWasmModuleShape(imports, exportEntries)
  if (!shape.ok) throw new Error(shape.errors.join('; '))

  const coldStartStarted = process.hrtime.bigint()
  const { instance } = await WebAssembly.instantiate(wasmBytes)
  const coldStartNs = process.hrtime.bigint() - coldStartStarted
  const abiVersion = instance.exports.veritas_wasm_abi_version()
  const capabilities = instance.exports.veritas_wasm_capabilities()
  if (abiVersion !== WASM_EXPECTED_ABI_VERSION || capabilities !== WASM_EXPECTED_CAPABILITIES) {
    throw new Error(`unexpected WASM ABI marker: version=${abiVersion}, capabilities=${capabilities}`)
  }

  const repeatStarted = process.hrtime.bigint()
  for (let index = 0; index < repeatCount; index += 1) {
    const { instance: repeated } = await WebAssembly.instantiate(wasmBytes)
    if (repeated.exports.veritas_wasm_abi_version() !== abiVersion) {
      throw new Error('WASM ABI marker changed during repeated instantiation')
    }
  }
  const repeatNs = process.hrtime.bigint() - repeatStarted
  const result = {
    schema: 'veritas-wasm-readiness-v1',
    status: 'PASS',
    target,
    artifact: path.relative(repoRoot, wasmPath),
    size_bytes: wasmBytes.byteLength,
    gzip_bytes: gzipSync(wasmBytes, { level: 9 }).byteLength,
    imports_count: imports.length,
    exports: shape.exports,
    abi_exports: shape.abiExports,
    linker_exports: shape.linkerExports,
    abi_version: abiVersion,
    capabilities,
    cold_start_ms: milliseconds(coldStartNs),
    repeat_count: repeatCount,
    repeat_total_ms: milliseconds(repeatNs),
    node: process.version,
  }
  fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`)
  fs.writeFileSync(reportPath, `${renderReport(result)}\n`)
  console.log(`WASM-001 PASS: ABI mínimo instanciado; relatório em ${path.relative(repoRoot, reportPath)}`)
} catch (error) {
  console.error(`WASM-001 FAIL: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
