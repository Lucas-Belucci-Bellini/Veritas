export const ACCESSIBILITY_ACCEPTANCE_IDS = ['A11Y-001', 'A11Y-002', 'A11Y-003', 'A11Y-004', 'A11Y-005']

export function sanitizeAccessibilityMessage(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 240)
}

export function renderAccessibilityReport(results, generatedAt = new Date().toISOString()) {
  const lines = [
    `# Accessibility acceptance ${generatedAt}`,
    '',
    'O relatório contém somente checks estruturais e não dados de usuários.',
    '',
    ...results.map((item) => `${item.id} ${item.status} — ${item.operation}: ${sanitizeAccessibilityMessage(item.message)}`),
    '',
    `Resumo: ${results.filter((item) => item.status === 'PASS').length} PASS, ${results.filter((item) => item.status === 'FAIL').length} FAIL, ${results.filter((item) => item.status === 'SKIP').length} SKIP.`,
  ]
  return `${lines.join('\n')}\n`
}
