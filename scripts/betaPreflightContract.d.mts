export declare function isTruthyFlag(value: unknown): boolean
export declare function isStrictBetaPreflight(env?: Record<string, unknown>): boolean
export declare function requiredEvidenceFlags(env?: Record<string, unknown>): {
  strict: boolean
  evidenceManifest: boolean
  rls: boolean
  realtime: boolean
  edge: boolean
  supabaseStructural: boolean
  smoke: boolean
}
