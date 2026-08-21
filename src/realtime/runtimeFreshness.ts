export const RUNTIME_STATE_MAX_AGE_MS = 30_000
export const RUNTIME_STATE_FUTURE_TOLERANCE_MS = 5_000

export interface RuntimeFreshness {
  sentAtMs: number
  ageMs: number
  expiresInMs: number
}

export function runtimeFreshness(
  sentAt: string,
  nowMs = Date.now(),
  maxAgeMs = RUNTIME_STATE_MAX_AGE_MS,
): RuntimeFreshness | null {
  const sentAtMs = Date.parse(sentAt)
  if (!Number.isFinite(sentAtMs)) return null
  const ageMs = nowMs - sentAtMs
  if (ageMs < -RUNTIME_STATE_FUTURE_TOLERANCE_MS || ageMs > maxAgeMs) return null
  return {
    sentAtMs,
    ageMs,
    expiresInMs: Math.max(0, maxAgeMs - ageMs),
  }
}

export function isRuntimeStateFresh(sentAt: string, nowMs = Date.now(), maxAgeMs = RUNTIME_STATE_MAX_AGE_MS): boolean {
  return runtimeFreshness(sentAt, nowMs, maxAgeMs) !== null
}
