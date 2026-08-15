import type { RealtimeChannel, User } from '@supabase/supabase-js'
import { MAX_BUS_WIDTH } from '../bus'
import type { CircuitDocument } from '../circuit'
import { buildCircuitContext } from '../circuit'
import { supabase } from '../lib/supabase'

export type RoomKind = 'document' | 'review' | 'chat'
export type RoomRole = 'owner' | 'editor' | 'viewer'

export interface RoomRef {
  projectId: string
  roomId: string
  kind: RoomKind
}

export interface RoomPresence {
  projectId: string
  roomId: string
  kind: RoomKind
  userId: string
  label: string
  color: string
  role: RoomRole
}

export interface RoomSnapshot {
  projectId: string
  roomId: string
  document: CircuitDocument
  contentHash: string
  baseVersion: number
  clientId: string
  sentAt: string
}

export interface RoomSession {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  broadcast: (document: CircuitDocument, baseVersion: number) => Promise<void>
  onSnapshot: (listener: (message: RoomSnapshot) => void) => () => void
  onPresence: (listener: (presence: RoomPresence[]) => void) => () => void
  isConnected: () => boolean
  room: RoomRef
}

export interface RoomManagerOptions {
  createSession?: (room: RoomRef) => RoomSession
}

export function topicFor(room: RoomRef): string {
  const normalized = normalizeRoomRef(room)
  return `veritas:project:${normalized.projectId}:room:${normalized.roomId}`
}

export function roomKey(room: RoomRef): string {
  const normalized = normalizeRoomRef(room)
  return `${normalized.projectId}/${normalized.roomId}/${normalized.kind}`
}

