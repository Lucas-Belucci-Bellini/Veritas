import { describe, expect, it } from 'vitest'
import { createCircuitDocument } from './editorModel'
import { CircuitHistory } from './history'

function documentWithName(name: string) {
  return { ...createCircuitDocument(name), name }
}

describe('CircuitHistory', () => {
  it('desfaz e refaz snapshots imutáveis', () => {
    const first = documentWithName('Primeiro')
    const second = documentWithName('Segundo')
    const history = new CircuitHistory(first)

    expect(history.commit(second)).toBe(true)
    expect(history.canUndo()).toBe(true)
    expect(history.undo()).toMatchObject({ name: 'Primeiro' })
    expect(history.canRedo()).toBe(true)
    expect(history.redo()).toMatchObject({ name: 'Segundo' })
  })

  it('ignora commits idênticos e descarta redo depois de nova edição', () => {
    const first = documentWithName('Primeiro')
    const second = documentWithName('Segundo')
    const third = documentWithName('Terceiro')
    const history = new CircuitHistory(first)

    expect(history.commit(first)).toBe(false)
    history.commit(second)
    history.undo()
    expect(history.commit(third)).toBe(true)
    expect(history.canRedo()).toBe(false)
    expect(history.current()).toMatchObject({ name: 'Terceiro' })
  })

  it('respeita o limite e clona snapshots para evitar mutação externa', () => {
    const first = documentWithName('0')
    const history = new CircuitHistory(first, { limit: 2 })
    const second = documentWithName('1')
    const third = documentWithName('2')
    const fourth = documentWithName('3')

    history.commit(second)
    history.commit(third)
    history.commit(fourth)
    const current = history.current()
    current.name = 'mutado fora'

    expect(history.current().name).toBe('3')
    expect(history.sizes).toEqual({ past: 2, future: 0 })
    expect(history.undo()?.name).toBe('2')
    expect(history.undo()?.name).toBe('1')
    expect(history.undo()).toBeNull()
  })

  it('replace limpa passado e futuro ao abrir um documento diferente', () => {
    const history = new CircuitHistory(documentWithName('Primeiro'))
    history.commit(documentWithName('Segundo'))
    history.undo()
    history.replace(documentWithName('Importado'))

    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(false)
    expect(history.current().name).toBe('Importado')
  })
})
