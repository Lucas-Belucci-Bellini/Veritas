import type { CircuitDocument } from '../circuit'
import {
  createRoomCollaboration,
  type RoomPresence,
  type RoomRef,
  type RoomRole,
  type RoomSession,
  type RoomSnapshot,
} from './roomCollaboration'

export type CircuitPresence = RoomPresence
export type CircuitBroadcast = RoomSnapshot

export interface CircuitCollaboration {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  broadcast: (document: CircuitDocument, baseVersion?: number) => Promise<void>
  onRemoteDocument: (listener: (message: CircuitBroadcast) => void) => () => void
  onPresence: (listener: (presence: CircuitPresence[]) => void) => () => void
  isConnected: () => boolean
  room: RoomRef
}

export function createCircuitCollaboration(projectId: string, roomId = 'main', role: RoomRole = 'editor'): CircuitCollaboration {
  const session = createRoomCollaboration({ projectId, roomId, kind: 'document' }, role)
  return adaptSession(session)
}

function adaptSession(session: RoomSession): CircuitCollaboration {
  return {
    room: session.room,
    connect: session.connect,
    disconnect: session.disconnect,
    broadcast: (document, baseVersion = 0) => session.broadcast(document, baseVersion),
    onRemoteDocument: session.onSnapshot,
    onPresence: session.onPresence,
    isConnected: session.isConnected,
  }
}
