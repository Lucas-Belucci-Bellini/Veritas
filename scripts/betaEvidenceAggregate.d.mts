export declare const AGGREGATED_BETA_GATES: readonly string[]
export interface BetaEvidenceGate {
  status: string
  evidence: string
  statuses?: Array<{ id: string; status: string }>
  errors?: string[]
}
export interface AggregatedBetaManifest {
  version: string
  generatedAt: string
  openP0: string[]
  openP1: string[]
  gates: Record<string, BetaEvidenceGate>
}
export declare function parseEvidenceReport(text: unknown): Record<string, string>
export declare function aggregateBetaEvidence(options?: {
  version?: string
  generatedAt?: string
  rlsReport?: string
  edgeReport?: string
  realtimeReport?: string
  hdlReport?: string
  accessibilityReport?: string
  rollbackReport?: string
  onboardingReport?: string
  mcpReport?: string
  structuralReport?: unknown
  structuralProjectId?: string
  evidencePaths?: Record<string, string>
}): AggregatedBetaManifest
export declare function isAggregatedManifest(value: unknown): boolean
