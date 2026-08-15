import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCircuitDocument, type CircuitDocument } from '../circuit'

const fakeChannel = vi.hoisted(() => ({
  on: vi.fn(),
  subscribe: vi.fn(),
  track: vi.fn(),
  send: vi.fn(),
  presenceState: vi.fn(),
}))
const fakeSupabase = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  channel: vi.fn(),
  removeChannel: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabase: fakeSupabase }))

import { createCircuitCollaboration } from './circuitCollaboration'
import { RoomManager, topicFor } from './roomCollaboration'

const document: CircuitDocument = {
  ...createCircuitDocument('Realtime'),
  nodes: [
    { id: 'a', type: 'input', position: { x: 0, y: 0 }, label: 'A' },
    { id: 'out', type: 'output', position: { x: 180, y: 0 }, label: 'Saída' },
  ],
  connections: [{ source: { node: 'a' }, target: { node: 'out', port: 0 } }],
}

beforeEach(() => {
  vi.clearAllMocks()
  fakeSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'lucas@example.com' } }, error: null })
  fakeChannel.on.mockReturnValue(fakeChannel)
  fakeChannel.subscribe.mockImplementation((callback: (status: string) => void) => { callback('SUBSCRIBED'); return fakeChannel })
  fakeChannel.track.mockResolvedValue('ok')
  fakeChannel.send.mockResolvedValue('ok')
  fakeChannel.presenceState.mockReturnValue({})
  fakeSupabase.channel.mockReturnValue(fakeChannel)
  fakeSupabase.removeChannel.mockResolvedValue('ok')
})

describe('createCircuitCollaboration', () => {
  it('conecta em canal privado por sala e transmite snapshots com baseVersion', async () => {
    const collaboration = createCircuitCollaboration('project-1')
    const presenceListener = vi.fn()
    collaboration.onPresence(presenceListener)

    await collaboration.connect()
    await collaboration.broadcast(document, 3)

    expect(fakeSupabase.channel).toHaveBeenCalledWith('veritas:project:project-1:room:main', { config: { private: true } })
    expect(fakeChannel.track).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1', roomId: 'main', userId: 'user-1', label: 'lucas@example.com', role: 'editor' }))
    expect(fakeChannel.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'broadcast', event: 'circuit_snapshot', payload: expect.objectContaining({ baseVersion: 3, projectId: 'project-1', roomId: 'main' }) }))
    expect(collaboration.isConnected()).toBe(true)
  })

  it('valida snapshots recebidos, isola a sala e ignora o próprio cliente', async () => {
    const collaboration = createCircuitCollaboration('project-1', 'alpha')
    const listener = vi.fn()
    collaboration.onRemoteDocument(listener)
    await collaboration.connect()

    const broadcastCallback = fakeChannel.on.mock.calls.find(([kind, config]) => kind === 'broadcast' && config.event === 'circuit_snapshot')?.[2] as ((payload: { payload: unknown }) => void)
    broadcastCallback({ payload: { projectId: 'project-1', roomId: 'beta', clientId: 'user-2', contentHash: 'hash', baseVersion: 2, document, sentAt: new Date().toISOString() } })
    broadcastCallback({ payload: { projectId: 'project-1', roomId: 'alpha', clientId: 'user-2', contentHash: 'hash', baseVersion: 4, document, sentAt: new Date().toISOString() } })
    broadcastCallback({ payload: { projectId: 'project-1', roomId: 'alpha', clientId: 'user-1', contentHash: 'hash', baseVersion: 4, document, sentAt: new Date().toISOString() } })
    broadcastCallback({ payload: { projectId: 'project-1', roomId: 'alpha', clientId: 'user-2', contentHash: 'hash', baseVersion: -1, document, sentAt: new Date().toISOString() } })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'user-2', roomId: 'alpha', baseVersion: 4, document }))
  })

  it('desconecta e remove o canal ao sair do editor', async () => {
    const collaboration = createCircuitCollaboration('project-1')
    await collaboration.connect()
    await collaboration.disconnect()

    expect(fakeSupabase.removeChannel).toHaveBeenCalledWith(fakeChannel)
    expect(collaboration.isConnected()).toBe(false)
  })
})

describe('ROOM-001', () => {
  it('forma tópicos seguros e rejeita identificadores com separadores', () => {
    expect(topicFor({ projectId: 'project-1', roomId: 'alpha', kind: 'document' })).toBe('veritas:project:project-1:room:alpha')
    expect(() => topicFor({ projectId: 'project-1', roomId: 'alpha:beta', kind: 'document' })).toThrow('roomId inválido')
  })

  it('desconecta a sala anterior ao trocar de room', async () => {
    const sessions = new Map<string, { room: { roomId: string }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; broadcast: ReturnType<typeof vi.fn>; onSnapshot: ReturnType<typeof vi.fn>; onPresence: ReturnType<typeof vi.fn>; isConnected: ReturnType<typeof vi.fn> }>()
    const manager = new RoomManager({
      createSession: (room) => {
        const session = {
          room,
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          broadcast: vi.fn().mockResolvedValue(undefined),
          onSnapshot: vi.fn(() => () => undefined),
          onPresence: vi.fn(() => () => undefined),
          isConnected: vi.fn(() => false),
        }
        sessions.set(room.roomId, session)
        return session
      },
    })

    await manager.switchTo({ projectId: 'project-1', roomId: 'alpha', kind: 'document' })
    await manager.switchTo({ projectId: 'project-1', roomId: 'beta', kind: 'document' })

    expect(sessions.get('alpha')?.disconnect).toHaveBeenCalledTimes(1)
    expect(sessions.get('beta')?.connect).toHaveBeenCalledTimes(1)
    expect(manager.get({ projectId: 'project-1', roomId: 'alpha', kind: 'document' })).toBeNull()
  })
})
