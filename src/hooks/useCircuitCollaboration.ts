import { useCallback, useEffect, useRef, useState } from 'react'
import type { CircuitDocument } from '../circuit'
import type { DocumentRuntimeState } from '../simulation/documentRuntime'
import { createCircuitCollaboration, type CircuitPresence, type CircuitBroadcast, type CircuitRuntimeConfig, type CircuitRuntimeState } from '../realtime/circuitCollaboration'
import type { RoomRole } from '../realtime/roomCollaboration'

export type CollaborationStatus = 'disabled' | 'connecting' | 'connected' | 'error'

interface UseCircuitCollaborationOptions {
  projectId: string | null
  roomId?: string
  role?: RoomRole
  baseVersion?: number
  enabled: boolean
  onRemoteDocument: (message: CircuitBroadcast) => boolean | void
  onRemoteRuntimeConfig?: (message: CircuitRuntimeConfig) => void
  onRemoteRuntimeState?: (message: CircuitRuntimeState) => void
}

export function useCircuitCollaboration({
  projectId,
  roomId = 'main',
  role = 'editor',
  baseVersion = 0,
  enabled,
  onRemoteDocument,
  onRemoteRuntimeConfig,
  onRemoteRuntimeState,
}: UseCircuitCollaborationOptions) {
  const [status, setStatus] = useState<CollaborationStatus>('disabled')
  const [participants, setParticipants] = useState<CircuitPresence[]>([])
  const [lastRemoteVersion, setLastRemoteVersion] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const listenerRef = useRef(onRemoteDocument)
  const runtimeListenerRef = useRef(onRemoteRuntimeConfig)
  const runtimeStateListenerRef = useRef(onRemoteRuntimeState)
  const baseVersionRef = useRef(baseVersion)
  listenerRef.current = onRemoteDocument
  runtimeListenerRef.current = onRemoteRuntimeConfig
  runtimeStateListenerRef.current = onRemoteRuntimeState
  baseVersionRef.current = Number.isInteger(baseVersion) && baseVersion >= 0 ? baseVersion : 0

  const collaborationRef = useRef<ReturnType<typeof createCircuitCollaboration> | null>(null)

  useEffect(() => {
    if (!enabled || !projectId) {
      setStatus('disabled')
      setParticipants([])
      setLastRemoteVersion(null)
      setError(null)
      collaborationRef.current = null
      return
    }

    const collaboration = createCircuitCollaboration(projectId, roomId, role)
    collaborationRef.current = collaboration
    let active = true
    setStatus('connecting')
    setError(null)

    const removeDocumentListener = collaboration.onRemoteDocument((message: CircuitBroadcast) => {
      if (!active) return
      const applied = listenerRef.current(message)
      if (applied !== false) setLastRemoteVersion(message.baseVersion)
    })
    const removeRuntimeListener = collaboration.onRemoteRuntimeConfig((message) => {
      if (active) runtimeListenerRef.current?.(message)
    })
    const removeRuntimeStateListener = collaboration.onRemoteRuntimeState((message) => {
      if (active) runtimeStateListenerRef.current?.(message)
    })
    const removePresenceListener = collaboration.onPresence((presence) => {
      if (active) setParticipants(presence)
    })

    void collaboration.connect().then(() => {
      if (active) setStatus('connected')
    }).catch((connectError: unknown) => {
      if (!active) return
      setStatus('error')
      setError(connectError instanceof Error ? connectError.message : 'Não foi possível conectar à colaboração em tempo real.')
    })

    return () => {
      active = false
      removeDocumentListener()
      removeRuntimeListener()
      removeRuntimeStateListener()
      removePresenceListener()
      void collaboration.disconnect()
      if (collaborationRef.current === collaboration) collaborationRef.current = null
    }
  }, [enabled, projectId, role, roomId])

  const broadcast = useCallback(async (document: CircuitDocument, nextBaseVersion?: number) => {
    const version = nextBaseVersion ?? baseVersionRef.current
    await collaborationRef.current?.broadcast(document, version)
  }, [])

  const broadcastRuntimeConfig = useCallback(async (clockPeriods: Readonly<Record<string, number>>, nextBaseVersion?: number) => {
    const version = nextBaseVersion ?? baseVersionRef.current
    await collaborationRef.current?.broadcastRuntimeConfig(clockPeriods, version)
  }, [])

  const broadcastRuntimeState = useCallback(async (state: DocumentRuntimeState, nextBaseVersion?: number) => {
    const version = nextBaseVersion ?? baseVersionRef.current
    await collaborationRef.current?.broadcastRuntimeState(state, version)
  }, [])

  return { status, participants, lastRemoteVersion, error, broadcast, broadcastRuntimeConfig, broadcastRuntimeState, roomId }
}
