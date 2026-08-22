import { execFile } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const REPORT_PATH = resolve(process.cwd(), process.env.MCP_HTTP_REPORT_PATH || `artifacts/mcp-http-acceptance-${Date.now()}.md`)
const TOKEN = 'mcp-http-acceptance-token'
const ORIGIN = 'https://allowed.test'
const ACCEPT = 'application/json, text/event-stream'
const PROTOCOL_VERSION = '2025-11-25'
const HTTP_ENTRY = resolve(process.cwd(), 'mcp/dist/http-server.js')

const results = []

function sanitize(value) {
  return String(value ?? '')
    .replace(/(token|password|secret|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
}

function result(id, status, operation, message) {
  results.push({ id, status, operation, message: sanitize(message) })
}

function headers(overrides = {}) {
  return {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    Accept: ACCEPT,
    Origin: ORIGIN,
    'MCP-Protocol-Version': PROTOCOL_VERSION,
    ...overrides,
  }
}

function initializeBody(id = 1) {
  return {
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'veritas-http-acceptance', version: '1.0.0' },
    },
  }
}

function startServer(envOverrides = {}) {
  const child = execFile('node', [HTTP_ENTRY], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VERITAS_MCP_HTTP_HOST: '127.0.0.1',
      VERITAS_MCP_HTTP_PORT: '0',
      VERITAS_MCP_HTTP_PATH: '/mcp',
      VERITAS_MCP_HTTP_BEARER_TOKEN: TOKEN,
      VERITAS_MCP_HTTP_ALLOWED_ORIGINS: ORIGIN,
      ...envOverrides,
    },
  })

  return new Promise((resolveServer, rejectServer) => {
    let stderr = ''
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      rejectServer(new Error('Servidor HTTP MCP não iniciou no prazo.'))
    }, 10_000)

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
      const match = stderr.match(/Veritas MCP HTTP local em http:\/\/127\.0\.0\.1:(\d+)\/mcp/)
      if (match) {
        clearTimeout(timeout)
        resolveServer({ child, url: `http://127.0.0.1:${match[1]}/mcp` })
      }
    })
    child.once('error', (error) => {
      clearTimeout(timeout)
      rejectServer(error)
    })
    child.once('exit', (code, signal) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout)
        rejectServer(new Error(`Servidor HTTP terminou com code=${code}, signal=${signal ?? 'none'}`))
      }
    })
  })
}

function rejectsStartup(envOverrides) {
  const child = execFile('node', [HTTP_ENTRY], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VERITAS_MCP_HTTP_HOST: '127.0.0.1',
      VERITAS_MCP_HTTP_PORT: '0',
      VERITAS_MCP_HTTP_PATH: '/mcp',
      VERITAS_MCP_HTTP_BEARER_TOKEN: TOKEN,
      VERITAS_MCP_HTTP_ALLOWED_ORIGINS: ORIGIN,
      ...envOverrides,
    },
  })
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      if (!child.killed) child.kill('SIGTERM')
      resolve(value)
    }
    child.once('error', () => finish(true))
    child.once('close', (code) => finish(code !== 0))
    setTimeout(() => finish(false), 1500)
  })
}

async function stopServer(child) {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  await new Promise((resolveStop) => child.once('exit', resolveStop))
}

