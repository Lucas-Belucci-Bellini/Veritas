export declare const HDL_ACCEPTANCE_IDS: readonly ['HDL-001', 'HDL-002', 'HDL-003']
export declare const HDL_TOOLCHAINS: readonly ['iverilog', 'ghdl']
export declare function isAcceptedHdlStatus(status: unknown): boolean
export declare function sanitizeHdlMessage(value: unknown): string
export declare function renderHdlReport(results: ReadonlyArray<{ id: string; status: string; operation: string; message: unknown }>, generatedAt?: string): string
