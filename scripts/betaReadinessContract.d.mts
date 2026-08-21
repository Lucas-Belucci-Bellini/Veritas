export declare const READINESS_IDS: readonly ['RDY-001', 'RDY-002', 'RDY-003', 'RDY-004', 'RDY-005', 'RDY-006']
export declare function sanitizeReadinessMessage(value: unknown): string
export declare function renderReadinessReport(results: ReadonlyArray<{ id: string; status: string; area: string; message: unknown }>, generatedAt?: string): string
