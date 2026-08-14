import { useCallback, useEffect, useState } from 'react'
import type { CircuitDocument } from '../circuit'
import { useAuth } from '../auth/useAuth'
import {
  deleteCloudCircuitProject,
  listCloudCircuitProjects,
  upsertCloudCircuitProject,
  type CloudCircuitProject,
} from '../cloud/circuitProjects'

interface UseCloudCircuitProjects {
  projects: CloudCircuitProject[]
  loading: boolean
  error: string | null
  configured: boolean
  sync: (name: string, document: CircuitDocument, id?: string) => Promise<CloudCircuitProject>
  remove: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useCloudCircuitProjects(): UseCloudCircuitProjects {
  const { configured, user } = useAuth()
  const [projects, setProjects] = useState<CloudCircuitProject[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!configured || !user) {
      setProjects([])
      setError(null)
      return
    }
    setLoading(true)
    try {
      setProjects(await listCloudCircuitProjects())
      setError(null)
    } catch (refreshError) {
      setError(messageOf(refreshError, 'Não foi possível carregar os circuitos da nuvem.'))
    } finally {
      setLoading(false)
    }
  }, [configured, user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    projects,
    loading,
    error,
    configured,
    refresh,
    sync: async (name, document, id) => {
      if (!user) throw new Error('Faça login para sincronizar circuitos na nuvem.')
      setLoading(true)
      try {
        const project = await upsertCloudCircuitProject(name, document, id)
        await refresh()
        setError(null)
        return project
      } catch (syncError) {
        const message = messageOf(syncError, 'Não foi possível sincronizar o circuito.')
        setError(message)
        throw new Error(message)
      } finally {
        setLoading(false)
      }
    },
    remove: async (id) => {
      setLoading(true)
      try {
        await deleteCloudCircuitProject(id)
        await refresh()
      } catch (removeError) {
        const message = messageOf(removeError, 'Não foi possível excluir o circuito da nuvem.')
        setError(message)
        throw new Error(message)
      } finally {
        setLoading(false)
      }
    },
  }
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
