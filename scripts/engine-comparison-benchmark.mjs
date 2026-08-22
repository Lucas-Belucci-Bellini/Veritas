import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixturePath = path.join(repoRoot, 'tests/fixtures/rust-engine/engine-comparison.tsv')
const artifactDir = path.join(repoRoot, process.env.BENCHMARK_ARTIFACT_DIR ?? 'artifacts')
const tsOutputPath = path.join(artifactDir, 'engine-comparison-typescript.json')
const rustOutputPath = path.join(artifactDir, 'engine-comparison-rust.json')
const reportPath = path.join(artifactDir, 'engine-comparison-benchmark.md')

fs.mkdirSync(artifactDir, { recursive: true })

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim().slice(-4000)
    throw new Error(`${command} exited with ${result.status}${details ? `\n${details}` : ''}`)
  }
  return result
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function version(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : 'unavailable'
}

function compareResults(ts, rust) {
  if (ts.runtime !== 'typescript' || rust.runtime !== 'rust') {
    throw new Error('benchmark outputs have unexpected runtime labels')
  }
  if (ts.warmup_iterations !== rust.warmup_iterations) {
    throw new Error('benchmark warmup counts differ')
  }
  const rustByName = new Map(rust.scenarios.map((scenario) => [scenario.name, scenario]))
  const rows = ts.scenarios.map((typescriptScenario) => {
    const rustScenario = rustByName.get(typescriptScenario.name)
    if (!rustScenario) throw new Error(`Rust result is missing scenario ${typescriptScenario.name}`)
    const same = ['width', 'iterations', 'expected_bits', 'output_bits', 'checksum']
      .every((field) => String(typescriptScenario[field]) === String(rustScenario[field]))
    if (!same) {
      throw new Error(`RUST-002 parity mismatch in ${typescriptScenario.name}`)
    }
    return {
      name: typescriptScenario.name,
      width: typescriptScenario.width,
      iterations: typescriptScenario.iterations,
      expected_bits: String(typescriptScenario.expected_bits),
      output_bits: String(typescriptScenario.output_bits),
      checksum: String(typescriptScenario.checksum),
      typescript_elapsed_ns: typescriptScenario.elapsed_ns,
      rust_elapsed_ns: rustScenario.elapsed_ns,
      parity: 'PASS',
    }
  })
  if (rows.length !== rust.scenarios.length) throw new Error('benchmark scenario counts differ')
  return rows
}

function renderReport(rows, ts) {
  const lines = [
    '# RUST-002 — benchmark comparativo TypeScript/Rust',
    '',
    `- **Status:** PASS — paridade de saída confirmada em ${rows.length} cenários`,
    `- **Fixture:** \`${path.relative(repoRoot, fixturePath)}\``,
    `- **Aquecimento:** ${ts.warmup_iterations} avaliações por cenário, fora da janela medida`,
    '- **Medição:** somente o laço de avaliações; build, parsing, construção do documento/netlist e inicialização ficam fora da janela',
    `- **Node:** ${version(process.execPath, ['--version'])}`,
    `- **Rust:** ${version('rustc', ['--version'])}`,
    `- **Cargo:** ${version('cargo', ['--version'])}`,
    '',
    '| Cenário | Largura | Iterações | Esperado | Saída | Checksum | TypeScript (ms) | Rust (ms) | Paridade |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ]
  for (const row of rows) {
    lines.push(`| ${row.name} | ${row.width} | ${row.iterations} | ${row.expected_bits} | ${row.output_bits} | ${row.checksum} | ${(row.typescript_elapsed_ns / 1e6).toFixed(3)} | ${(row.rust_elapsed_ns / 1e6).toFixed(3)} | ${row.parity} |`)
  }
  lines.push(
    '',
    '## Interpretação',
    '',
    'O resultado confirma que os dois harnesses produziram a mesma saída e o mesmo checksum para o fixture compartilhado. Os tempos são observações do ambiente desta execução e não devem ser comparados entre máquinas, sistemas operacionais, versões de compilador ou modos de build diferentes.',
    '',
    'O lado TypeScript usa o avaliador vetorial de produção transformado pelo Vitest/esbuild; o lado Rust usa `cargo bench` com perfil release. Esta etapa não mede WASM, não altera o runtime produtivo e não autoriza afirmar que Rust é superior ou substituir o fallback TypeScript.',
    '',
  )
  return `${lines.join('\n')}\n`
}

try {
  run(path.join(repoRoot, 'node_modules/.bin/vitest'), [
    'run',
    '--config',
    'vitest.benchmark.config.ts',
  ], {
    VERITAS_BENCHMARK_OUTPUT: tsOutputPath,
  })
  run('cargo', [
    'bench',
    '--manifest-path',
    'engine-rs/Cargo.toml',
    '--offline',
    '--bench',
    'comparison',
  ], {
    VERITAS_BENCHMARK_FIXTURE: fixturePath,
    VERITAS_BENCHMARK_OUTPUT: rustOutputPath,
  })

  const typescript = readJson(tsOutputPath)
  const rust = readJson(rustOutputPath)
  const rows = compareResults(typescript, rust)
  const report = {
    schema: 'veritas-engine-comparison-v1',
    status: 'PASS',
    fixture: path.relative(repoRoot, fixturePath),
    typescript,
    rust,
    rows,
    environment: {
      node: version(process.execPath, ['--version']),
      rustc: version('rustc', ['--version']),
      cargo: version('cargo', ['--version']),
    },
  }
  fs.writeFileSync(path.join(artifactDir, 'engine-comparison-benchmark.json'), `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(reportPath, renderReport(rows, typescript))
  console.log(`RUST-002 PASS: ${rows.length} cenários com paridade de saída; relatório em ${path.relative(repoRoot, reportPath)}`)
} catch (error) {
  console.error(`RUST-002 FAIL: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
