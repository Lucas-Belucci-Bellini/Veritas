import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  WASM_ISOLATION_IDS,
  checkArtifactIsolation,
  checkProductionSource,
  checkRequiredArtifacts,
  checkRustFeatureOptIn,
  renderWasmIsolationReport,
  sanitizeWasmIsolationMessage,
} from './wasm-isolation-contract.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const artifactDir = path.join(repoRoot, process.env.WASM_ISOLATION_ARTIFACT_DIR ?? 'artifacts')
const reportPath = path.join(artifactDir, 'wasm-isolation.md')
const jsonPath = path.join(artifactDir, 'wasm-isolation.json')
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs', '.webmanifest'])

function relative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, '/')
}

function walk(directory) {
  if (!fs.existsSync(directory)) return []
  const entries = fs.readdirSync(directory, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const filePath = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(filePath) : [filePath]
  })
}

function readEntries(paths, options = {}) {
  const excluded = options.excluded ?? (() => false)
  return paths
    .flatMap((root) => walk(path.join(repoRoot, root)))
    .filter((filePath) => textExtensions.has(path.extname(filePath)) && !excluded(relative(filePath)))
    .sort()
    .map((filePath) => ({ path: relative(filePath), content: fs.readFileSync(filePath, 'utf8') }))
}

function resultForFailure(id, operation, message) {
  return { id, operation, status: 'FAIL', message: sanitizeWasmIsolationMessage(message) }
}

function runRegression() {
  const result = spawnSync('npm', ['test', '--', '--run', 'src/release/wasmIsolationContract.test.ts'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: Number(process.env.WASM_ISOLATION_TEST_TIMEOUT_MS ?? 30_000),
  })
  if (result.error || result.status !== 0) {
    return resultForFailure('WASM-004-005', 'regressão do contrato de isolamento', [result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n'))
  }
  return { id: 'WASM-004-005', operation: 'regressão do contrato de isolamento', status: 'PASS', message: 'wasmIsolationContract.test.ts aprovado' }
}

function main() {
  const sourceEntries = readEntries(['src'], {
    excluded: (filePath) => filePath.includes('/wasm/') || filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx'),
  })
  const artifactEntries = [
    ...readEntries(['dist', 'mcp/dist', 'plugins/veritas-logic']),
  ]
  const requiredPaths = ['dist/index.html', 'mcp/dist/server.js', 'mcp/dist/http-server.js', 'plugins/veritas-logic/server.mjs']
  const cargoToml = fs.readFileSync(path.join(repoRoot, 'engine-rs', 'Cargo.toml'), 'utf8')
  const results = [
    checkProductionSource(sourceEntries),
    checkArtifactIsolation(artifactEntries),
    checkRustFeatureOptIn(cargoToml),
    checkRequiredArtifacts(artifactEntries, requiredPaths),
    runRegression(),
  ]
  const ids = results.map((item) => item.id)
  if (ids.length !== WASM_ISOLATION_IDS.length || new Set(ids).size !== ids.length || ids.some((id) => !WASM_ISOLATION_IDS.includes(id))) {
    throw new Error('IDs WASM-004 incompletos ou duplicados')
  }
  fs.mkdirSync(artifactDir, { recursive: true })
  fs.writeFileSync(jsonPath, `${JSON.stringify({ schema: 'veritas-wasm-isolation-v1', status: results.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL', results }, null, 2)}\n`)
  fs.writeFileSync(reportPath, renderWasmIsolationReport(results))
  console.log(renderWasmIsolationReport(results))
  console.log(`Relatório sanitizado: ${reportPath}`)
  if (results.some((item) => item.status === 'FAIL')) process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(`WASM-004 runner abortado: ${sanitizeWasmIsolationMessage(error)}`)
  process.exitCode = 1
}
