import { useCallback, useEffect, useState } from 'react'
import { storageAvailable, type NewProject, type Project } from '../storage/db'
import {
  createProject,
  deleteProject,
  importProjects,
  listProjects,
  parseVeritasFile,
  updateProject,
} from '../storage/projects'

interface UseProjects {
  projects: Project[]
  ready: boolean
  /** Mensagem quando o navegador não deixa usar o IndexedDB. */
  unavailable: string | null
  save: (input: NewProject) => Promise<void>
  update: (id: number, patch: Partial<NewProject>) => Promise<void>
  remove: (id: number) => Promise<void>
  importFile: (text: string) => Promise<number>
}

export function useProjects(): UseProjects {
  const [projects, setProjects] = useState<Project[]>([])
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!storageAvailable()) {
      setUnavailable(
        'Este navegador não deixa salvar projetos localmente (IndexedDB indisponível).',
      )
      setReady(true)
      return
    }
    try {
      setProjects(await listProjects())
      setUnavailable(null)
    } catch {
      setUnavailable('Não foi possível abrir o banco local de projetos.')
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
    save: async (input) => {
      await createProject(input)
      await refresh()
    },
    update: async (id, patch) => {
      await updateProject(id, patch)
      await refresh()
    },
    remove: async (id) => {
      await deleteProject(id)
      await refresh()
    },
    importFile: async (text) => {
      const count = await importProjects(parseVeritasFile(text))
      await refresh()
      return count
    },
  }
}
