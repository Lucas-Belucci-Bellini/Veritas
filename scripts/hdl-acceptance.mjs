import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { HDL_ACCEPTANCE_IDS, renderHdlReport, sanitizeHdlMessage } from './hdlAcceptanceContract.mjs'

const REQUIRE_TOOLCHAINS = process.env.HDL_REQUIRE_TOOLCHAINS === '1'
const REPORT_PATH = resolve(process.cwd(), process.env.HDL_REPORT_PATH || `artifacts/hdl-acceptance-${Date.now()}.md`)
const FIXTURE_DIR = resolve(process.cwd(), 'tests/fixtures/hdl')
const TMP_DIR = resolve(process.cwd(), process.env.HDL_TMP_DIR || `.tmp/hdl-acceptance-${Date.now()}`)

function run(command, args, options = {}) {
  try {
    const stdout = execFileSync(command, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: Number(process.env.HDL_COMMAND_TIMEOUT_MS || 30000),
      ...options,
    })
    return { status: 0, output: stdout }
  } catch (error) {
    const output = [error?.stdout, error?.stderr, error?.message].filter(Boolean).join('\n')
    return { status: typeof error?.status === 'number' ? error.status : 1, output }
  }
}

function hasCommand(command) {
  const result = run('sh', ['-lc', `command -v ${command}`])
  return result.status === 0 && result.output.trim().length > 0
}

function result(id, status, operation, message) {
  return { id, status, operation, message: sanitizeHdlMessage(message) }
}

function compileVerilog() {
  if (!hasCommand('iverilog')) {
    return result('HDL-001', REQUIRE_TOOLCHAINS ? 'FAIL' : 'SKIP', 'compilação Verilog', REQUIRE_TOOLCHAINS ? 'iverilog não está instalado no ambiente obrigatório' : 'iverilog não está instalado; evidência de compilação ficou SKIP')
  }
  mkdirSync(TMP_DIR, { recursive: true })
  const compile = run('iverilog', ['-g2005', '-o', resolve(TMP_DIR, 'vector_and.vvp'), resolve(FIXTURE_DIR, 'vector_and.v')])
  return result('HDL-001', compile.status === 0 ? 'PASS' : 'FAIL', 'compilação Verilog', compile.status === 0 ? 'fixture vector_and.v compilada com iverilog' : compile.output)
}

function compileVhdl() {
  if (!hasCommand('ghdl')) {
    return result('HDL-002', REQUIRE_TOOLCHAINS ? 'FAIL' : 'SKIP', 'compilação VHDL', REQUIRE_TOOLCHAINS ? 'ghdl não está instalado no ambiente obrigatório' : 'ghdl não está instalado; evidência de compilação ficou SKIP')
  }
  mkdirSync(TMP_DIR, { recursive: true })
  const compile = run('ghdl', ['-a', '--std=08', '--workdir=' + TMP_DIR, resolve(FIXTURE_DIR, 'vector_and.vhd')])
  return result('HDL-002', compile.status === 0 ? 'PASS' : 'FAIL', 'compilação VHDL', compile.status === 0 ? 'fixture vector_and.vhd analisada com ghdl' : compile.output)
}

function exportRegression() {
  const test = run('npm', ['test', '--', '--run', 'src/circuit/export.test.ts', 'src/release/hdlAcceptanceContract.test.ts'])
  return result('HDL-003', test.status === 0 ? 'PASS' : 'FAIL', 'regressão determinística do exportador', test.status === 0 ? 'export.test.ts e hdlAcceptanceContract.test.ts aprovados' : test.output)
}

function main() {
  mkdirSync(dirname(REPORT_PATH), { recursive: true })
  const results = [compileVerilog(), compileVhdl(), exportRegression()]
  const unknown = results.filter((item) => !HDL_ACCEPTANCE_IDS.includes(item.id) || !['PASS', 'SKIP', 'FAIL'].includes(item.status))
  if (unknown.length > 0) throw new Error('resultado HDL fora do contrato')
  const report = renderHdlReport(results)
  writeFileSync(REPORT_PATH, report)
  console.log(report)
  console.log(`Relatório sanitizado: ${REPORT_PATH}`)
  if (results.some((item) => item.status === 'FAIL')) process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(`HDL runner abortado: ${sanitizeHdlMessage(error)}`)
  process.exitCode = 1
}
