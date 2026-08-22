import { describe, expect, it } from 'vitest'
import {
  MCP012_DEFAULT_BEARER_METHOD,
  MCP_PROTECTED_RESOURCE_METADATA_VERSION,
  buildProtectedResourceMetadata,
  protectedResourceMetadataSchema,
} from './protectedResourceMetadata'

describe('MCP-012 Protected Resource Metadata', () => {
  it('produz metadata determinística para recurso HTTPS e authorization server', () => {
    const metadata = buildProtectedResourceMetadata({
      resource: 'https://veritas.example/mcp',
      authorization_servers: ['https://auth.example/realms/veritas'],
      scopes_supported: ['circuit:read', 'circuit:write'],
    })

    expect(metadata).toEqual({
      resource: 'https://veritas.example/mcp',
      authorization_servers: ['https://auth.example/realms/veritas'],
      scopes_supported: ['circuit:read', 'circuit:write'],
      bearer_methods_supported: [MCP012_DEFAULT_BEARER_METHOD],
    })
    expect(MCP_PROTECTED_RESOURCE_METADATA_VERSION).toBe('2025-06-18')
    expect(protectedResourceMetadataSchema.safeParse(metadata).success).toBe(true)
  })

  it('normaliza espaços externos e aceita HTTP somente em localhost', () => {
    expect(
      buildProtectedResourceMetadata({
        resource: ' http://127.0.0.1:8787/mcp ',
        authorization_servers: [' https://auth.example/ '],
        scopes_supported: [' circuit:read '],
      }),
    ).toEqual({
      resource: 'http://127.0.0.1:8787/mcp',
      authorization_servers: ['https://auth.example/'],
      scopes_supported: ['circuit:read'],
      bearer_methods_supported: ['header'],
    })
  })

  it('rejeita URLs não HTTPS remotas e URLs com credenciais/query/fragmento', () => {
    expect(() =>
      buildProtectedResourceMetadata({
        resource: 'http://veritas.example/mcp',
        authorization_servers: ['https://auth.example'],
      }),
    ).toThrow('resource deve usar HTTPS fora de localhost.')

    expect(() =>
      buildProtectedResourceMetadata({
        resource: 'https://veritas.example/mcp?token=secret',
        authorization_servers: ['https://auth.example'],
      }),
    ).toThrow('resource não pode conter credenciais, query string ou fragmento.')

    expect(() =>
      buildProtectedResourceMetadata({
        resource: 'https://veritas.example/mcp',
        authorization_servers: ['https://user:password@auth.example'],
      }),
    ).toThrow('authorization_servers[0] não pode conter credenciais, query string ou fragmento.')
  })

  it('rejeita escopos vazios, duplicados, com espaços e métodos de bearer não suportados', () => {
    const base = {
      resource: 'https://veritas.example/mcp',
      authorization_servers: ['https://auth.example'],
    }
    expect(() => buildProtectedResourceMetadata({ ...base, scopes_supported: [] })).toThrow(
      'scopes_supported deve conter pelo menos um escopo quando informado.',
    )
    expect(() => buildProtectedResourceMetadata({ ...base, scopes_supported: [''] })).toThrow(
      'scopes_supported deve conter tokens não vazios e sem espaços.',
    )
    expect(() => buildProtectedResourceMetadata({ ...base, scopes_supported: ['read', 'read'] })).toThrow(
      'scopes_supported não pode conter escopos duplicados.',
    )
    expect(() => buildProtectedResourceMetadata({ ...base, scopes_supported: ['read scope'] })).toThrow(
      'scopes_supported deve conter tokens não vazios e sem espaços.',
    )
    expect(() =>
      buildProtectedResourceMetadata({ ...base, bearer_methods_supported: ['body'] as never }),
    ).toThrow('O Veritas MCP-012 aceita somente bearer_methods_supported=["header"].')
  })

  it('rejeita authorization servers vazios ou duplicados', () => {
    const base = { resource: 'https://veritas.example/mcp' }
    expect(() => buildProtectedResourceMetadata({ ...base, authorization_servers: [] })).toThrow(
      'authorization_servers deve conter pelo menos uma URL válida.',
    )
    expect(() =>
      buildProtectedResourceMetadata({
        ...base,
        authorization_servers: ['https://auth.example', 'https://auth.example/'],
      }),
    ).toThrow('authorization_servers não pode conter URLs duplicadas.')
  })
})
