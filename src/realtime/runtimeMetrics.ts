export const RUNTIME_EVENT_HISTORY_LIMIT = 12

export interface RuntimeEvent {
  id: number
  at: string
  type: RuntimeMetricEvent
  message: string
}

export interface RuntimeMetrics {
  received: number
  applied: number
  versionConflicts: number
  expired: number
  invalidOrStale: number
  published: number
  publishFailures: number
  events: RuntimeEvent[]
}

export type RuntimeMetricEvent =
  | 'received'
  | 'applied'
  | 'version-conflict'
  | 'expired'
  | 'invalid-or-stale'
  | 'published'
  | 'publish-failure'

export const EMPTY_RUNTIME_METRICS: RuntimeMetrics = {
  received: 0,
  applied: 0,
  versionConflicts: 0,
  expired: 0,
  invalidOrStale: 0,
  published: 0,
  publishFailures: 0,
  events: [],
}

const EVENT_MESSAGES: Record<RuntimeMetricEvent, string> = {
  received: 'estado remoto recebido',
  applied: 'estado remoto aplicado',
  'version-conflict': 'conflito de versão rejeitado',
  expired: 'oferta remota expirada',
  'invalid-or-stale': 'oferta inválida ou antiga rejeitada',
  published: 'estado temporal publicado',
  'publish-failure': 'falha ao publicar estado temporal',
}

export function recordRuntimeMetric(metrics: RuntimeMetrics, event: RuntimeMetricEvent, at = new Date().toISOString()): RuntimeMetrics {
  const next = { ...metrics, events: [...metrics.events] }
  switch (event) {
    case 'received':
      next.received += 1
      break
    case 'applied':
      next.applied += 1
      break
    case 'version-conflict':
      next.versionConflicts += 1
      break
    case 'expired':
      next.expired += 1
      break
    case 'invalid-or-stale':
      next.invalidOrStale += 1
      break
    case 'published':
      next.published += 1
      break
    case 'publish-failure':
      next.publishFailures += 1
      break
  }
  next.events = [
    ...next.events,
    {
      id: next.events.length > 0 ? next.events[next.events.length - 1].id + 1 : 1,
      at,
      type: event,
      message: EVENT_MESSAGES[event],
    },
  ].slice(-RUNTIME_EVENT_HISTORY_LIMIT)
  return next
}
