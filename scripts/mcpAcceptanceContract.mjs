export const MCP_ACCEPTANCE_IDS = ['MCP-001', 'MCP-002', 'MCP-003', 'MCP-004', 'MCP-005', 'MCP-006', 'MCP-007']

export function sanitizeMcpMessage(value) {
  return String(value ?? '')
    .replace(/(token|password|secret|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
}

export function renderMcpReport(results, generatedAt = new Date().toISOString()) {
  const lines = [
    `# MCP acceptance ${generatedAt}`,
    '',
    'O ensaio usa somente stdio local, sem sessão de IA, rede externa ou dados privados.',
    '',
    ...results.map((item) => `${item.id} ${item.status} — ${item.operation}: ${sanitizeMcpMessage(item.message)}`),
    '',
    `Resumo: ${results.filter((item) => item.status === 'PASS').length} PASS, ${results.filter((item) => item.status === 'FAIL').length} FAIL, ${results.filter((item) => item.status === 'SKIP').length} SKIP.`,
  ]
  return `${lines.join('\n')}\n`
}
