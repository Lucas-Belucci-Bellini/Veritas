import { useCallback, useEffect, useRef, useState } from 'react'
import type { CircuitDocument } from '../circuit'
import { createCircuitCollaboration, type CircuitPresence } from '../realtime/circuitCollaboration'

export type CollaborationStatus = 'disabled' | 'connecting' | 'connected' | 'error'

interface UseCircuitCollaborationOptions {
  projectId: string | null
  enabled: boolean
  onRemoteDocument: (document: CircuitDocument) => void
}

export function useCircuitCollaboration({ projectId, enabled, onRemoteDocument }: UseCircuitCollaborationOptions) {
  const [status, setStatus] = useState<CollaborationStatus>('disabled')
  const [participants, setParticipants] = useState<CircuitPresence[]>([])
  const [error, setError] = useState<string | null>(null)
  const listenerRef = useRef(onRemoteDocument)
  listenerRef.current = onRemoteDocument

  const collaborationRef = useRef<ReturnType<typeof createCircuitCollaboration> | null>(null)

  useEffect(() => {
    if (!enabled || !projectId) {
      setStatus('disabled')
      setParticipants([])
      setError(null)
      collaborationRef.current = null
      return
    }

    const collaboration = createCircuitCollaboration(projectId)
    collaborationRef.current = collaboration
    let active = true
    setStatus('connecting')
    setError(null)

    const removeDocumentListener = collaboration.onRemoteDocument((message) => {
      if (active) listenerRef.current(message.document)
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
      removePresenceListener()
      void collaboration.disconnect()
      if (collaborationRef.current === collaboration) collaborationRef.current = null
    }
  }, [enabled, projectId])

  const broadcast = useCallback(async (document: CircuitDocument) => {
    await collaborationRef.current?.broadcast(document)
  }, [])

  return { status, participants, error, broadcast }
}
