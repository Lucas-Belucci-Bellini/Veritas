import type { CircuitDocument } from '../circuit'
import { buildCircuitContext } from '../circuit'
import { supabase } from '../lib/supabase'

export type CircuitAiAction = 'analyze' | 'optimize'

export interface CircuitAiResult {
  action: CircuitAiAction
  provider: 'llm' | 'heuristic'
  summary: string
  suggestions: string[]
  optimizedDocument: CircuitDocument | null
  confidence: number
}

export async function requestCircuitAi(
  document: CircuitDocument,
  action: CircuitAiAction,
): Promise<CircuitAiResult> {
  if (!supabase) throw new Error('Supabase não está configurado neste ambiente.')
  const context = buildCircuitContext(document)
  const { data, error } = await supabase.functions.invoke('veritas-circuit-ai', {
    body: { action, context },
  })

  if (error) throw new Error(error.message || 'A análise de IA não pôde ser concluída.')
  if (!isCircuitAiResult(data)) throw new Error('A Edge Function devolveu uma análise inválida.')
  return data
}

function isCircuitAiResult(value: unknown): value is CircuitAiResult {
  if (!isRecord(value)) return false
  if (value.action !== 'analyze' && value.action !== 'optimize') return false
  if (value.provider !== 'llm' && value.provider !== 'heuristic') return false
  if (typeof value.summary !== 'string' || !Array.isArray(value.suggestions)) return false
  if (!value.suggestions.every((item) => typeof item === 'string')) return false
  if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence)) return false
  return value.optimizedDocument === null || isCircuitDocument(value.optimizedDocument)
}

function isCircuitDocument(value: unknown): value is CircuitDocument {
  if (!isRecord(value) || value.format !== 'veritas-circuit' || value.version !== 1) return false
  if (typeof value.name !== 'string' || !Array.isArray(value.nodes) || !Array.isArray(value.connections)) return false
  return value.nodes.every((node) => {
    if (!isRecord(node) || typeof node.id !== 'string' || typeof node.type !== 'string') return false
    return isRecord(node.position) && isFiniteNumber(node.position.x) && isFiniteNumber(node.position.y)
  }) && value.connections.every((connection) => {
    if (!isRecord(connection) || !isRecord(connection.source) || !isRecord(connection.target)) return false
    return typeof connection.source.node === 'string' && typeof connection.target.node === 'string' && Number.isInteger(connection.target.port)
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
