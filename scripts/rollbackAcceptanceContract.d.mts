export declare const ROLLBACK_ACCEPTANCE_IDS: readonly ['RB-001', 'RB-002', 'RB-003', 'RB-004', 'RB-005']
export declare function sanitizeRollbackMessage(value: unknown): string
export declare function renderRollbackReport(results: ReadonlyArray<{ id: string; status: string; operation: string; message: unknown }>, generatedAt?: string): string
