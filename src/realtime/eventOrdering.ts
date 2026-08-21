export type RealtimeEventKind = 'snapshot' | 'runtime_config' | 'runtime_state'

export interface RealtimeEventEnvelope {
  baseVersion: number
  sentAt: string
  clientId: string
  hash: string
}

export interface RealtimeOrderingState {
  latest: Partial<Record<RealtimeEventKind, RealtimeEventEnvelope>>
}

export type RealtimeEventDecisionReason =
  | 'accepted'
  | 'newer-version'
  | 'newer-timestamp'
  | 'tie-breaker'
  | 'duplicate'
  | 'stale-version'
  | 'older-timestamp'
  | 'losing-tie-breaker'

export interface RealtimeEventDecision {
  accepted: boolean
  reason: RealtimeEventDecisionReason
  state: RealtimeOrderingState
}

export function createRealtimeOrderingState(): RealtimeOrderingState {
  return { latest: {} }
}

export function reduceRealtimeEvent(
  state: RealtimeOrderingState,
  kind: RealtimeEventKind,
  next: RealtimeEventEnvelope,
): RealtimeEventDecision {
  const current = state.latest[kind]
  if (!current) return accepted(state, kind, next, 'accepted')

  const comparison = compareRealtimeEvents(next, current)
  if (comparison <= 0) {
    return {
      accepted: false,
      reason: next.baseVersion < current.baseVersion
        ? 'stale-version'
        : Date.parse(next.sentAt) < Date.parse(current.sentAt)
          ? 'older-timestamp'
          : next.clientId === current.clientId && next.hash === current.hash
            ? 'duplicate'
            : 'losing-tie-breaker',
      state,
    }
  }

  const reason = next.baseVersion > current.baseVersion
    ? 'newer-version'
    : Date.parse(next.sentAt) > Date.parse(current.sentAt)
      ? 'newer-timestamp'
      : 'tie-breaker'
  return accepted(state, kind, next, reason)
}

export function compareRealtimeEvents(left: RealtimeEventEnvelope, right: RealtimeEventEnvelope): number {
  if (left.baseVersion !== right.baseVersion) return left.baseVersion - right.baseVersion
  const leftTime = Date.parse(left.sentAt)
  const rightTime = Date.parse(right.sentAt)
  if (leftTime !== rightTime) return leftTime - rightTime
  const clientComparison = left.clientId.localeCompare(right.clientId)
  if (clientComparison !== 0) return clientComparison
  return left.hash.localeCompare(right.hash)
}

function accepted(
  state: RealtimeOrderingState,
  kind: RealtimeEventKind,
  envelope: RealtimeEventEnvelope,
  reason: RealtimeEventDecisionReason,
): RealtimeEventDecision {
  return {
    accepted: true,
    reason,
    state: {
      latest: { ...state.latest, [kind]: envelope },
    },
  }
}
