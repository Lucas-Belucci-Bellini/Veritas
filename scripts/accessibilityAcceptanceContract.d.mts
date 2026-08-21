export declare const ACCESSIBILITY_ACCEPTANCE_IDS: readonly ['A11Y-001', 'A11Y-002', 'A11Y-003', 'A11Y-004', 'A11Y-005']
export declare function sanitizeAccessibilityMessage(value: unknown): string
export declare function renderAccessibilityReport(results: ReadonlyArray<{ id: string; status: string; operation: string; message: unknown }>, generatedAt?: string): string
