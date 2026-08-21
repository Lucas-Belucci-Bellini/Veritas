export const HDL_ACCEPTANCE_IDS = ['HDL-001', 'HDL-002', 'HDL-003']
export const HDL_TOOLCHAINS = ['iverilog', 'ghdl']

export function isAcceptedHdlStatus(status) {
  return status === 'PASS' || status === 'SKIP' || status === 'FAIL'
}

export function sanitizeHdlMessage(value) {
  return String(value ?? '')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/(password|token|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

export function renderHdlReport(results, generatedAt = new Date().toISOString()) {
  const lines = [
    `# HDL acceptance ${generatedAt}`,
    '',
    'Fixtures são públicas e não contêm tokens ou dados de usuários.',
    '',
    ...results.map((item) => `${item.id} ${item.status} — ${item.operation}: ${sanitizeHdlMessage(item.message)}`),
    '',
    `Resumo: ${results.filter((item) => item.status === 'PASS').length} PASS, ${results.filter((item) => item.status === 'FAIL').length} FAIL, ${results.filter((item) => item.status === 'SKIP').length} SKIP.`,
  ]
  return `${lines.join('\n')}\n`
}
