export declare const ONBOARDING_ACCEPTANCE_IDS: readonly ['ONB-001', 'ONB-002', 'ONB-003', 'ONB-004']
export declare function sanitizeOnboardingMessage(value: unknown): string
export declare function renderOnboardingReport(results: ReadonlyArray<{ id: string; status: string; operation: string; message: unknown }>, generatedAt?: string): string
