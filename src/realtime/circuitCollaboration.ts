import type { RealtimeChannel, User } from '@supabase/supabase-js'
import type { CircuitDocument } from '../circuit'
import { buildCircuitContext } from '../circuit'
import { supabase } from '../lib/supabase'

export interface CircuitPresence {
  userId: string
  label: string
  color: string
}

export interface CircuitBroadcast {
  senderId: string
  contentHash: string
  document: CircuitDocument
  sentAt: string
}

export interface CircuitCollaboration {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  broadcast: (document: CircuitDocument) => Promise<void>
  onRemoteDocument: (listener: (message: CircuitBroadcast) => void) => () => void
  onPresence: (listener: (presence: CircuitPresence[]) => void) => () => void
  isConnected: () => boolean
}

export function createCircuitCollaboration(projectId: string): CircuitCollaboration {
  let channel: RealtimeChannel | null = null
  let currentUser: User | null = null
  let connected = false
  let lastReceivedHash: string | null = null
  const documentListeners = new Set<(message: CircuitBroadcast) => void>()
  const presenceListeners = new Set<(presence: CircuitPresence[]) => void>()

  const notifyPresence = () => {
    if (!channel) return
    const state = channel.presenceState<Record<string, unknown>>()
    const presence = Object.values(state).flatMap((entries) => entries.map((entry) => normalizePresence(entry)))
    presenceListeners.forEach((listener) => listener(presence.filter(isCircuitPresence)))
  }

  return {
    async connect() {
      if (connected) return
      if (!supabase) throw new Error('Supabase não está configurado neste ambiente.')
      const { data, error } = await supabase.auth.getUser()
      if (error) throw error
      if (!data.user) throw new Error('Faça login para colaborar em tempo real.')
      currentUser = data.user

      channel = supabase
        .channel(`veritas:circuit:${projectId}`, { config: { private: true } })
        .on('broadcast', { event: 'circuit_update' }, (payload) => {
          const message = normalizeBroadcast(payload.payload)
          if (!message || message.senderId === currentUser?.id) return
          lastReceivedHash = message.contentHash
          documentListeners.forEach((listener) => listener(message))
        })
        .on('presence', { event: 'sync' }, notifyPresence)
        .on('presence', { event: 'join' }, notifyPresence)
        .on('presence', { event: 'leave' }, notifyPresence)

      await subscribe(channel)
      await channel.track({
        userId: currentUser.id,
        label: currentUser.email ?? `Usuário ${currentUser.id.slice(0, 6)}`,
        color: colorForUser(currentUser.id),
      })
      connected = true
      notifyPresence()
    },
    async disconnect() {
      if (!channel || !supabase) return
      await supabase.removeChannel(channel)
      channel = null
      connected = false
      currentUser = null
      documentListeners.clear()
      presenceListeners.clear()
    },
    async broadcast(document) {
      if (!channel || !connected || !currentUser) return
      const contentHash = buildCircuitContext(document).contentHash
      if (contentHash === lastReceivedHash) {
        lastReceivedHash = null
        return
      }
      await channel.send({
        type: 'broadcast',
        event: 'circuit_update',
        payload: { senderId: currentUser.id, contentHash, document, sentAt: new Date().toISOString() },
      })
    },
    onRemoteDocument(listener) {
      documentListeners.add(listener)
      return () => documentListeners.delete(listener)
    },
    onPresence(listener) {
      presenceListeners.add(listener)
      return () => presenceListeners.delete(listener)
    },
    isConnected: () => connected,
  }
}

function subscribe(channel: RealtimeChannel): Promise<void> {
  return new Promise((resolve, reject) => {
    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') resolve()
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(error ?? new Error(`Realtime: ${status}`))
    })
  })
}

function normalizeBroadcast(value: unknown): CircuitBroadcast | null {
  if (!isRecord(value) || typeof value.senderId !== 'string' || typeof value.contentHash !== 'string' || typeof value.sentAt !== 'string') return null
  if (!isCircuitDocument(value.document)) return null
  return { senderId: value.senderId, contentHash: value.contentHash, sentAt: value.sentAt, document: value.document }
}

function normalizePresence(value: Record<string, unknown>): CircuitPresence | null {
  if (typeof value.userId !== 'string' || typeof value.label !== 'string' || typeof value.color !== 'string') return null
  return { userId: value.userId, label: value.label, color: value.color }
}

function colorForUser(userId: string): string {
  const palette = ['#2563eb', '#7c3aed', '#db2777', '#059669', '#d97706', '#0891b2']
  let hash = 0
  for (const character of userId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return palette[hash % palette.length]
}

function isCircuitDocument(value: unknown): value is CircuitDocument {
  if (!isRecord(value) || value.format !== 'veritas-circuit' || value.version !== 1 || typeof value.name !== 'string') return false
  if (!Array.isArray(value.nodes) || !Array.isArray(value.connections)) return false
  return value.nodes.every((node) => isRecord(node) && typeof node.id === 'string' && typeof node.type === 'string' && isRecord(node.position) && isFiniteNumber(node.position.x) && isFiniteNumber(node.position.y)) && value.connections.every((connection) => isRecord(connection) && isRecord(connection.source) && isRecord(connection.target) && typeof connection.source.node === 'string' && typeof connection.target.node === 'string' && Number.isInteger(connection.target.port))
}

function isCircuitPresence(value: CircuitPresence | null): value is CircuitPresence {
  return value !== null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
