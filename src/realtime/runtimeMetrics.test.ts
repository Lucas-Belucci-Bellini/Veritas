import { describe, expect, it } from 'vitest'
import { EMPTY_RUNTIME_METRICS, recordRuntimeMetric } from './runtimeMetrics'

describe('runtimeMetrics', () => {
  it('registra todos os eventos sem mutar o estado anterior', () => {
    const before = { ...EMPTY_RUNTIME_METRICS }
    const after = ['received', 'applied', 'version-conflict', 'expired', 'invalid-or-stale', 'published', 'publish-failure']
      .reduce((metrics, event) => recordRuntimeMetric(metrics, event as Parameters<typeof recordRuntimeMetric>[1]), before)

    expect(after).toEqual({
      received: 1,
      applied: 1,
      versionConflicts: 1,
      expired: 1,
      invalidOrStale: 1,
      published: 1,
      publishFailures: 1,
    })
    expect(before).toEqual(EMPTY_RUNTIME_METRICS)
  })

  it('acumula eventos repetidos de forma determinística', () => {
    const once = recordRuntimeMetric(EMPTY_RUNTIME_METRICS, 'expired')
    const twice = recordRuntimeMetric(once, 'expired')

    expect(twice.expired).toBe(2)
    expect(twice.received).toBe(0)
  })
})
