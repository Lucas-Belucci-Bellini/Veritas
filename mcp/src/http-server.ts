import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  protectedResourceMetadataSchema,
  type ProtectedResourceMetadata,
} from './protectedResourceMetadata'
import { createVeritasServer } from './server'

export const VERITAS_MCP_HTTP_PROTOCOL_VERSION = '2025-11-25'
export const VERITAS_MCP_HTTP_DEFAULT_PATH = '/mcp'
export const VERITAS_MCP_HTTP_METADATA_PATH = '/.well-known/oauth-protected-resource'
export const VERITAS_MCP_HTTP_DEFAULT_MAX_BODY_BYTES = 1_048_576
export const VERITAS_MCP_HTTP_DEFAULT_REQUEST_TIMEOUT_MS = 30_000

export interface VeritasHttpServerOptions {
  host?: string
  port?: number
  path?: string
  bearerToken: string
  allowedOrigins: readonly string[]
  maxBodyBytes?: number
  requestTimeoutMs?: number
  protectedResourceMetadata?: ProtectedResourceMetadata
}

interface HttpConfig {
  path: string
  bearerToken: string
  allowedOrigins: readonly string[]
  maxBodyBytes: number
  protectedResourceMetadata?: ProtectedResourceMetadata
}

class HttpRequestError extends Error {
  constructor(
    readonly statusCode: number,
    readonly errorCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpRequestError'
  }
}

function errorResponse(
  res: ServerResponse,
  statusCode: number,
  errorCode: number,
  message: string,
  headers: Record<string, string> = {},
): void {
  if (res.headersSent) {
    res.end()
    return
  }
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  })
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: errorCode, message }, id: null }))
}

function originHeader(req: IncomingMessage): string | undefined {
  const value = req.headers.origin
  return typeof value === 'string' ? value : undefined
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers':
      'Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'Origin',
  }
}

function metadataCorsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'Accept',
    'access-control-allow-methods': 'GET, OPTIONS',
    vary: 'Origin',
  }
}

function validateOrigin(req: IncomingMessage, config: HttpConfig): string {
  const origin = originHeader(req)
  if (!origin || !config.allowedOrigins.includes(origin)) {
    throw new HttpRequestError(403, -32003, 'Origin não autorizada.')
  }
  return origin
}

function validateBearer(req: IncomingMessage, config: HttpConfig): void {
  const authorization = req.headers.authorization
  if (authorization !== `Bearer ${config.bearerToken}`) {
    throw new HttpRequestError(401, -32001, 'Bearer inválido ou ausente.')
  }
}

function validateHeaders(req: IncomingMessage): void {
  const contentType = req.headers['content-type']
  if (typeof contentType !== 'string' || !contentType.toLowerCase().startsWith('application/json')) {
    throw new HttpRequestError(415, -32004, 'Content-Type deve ser application/json.')
  }

  const accept = typeof req.headers.accept === 'string' ? req.headers.accept : ''
  const acceptedTypes = accept.split(',').map((value) => value.split(';', 1)[0].trim().toLowerCase())
  if (!acceptedTypes.includes('application/json') || !acceptedTypes.includes('text/event-stream')) {
    throw new HttpRequestError(406, -32005, 'Accept deve incluir application/json e text/event-stream.')
  }

  const protocolVersion = req.headers['mcp-protocol-version']
  if (protocolVersion !== VERITAS_MCP_HTTP_PROTOCOL_VERSION) {
    throw new HttpRequestError(400, -32006, `MCP-Protocol-Version deve ser ${VERITAS_MCP_HTTP_PROTOCOL_VERSION}.`)
  }
}

function readBody(req: IncomingMessage, maxBodyBytes: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalBytes = 0
    let settled = false

    const fail = (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    }

    req.on('data', (chunk: Buffer | string) => {
      if (settled) return
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      totalBytes += buffer.byteLength
      if (totalBytes > maxBodyBytes) {
        req.resume()
        fail(new HttpRequestError(413, -32007, 'Payload MCP excede o limite permitido.'))
        return
      }
      chunks.push(buffer)
    })
    req.once('end', () => {
      if (settled) return
      settled = true
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(JSON.parse(text))
      } catch {
        reject(new HttpRequestError(400, -32700, 'JSON-RPC inválido.'))
      }
    })
    req.once('error', (error) => fail(error instanceof Error ? error : new Error('Erro ao ler request.')))
  })
}

function assertHeaderMatchesBody(req: IncomingMessage, body: unknown): void {
  if (!body || typeof body !== 'object') return
  const record = body as Record<string, unknown>
  const methodHeader = req.headers['mcp-method']
  const nameHeader = req.headers['mcp-name']
  if (typeof methodHeader === 'string' && methodHeader !== record.method) {
    throw new HttpRequestError(400, -32008, 'HeaderMismatch: Mcp-Method não coincide com o corpo.')
  }
  if (typeof nameHeader === 'string' && nameHeader !== 'veritas') {
    throw new HttpRequestError(400, -32008, 'HeaderMismatch: Mcp-Name não coincide com o servidor.')
  }
}

