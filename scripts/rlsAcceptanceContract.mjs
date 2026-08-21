export const REQUIRED_RLS_IDS = Object.freeze(Array.from({ length: 22 }, (_, index) => `RLS-${String(index + 1).padStart(3, '0')}`))

function clean(value) {
  return String(value ?? '').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/password\s*=\s*\S+/gi, 'password=[redacted]').slice(0, 240)
}

export function renderRlsReport(prefix, results, generatedAt = new Date().toISOString()) {
  return [
    `# RLS acceptance ${generatedAt}`,
    '',
    `Fixture prefix: ${clean(prefix)}`,
    'Tokens e passwords não são gravados neste relatório.',
    '',
    ...results.map((result) => `${clean(result.id)} ${clean(result.status)} — ${clean(result.logicalUser)} — ${clean(result.operation)}: ${clean(result.message)}`),
    '',
    `Resumo: ${results.filter((result) => result.status === 'PASS').length} PASS, ${results.filter((result) => result.status === 'FAIL').length} FAIL, ${results.filter((result) => result.status === 'SKIP').length} SKIP.`,
  ].join('\n')
}
