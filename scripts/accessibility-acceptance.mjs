import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { ACCESSIBILITY_ACCEPTANCE_IDS, renderAccessibilityReport, sanitizeAccessibilityMessage } from './accessibilityAcceptanceContract.mjs'

const REPORT_PATH = resolve(process.cwd(), process.env.ACCESSIBILITY_REPORT_PATH || `artifacts/accessibility-acceptance-${Date.now()}.md`)

function read(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function result(id, status, operation, message) {
  return { id, status, operation, message: sanitizeAccessibilityMessage(message) }
}

function checkIncludes(id, operation, path, fragments) {
  const source = read(path)
  const missing = fragments.filter((fragment) => !source.includes(fragment))
  return result(
    id,
    missing.length === 0 ? 'PASS' : 'FAIL',
    operation,
    missing.length === 0 ? `${path} contém os contratos esperados` : `${path} não contém: ${missing.join(', ')}`,
  )
}

function checkIncludesAcross(id, operation, checks) {
  const missing = []
  for (const [path, fragments] of checks) {
    const source = read(path)
    for (const fragment of fragments) {
      if (!source.includes(fragment)) missing.push(`${path}: ${fragment}`)
    }
  }
  return result(
    id,
    missing.length === 0 ? 'PASS' : 'FAIL',
    operation,
    missing.length === 0 ? 'viewport e canvas contêm os contratos esperados' : `contratos ausentes: ${missing.join(', ')}`,
  )
}

function runRegression() {
  try {
    execFileSync('npm', ['test', '--', '--run', 'src/release/accessibilityAcceptanceContract.test.ts'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: Number(process.env.ACCESSIBILITY_TEST_TIMEOUT_MS || 30000),
    })
    return result('A11Y-005', 'PASS', 'regressão do contrato acessível', 'accessibilityAcceptanceContract.test.ts aprovado')
  } catch (error) {
    return result('A11Y-005', 'FAIL', 'regressão do contrato acessível', [error?.stdout, error?.stderr, error?.message].filter(Boolean).join('\n'))
  }
}

function main() {
  const results = [
    checkIncludes('A11Y-001', 'landmarks e skip link', 'src/App.tsx', ['Pular para o conteúdo principal', 'id="main-content"', 'aria-labelledby="app-title"']),
    checkIncludes('A11Y-002', 'tabela verdade por teclado', 'src/components/TruthTableView.tsx', ['tabIndex={0}', 'aria-selected=', "event.key === 'Enter'", "event.key === ' '"]),
    checkIncludes('A11Y-003', 'anúncios de status', 'src/components/PwaStatus.tsx', ['aria-live="polite"', 'aria-atomic="true"']),
    checkIncludesAcross('A11Y-004', 'viewport e canvas responsivo', [
      ['index.html', ['lang="pt-BR"', 'name="viewport"', 'width=device-width']],
      ['src/components/CircuitEditor.tsx', ['h-[min(420px,70vh)]', 'aria-label="Canvas de edição do circuito"']],
    ]),
  ]
  results.push(runRegression())

  const ids = results.map((item) => item.id)
  if (ids.length !== ACCESSIBILITY_ACCEPTANCE_IDS.length || new Set(ids).size !== ids.length) {
    throw new Error('IDs A11Y incompletos ou duplicados')
  }
  mkdirSync(dirname(REPORT_PATH), { recursive: true })
  const report = renderAccessibilityReport(results)
  writeFileSync(REPORT_PATH, report)
  console.log(report)
  console.log(`Relatório sanitizado: ${REPORT_PATH}`)
  if (results.some((item) => item.status === 'FAIL')) process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(`Accessibility runner abortado: ${sanitizeAccessibilityMessage(error)}`)
  process.exitCode = 1
}
