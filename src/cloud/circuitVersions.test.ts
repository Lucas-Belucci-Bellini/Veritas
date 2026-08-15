import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCircuitDocument, type CircuitDocument } from '../circuit'

const fakeSupabase = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabase: fakeSupabase }))

import { listCloudCircuitVersions, syncCloudCircuitVersion } from './circuitVersions'

const document: CircuitDocument = {
  ...createCircuitDocument('AND cloud'),
  nodes: [
    { id: 'a', type: 'input', position: { x: 0, y: 0 }, label: 'A' },
    { id: 'out', type: 'output', position: { x: 180, y: 0 }, label: 'Saída' },
  ],
  connections: [{ source: { node: 'a' }, target: { node: 'out', port: 0 } }],
}

beforeEach(() => {
  vi.clearAllMocks()
  fakeSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
})

describe('listCloudCircuitVersions', () => {
  it('consulta somente as versões do projeto autenticado e converte datas/documentos', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{
          id: 'version-2',
          project_id: 'project-1',
          version_number: 2,
          name: 'Atual',
          document,
          content_hash: 'fnv1a-2',
          change_summary: {
            nameChanged: false,
            nodesAdded: 1,
            nodesRemoved: 0,
            nodesChanged: 0,
            connectionsAdded: 1,
            connectionsRemoved: 0,
            totalNodesBefore: 1,
            totalNodesAfter: 2,
            totalConnectionsBefore: 0,
            totalConnectionsAfter: 1,
          },
          created_at: '2026-08-14T19:00:00.000Z',
        }],
        error: null,
      }),
    }
    fakeSupabase.from.mockReturnValue(query)

    const versions = await listCloudCircuitVersions('project-1')

    expect(fakeSupabase.from).toHaveBeenCalledWith('veritas_circuit_versions')
    expect(query.eq).toHaveBeenCalledWith('project_id', 'project-1')
    expect(versions[0]).toMatchObject({ id: 'version-2', versionNumber: 2, projectId: 'project-1' })
    expect(versions[0].createdAt).toBe(Date.parse('2026-08-14T19:00:00.000Z'))
  })
})

describe('syncCloudCircuitVersion', () => {
  it('recusa sincronização sem usuário autenticado', async () => {
    fakeSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    await expect(syncCloudCircuitVersion(null, 'Sem login', document, null)).rejects.toThrow('Faça login')
    expect(fakeSupabase.rpc).not.toHaveBeenCalled()
  })

  it('envia contexto, resumo de mudança e devolve a versão criada pela RPC', async () => {
    fakeSupabase.rpc.mockResolvedValue({
      data: [{
        project_id: 'project-1',
        version_id: 'version-1',
        version_number: 1,
        name: 'Primeiro',
        document,
        content_hash: 'fnv1a-1',
        created_at: '2026-08-14T19:00:00.000Z',
        updated_at: '2026-08-14T19:00:00.000Z',
      }],
      error: null,
    })

    const result = await syncCloudCircuitVersion(null, 'Primeiro', document, null)
    const call = fakeSupabase.rpc.mock.calls[0]

    expect(call[0]).toBe('veritas_sync_circuit_project')
    expect(call[1]).toMatchObject({ p_project_id: null, p_name: 'Primeiro', p_document: document, p_content_hash: expect.any(String) })
    expect(call[1].p_change_summary).toMatchObject({ nodesAdded: 2, connectionsAdded: 1 })
    expect(call[1].p_base_version).toBe(0)
    expect(result).toMatchObject({ projectId: 'project-1', version: { id: 'version-1', versionNumber: 1 } })
  })

  it('envia a versão-base e rejeita conflito otimista sem aplicar o salvamento', async () => {
    fakeSupabase.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'CIRCUIT_CONFLICT current=7' },
    })

    const { CloudVersionConflictError } = await import('./circuitVersions')
    await expect(syncCloudCircuitVersion('project-1', 'Concorrente', document, document, 6)).rejects.toBeInstanceOf(CloudVersionConflictError)
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('veritas_sync_circuit_project', expect.objectContaining({ p_base_version: 6 }))
  })
})
