import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const artifactDir = path.resolve(repoRoot, process.env.BENCHMARK_ARTIFACT_DIR ?? 'artifacts')
const rawOutputPath = path.join(artifactDir, 'logic-scale-measurements.json')
const reportJsonPath = path.join(artifactDir, 'logic-scale-benchmark.json')
const reportMarkdownPath = path.join(artifactDir, 'logic-scale-benchmark.md')
const configPath = path.join(repoRoot, 'vitest.logic-scale.config.ts')

fs.mkdirSync(artifactDir, { recursive: true })

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim().slice(-5000)
    throw new Error(`${command} exited with ${result.status}${details ? `\n${details}` : ''}`)
  }
  return result
}

function version(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : 'unavailable'
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function formatNs(value) {
  return `${(Number(value) / 1e6).toFixed(3)} ms`
}

function renderMeasurement(measurement) {
  if (measurement.status === 'MEASURED') {
    return [
      measurement.gates,
      measurement.nodes,
      measurement.connections,
      measurement.status,
      measurement.iterations,
      measurement.total_ticks,
      formatNs(measurement.elapsed_ns),
      formatNs(measurement.average_ns_per_tick),
      `${measurement.rss_before_kb} → ${measurement.rss_after_kb} kB`,
      'PASS',
    ]
  }
  return [
    measurement.gates,
    measurement.nodes,
    measurement.connections,
    measurement.status,
    '—',
    '—',
    'NOT VERIFIED',
    'NOT VERIFIED',
    'NOT VERIFIED',
    '—',
  ]
}

function renderMeasurementTable(title, measurements) {
  const lines = [
    `### ${title}`,
    '',
    '| Gates | Nós | Conexões | Estado | Iterações | Ticks | Tempo total | Média/tick | RSS Node antes → depois | Saída |',
    '| ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- |',
  ]
  for (const measurement of measurements) {
    lines.push(`| ${renderMeasurement(measurement).join(' | ')} |`)
  }
  return lines
}

function renderReport(report) {
  const documentMeasured = report.document_measurements.filter((measurement) => measurement.status === 'MEASURED')
  const documentUnsupported = report.document_measurements.filter((measurement) => measurement.status !== 'MEASURED')
  const lines = [
    '# BENCH-002 — capacidade bruta do Simulator em escala de gates',
    '',
    `- **Status:** BASELINE RECORDED — runtime bruto medido em ${report.raw_netlist_measurements.length} alvos; caminho de produto medido em ${documentMeasured.length} e não suportado em ${documentUnsupported.length}.`,
    '- **Topologia:** `input → N × NOT → output`, gerada deterministicamente; não há aleatoriedade nem dados simulados.',
    '- **Caminho de produto:** `CircuitDocument → toNetlist → createDocumentRuntime`/`Simulator`; os limites oficiais do documento são preservados.',
    '- **Caminho de capacidade:** `Netlist → Simulator`; mede somente a capacidade do runtime bruto e não transforma esse resultado em suporte do editor, storage ou formato `.veritas`.',
    '- **Medição:** a janela inclui `setInput` e `tick`, e exclui construção, validação, netlist e inicialização do runtime. O aquecimento fica fora da janela.',
    `- **Node:** ${report.environment.node}; **plataforma:** ${report.environment.platform}/${report.environment.arch}; **CPU:** ${report.environment.cpu}.`,
    `- **Versão do projeto:** ${report.environment.package_version}.`,
    '',
    ...renderMeasurementTable('CircuitDocument — suporte do produto', report.document_measurements),
    '',
    ...renderMeasurementTable('Netlist bruto — capacidade do Simulator', report.raw_netlist_measurements),
    '',
    '## Limites e interpretação',
    '',
    'O caminho `CircuitDocument` continua bloqueando 500, 1000 e 5000 gates porque uma cadeia linear exige 502, 1002 e 5002 nós, acima do limite atual de 256 nós; 1000 e 5000 também excedem o limite de 512 conexões. Esses alvos são **NOT SUPPORTED** no produto.',
    '',
    'O caminho Netlist bruto mediu os cinco alvos para identificar a capacidade do Simulator, mas isso não equivale a suporte oficial: ainda faltam contratos de documento, editor, persistência, import/export, renderização e UX para circuitos grandes.',
    '',
    'O RSS é uma amostra do processo Node e não representa memória isolada do simulador. Renderização/FPS, memória de simulação interativa no desktop, startup nativo, tamanho instalado e comparação entre sistemas operacionais permanecem **NOT VERIFIED** neste benchmark.',
    '',
    'Números brutos só são comparáveis com execuções repetidas na mesma máquina, sistema operacional, arquitetura, versão do Node e estado equivalente do processo. Esta baseline não promove uma release estável.',
    '',
  ]
  return `${lines.join('\n')}\n`
}

try {
  run(path.join(repoRoot, 'node_modules/.bin/vitest'), ['run', '--config', configPath], {
    VERITAS_LOGIC_SCALE_OUTPUT: rawOutputPath,
  })
  const raw = readJson(rawOutputPath)
  const packageJson = readJson(path.join(repoRoot, 'package.json'))
  const report = {
    schema: 'veritas-logic-scale-benchmark-v2',
    benchmark_id: 'BENCH-002',
    status: 'BASELINE_RECORDED',
    benchmark: raw.benchmark,
    topology: 'deterministic-not-chain',
    document_warmup_iterations: raw.document_warmup_iterations,
    document_measured_iterations: raw.document_measured_iterations,
    raw_warmup_iterations: raw.raw_warmup_iterations,
    document_measurements: raw.document_measurements,
    raw_netlist_measurements: raw.raw_netlist_measurements,
    environment: {
      node: version(process.execPath, ['--version']),
      platform: process.platform,
      arch: process.arch,
      cpu: os.cpus()[0]?.model ?? 'unavailable',
      package_version: packageJson.version,
    },
    limitations: {
      rendering_fps: 'NOT VERIFIED',
      desktop_interactive_simulation_memory: 'NOT VERIFIED',
      native_startup: 'NOT VERIFIED',
      installed_size: 'NOT VERIFIED',
      cross_platform_comparison: 'NOT VERIFIED',
      official_large_document_support: 'NOT VERIFIED',
    },
  }
  fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(reportMarkdownPath, renderReport(report))
  console.log(`BENCH-002 BASELINE RECORDED: relatório em ${path.relative(repoRoot, reportMarkdownPath)}`)
} catch (error) {
  console.error(`BENCH-002 FAIL: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
