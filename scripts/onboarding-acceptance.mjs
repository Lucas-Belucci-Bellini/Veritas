import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { ONBOARDING_ACCEPTANCE_IDS, renderOnboardingReport, sanitizeOnboardingMessage } from './onboardingAcceptanceContract.mjs'

const REPORT_PATH = resolve(process.cwd(), process.env.ONBOARDING_REPORT_PATH || `artifacts/onboarding-acceptance-${Date.now()}.md`)
const EXTERNAL_PASS = process.env.ONBOARDING_EXTERNAL_PASS === '1'

function read(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function result(id, status, operation, message) {
  return { id, status, operation, message: sanitizeOnboardingMessage(message) }
}

function checkIncludes(id, operation, path, fragments) {
  const source = read(path)
  const missing = fragments.filter((fragment) => !source.includes(fragment))
  return result(id, missing.length === 0 ? 'PASS' : 'FAIL', operation, missing.length === 0 ? `${path} contém o contrato de onboarding` : `${path} sem: ${missing.join(', ')}`)
}

function main() {
  const results = [
    checkIncludes('ONB-001', 'primeiros passos no app', 'src/App.tsx', ['Primeiros passos', 'Aprenda o fluxo básico em menos de um minuto', '1. Escreva:', '2. Observe:', '3. Preserve:', '4. Colabore:']),
    checkIncludes('ONB-002', 'guia público em português', 'README.md', ['docs/ONBOARDING.md', 'modo local funciona sem conta']),
    checkIncludes('ONB-003', 'guia cobre limites e recuperação', 'docs/ONBOARDING.md', ['O objetivo em dois minutos', 'IndexedDB', 'ROLLBACK-RUNBOOK.md', 'Limitações beta']),
    result('ONB-004', EXTERNAL_PASS ? 'PASS' : 'SKIP', 'sessão externa de primeiro uso', EXTERNAL_PASS ? 'confirmação externa fornecida por ONBOARDING_EXTERNAL_PASS=1' : 'aguardando pessoa externa seguir o checklist; não é convertido em PASS automaticamente'),
  ]
  const ids = results.map((item) => item.id)
  if (ids.length !== ONBOARDING_ACCEPTANCE_IDS.length || new Set(ids).size !== ids.length) throw new Error('IDs ONB incompletos ou duplicados')
  mkdirSync(dirname(REPORT_PATH), { recursive: true })
  const report = renderOnboardingReport(results)
  writeFileSync(REPORT_PATH, report)
  console.log(report)
  console.log(`Relatório sanitizado: ${REPORT_PATH}`)
  if (results.some((item) => item.status === 'FAIL')) process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(`Onboarding runner abortado: ${sanitizeOnboardingMessage(error)}`)
  process.exitCode = 1
}