export function createRoomCollaboration(room: RoomRef, role: RoomRole = 'editor'): RoomSession {
  const normalizedRoom = normalizeRoomRef(room)
  let channel: RealtimeChannel | null = null
  let currentUser: User | null = null
  let connected = false
  let lastReceivedHash: string | null = null
  const snapshotListeners = new Set<(message: RoomSnapshot) => void>()
  const presenceListeners = new Set<(presence: RoomPresence[]) => void>()

  const notifyPresence = () => {
    if (!channel) return
    const state = channel.presenceState<Record<string, unknown>>()
    const presence = Object.values(state)
      .flatMap((entries) => entries.map((entry) => normalizePresence(entry, normalizedRoom)))
      .filter(isRoomPresence)
    presenceListeners.forEach((listener) => listener(presence))
  }

  return {
    room: normalizedRoom,
    async connect() {
      if (connected) return
      if (!supabase) throw new Error('Supabase não está configurado neste ambiente.')
      const { data, error } = await supabase.auth.getUser()
      if (error) throw error
      if (!data.user) throw new Error('Faça login para colaborar em tempo real.')
      currentUser = data.user

      channel = supabase
        .channel(topicFor(normalizedRoom), { config: { private: true } })
        .on('broadcast', { event: 'circuit_snapshot' }, (payload) => {
          const message = normalizeSnapshot(payload.payload, normalizedRoom)
          if (!message || message.clientId === currentUser?.id) return
          lastReceivedHash = message.contentHash
          snapshotListeners.forEach((listener) => listener(message))
        })
        .on('presence', { event: 'sync' }, notifyPresence)
        .on('presence', { event: 'join' }, notifyPresence)
        .on('presence', { event: 'leave' }, notifyPresence)

      await subscribe(channel)
      await channel.track({
        projectId: normalizedRoom.projectId,
        roomId: normalizedRoom.roomId,
        kind: normalizedRoom.kind,
        userId: currentUser.id,
        label: currentUser.email ?? `Usuário ${currentUser.id.slice(0, 6)}`,
        color: colorForUser(currentUser.id),
        role,
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
      lastReceivedHash = null
      snapshotListeners.clear()
      presenceListeners.clear()
    },
    async broadcast(document, baseVersion) {
      if (!channel || !connected || !currentUser) return
      if (!Number.isInteger(baseVersion) || baseVersion < 0) {
        throw new Error('A versão-base da sala precisa ser um inteiro não negativo.')
      }
      const contentHash = buildCircuitContext(document).contentHash
      if (contentHash === lastReceivedHash) {
        lastReceivedHash = null
        return
      }
      await channel.send({
        type: 'broadcast',
        event: 'circuit_snapshot',
        payload: {
          projectId: normalizedRoom.projectId,
          roomId: normalizedRoom.roomId,
          contentHash,
          baseVersion,
          clientId: currentUser.id,
          document,
          sentAt: new Date().toISOString(),
        },
      })
    },
    onSnapshot(listener) {
      snapshotListeners.add(listener)
      return () => snapshotListeners.delete(listener)
    },
    onPresence(listener) {
      presenceListeners.add(listener)
      return () => presenceListeners.delete(listener)
    },
    isConnected: () => connected,
  }
}

export class RoomManager {
  private readonly sessions = new Map<string, RoomSession>()
  private readonly createSession: (room: RoomRef) => RoomSession

  constructor(options: RoomManagerOptions = {}) {
    this.createSession = options.createSession ?? ((room) => createRoomCollaboration(room))
  }

  get(room: RoomRef): RoomSession | null {
    return this.sessions.get(roomKey(room)) ?? null
  }

  getOrCreate(room: RoomRef): RoomSession {
    const key = roomKey(room)
    const existing = this.sessions.get(key)
    if (existing) return existing
    const session = this.createSession(normalizeRoomRef(room))
    this.sessions.set(key, session)
    return session
  }

  async switchTo(room: RoomRef): Promise<RoomSession> {
    const targetKey = roomKey(room)
    await Promise.all([...this.sessions.entries()]
      .filter(([key]) => key !== targetKey)
      .map(async ([key, session]) => {
        await session.disconnect()
        this.sessions.delete(key)
      }))
    const session = this.getOrCreate(room)
    if (!session.isConnected()) await session.connect()
    return session
  }

  async disconnectAll(): Promise<void> {
    await Promise.all([...this.sessions.values()].map((session) => session.disconnect()))
    this.sessions.clear()
  }
}

function normalizeRoomRef(room: RoomRef): RoomRef {
  if (!isSafeIdentifier(room.projectId, 80)) throw new Error('projectId inválido para colaboração.')
  if (!isSafeIdentifier(room.roomId, 64)) throw new Error('roomId inválido para colaboração.')
  if (!['document', 'review', 'chat'].includes(room.kind)) throw new Error('Tipo de sala inválido.')
  return { projectId: room.projectId, roomId: room.roomId, kind: room.kind }
}

function normalizeSnapshot(value: unknown, room: RoomRef): RoomSnapshot | null {
  if (!isRecord(value)) return null
  if (value.projectId !== room.projectId || value.roomId !== room.roomId) return null
  if (typeof value.clientId !== 'string' || typeof value.contentHash !== 'string' || typeof value.sentAt !== 'string') return null
  if (!isNonNegativeInteger(value.baseVersion) || !isCircuitDocument(value.document)) return null
  return {
    projectId: room.projectId,
    roomId: room.roomId,
    document: value.document,
    contentHash: value.contentHash,
    baseVersion: value.baseVersion,
    clientId: value.clientId,
    sentAt: value.sentAt,
  }
}

function normalizePresence(value: Record<string, unknown>, room: RoomRef): RoomPresence | null {
  if (value.projectId !== room.projectId || value.roomId !== room.roomId || value.kind !== room.kind) return null
  if (typeof value.userId !== 'string' || typeof value.label !== 'string' || typeof value.color !== 'string') return null
  const role = value.role
  if (role !== 'owner' && role !== 'editor' && role !== 'viewer') return null
  return { projectId: room.projectId, roomId: room.roomId, kind: room.kind, userId: value.userId, label: value.label, color: value.color, role }
}

function isRoomPresence(value: RoomPresence | null): value is RoomPresence {
  return value !== null
}

function isCircuitDocument(value: unknown): value is CircuitDocument {
  if (!isRecord(value) || value.format !== 'veritas-circuit' || value.version !== 1 || typeof value.name !== 'string') return false
  if (!Array.isArray(value.nodes) || !Array.isArray(value.connections)) return false
  return value.nodes.every((node) => isValidRemoteNode(node)) && value.connections.every((connection) => isRecord(connection) && isRecord(connection.source) && isRecord(connection.target) && typeof connection.source.node === 'string' && typeof connection.target.node === 'string' && Number.isInteger(connection.target.port))
}

function isValidRemoteNode(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string' || !isRecord(value.position) || !isFiniteNumber(value.position.x) || !isFiniteNumber(value.position.y)) return false
  if (value.options === undefined) return true
  if (!isRecord(value.options)) return false
  const width = value.options.width
  return width === undefined || (typeof width === 'number' && Number.isInteger(width) && width >= 1 && width <= MAX_BUS_WIDTH)
}

function colorForUser(userId: string): string {
  const palette = ['#2563eb', '#7c3aed', '#db2777', '#059669', '#d97706', '#0891b2']
  let hash = 0
  for (const character of userId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return palette[hash % palette.length]
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isSafeIdentifier(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength && /^[a-zA-Z0-9_-]+$/.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function subscribe(channel: RealtimeChannel): Promise<void> {
  return new Promise((resolve, reject) => {
    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') resolve()
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(error ?? new Error(`Realtime: ${status}`))
    })
  })
}
