import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../lib/supabase'
import { toAiMetricEvent, type AiMetricEvent } from '../metrics/aiMetrics'

export type MetricsRealtimeStatus = 'disabled' | 'connecting' | 'connected' | 'error'

export function useAiMetrics(limit = 100) {
  const { user } = useAuth()
  const [events, setEvents] = useState<AiMetricEvent[]>([])
  const [status, setStatus] = useState<MetricsRealtimeStatus>('disabled')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !user) {
      setEvents([])
      setStatus('disabled')
      return
    }
    const { data, error: queryError } = await supabase
      .from('veritas_ai_metrics')
      .select('id,user_id,action,provider,latency_ms,success,confidence,content_hash,error_message,metadata,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (queryError) {
      setError(queryError.message)
      return
    }
    setEvents((data ?? []).flatMap((row) => {
      const event = toAiMetricEvent(row)
      return event ? [event] : []
    }))
    setError(null)
  }, [limit, user])

  useEffect(() => {
    const client = supabase
    if (!client || !user) {
      setEvents([])
      setStatus('disabled')
      return
    }
    let active = true
    setStatus('connecting')
    void load()

    const channel = client
      .channel(`veritas:ai-metrics:${user.id}`, { config: { private: true } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'veritas_ai_metrics', filter: `user_id=eq.${user.id}` }, (payload) => {
        const event = toAiMetricEvent(payload.new)
        if (!event || !active) return
        setEvents((current) => [event, ...current.filter((item) => item.id !== event.id)].slice(0, limit))
      })
      .subscribe((subscriptionStatus, subscriptionError) => {
        if (!active) return
        if (subscriptionStatus === 'SUBSCRIBED') setStatus('connected')
        if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
          setStatus('error')
          setError(subscriptionError?.message ?? 'O painel não conseguiu assinar as métricas em tempo real.')
        }
      })

    return () => {
      active = false
      void client.removeChannel(channel)
    }
  }, [limit, load, user])

  const summary = useMemo(() => {
    const successful = events.filter((event) => event.success)
    const llmCalls = events.filter((event) => event.provider === 'llm')
    const average = (values: number[]) => values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : 0
    return {
      totalCalls: events.length,
      successRate: events.length > 0 ? successful.length / events.length : 0,
      averageLatencyMs: average(events.map((event) => event.latencyMs)),
      averageConfidence: average(successful.flatMap((event) => event.confidence == null ? [] : [event.confidence])),
      llmCalls: llmCalls.length,
      heuristicCalls: events.filter((event) => event.provider === 'heuristic').length,
      lastCallAt: events[0]?.createdAt ?? null,
    }
  }, [events])

  return { events, summary, status, error, refresh: load }
}
