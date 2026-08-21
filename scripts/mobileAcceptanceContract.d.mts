export declare const MOBILE_ACCEPTANCE_IDS: readonly ['MOBILE-001', 'MOBILE-002', 'MOBILE-003', 'MOBILE-004']
export interface MobileManualCheck {
  status: string
  evidence: string
}
export interface MobileManualEvidence {
  executionMode?: string
  runnerGuard?: string
  reviewer?: string
  device?: string
  browser?: string
  checkedAt?: string
  checks?: Record<string, MobileManualCheck>
}
export declare function validateMobileManualEvidence(evidence: unknown): string[]
export declare function renderMobileAcceptanceReport(evidence: MobileManualEvidence, generatedAt?: string): string
export declare function renderMobileSkipReport(generatedAt?: string): string
