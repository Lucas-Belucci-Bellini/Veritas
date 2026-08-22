import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const manifest = path.join(root, 'engine-rs', 'Cargo.toml')
const reportDir = path.join(root, 'artifacts')
const reportPath = path.join(reportDir, `rust-engine-acceptance-${Date.now()}.md`)

const checks = [
  {
    id: 'RUST-001',
    label: 'formatação reprodutível',
    args: ['fmt', '--manifest-path', manifest, '--', '--check'],
  },
  {
    id: 'RUST-002',
    label: 'testes do núcleo determinístico',
    args: ['test', '--manifest-path', manifest, '--offline'],
  },
]

const lines = [`# Rust engine acceptance ${new Date().toISOString()}`, '', 'O relatório contém somente resultados de build/teste e caminhos locais; não contém credenciais ou dados de usuários.', '']
let failures = 0

for (const check of checks) {
  const result = spawnSync('cargo', check.args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  if (result.status === 0) {
    lines.push(`${check.id} PASS — ${check.label}`)
  } else {
    failures += 1
    lines.push(`${check.id} FAIL — ${check.label}`)
    if (output) lines.push('```text', output.slice(-4000), '```')
  }
}

lines.push('', `Resumo: ${checks.length - failures} PASS, ${failures} FAIL, 0 SKIP.`)
await mkdir(reportDir, { recursive: true })
await writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8')
console.log(lines.join('\n'))
console.log(`Relatório sanitizado: ${reportPath}`)
if (failures > 0) process.exitCode = 1
