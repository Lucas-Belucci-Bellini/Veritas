import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import {
  renderMobileAcceptanceReport,
  renderMobileSkipReport,
  validateMobileManualEvidence,
} from './mobileAcceptanceContract.mjs'

const reportPath = resolve(process.cwd(), process.env.MOBILE_REPORT_PATH || `artifacts/mobile-acceptance-${Date.now()}.md`)
const evidencePath = process.env.MOBILE_MANUAL_EVIDENCE_PATH || ''

function main() {
  if (!evidencePath) {
    const report = renderMobileSkipReport()
    mkdirSync(dirname(reportPath), { recursive: true })
    writeFileSync(reportPath, report)
    console.log(report)
    console.log(`Relatório mobile sanitizado: ${reportPath}`)
    return
  }

  if (process.env.MOBILE_MANUAL_ALLOW_REAL !== '1') {
    throw new Error('MOBILE_MANUAL_ALLOW_REAL=1 é obrigatório para aceitar inspeção manual real')
  }
  const absoluteEvidencePath = resolve(process.cwd(), evidencePath)
  if (!existsSync(absoluteEvidencePath)) throw new Error('MOBILE_MANUAL_EVIDENCE_PATH não foi encontrado')
  const evidence = JSON.parse(readFileSync(absoluteEvidencePath, 'utf8'))
  const errors = validateMobileManualEvidence(evidence)
  const report = renderMobileAcceptanceReport(evidence)
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, report)
  console.log(report)
  console.log(`Relatório mobile sanitizado: ${reportPath}`)
  if (errors.length > 0) process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(`Mobile acceptance runner abortado: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
