import { describe, expect, it } from 'vitest'
import {
  edgeEndpoint,
  isSuccessfulAnalysisStatus,
  isUnauthorizedStatus,
  sanitizeEdgeMessage,
} from '../../scripts/edgeAcceptanceContract.mjs'

describe('contrato do smoke da Edge Function', () => {
  it('classifica ausência de JWT como 401/403 e não aceita outros status', () => {
    expect(isUnauthorizedStatus(401)).toBe(true)
    expect(isUnauthorizedStatus(403)).toBe(true)
    expect(isUnauthorizedStatus(200)).toBe(false)
    expect(isUnauthorizedStatus(500)).toBe(false)
  })

  it('classifica somente respostas 2xx como sucesso de análise', () => {
    expect(isSuccessfulAnalysisStatus(200)).toBe(true)
    expect(isSuccessfulAnalysisStatus(204)).toBe(true)
    expect(isSuccessfulAnalysisStatus(400)).toBe(false)
    expect(isSuccessfulAnalysisStatus(500)).toBe(false)
  })

  it('monta endpoint e remove segredos das mensagens', () => {
    expect(edgeEndpoint('https://example.supabase.co/')).toBe('https://example.supabase.co/functions/v1/veritas-circuit-ai')
    const sanitized = sanitizeEdgeMessage('Bearer abc token=secret api_key=private password=hidden')
    expect(sanitized).toContain('Bearer [redacted]')
    expect(sanitized).not.toContain('secret')
    expect(sanitized).not.toContain('private')
    expect(sanitized).not.toContain('hidden')
  })
})
