export interface RuntimeMetrics {
  received: number
  applied: number
  versionConflicts: number
  expired: number
  invalidOrStale: number
  published: number
  publishFailures: number
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
}

export function recordRuntimeMetric(metrics: RuntimeMetrics, event: RuntimeMetricEvent): RuntimeMetrics {
  const next = { ...metrics }
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
  return next
}
