import { supabase } from '../lib/supabase'

export type AiMetricAction = 'analyze' | 'optimize'
export type AiMetricProvider = 'llm' | 'heuristic' | 'unknown'

export interface AiMetricInput {
  action: AiMetricAction
  provider: AiMetricProvider
  latencyMs: number
  success: boolean
  confidence?: number | null
  contentHash?: string | null
  errorMessage?: string | null
  metadata?: Record<string, unknown>
}

export interface AiMetricEvent extends AiMetricInput {
  id: string
  userId: string
  createdAt: number
}

export async function recordAiMetric(input: AiMetricInput): Promise<void> {
  if (!supabase) return
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) return
    await supabase.from('veritas_ai_metrics').insert({
      user_id: authData.user.id,
      action: input.action,
      provider: input.provider,
      latency_ms: Math.max(0, Math.round(input.latencyMs)),
      success: input.success,
      confidence: input.confidence == null || !Number.isFinite(input.confidence) ? null : Math.max(0, Math.min(1, input.confidence)),
      content_hash: input.contentHash ?? null,
      error_message: input.errorMessage?.slice(0, 500) ?? null,
      metadata: input.metadata ?? {},
    })
  } catch {
    // Telemetry must never make circuit analysis fail.
  }
}

export function toAiMetricEvent(row: unknown): AiMetricEvent | null {
  if (!isRecord(row) || typeof row.id !== 'string' || typeof row.user_id !== 'string' || typeof row.action !== 'string' || typeof row.provider !== 'string' || typeof row.latency_ms !== 'number' || typeof row.success !== 'boolean' || typeof row.created_at !== 'string') return null
  if (row.action !== 'analyze' && row.action !== 'optimize') return null
  if (row.provider !== 'llm' && row.provider !== 'heuristic' && row.provider !== 'unknown') return null
  return {
    id: row.id,
    userId: row.user_id,
    action: row.action,
    provider: row.provider,
    latencyMs: row.latency_ms,
    success: row.success,
    confidence: typeof row.confidence === 'number' ? row.confidence : null,
    contentHash: typeof row.content_hash === 'string' ? row.content_hash : null,
    errorMessage: typeof row.error_message === 'string' ? row.error_message : null,
    metadata: isRecord(row.metadata) ? row.metadata : {},
    createdAt: Date.parse(row.created_at),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
