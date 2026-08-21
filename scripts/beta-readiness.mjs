import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { READINESS_IDS, renderReadinessReport, sanitizeReadinessMessage } from './betaReadinessContract.mjs'

const REPORT_PATH = resolve(process.cwd(), process.env.BETA_READINESS_REPORT_PATH || `artifacts/beta-readiness-${Date.now()}.md`)
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))

function present(name) {
  return typeof process.env[name] === 'string' && process.env[name].trim().length > 0
}

function filesPresent(paths) {
  return paths.filter((path) => !existsSync(resolve(process.cwd(), path)))
}

function result(id, status, area, message) {
  return { id, status, area, message: sanitizeReadinessMessage(message) }
}

function main() {
  const results = []
  const supabaseReady = present('SUPABASE_URL') && present('SUPABASE_PUBLISHABLE_KEY')
  results.push(result('RDY-001', supabaseReady ? 'READY' : 'BLOCKED', 'Supabase público', supabaseReady ? 'SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY estão presentes; valores não foram lidos' : 'faltam SUPABASE_URL e/ou SUPABASE_PUBLISHABLE_KEY'))

  const rlsReady = present('RLS_RUNNER_ALLOW_REAL') && process.env.RLS_RUNNER_ALLOW_REAL === '1'
    && ['RLS_OWNER_EMAIL', 'RLS_OWNER_PASSWORD', 'RLS_OTHER_EMAIL', 'RLS_OTHER_PASSWORD', 'RLS_EDITOR_EMAIL', 'RLS_EDITOR_PASSWORD', 'RLS_VIEWER_EMAIL', 'RLS_VIEWER_PASSWORD'].every(present)
  results.push(result('RDY-002', rlsReady ? 'READY' : 'BLOCKED', 'quatro contas RLS', rlsReady ? 'guard real e quatro pares de credenciais estão presentes; valores não foram lidos' : 'exige RLS_RUNNER_ALLOW_REAL=1 e credenciais owner/other/editor/viewer'))

  const realtimeReady = present('REALTIME_RUNNER_ALLOW_REAL') && process.env.REALTIME_RUNNER_ALLOW_REAL === '1'
    && present('RT_REQUIRE_REAL') && process.env.RT_REQUIRE_REAL === '1'
    && ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'RT_PROJECT_ID', 'RT_ROOM_ID', 'RT_OWNER_ACCESS_TOKEN', 'RT_EDITOR_ACCESS_TOKEN', 'RT_VIEWER_ACCESS_TOKEN', 'RT_OTHER_ACCESS_TOKEN'].every(present)
  results.push(result('RDY-003', realtimeReady ? 'READY' : 'BLOCKED', 'Realtime cross-user', realtimeReady ? 'guard real, room e quatro tokens estão presentes; valores não foram lidos' : 'exige REALTIME_RUNNER_ALLOW_REAL=1, RT_REQUIRE_REAL=1, room e quatro tokens'))

  const edgeReady = present('RLS_EDGE_REQUIRE_AUTHENTICATED') && process.env.RLS_EDGE_REQUIRE_AUTHENTICATED === '1' && present('RLS_EDGE_ACCESS_TOKEN') && present('SUPABASE_URL')
  results.push(result('RDY-004', edgeReady ? 'READY' : 'BLOCKED', 'Edge autenticada', edgeReady ? 'endpoint, modo autenticado e JWT descartável estão presentes; valores não foram lidos' : 'exige SUPABASE_URL, RLS_EDGE_REQUIRE_AUTHENTICATED=1 e RLS_EDGE_ACCESS_TOKEN'))

  const evidenceMissing = filesPresent([
    'artifacts/rls-acceptance.md',
    'artifacts/realtime-acceptance.md',
    'artifacts/edge-acceptance.md',
    'artifacts/beta-evidence-manifest.json',
  ])
  results.push(result('RDY-005', evidenceMissing.length === 0 ? 'READY' : 'BLOCKED', 'artefatos de evidência', evidenceMissing.length === 0 ? 'artefatos esperados estão presentes; conteúdo não foi impresso' : `faltam ${evidenceMissing.length} artefatos: ${evidenceMissing.join(', ')}`))

  const versionReady = typeof packageJson.version === 'string' && /-beta\.\d+$/.test(packageJson.version)
  results.push(result('RDY-006', versionReady ? 'READY' : 'SKIP', 'janela de promoção', versionReady ? `package.json está na versão beta ${packageJson.version}` : `versão atual ${packageJson.version} não é beta; nenhuma promoção foi iniciada`))

  const ids = results.map((item) => item.id)
  if (ids.length !== READINESS_IDS.length || new Set(ids).size !== ids.length) throw new Error('IDs RDY incompletos ou duplicados')
  mkdirSync(dirname(REPORT_PATH), { recursive: true })
  const report = renderReadinessReport(results)
  writeFileSync(REPORT_PATH, report)
  console.log(report)
  console.log(`Relatório sanitizado: ${REPORT_PATH}`)
  if (results.some((item) => item.status === 'BLOCKED')) process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(`Readiness doctor abortado: ${sanitizeReadinessMessage(error)}`)
  process.exitCode = 1
}
