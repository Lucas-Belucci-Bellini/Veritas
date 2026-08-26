import { useCallback, useEffect, useState } from 'react'
import {
  createTestbenchProject,
  deleteTestbenchProject,
  importTestbenchProjects,
  listTestbenchProjects,
  parseTestbenchFile,
  updateTestbenchProject,
} from '../storage/testbenches'
import {
  storageAvailable,
  type NewTestbenchProject,
  type TestbenchProject,
} from '../storage/db'
import type { TestbenchDocument } from '../circuit'

type TestbenchDraft = Pick<NewTestbenchProject, 'name' | 'document'>
type TestbenchPatch = Partial<TestbenchDraft>

interface UseTestbenchProjects {
  projects: TestbenchProject[]
  ready: boolean
  unavailable: string | null
  error: string | null
  save: (input: TestbenchDraft) => Promise<number>
  update: (id: number, patch: TestbenchPatch) => Promise<void>
  remove: (id: number) => Promise<void>
  importFile: (text: string) => Promise<number>
  refresh: () => Promise<void>
}

export function useTestbenchProjects(
  circuitId: number | '',
): UseTestbenchProjects {
  const [projects, setProjects] = useState<TestbenchProject[]>([])
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setReady(false)
    if (circuitId === '') {
      setProjects([])
      setUnavailable(null)
      setError(null)
      setReady(true)
      return
    }
    if (!storageAvailable()) {
      setProjects([])
      setUnavailable(
        'Este navegador não permite salvar testbenches localmente (IndexedDB indisponível).',
      )
      setReady(true)
      return
    }
    try {
      setProjects(await listTestbenchProjects(circuitId))
      setUnavailable(null)
      setError(null)
    } catch {
      setError('Não foi possível abrir o banco local de testbenches.')
    } finally {
      setReady(true)
    }
  }, [circuitId])

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
      if (circuitId === '')
        throw new Error('Selecione um circuito antes de salvar o testbench.')
      const id = await createTestbenchProject({ ...input, circuitId })
      await refresh()
      return id
    },
    update: async (id, patch) => {
      await updateTestbenchProject(id, patch)
      await refresh()
    },
    remove: async (id) => {
      await deleteTestbenchProject(id)
      await refresh()
    },
    importFile: async (text) => {
      if (circuitId === '')
        throw new Error('Selecione um circuito antes de importar um testbench.')
      const parsed = parseTestbenchFile(text)
      const count = await importTestbenchProjects(
        circuitId,
        parsed.map(
          ({
            name,
            document,
          }: {
            name: string
            document: TestbenchDocument
          }) => ({ name, document }),
        ),
      )
      await refresh()
      return count
    },
  }
}
