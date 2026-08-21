export declare const RELEASE_CHANNELS: readonly ['alpha', 'beta', 'rc', 'stable']
export declare function classifyReleaseVersion(version: unknown): 'alpha' | 'beta' | 'rc' | 'stable' | 'invalid'
export declare function validateReleasePromotion(input?: { version?: unknown; preflightStrict?: boolean; evidenceStatus?: string; approval?: boolean }): { channel: string; allowed: boolean; errors: string[] }
