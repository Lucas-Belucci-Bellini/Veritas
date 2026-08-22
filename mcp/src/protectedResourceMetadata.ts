import { z } from 'zod'

export const MCP_PROTECTED_RESOURCE_METADATA_VERSION = '2025-06-18'
export const MCP012_DEFAULT_BEARER_METHOD = 'header' as const

const bearerMethodSchema = z.literal(MCP012_DEFAULT_BEARER_METHOD)

export const protectedResourceMetadataSchema = z.object({
  resource: z.string().url(),
  authorization_servers: z.array(z.string().url()).min(1),
  scopes_supported: z.array(z.string().min(1)).optional(),
  bearer_methods_supported: z.array(bearerMethodSchema).min(1),
})

export type ProtectedResourceMetadata = z.infer<typeof protectedResourceMetadataSchema>

export interface ProtectedResourceMetadataInput {
  resource: string
  authorization_servers: readonly string[]
  scopes_supported?: readonly string[]
  bearer_methods_supported?: readonly typeof MCP012_DEFAULT_BEARER_METHOD[]
}

function isLocalhost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1'
}

function normalizeHttpsOrLocalUrl(value: string, field: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${field} não pode ser vazio.`)

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error(`${field} deve ser uma URL absoluta.`)
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${field} deve usar http ou https.`)
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${field} não pode conter credenciais, query string ou fragmento.`)
  }
  if (url.protocol !== 'https:' && !isLocalhost(url.hostname)) {
    throw new Error(`${field} deve usar HTTPS fora de localhost.`)
  }
  return url.toString()
}

function normalizeScopes(scopes: readonly string[] | undefined): string[] | undefined {
  if (scopes === undefined) return undefined
  if (scopes.length === 0) {
    throw new Error('scopes_supported deve conter pelo menos um escopo quando informado.')
  }
  const normalized = scopes.map((scope) => scope.trim())
  if (normalized.some((scope) => !scope || /\s/.test(scope))) {
    throw new Error('scopes_supported deve conter tokens não vazios e sem espaços.')
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('scopes_supported não pode conter escopos duplicados.')
  }
  return normalized
}

function normalizeBearerMethods(
  methods: readonly typeof MCP012_DEFAULT_BEARER_METHOD[] | undefined,
): [typeof MCP012_DEFAULT_BEARER_METHOD] {
  const normalized = methods === undefined ? [MCP012_DEFAULT_BEARER_METHOD] : [...methods]
  if (normalized.length !== 1 || normalized[0] !== MCP012_DEFAULT_BEARER_METHOD) {
    throw new Error('O Veritas MCP-012 aceita somente bearer_methods_supported=["header"].')
  }
  return [MCP012_DEFAULT_BEARER_METHOD]
}

export function buildProtectedResourceMetadata(input: ProtectedResourceMetadataInput): ProtectedResourceMetadata {
  const resource = normalizeHttpsOrLocalUrl(input.resource, 'resource')
  if (input.authorization_servers.length === 0) {
    throw new Error('authorization_servers deve conter pelo menos uma URL válida.')
  }
  const authorization_servers = input.authorization_servers.map((server, index) =>
    normalizeHttpsOrLocalUrl(server, `authorization_servers[${index}]`),
  )
  if (new Set(authorization_servers).size !== authorization_servers.length) {
    throw new Error('authorization_servers não pode conter URLs duplicadas.')
  }

  const metadata: ProtectedResourceMetadata = {
    resource,
    authorization_servers,
    scopes_supported: normalizeScopes(input.scopes_supported),
    bearer_methods_supported: normalizeBearerMethods(input.bearer_methods_supported),
  }
  const parsed = protectedResourceMetadataSchema.safeParse(metadata)
  if (!parsed.success) throw new Error('Protected Resource Metadata inválido após normalização.')
  return parsed.data
}
