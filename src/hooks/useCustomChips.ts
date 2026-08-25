import { useCallback, useEffect, useState } from 'react'
import { storageAvailable, type CustomChipProject } from '../storage/db'
import type { CustomChipLibraryEntry } from '../circuit'
import {
  createCustomChipProject,
  CUSTOM_CHIP_LIBRARY_EVENT,
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
    if (typeof window === 'undefined') return
    const handleLibraryChanged = () => void refresh()
    window.addEventListener(CUSTOM_CHIP_LIBRARY_EVENT, handleLibraryChanged)
    return () => window.removeEventListener(CUSTOM_CHIP_LIBRARY_EVENT, handleLibraryChanged)
  }, [refresh])

  return {
    chips,
    ready,
    unavailable,
    error,
    refresh,
    save: async (input) => {
      const library = chips.map<CustomChipLibraryEntry>((chip) => ({ id: chip.id, definition: chip.definition }))
      const id = await createCustomChipProject(input, library)
      await refresh()
      return id
    },
    update: async (id, patch) => {
      const library = chips.map<CustomChipLibraryEntry>((chip) => ({ id: chip.id, definition: chip.definition }))
      await updateCustomChipProject(id, patch, library)
      await refresh()
    },
    remove: async (id) => {
      await deleteCustomChipProject(id)
      await refresh()
    },
  }
}
