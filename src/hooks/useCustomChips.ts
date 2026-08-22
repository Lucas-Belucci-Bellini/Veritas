import { useCallback, useEffect, useState } from 'react'
import { storageAvailable, type CustomChipProject } from '../storage/db'
import {
  createCustomChipProject,
  deleteCustomChipProject,
  listCustomChipProjects,
  updateCustomChipProject,
  type NewCustomChipInput,
} from '../storage/customChips'

interface UseCustomChips {
  chips: CustomChipProject[]
  ready: boolean
  unavailable: string | null
  error: string | null
  save: (input: NewCustomChipInput) => Promise<number>
  update: (id: number, patch: Partial<NewCustomChipInput>) => Promise<void>
  remove: (id: number) => Promise<void>
  refresh: () => Promise<void>
}

export function useCustomChips(): UseCustomChips {
  const [chips, setChips] = useState<CustomChipProject[]>([])
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!storageAvailable()) {
      setUnavailable('Este navegador não permite salvar chips localmente (IndexedDB indisponível).')
      setReady(true)
      return
    }
    try {
      setChips(await listCustomChipProjects())
      setUnavailable(null)
      setError(null)
    } catch {
      setError('Não foi possível abrir a biblioteca local de chips customizados.')
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    chips,
    ready,
    unavailable,
    error,
    refresh,
    save: async (input) => {
      const id = await createCustomChipProject(input)
      await refresh()
      return id
    },
    update: async (id, patch) => {
      await updateCustomChipProject(id, patch)
      await refresh()
    },
    remove: async (id) => {
      await deleteCustomChipProject(id)
      await refresh()
    },
  }
}
