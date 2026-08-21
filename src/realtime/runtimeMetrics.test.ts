import { describe, expect, it } from 'vitest'
import { EMPTY_RUNTIME_METRICS, recordRuntimeMetric } from './runtimeMetrics'

describe('runtimeMetrics', () => {
  it('registra todos os eventos sem mutar o estado anterior', () => {
    const before = { ...EMPTY_RUNTIME_METRICS }
    const after = ['received', 'applied', 'version-conflict', 'expired', 'invalid-or-stale', 'published', 'publish-failure', 'apply-failure']
      .reduce((metrics, event, index) => recordRuntimeMetric(metrics, event as Parameters<typeof recordRuntimeMetric>[1], `2026-08-21T01:4${index}:00.000Z`), before)

    expect(after).toEqual({
      received: 1,
      applied: 1,
      versionConflicts: 1,
      expired: 1,
      invalidOrStale: 1,
      published: 1,
      publishFailures: 1,
      applyFailures: 1,
      events: expect.arrayContaining([
        expect.objectContaining({ id: 1, type: 'received', message: 'estado remoto recebido' }),
        expect.objectContaining({ id: 7, type: 'publish-failure', message: 'falha ao publicar estado temporal' }),
        expect.objectContaining({ id: 8, type: 'apply-failure', message: 'falha ao aplicar estado temporal' }),
      ]),
    })
    expect(before).toEqual(EMPTY_RUNTIME_METRICS)
  })

  it('acumula eventos repetidos de forma determinística', () => {
    const once = recordRuntimeMetric(EMPTY_RUNTIME_METRICS, 'expired', '2026-08-21T01:40:00.000Z')
    const twice = recordRuntimeMetric(once, 'expired', '2026-08-21T01:40:01.000Z')

    expect(twice.expired).toBe(2)
    expect(twice.received).toBe(0)
    expect(twice.events.map((event) => event.id)).toEqual([1, 2])
  })

  it('retém somente os últimos eventos', () => {
    let metrics = { ...EMPTY_RUNTIME_METRICS }
    for (let index = 0; index < 20; index += 1) metrics = recordRuntimeMetric(metrics, 'received', `2026-08-21T01:40:${String(index).padStart(2, '0')}.000Z`)

    expect(metrics.events).toHaveLength(12)
    expect(metrics.events[0].id).toBe(9)
    expect(metrics.received).toBe(20)
  })
})
