export declare const MCP_ACCEPTANCE_IDS: readonly ['MCP-001', 'MCP-002', 'MCP-003', 'MCP-004', 'MCP-005', 'MCP-006']
export declare function sanitizeMcpMessage(value: unknown): string
export declare function renderMcpReport(results: ReadonlyArray<{ id: string; status: string; operation: string; message: unknown }>, generatedAt?: string): string
