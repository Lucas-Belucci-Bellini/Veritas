export const ONBOARDING_ACCEPTANCE_IDS = ['ONB-001', 'ONB-002', 'ONB-003', 'ONB-004']

export function sanitizeOnboardingMessage(value) {
  return String(value ?? '')
    .replace(/(token|password|secret|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

export function renderOnboardingReport(results, generatedAt = new Date().toISOString()) {
  const lines = [
    `# Onboarding acceptance ${generatedAt}`,
    '',
    'Checks estruturais não contêm dados privados; ONB-004 exige confirmação de pessoa externa.',
    '',
    ...results.map((item) => `${item.id} ${item.status} — ${item.operation}: ${sanitizeOnboardingMessage(item.message)}`),
    '',
    `Resumo: ${results.filter((item) => item.status === 'PASS').length} PASS, ${results.filter((item) => item.status === 'FAIL').length} FAIL, ${results.filter((item) => item.status === 'SKIP').length} SKIP.`,
  ]
  return `${lines.join('\n')}\n`
}
