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
  it('conecta em canal privado, registra presença e transmite snapshots', async () => {
    const collaboration = createCircuitCollaboration('project-1')
    const presenceListener = vi.fn()
    collaboration.onPresence(presenceListener)

    await collaboration.connect()
    await collaboration.broadcast(document)

    expect(fakeSupabase.channel).toHaveBeenCalledWith('veritas:circuit:project-1', { config: { private: true } })
    expect(fakeChannel.track).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', label: 'lucas@example.com' }))
    expect(fakeChannel.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'broadcast', event: 'circuit_update' }))
    expect(collaboration.isConnected()).toBe(true)
  })

  it('valida snapshots recebidos e ignora os enviados pelo próprio usuário', async () => {
    const collaboration = createCircuitCollaboration('project-1')
    const listener = vi.fn()
    collaboration.onRemoteDocument(listener)
    await collaboration.connect()

    const broadcastCallback = fakeChannel.on.mock.calls.find(([kind, config]) => kind === 'broadcast' && config.event === 'circuit_update')?.[2] as ((payload: { payload: unknown }) => void)
    broadcastCallback({ payload: { senderId: 'user-2', contentHash: 'hash', document, sentAt: new Date().toISOString() } })
    broadcastCallback({ payload: { senderId: 'user-1', contentHash: 'hash', document, sentAt: new Date().toISOString() } })
    broadcastCallback({ payload: { senderId: 'user-2', contentHash: 'hash', document: { invalid: true }, sentAt: new Date().toISOString() } })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ senderId: 'user-2', document }))
  })

  it('desconecta e remove o canal ao sair do editor', async () => {
    const collaboration = createCircuitCollaboration('project-1')
    await collaboration.connect()
    await collaboration.disconnect()

    expect(fakeSupabase.removeChannel).toHaveBeenCalledWith(fakeChannel)
    expect(collaboration.isConnected()).toBe(false)
  })
})