async function handleMetadataRequest(req: IncomingMessage, res: ServerResponse, config: HttpConfig): Promise<void> {
  let origin: string | undefined
  try {
    origin = validateOrigin(req, config)
    const responseHeaders = {
      ...metadataCorsHeaders(origin),
      'cache-control': 'no-store',
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, responseHeaders)
      res.end()
      return
    }
    if (req.method !== 'GET') {
      errorResponse(res, 405, -32601, 'A rota de metadata aceita somente GET.', { allow: 'GET, OPTIONS', ...responseHeaders })
      return
    }
    if (!config.protectedResourceMetadata) {
      errorResponse(res, 404, -32601, 'Protected Resource Metadata não configurada.', responseHeaders)
      return
    }
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      ...responseHeaders,
    })
    res.end(JSON.stringify(config.protectedResourceMetadata))
  } catch (error) {
    if (error instanceof HttpRequestError) {
      errorResponse(res, error.statusCode, error.errorCode, error.message, origin ? metadataCorsHeaders(origin) : undefined)
      return
    }
    errorResponse(res, 500, -32603, 'Erro interno da rota de metadata.')
  }
}

async function handleMcpRequest(req: IncomingMessage, res: ServerResponse, config: HttpConfig): Promise<void> {
  let origin: string | undefined
  try {
    origin = validateOrigin(req, config)
    res.setHeader('cache-control', 'no-store')
    for (const [key, value] of Object.entries(corsHeaders(origin))) res.setHeader(key, value)

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    if (req.method !== 'POST') {
      errorResponse(res, 405, -32601, 'Apenas POST é aceito no endpoint MCP.', { allow: 'POST, OPTIONS' })
      return
    }

    validateBearer(req, config)
    validateHeaders(req)
    const body = await readBody(req, config.maxBodyBytes)
    assertHeaderMatchesBody(req, body)

    const mcpServer = createVeritasServer()
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      allowedOrigins: [...config.allowedOrigins],
    })
    res.once('close', () => {
      void Promise.allSettled([transport.close(), mcpServer.close()])
    })
    await mcpServer.connect(transport)
    await transport.handleRequest(req, res, body)
  } catch (error) {
    if (error instanceof HttpRequestError) {
      errorResponse(res, error.statusCode, error.errorCode, error.message, origin ? corsHeaders(origin) : undefined)
      return
    }
    errorResponse(res, 500, -32603, 'Erro interno do transporte MCP.')
  }
}

function normalizeOptions(options: VeritasHttpServerOptions): { config: HttpConfig; host: string; port: number; requestTimeoutMs: number } {
  const path = options.path ?? VERITAS_MCP_HTTP_DEFAULT_PATH
  const metadataResult = options.protectedResourceMetadata
    ? protectedResourceMetadataSchema.safeParse(options.protectedResourceMetadata)
    : { success: true as const, data: undefined }
  if (!metadataResult.success) throw new Error('Protected Resource Metadata inválida.')
  const bearerToken = options.bearerToken.trim()
  const allowedOrigins = options.allowedOrigins.map((origin) => origin.trim()).filter(Boolean)
  if (!path.startsWith('/')) throw new Error('O path MCP deve começar com /.')
  if (path === VERITAS_MCP_HTTP_METADATA_PATH) {
    throw new Error('O path MCP não pode coincidir com a rota reservada de metadata.')
  }
  if (!bearerToken) throw new Error('Bearer token MCP é obrigatório.')
  if (allowedOrigins.length === 0) throw new Error('É necessária uma allowlist de Origin MCP.')

  return {
    config: {
      path,
      bearerToken,
      allowedOrigins,
      maxBodyBytes: options.maxBodyBytes ?? VERITAS_MCP_HTTP_DEFAULT_MAX_BODY_BYTES,
      protectedResourceMetadata: metadataResult.data,
    },
    host: options.host ?? '127.0.0.1',
    port: options.port ?? 8787,
    requestTimeoutMs: options.requestTimeoutMs ?? VERITAS_MCP_HTTP_DEFAULT_REQUEST_TIMEOUT_MS,
  }
}

export function createVeritasHttpServer(options: VeritasHttpServerOptions): Server {
  const normalized = normalizeOptions(options)
  const server = createServer((req, res) => {
    const requestPath = new URL(req.url ?? '/', 'http://veritas.local').pathname
    if (requestPath === VERITAS_MCP_HTTP_METADATA_PATH) {
      void handleMetadataRequest(req, res, normalized.config)
      return
    }
    if (requestPath !== normalized.config.path) {
      errorResponse(res, 404, -32601, 'Endpoint MCP não encontrado.')
      return
    }
    void handleMcpRequest(req, res, normalized.config)
  })
  server.requestTimeout = normalized.requestTimeoutMs
  server.headersTimeout = normalized.requestTimeoutMs
  server.keepAliveTimeout = 5_000
  server.listen(normalized.port, normalized.host)
  return server
}

export function httpServerAddress(server: Server): { host: string; port: number } {
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Servidor MCP ainda não possui endereço.')
  return { host: address.address, port: address.port }
}
