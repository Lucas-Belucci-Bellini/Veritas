import { useCallback, useEffect, useState } from 'react'
import { storageAvailable, type CircuitProject, type NewCircuitProject } from '../storage/db'
import {
  createCircuitProject,
  deleteCircuitProject,
  importCircuitProjects,
  listCircuitProjects,
  parseCircuitFile,
  updateCircuitProject,
} from '../storage/circuits'

interface UseCircuitProjects {
  projects: CircuitProject[]
  ready: boolean
  unavailable: string | null
  error: string | null
  save: (input: NewCircuitProject) => Promise<number>
  update: (id: number, patch: Partial<NewCircuitProject>) => Promise<void>
  remove: (id: number) => Promise<void>
  importFile: (text: string) => Promise<number>
  refresh: () => Promise<void>
}

export function useCircuitProjects(): UseCircuitProjects {
  const [projects, setProjects] = useState<CircuitProject[]>([])
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!storageAvailable()) {
      setUnavailable('Este navegador não permite salvar circuitos localmente (IndexedDB indisponível).')
      setReady(true)
      return
    }
    try {
      setProjects(await listCircuitProjects())
      setUnavailable(null)
      setError(null)
    } catch {
      setError('Não foi possível abrir o banco local de circuitos.')
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    projects,
    ready,
    unavailable,
    error,
    refresh,
    save: async (input) => {
      const id = await createCircuitProject(input)
      await refresh()
      return id
    },
    update: async (id, patch) => {
      await updateCircuitProject(id, patch)
      await refresh()
    },
    remove: async (id) => {
      await deleteCircuitProject(id)
      await refresh()
    },
    importFile: async (text) => {
      const count = await importCircuitProjects(parseCircuitFile(text))
      await refresh()
      return count
    },
  }
}
