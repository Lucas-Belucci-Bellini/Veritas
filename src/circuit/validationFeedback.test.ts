import { describe, expect, it } from 'vitest'
import { buildCircuitIssueGuidance, summarizeCircuitIssues } from './validationFeedback'
import type { CircuitIssue } from './editorModel'

describe('feedback de validação do editor', () => {
  it('mapeia cada código para uma correção acionável', () => {
    const codes: CircuitIssue['code'][] = [
      'duplicate-node',
      'invalid-node',
      'missing-node',
      'invalid-source-port',
      'invalid-target-port',
      'duplicate-target-port',
      'self-connection',
      'missing-input',
      'cycle',
      'invalid-width',
      'unsupported-width',
      'width-mismatch',
      'wireless-empty-channel',
      'wireless-duplicate-transmitter',
      'wireless-missing-transmitter',
      'wireless-channel-too-long',
      'custom-chip-missing-definition',
    ]
    const guidance = buildCircuitIssueGuidance(codes.map((code) => ({ code, message: `erro ${code}` })))

    expect(guidance).toHaveLength(codes.length)
    expect(guidance.every((item) => item.title.length > 0 && item.action.length > 0)).toBe(true)
    expect(guidance.find((item) => item.code === 'cycle')?.action).toContain('Interrompa')
    expect(guidance.find((item) => item.code === 'missing-input')?.action).toContain('Conecte')
    expect(guidance.find((item) => item.code === 'wireless-missing-transmitter')?.action).toContain('transmissor')
  })

  it('resume o primeiro problema e preserva o número total', () => {
    const summary = summarizeCircuitIssues([
      { code: 'width-mismatch', nodeId: 'out', message: 'largura incompatível' },
      { code: 'cycle', nodeId: 'gate', message: 'ciclo' },
    ])

    expect(summary).toEqual({
      valid: false,
      title: '2 problemas para corrigir',
      message: 'Larguras incompatíveis: Ajuste a largura da conexão ou faça a partição/concatenação com Splitter e Combiner; as portas conectadas precisam coincidir.',
    })
  })

  it('informa quando a estrutura está válida', () => {
    expect(summarizeCircuitIssues([])).toEqual({
      valid: true,
      title: 'Circuito validado',
      message: 'Nenhum problema de estrutura foi encontrado.',
    })
  })
})
