export declare const MCP_ACCEPTANCE_IDS: readonly ['MCP-001', 'MCP-002', 'MCP-003', 'MCP-004', 'MCP-005', 'MCP-006', 'MCP-007', 'MCP-008', 'MCP-009', 'MCP-010', 'MCP-EQ-001', 'MCP-EQ-002', 'MCP-DIFF-001', 'MCP-DIFF-002', 'MCP-TB-001', 'MCP-TB-002']
export declare function sanitizeMcpMessage(value: unknown): string
export declare function renderMcpReport(results: ReadonlyArray<{ id: string; status: string; operation: string; message: unknown }>, generatedAt?: string): string
