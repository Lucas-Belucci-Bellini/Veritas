#!/usr/bin/env node
import { createVeritasHttpServer, httpServerAddress } from './http-server'

const bearerToken = process.env.VERITAS_MCP_HTTP_BEARER_TOKEN?.trim()
const allowedOrigins = (process.env.VERITAS_MCP_HTTP_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const portText = process.env.VERITAS_MCP_HTTP_PORT ?? '8787'
const port = Number.parseInt(portText, 10)

if (!bearerToken) throw new Error('Defina VERITAS_MCP_HTTP_BEARER_TOKEN para iniciar o transporte HTTP local.')
if (allowedOrigins.length === 0) {
  throw new Error('Defina VERITAS_MCP_HTTP_ALLOWED_ORIGINS com pelo menos uma origem explícita.')
}
if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  throw new Error('VERITAS_MCP_HTTP_PORT deve ser uma porta inteira entre 0 e 65535.')
}

const server = createVeritasHttpServer({
  host: process.env.VERITAS_MCP_HTTP_HOST ?? '127.0.0.1',
  port,
  path: process.env.VERITAS_MCP_HTTP_PATH ?? '/mcp',
  bearerToken,
  allowedOrigins,
})

server.once('listening', () => {
  const address = httpServerAddress(server)
  console.error(`Veritas MCP HTTP local em http://${address.host}:${address.port}${process.env.VERITAS_MCP_HTTP_PATH ?? '/mcp'}`)
})

const shutdown = () => {
  server.close(() => process.exit(0))
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