async function main() {
  mkdirSync(dirname(REPORT_PATH), { recursive: true })
  let server
  let metadataServer
  try {
    server = await startServer()

    const options = await fetch(server.url, { method: 'OPTIONS', headers: { Origin: ORIGIN } })
    result('MCP-011-HTTP-001', options.status === 204 ? 'PASS' : 'FAIL', 'CORS e método permitido', `OPTIONS retorna ${options.status}`)

    const noAuth = await fetch(server.url, {
      method: 'POST',
      headers: headers({ Authorization: '' }),
      body: JSON.stringify(initializeBody()),
    })
    result('MCP-011-HTTP-002', noAuth.status === 401 ? 'PASS' : 'FAIL', 'Bearer obrigatório', `request sem Bearer retorna ${noAuth.status}`)

    const badOrigin = await fetch(server.url, {
      method: 'POST',
      headers: headers({ Origin: 'https://not-allowed.test' }),
      body: JSON.stringify(initializeBody()),
    })
    result('MCP-011-HTTP-003', badOrigin.status === 403 ? 'PASS' : 'FAIL', 'Origin allowlist', `Origin inválida retorna ${badOrigin.status}`)

    const get = await fetch(server.url, { method: 'GET', headers: headers() })
    result('MCP-011-HTTP-004', get.status === 405 ? 'PASS' : 'FAIL', 'método HTTP', `GET retorna ${get.status}`)

    const initialize = await fetch(server.url, {
      method: 'POST',
      headers: headers({ 'Mcp-Method': 'initialize', 'Mcp-Name': 'veritas' }),
      body: JSON.stringify(initializeBody()),
    })
    const initializeJson = await initialize.json()
    const negotiated = initializeJson?.result?.protocolVersion
    result('MCP-011-HTTP-005', initialize.status === 200 && negotiated === PROTOCOL_VERSION ? 'PASS' : 'FAIL', 'initialize Streamable HTTP', `status=${initialize.status}, protocol=${negotiated ?? 'ausente'}`)

    const toolCall = await fetch(server.url, {
      method: 'POST',
      headers: headers({ 'Mcp-Method': 'tools/call', 'Mcp-Name': 'veritas' }),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'truth_table', arguments: { expression: 'A XOR B', include_steps: false, notation: 'text', max_rows: 4 } },
      }),
    })
    const toolJson = await toolCall.json()
    const toolText = toolJson?.result?.content?.[0]?.text ?? ''
    const equivalent = toolCall.status === 200 && toolText.includes('| A | B | A XOR B |') && toolText.includes('| 1 | 1 | 0 |')
    result('MCP-011-HTTP-006', equivalent ? 'PASS' : 'FAIL', 'equivalência com golden stdio', `status=${toolCall.status}, golden=${equivalent}`)

    const mismatch = await fetch(server.url, {
      method: 'POST',
      headers: headers({ 'Mcp-Method': 'tools/list' }),
      body: JSON.stringify(initializeBody(3)),
    })
    const mismatchText = await mismatch.text()
    result('MCP-011-HTTP-007', mismatch.status === 400 && mismatchText.includes('HeaderMismatch') ? 'PASS' : 'FAIL', 'HeaderMismatch', `status=${mismatch.status}, headerMismatch=${mismatchText.includes('HeaderMismatch')}`)

    const invalidJson = await fetch(server.url, {
      method: 'POST',
      headers: headers(),
      body: '{',
    })
    const invalidJsonText = await invalidJson.text()
    result('MCP-011-HTTP-008', invalidJson.status === 400 && invalidJsonText.includes('JSON-RPC inválido') ? 'PASS' : 'FAIL', 'JSON inválido', `status=${invalidJson.status}, invalidJson=${invalidJsonText.includes('JSON-RPC inválido')}`)

    const oversized = await fetch(server.url, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ...initializeBody(4), padding: 'x'.repeat(1_050_000) }),
    })
    result('MCP-011-HTTP-009', oversized.status === 413 ? 'PASS' : 'FAIL', 'limite de payload', `payload excedente retorna ${oversized.status}`)

    const metadataPath = '/.well-known/oauth-protected-resource'
    const defaultMetadata = await fetch(server.url.replace('/mcp', metadataPath), {
      method: 'GET',
      headers: { Origin: ORIGIN },
    })
    result('MCP-013-HTTP-001', defaultMetadata.status === 404 ? 'PASS' : 'FAIL', 'metadata desabilitada por padrão', `rota padrão retorna ${defaultMetadata.status}`)

    metadataServer = await startServer({
      VERITAS_MCP_HTTP_RESOURCE: 'https://veritas.example/mcp',
      VERITAS_MCP_HTTP_AUTHORIZATION_SERVERS: 'https://auth.example/realms/veritas',
      VERITAS_MCP_HTTP_SCOPES: 'circuit:read',
    })
    const metadataResponse = await fetch(metadataServer.url.replace('/mcp', metadataPath), {
      method: 'GET',
      headers: { Origin: ORIGIN },
    })
    const metadataJson = await metadataResponse.json()
    const metadataOk = metadataResponse.status === 200 && metadataJson?.resource === 'https://veritas.example/mcp' && metadataJson?.authorization_servers?.[0] === 'https://auth.example/realms/veritas'
    result('MCP-013-HTTP-002', metadataOk ? 'PASS' : 'FAIL', 'metadata opt-in', `status=${metadataResponse.status}, metadata=${metadataOk}`)

    const metadataMethodsOk = metadataResponse.headers.get('access-control-allow-methods') === 'GET, OPTIONS' && metadataResponse.headers.get('vary') === 'Origin'
    result('MCP-014-HTTP-001', metadataMethodsOk ? 'PASS' : 'FAIL', 'CORS da metadata', 'metadata anuncia somente GET, OPTIONS e Vary: Origin')

    const mcpOptions = await fetch(metadataServer.url.replace('/mcp', '/mcp'), {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN },
    })
    result('MCP-014-HTTP-002', mcpOptions.status === 204 && mcpOptions.headers.get('access-control-allow-methods') === 'POST, OPTIONS' ? 'PASS' : 'FAIL', 'CORS do MCP', 'endpoint protegido mantém somente POST, OPTIONS')

    const metadataMissingOrigin = await fetch(metadataServer.url.replace('/mcp', metadataPath), { method: 'GET' })
    result('MCP-013-HTTP-003', metadataMissingOrigin.status === 403 ? 'PASS' : 'FAIL', 'Origin da metadata', `Origin ausente retorna ${metadataMissingOrigin.status}`)

    const metadataPost = await fetch(metadataServer.url.replace('/mcp', metadataPath), {
      method: 'POST',
      headers: { Origin: ORIGIN },
    })
    result('MCP-014-HTTP-003', metadataPost.status === 405 && metadataPost.headers.get('access-control-allow-methods') === 'GET, OPTIONS' ? 'PASS' : 'FAIL', 'método da metadata', 'POST permanece 405 e não é anunciado pelo CORS')

    const partialMetadataRejected = await rejectsStartup({
      VERITAS_MCP_HTTP_RESOURCE: 'https://veritas.example/mcp',
    })
    result('MCP-013-HTTP-004', partialMetadataRejected ? 'PASS' : 'FAIL', 'metadata parcial', 'processo rejeita configuração sem authorization servers')

    const insecureMetadataRejected = await rejectsStartup({
      VERITAS_MCP_HTTP_RESOURCE: 'http://veritas.example/mcp',
      VERITAS_MCP_HTTP_AUTHORIZATION_SERVERS: 'https://auth.example',
    })
    result('MCP-013-HTTP-005', insecureMetadataRejected ? 'PASS' : 'FAIL', 'metadata HTTPS', 'processo rejeita recurso remoto sem HTTPS')
  } catch (error) {
    result('MCP-014-HTTP-004', 'FAIL', 'runner HTTP', error instanceof Error ? error.message : 'erro desconhecido')
  } finally {
    if (metadataServer) await stopServer(metadataServer.child)
    if (server) await stopServer(server.child)
  }

  const lines = [
    `# MCP-011 + MCP-013 + MCP-014 HTTP acceptance ${new Date().toISOString()}`,
    '',
    'O ensaio usa somente localhost, token efêmero do processo, Origin allowlist e dados determinísticos; nenhum segredo é persistido.',
    '',
    ...results.map((item) => `${item.id} ${item.status} — ${item.operation}: ${item.message}`),
    '',
    `Resumo: ${results.filter((item) => item.status === 'PASS').length} PASS, ${results.filter((item) => item.status === 'FAIL').length} FAIL, ${results.filter((item) => item.status === 'SKIP').length} SKIP.`,
  ]
  const report = `${lines.join('\n')}\n`
  writeFileSync(REPORT_PATH, report)
  console.log(report)
  console.log(`Relatório sanitizado: ${REPORT_PATH}`)
  if (results.some((item) => item.status === 'FAIL')) process.exitCode = 1
}

main().catch((error) => {
  console.error(`MCP HTTP runner abortado: ${sanitize(error instanceof Error ? error.message : error)}`)
  process.exitCode = 1
})
