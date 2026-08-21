import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { ROLLBACK_ACCEPTANCE_IDS, renderRollbackReport, sanitizeRollbackMessage } from './rollbackAcceptanceContract.mjs'

const REPORT_PATH = resolve(process.cwd(), process.env.ROLLBACK_REPORT_PATH || `artifacts/rollback-acceptance-${Date.now()}.md`)
const CURRENT_TAG = process.env.ROLLBACK_CURRENT_TAG || 'v0.9.0-rc.1'

function run(command, args) {
  try {
    return { status: 0, output: execFileSync(command, args, { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }) }
  } catch (error) {
    return { status: typeof error?.status === 'number' ? error.status : 1, output: [error?.stdout, error?.stderr, error?.message].filter(Boolean).join('\n') }
  }
}

function read(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function result(id, status, operation, message) {
  return { id, status, operation, message: sanitizeRollbackMessage(message) }
}

function immutableTagCheck() {
  const tag = run('git', ['rev-parse', '--verify', `${CURRENT_TAG}^{commit}`])
  const commit = run('git', ['rev-list', '-n', '1', CURRENT_TAG])
  if (tag.status !== 0 || commit.status !== 0 || tag.output.trim() !== commit.output.trim()) {
    return result('RB-001', 'FAIL', 'tag atual imutável e resolvível', `A tag ${CURRENT_TAG} não pôde ser resolvida de forma determinística`)
  }
  return result('RB-001', 'PASS', 'tag atual imutável e resolvível', `${CURRENT_TAG} resolve para ${commit.output.trim()}`)
}

function previousCommitCheck() {
  const previous = run('git', ['rev-parse', `${CURRENT_TAG}^`])
  const tags = run('git', ['tag', '--sort=-creatordate'])
  const previousRelease = tags.output.split('\n').map((tag) => tag.trim()).filter(Boolean).find((tag) => tag !== CURRENT_TAG)
  const previousTag = previousRelease ? run('git', ['rev-parse', '--verify', previousRelease]) : { status: 1, output: '' }
  if (previous.status !== 0 || previousTag.status !== 0) {
    return result('RB-002', 'FAIL', 'commit anterior recuperável', `Não foi possível resolver parent de ${CURRENT_TAG} e uma release anterior`)
  }
  return result('RB-002', 'PASS', 'commit anterior recuperável', `${CURRENT_TAG} tem parent ${previous.output.trim()} e release anterior ${previousRelease} em ${previousTag.output.trim()}`)
}

function runbookCheck() {
  const source = read('docs/ROLLBACK-RUNBOOK.md')
  const required = ['não mova tags', 'não apague', 'IndexedDB', 'smoke:release', 'versão restaurada', 'P0', 'P1']
  const missing = required.filter((item) => !source.toLowerCase().includes(item.toLowerCase()))
  return result('RB-003', missing.length === 0 ? 'PASS' : 'FAIL', 'runbook operacional de rollback', missing.length === 0 ? 'runbook contém as salvaguardas e passos de recuperação' : `runbook sem: ${missing.join(', ')}`)
}

function recoveryTests() {
  const test = run('npm', ['test', '--', '--run', 'src/storage/projects.test.ts', 'src/cloud/circuitVersions.test.ts'])
  return result('RB-004', test.status === 0 ? 'PASS' : 'FAIL', 'preservação local e histórico remoto', test.status === 0 ? 'IndexedDB e histórico de versões passaram seus testes de recuperação' : test.output)
}

function workflowInvariantCheck() {
  const source = read('.github/workflows/release.yml')
  const required = ['fetch-depth: 0', 'git rev-list -n 1', 'A tag $VERSION já existe', '--verify-tag', 'contents: write']
  const missing = required.filter((item) => !source.includes(item))
  return result('RB-005', missing.length === 0 ? 'PASS' : 'FAIL', 'invariantes do workflow de release', missing.length === 0 ? 'workflow valida refs e publica sem reescrever tag existente' : `workflow sem: ${missing.join(', ')}`)
}

function main() {
  const results = [immutableTagCheck(), previousCommitCheck(), runbookCheck(), recoveryTests(), workflowInvariantCheck()]
  const ids = results.map((item) => item.id)
  if (ids.length !== ROLLBACK_ACCEPTANCE_IDS.length || new Set(ids).size !== ids.length) throw new Error('IDs RB incompletos ou duplicados')
  mkdirSync(dirname(REPORT_PATH), { recursive: true })
  const report = renderRollbackReport(results)
  writeFileSync(REPORT_PATH, report)
  console.log(report)
  console.log(`Relatório sanitizado: ${REPORT_PATH}`)
  if (results.some((item) => item.status === 'FAIL')) process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(`Rollback runner abortado: ${sanitizeRollbackMessage(error)}`)
  process.exitCode = 1
}
