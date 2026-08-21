export const ROLLBACK_ACCEPTANCE_IDS = ['RB-001', 'RB-002', 'RB-003', 'RB-004', 'RB-005']

export function sanitizeRollbackMessage(value) {
  return String(value ?? '')
    .replace(/https?:\/\/[^\s]+/gi, '[url]')
    .replace(/(token|password|secret|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

export function renderRollbackReport(results, generatedAt = new Date().toISOString()) {
  const lines = [
    `# Rollback acceptance ${generatedAt}`,
    '',
    'O ensaio não move tags, não apaga releases, não reescreve migrations e não altera dados remotos.',
    '',
    ...results.map((item) => `${item.id} ${item.status} — ${item.operation}: ${sanitizeRollbackMessage(item.message)}`),
    '',
    `Resumo: ${results.filter((item) => item.status === 'PASS').length} PASS, ${results.filter((item) => item.status === 'FAIL').length} FAIL, ${results.filter((item) => item.status === 'SKIP').length} SKIP.`,
  ]
  return `${lines.join('\n')}\n`
}
