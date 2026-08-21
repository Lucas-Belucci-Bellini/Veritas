export declare const REAL_EVIDENCE_REQUIREMENTS: Readonly<Record<string, {
  label: string
  markers: readonly string[]
  ids: readonly string[]
}>>
export declare function missingEvidenceMarkers(report: unknown, kind: string): string[]
export declare function missingPassScenarios(report: unknown, kind: string): string[]
