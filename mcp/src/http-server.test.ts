import { afterEach, describe, expect, it } from 'vitest'
import { buildProtectedResourceMetadata } from './protectedResourceMetadata'
import {
  VERITAS_MCP_HTTP_METADATA_PATH,
  VERITAS_MCP_HTTP_PROTOCOL_VERSION,
  createVeritasHttpServer,
  httpServerAddress,
  type VeritasHttpServerOptions,
} from './http-server'

const TOKEN = 'local-test-token'
const ORIGIN = 'https://allowed.test'
const ACCEPT = 'application/json, text/event-stream'

const baseOptions: VeritasHttpServerOptions = {
  port: 0,
  bearerToken: TOKEN,
  allowedOrigins: [ORIGIN],
}

const servers: ReturnType<typeof createVeritasHttpServer>[] = []

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          if (!server.listening) {
            resolve()
            return
          }
          server.close((error) => (error ? reject(error) : resolve()))
        }),
    ),
  )
})

async function startServer(options: Partial<VeritasHttpServerOptions> = {}) {
  const server = createVeritasHttpServer({ ...baseOptions, ...options })
  servers.push(server)
  if (!server.listening) await new Promise<void>((resolve) => server.once('listening', resolve))
  const { port } = httpServerAddress(server)
  return `http://127.0.0.1:${port}/mcp`
}

function headers(overrides: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    Accept: ACCEPT,
    Origin: ORIGIN,
    'MCP-Protocol-Version': VERITAS_MCP_HTTP_PROTOCOL_VERSION,
    ...overrides,
  }
}

function initializeBody(id = 1) {
  return {
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      protocolVersion: VERITAS_MCP_HTTP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'veritas-http-test', version: '1.0.0' },
    },
  }
}

