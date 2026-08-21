export const READINESS_IDS = ['RDY-001', 'RDY-002', 'RDY-003', 'RDY-004', 'RDY-005', 'RDY-006']

export function sanitizeReadinessMessage(value) {
  return String(value ?? '')
    .replace(/(token|password|secret|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/https?:\/\/[^\s]+/gi, '[url]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280)
}

export function renderReadinessReport(results, generatedAt = new Date().toISOString()) {
  const lines = [
    `# Beta readiness ${generatedAt}`,
    '',
    'Diagnóstico somente local: não abre sessões Supabase, não faz requests de rede e não imprime valores de ambiente.',
    '',
    ...results.map((item) => `${item.id} ${item.status} — ${item.area}: ${sanitizeReadinessMessage(item.message)}`),
    '',
    `Resumo: ${results.filter((item) => item.status === 'READY').length} READY, ${results.filter((item) => item.status === 'BLOCKED').length} BLOCKED, ${results.filter((item) => item.status === 'SKIP').length} SKIP.`,
  ]
  return `${lines.join('\n')}\n`
}
