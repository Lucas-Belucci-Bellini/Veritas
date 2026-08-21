import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import {
  edgeEndpoint,
  isSuccessfulAnalysisStatus,
  isUnauthorizedStatus,
  sanitizeEdgeMessage,
} from './edgeAcceptanceContract.mjs'

function env(name, required = true) {
  const value = process.env[name]?.trim()
  if (!value && required) throw new Error(`Variável obrigatória ausente: ${name}`)
  return value ?? ''
}

function reportPath() {
  return resolve(process.cwd(), process.env.RLS_EDGE_REPORT_PATH || `artifacts/edge-acceptance-${Date.now()}.md`)
}

function context() {
  return {
    circuitName: 'beta-edge-smoke',
    summary: 'Fixture descartável do smoke de autenticação da Edge Function.',
    payload: {
      document: {
        format: 'veritas-circuit',
        version: 1,
        name: 'beta-edge-smoke',
        nodes: [{ id: 'input-a', type: 'input', position: { x: 0, y: 0 } }],
        connections: [],
      },
    },
  }
}

async function request(endpoint, token, body) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: sanitizeEdgeMessage(await response.text()) }
}

function result(id, status, message, operation) {
  return { id, status, message: sanitizeEdgeMessage(message), operation }
}

async function main() {
  const projectUrl = env('SUPABASE_URL')
  const endpoint = process.env.RLS_EDGE_FUNCTION_URL?.trim() || edgeEndpoint(projectUrl, process.env.RLS_EDGE_FUNCTION_SLUG?.trim() || 'veritas-circuit-ai')
  const results = []

  const anonymous = await request(endpoint, '', { action: 'analyze', context: context() })
  results.push(result(
    'RLS-019',
    isUnauthorizedStatus(anonymous.status) ? 'PASS' : 'FAIL',
    `sem JWT respondeu HTTP ${anonymous.status}`,
    endpoint,
  ))

  const accessToken = process.env.RLS_EDGE_ACCESS_TOKEN?.trim() || ''
  const authenticatedRequired = process.env.RLS_EDGE_REQUIRE_AUTHENTICATED === '1'
  if (!accessToken) {
    results.push(result('RLS-020', authenticatedRequired ? 'FAIL' : 'SKIP', authenticatedRequired ? 'RLS_EDGE_ACCESS_TOKEN ausente no modo obrigatório' : 'token de teste não fornecido', 'análise autenticada'))
    results.push(result('RLS-021', authenticatedRequired ? 'FAIL' : 'SKIP', authenticatedRequired ? 'RLS_EDGE_ACCESS_TOKEN ausente no modo obrigatório' : 'token de teste não fornecido', 'tentativa de elevação'))
  } else {
    const authenticated = await request(endpoint, accessToken, { action: 'analyze', context: context() })
    results.push(result(
      'RLS-020',
      isSuccessfulAnalysisStatus(authenticated.status) ? 'PASS' : 'FAIL',
      `JWT de teste respondeu HTTP ${authenticated.status}`,
      'análise autenticada',
    ))

    const abuse = await request(endpoint, accessToken, {
      action: 'analyze',
      user_id: process.env.RLS_EDGE_ABUSE_USER_ID || 'other-user-id',
      project_id: process.env.RLS_EDGE_ABUSE_PROJECT_ID || 'other-project-id',
      context: context(),
    })
    const bodyDoesNotEchoForeignIdentity = !abuse.body.includes(process.env.RLS_EDGE_ABUSE_USER_ID || 'other-user-id')
      && !abuse.body.includes(process.env.RLS_EDGE_ABUSE_PROJECT_ID || 'other-project-id')
    results.push(result(
      'RLS-021',
      (isSuccessfulAnalysisStatus(abuse.status) && bodyDoesNotEchoForeignIdentity) || isUnauthorizedStatus(abuse.status) ? 'PASS' : 'FAIL',
      `tentativa de elevação respondeu HTTP ${abuse.status}`,
      'tentativa de elevação',
    ))
  }

  const report = [
    `# Edge acceptance ${new Date().toISOString()}`,
    '',
    'Execution mode: REAL',
    `Authenticated mode: ${authenticatedRequired && accessToken ? 'REAL_REQUIRED' : 'ANONYMOUS_ONLY'}`,
    `Authenticated disposable JWT: ${accessToken ? 'provided' : 'missing'}`,
    'Tokens não são gravados neste relatório.',
    '',
    ...results.map((item) => `${item.id} ${item.status} — ${item.operation}: ${item.message}`),
    '',
    `Resumo: ${results.filter((item) => item.status === 'PASS').length} PASS, ${results.filter((item) => item.status === 'FAIL').length} FAIL, ${results.filter((item) => item.status === 'SKIP').length} SKIP.`,
  ].join('\n')
  const outputFile = reportPath()
  mkdirSync(dirname(outputFile), { recursive: true })
  writeFileSync(outputFile, `${report}\n`)
  console.log(report)
  console.log(`Relatório sanitizado: ${outputFile}`)
  if (results.some((item) => item.status === 'FAIL')) process.exitCode = 1
}

main().catch((error) => {
  console.error(`Edge runner abortado: ${sanitizeEdgeMessage(error)}`)
  process.exitCode = 1
})
