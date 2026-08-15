import { beforeEach, describe, expect, it, vi } from 'vitest'

const fakeSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabase: fakeSupabase }))

import { createCircuitRoom, listCircuitRooms } from './circuitRooms'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('circuitRooms', () => {
  it('lista somente salas do projeto com kind permitido', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: 'room-1', project_id: 'project-1', room_id: 'main', kind: 'document', created_by: 'user-1', created_at: '2026-08-15T00:00:00.000Z' },
          { id: 'room-2', project_id: 'project-1', room_id: 'review', kind: 'review', created_by: 'user-1', created_at: '2026-08-15T00:01:00.000Z' },
          { id: 'room-3', project_id: 'project-1', room_id: 'bad', kind: 'unknown', created_by: 'user-1', created_at: '2026-08-15T00:02:00.000Z' },
        ],
        error: null,
      }),
    }
    fakeSupabase.from.mockReturnValue(query)

    const rooms = await listCircuitRooms('project-1')

    expect(fakeSupabase.from).toHaveBeenCalledWith('veritas_circuit_rooms')
    expect(query.eq).toHaveBeenCalledWith('project_id', 'project-1')
    expect(rooms).toHaveLength(2)
    expect(rooms[1]).toMatchObject({ roomId: 'review', kind: 'review', createdBy: 'user-1' })
  })

  it('cria uma sala por RPC e normaliza a resposta', async () => {
    fakeSupabase.rpc.mockResolvedValue({
      data: { id: 'room-2', project_id: 'project-1', room_id: 'review', kind: 'review', created_by: 'user-1', created_at: '2026-08-15T00:01:00.000Z' },
      error: null,
    })

    const room = await createCircuitRoom('project-1', ' review ', 'review')

    expect(fakeSupabase.rpc).toHaveBeenCalledWith('veritas_create_circuit_room', { p_project_id: 'project-1', p_room_id: 'review', p_kind: 'review' })
    expect(room).toMatchObject({ projectId: 'project-1', roomId: 'review', kind: 'review' })
  })

  it('rejeita resposta inválida ao criar sala', async () => {
    fakeSupabase.rpc.mockResolvedValue({ data: { id: 'room-1', kind: 'invalid' }, error: null })

    await expect(createCircuitRoom('project-1', 'main')).rejects.toThrow('sala inválida')
  })
})
