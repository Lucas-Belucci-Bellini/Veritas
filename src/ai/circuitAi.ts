import type { CircuitDocument } from '../circuit'
import { buildCircuitContext, isCircuitDocumentShape, validateCircuit, type CustomChipLibraryEntry } from '../circuit'
import { supabase } from '../lib/supabase'
import { recordAiMetric } from '../metrics/aiMetrics'

export type CircuitAiAction = 'analyze' | 'optimize'

export interface CircuitAiResult {
  action: CircuitAiAction
  provider: 'llm' | 'heuristic'
  summary: string
  suggestions: string[]
  optimizedDocument: CircuitDocument | null
  confidence: number
}

export interface CircuitAiOptions {
  customChips?: readonly CustomChipLibraryEntry[]
}

export async function requestCircuitAi(
  document: CircuitDocument,
  action: CircuitAiAction,
  instruction?: string,
  options: CircuitAiOptions = {},
): Promise<CircuitAiResult> {
  if (!supabase) throw new Error('Supabase não está configurado neste ambiente.')
  const context = buildCircuitContext(document, undefined, { customChips: options.customChips })
  const normalizedInstruction = instruction?.trim().slice(0, 1200)
  const startedAt = Date.now()
  try {
    const { data, error } = await supabase.functions.invoke('veritas-circuit-ai', {
      body: { action, context, ...(normalizedInstruction ? { instruction: normalizedInstruction } : {}) },
    })

    if (error) throw new Error(error.message || 'A análise de IA não pôde ser concluída.')
    if (!isCircuitAiResult(data, options.customChips)) throw new Error('A Edge Function devolveu uma análise inválida.')
    void recordAiMetric({
      action,
      provider: data.provider,
      latencyMs: Date.now() - startedAt,
      success: true,
      confidence: data.confidence,
      contentHash: context.contentHash,
    })
    return data
  } catch (error) {
    void recordAiMetric({
      action,
      provider: 'unknown',
      latencyMs: Date.now() - startedAt,
      success: false,
      contentHash: context.contentHash,
      errorMessage: error instanceof Error ? error.message : 'Erro desconhecido',
    })
    throw error
  }
}

function isCircuitAiResult(value: unknown, customChips: readonly CustomChipLibraryEntry[] = []): value is CircuitAiResult {
  if (!isRecord(value)) return false
  if (value.action !== 'analyze' && value.action !== 'optimize') return false
  if (value.provider !== 'llm' && value.provider !== 'heuristic') return false
  if (typeof value.summary !== 'string' || !Array.isArray(value.suggestions)) return false
  if (!value.suggestions.every((item) => typeof item === 'string')) return false
  if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence)) return false
  return value.optimizedDocument === null || isCircuitDocument(value.optimizedDocument, customChips)
}

function isCircuitDocument(value: unknown, customChips: readonly CustomChipLibraryEntry[] = []): value is CircuitDocument {
  return isCircuitDocumentShape(value) && validateCircuit(value, { allowBuses: true, customChips }).length === 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
