export const MOBILE_ACCEPTANCE_IDS = ['MOBILE-001', 'MOBILE-002', 'MOBILE-003', 'MOBILE-004']

const REAL_EXECUTION_MODE = 'REAL_MANUAL'
const REAL_RUNNER_GUARD = 'MOBILE_MANUAL_ALLOW_REAL=1'

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function validateMobileManualEvidence(evidence) {
  const errors = []
  if (!isRecord(evidence)) return ['evidência mobile precisa ser um objeto JSON']
  if (evidence.executionMode !== REAL_EXECUTION_MODE) errors.push(`executionMode precisa ser ${REAL_EXECUTION_MODE}`)
  if (evidence.runnerGuard !== REAL_RUNNER_GUARD) errors.push(`runnerGuard precisa ser ${REAL_RUNNER_GUARD}`)
  for (const field of ['reviewer', 'device', 'browser', 'checkedAt']) {
    if (!nonEmptyString(evidence[field])) errors.push(`${field} precisa ser uma string não vazia`)
  }
  if (!isRecord(evidence.checks)) {
    errors.push('checks precisa ser um objeto')
    return errors
  }
  for (const id of MOBILE_ACCEPTANCE_IDS) {
    const check = evidence.checks[id]
    if (!isRecord(check)) {
      errors.push(`${id} não foi declarado`)
      continue
    }
    if (check.status !== 'PASS') errors.push(`${id} precisa estar PASS`)
    if (!nonEmptyString(check.evidence)) errors.push(`${id} precisa possuir evidência não vazia`)
  }
  return errors
}

export function renderMobileAcceptanceReport(evidence, generatedAt = new Date().toISOString()) {
  const errors = validateMobileManualEvidence(evidence)
  const lines = [
    `# Mobile acceptance ${generatedAt}`,
    '',
    errors.length === 0 ? 'Execution mode: REAL_MANUAL' : 'Execution mode: INVALID_OR_INCOMPLETE',
    errors.length === 0 ? `Runner guard: ${REAL_RUNNER_GUARD}` : 'Runner guard: not verified',
    errors.length === 0 ? `Reviewer: ${evidence.reviewer}` : 'Reviewer: not verified',
    errors.length === 0 ? `Device: ${evidence.device}` : 'Device: not verified',
    errors.length === 0 ? `Browser: ${evidence.browser}` : 'Browser: not verified',
    errors.length === 0 ? `Checked at: ${evidence.checkedAt}` : 'Checked at: not verified',
    '',
  ]
  for (const id of MOBILE_ACCEPTANCE_IDS) {
    const check = evidence?.checks?.[id]
    const status = errors.length === 0 ? 'PASS' : 'FAIL'
    const message = errors.length === 0 ? `${check.evidence}` : errors.join('; ')
    lines.push(`${id} ${status} — ${message}`)
  }
  lines.push('', `Resumo: ${errors.length === 0 ? MOBILE_ACCEPTANCE_IDS.length : 0} PASS, ${errors.length === 0 ? 0 : MOBILE_ACCEPTANCE_IDS.length} FAIL, 0 SKIP.`)
  return `${lines.join('\n')}\n`
}

export function renderMobileSkipReport(generatedAt = new Date().toISOString()) {
  const lines = [
    `# Mobile acceptance ${generatedAt}`,
    '',
    'Execution mode: NOT_RUN',
    'Runner guard: not provided',
    'A inspeção manual exige um checklist externo e não é simulada pelo runner.',
    '',
    ...MOBILE_ACCEPTANCE_IDS.map((id) => `${id} SKIP — confirmação manual ausente`),
    '',
    'Resumo: 0 PASS, 0 FAIL, 4 SKIP.',
  ]
  return `${lines.join('\n')}\n`
}
