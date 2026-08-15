import { useCallback, useEffect, useState } from 'react'
import type { CircuitDocument } from '../circuit'
import { useAuth } from '../auth/useAuth'
import {
  deleteCloudCircuitProject,
  listCloudCircuitProjects,
  type CloudCircuitProject,
} from '../cloud/circuitProjects'
import {
  listCloudCircuitVersions,
  syncCloudCircuitVersion,
  CloudVersionConflictError,
  type CloudCircuitVersion,
} from '../cloud/circuitVersions'

interface CloudSyncResult {
  project: CloudCircuitProject
  version: CloudCircuitVersion
}

interface UseCloudCircuitProjects {
  projects: CloudCircuitProject[]
  versions: CloudCircuitVersion[]
  loading: boolean
  versionsLoading: boolean
  error: string | null
  configured: boolean
  sync: (name: string, document: CircuitDocument, id?: string) => Promise<CloudSyncResult>
  remove: (id: string) => Promise<void>
  refresh: () => Promise<void>
  loadVersions: (projectId: string) => Promise<void>
}

export function useCloudCircuitProjects(): UseCloudCircuitProjects {
  const { configured, user } = useAuth()
  const [projects, setProjects] = useState<CloudCircuitProject[]>([])
  const [versions, setVersions] = useState<CloudCircuitVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!configured || !user) {
      setProjects([])
      setVersions([])
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

  const loadVersions = useCallback(async (projectId: string) => {
    setVersionsLoading(true)
    try {
      setVersions(await listCloudCircuitVersions(projectId))
      setError(null)
    } catch (versionsError) {
      setError(messageOf(versionsError, 'Não foi possível carregar o histórico do circuito.'))
    } finally {
      setVersionsLoading(false)
    }
  }, [])

  return {
    projects,
    versions,
    loading,
    versionsLoading,
    error,
    configured,
    refresh,
    loadVersions,
    sync: async (name, document, id) => {
      if (!user) throw new Error('Faça login para sincronizar circuitos na nuvem.')
      setLoading(true)
      try {
        const previousVersions = id ? await listCloudCircuitVersions(id) : []
        const baseVersion = previousVersions[0]?.versionNumber ?? 0
        const result = await syncCloudCircuitVersion(id ?? null, name, document, previousVersions[0]?.document ?? null, baseVersion)
        const version = result.version
        const project: CloudCircuitProject = {
          id: result.projectId,
          name: version.name,
          document: version.document,
          contentHash: version.contentHash,
          createdAt: version.createdAt,
          updatedAt: version.createdAt,
        }
        setVersions([version, ...previousVersions])
        await refresh()
        setError(null)
        return { project, version }
      } catch (syncError) {
        const message = messageOf(syncError, 'Não foi possível sincronizar o circuito.')
        setError(message)
        throw syncError instanceof CloudVersionConflictError ? syncError : new Error(message)
      } finally {
        setLoading(false)
      }
    },
    remove: async (id) => {
      setLoading(true)
      try {
        await deleteCloudCircuitProject(id)
        setVersions([])
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
