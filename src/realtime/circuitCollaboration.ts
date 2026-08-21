import type { CircuitDocument } from '../circuit'
import type { DocumentRuntimeState } from '../simulation/documentRuntime'
import {
  createRoomCollaboration,
  type RoomPresence,
  type RoomRef,
  type RoomRole,
  type RoomRuntimeConfig,
  type RoomRuntimeState,
  type RoomSession,
  type RoomSnapshot,
} from './roomCollaboration'

export type CircuitPresence = RoomPresence
export type CircuitBroadcast = RoomSnapshot
export type CircuitRuntimeConfig = RoomRuntimeConfig
export type CircuitRuntimeState = RoomRuntimeState

export interface CircuitCollaboration {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  broadcast: (document: CircuitDocument, baseVersion?: number) => Promise<void>
  broadcastRuntimeConfig: (clockPeriods: Readonly<Record<string, number>>, baseVersion?: number) => Promise<void>
  broadcastRuntimeState: (state: DocumentRuntimeState, baseVersion?: number) => Promise<void>
  onRemoteDocument: (listener: (message: CircuitBroadcast) => void) => () => void
  onRemoteRuntimeConfig: (listener: (message: CircuitRuntimeConfig) => void) => () => void
  onRemoteRuntimeState: (listener: (message: CircuitRuntimeState) => void) => () => void
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
    broadcastRuntimeConfig: (clockPeriods, baseVersion = 0) => session.broadcastRuntimeConfig(clockPeriods, baseVersion),
    broadcastRuntimeState: (state, baseVersion = 0) => session.broadcastRuntimeState(state, baseVersion),
    onRemoteDocument: session.onSnapshot,
    onRemoteRuntimeConfig: session.onRuntimeConfig,
    onRemoteRuntimeState: session.onRuntimeState,
    onPresence: session.onPresence,
    isConnected: session.isConnected,
  }
}