describe('MCP-011 Streamable HTTP local', () => {
  it('negocia initialize em modo stateless e lista as ferramentas existentes', async () => {
    const url = await startServer()
    const mcpOptions = await fetch(url, { method: 'OPTIONS', headers: { Origin: ORIGIN } })
    expect(mcpOptions.status).toBe(204)
    expect(mcpOptions.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS')
    const initialize = await fetch(url, {
      method: 'POST',
      headers: headers({ 'Mcp-Method': 'initialize', 'Mcp-Name': 'veritas' }),
      body: JSON.stringify(initializeBody()),
    })

    expect(initialize.status).toBe(200)
    const initializeJson = (await initialize.json()) as { result?: { protocolVersion?: string } }
    expect(initializeJson.result?.protocolVersion).toBe(VERITAS_MCP_HTTP_PROTOCOL_VERSION)

    const tools = await fetch(url, {
      method: 'POST',
      headers: headers({ 'Mcp-Method': 'tools/list', 'Mcp-Name': 'veritas' }),
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    })
    expect(tools.status).toBe(200)
    const toolsJson = (await tools.json()) as { result?: { tools?: Array<{ name: string }> } }
    const names = toolsJson.result?.tools?.map((tool) => tool.name) ?? []
    expect(names).toContain('truth_table')
    expect(names).toContain('circuit_vector_truth_table')
    expect(names).toContain('export_circuit_hdl')
  })

  it('mantém uma resposta de ferramenta equivalente ao golden local', async () => {
    const url = await startServer()
    const response = await fetch(url, {
      method: 'POST',
      headers: headers({ 'Mcp-Method': 'tools/call', 'Mcp-Name': 'veritas' }),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'truth_table',
          arguments: { expression: 'A XOR B', include_steps: false, notation: 'text', max_rows: 4 },
        },
      }),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { result?: { content?: Array<{ text?: string }> } }
    const text = json.result?.content?.[0]?.text ?? ''
    expect(text).toContain('| A | B | A XOR B |')
    expect(text).toContain('| 1 | 1 | 0 |')
  })

  it('rejeita credencial ausente, Origin inválida e headers MCP incompletos', async () => {
    const url = await startServer()
    const body = JSON.stringify(initializeBody())

    const missingToken = await fetch(url, {
      method: 'POST',
      headers: headers({ Authorization: '', 'Mcp-Method': 'initialize' }),
      body,
    })
    expect(missingToken.status).toBe(401)

    const invalidOrigin = await fetch(url, {
      method: 'POST',
      headers: headers({ Origin: 'https://not-allowed.test' }),
      body,
    })
    expect(invalidOrigin.status).toBe(403)

    const missingProtocol = await fetch(url, {
      method: 'POST',
      headers: headers({ 'MCP-Protocol-Version': '' }),
      body,
    })
    expect(missingProtocol.status).toBe(400)
  })

  it('rejeita GET, divergência de header/body e payload acima do limite', async () => {
    const url = await startServer({ maxBodyBytes: 512 })
    const body = JSON.stringify(initializeBody())

    const get = await fetch(url, { method: 'GET', headers: headers() })
    expect(get.status).toBe(405)

    const mismatch = await fetch(url, {
      method: 'POST',
      headers: headers({ 'Mcp-Method': 'tools/list' }),
      body,
    })
    expect(mismatch.status).toBe(400)
    expect(await mismatch.text()).toContain('HeaderMismatch')

    const invalidJson = await fetch(url, {
      method: 'POST',
      headers: headers(),
      body: '{',
    })
    expect(invalidJson.status).toBe(400)
    expect(await invalidJson.text()).toContain('JSON-RPC inválido')

    const oversized = await fetch(url, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ...initializeBody(), padding: 'x'.repeat(768) }),
    })
    expect(oversized.status).toBe(413)
  })

  it('mantém metadata 404 por padrão e serve JSON somente quando configurada', async () => {
    const defaultUrl = await startServer()
    const defaultMetadata = await fetch(defaultUrl.replace('/mcp', VERITAS_MCP_HTTP_METADATA_PATH), {
      method: 'GET',
      headers: { Origin: ORIGIN },
    })
    expect(defaultMetadata.status).toBe(404)

    const metadata = buildProtectedResourceMetadata({
      resource: 'http://127.0.0.1:8787/mcp',
      authorization_servers: ['https://auth.example/realms/veritas'],
      scopes_supported: ['circuit:read'],
    })
    const configuredUrl = await startServer({ protectedResourceMetadata: metadata })
    const metadataUrl = configuredUrl.replace('/mcp', VERITAS_MCP_HTTP_METADATA_PATH)
    const response = await fetch(metadataUrl, { method: 'GET', headers: { Origin: ORIGIN } })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS')
    expect(response.headers.get('vary')).toBe('Origin')
    expect(await response.json()).toEqual(metadata)

    const options = await fetch(metadataUrl, { method: 'OPTIONS', headers: { Origin: ORIGIN } })
    expect(options.status).toBe(204)
    expect(options.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS')

    const missingBearerOnMcp = await fetch(configuredUrl, {
      method: 'POST',
      headers: { ...headers({ Authorization: '' }), 'Mcp-Method': 'initialize', 'Mcp-Name': 'veritas' },
      body: JSON.stringify(initializeBody()),
    })
    expect(missingBearerOnMcp.status).toBe(401)
  })

  it('protege a rota de metadata com Origin e método explícitos', async () => {
    const metadata = buildProtectedResourceMetadata({
      resource: 'https://veritas.example/mcp',
      authorization_servers: ['https://auth.example'],
    })
    const url = (await startServer({ protectedResourceMetadata: metadata })).replace('/mcp', VERITAS_MCP_HTTP_METADATA_PATH)

    const missingOrigin = await fetch(url)
    expect(missingOrigin.status).toBe(403)

    const post = await fetch(url, { method: 'POST', headers: { Origin: ORIGIN } })
    expect(post.status).toBe(405)
    expect(post.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS')
  })

  it('exige configuração segura e nunca aceita token vazio ou Origin curinga', () => {
    expect(() => createVeritasHttpServer({ ...baseOptions, bearerToken: ' ' })).toThrow(
      'Bearer token MCP é obrigatório.',
    )
    expect(() => createVeritasHttpServer({ ...baseOptions, allowedOrigins: [] })).toThrow(
      'É necessária uma allowlist de Origin MCP.',
    )
    expect(() => createVeritasHttpServer({ ...baseOptions, path: VERITAS_MCP_HTTP_METADATA_PATH })).toThrow(
      'O path MCP não pode coincidir com a rota reservada de metadata.',
    )
    expect(() =>
      createVeritasHttpServer({
        ...baseOptions,
        protectedResourceMetadata: {
          resource: 'https://veritas.example/mcp',
          authorization_servers: ['https://auth.example'],
          bearer_methods_supported: ['body'],
        } as never,
      }),
    ).toThrow('Protected Resource Metadata inválida.')
  })
})
