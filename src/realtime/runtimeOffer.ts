export type RuntimeOfferApplyDecision = 'current' | 'stale'

export function runtimeOfferDecision(baseVersion: number, currentVersion: number): RuntimeOfferApplyDecision {
  return Number.isInteger(baseVersion) && baseVersion >= 0 && baseVersion === currentVersion ? 'current' : 'stale'
}
