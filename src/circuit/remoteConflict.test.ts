import { describe, expect, it } from 'vitest'
import { createCircuitDocument, type CircuitDocument } from './editorModel'
import { decideRemoteCircuitUpdate } from './remoteConflict'

const document = (name: string): CircuitDocument => ({ ...createCircuitDocument(name), name })

describe('decisão de conflito remoto', () => {
  it('aplica atualização quando o local coincide com a última versão sincronizada', () => {
    const local = document('local')
    const remote = document('remoto')

    expect(decideRemoteCircuitUpdate(local, local, remote)).toEqual({ action: 'apply', reason: 'clean-local' })
  })

  it('adia atualização quando existem alterações locais não sincronizadas', () => {
    const lastSynced = document('sincronizado')
    const local = document('alteração local')
    const remote = document('alteração remota')

    expect(decideRemoteCircuitUpdate(local, lastSynced, remote)).toEqual({ action: 'defer', reason: 'local-changes' })
  })

  it('ignora snapshot já refletido no documento local', () => {
    const local = document('mesmo')

    expect(decideRemoteCircuitUpdate(local, document('anterior'), local)).toEqual({ action: 'ignore', reason: 'already-current' })
  })
})
