#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { validateBetaEvidenceManifest } from './betaEvidence.mjs'
import { validateSupabaseStructuralAudit } from './supabaseStructuralAudit.mjs'

const root = resolve(new URL('..', import.meta.url).pathname)
const failures = []
const skips = []
const passes = []

function envFlag(name) {
  return ['1', 'true', 'yes', 'on'].includes((process.env[name] ?? '').toLowerCase())
}

function recordSkip(name, reason) {
  skips.push(`${name}: ${reason}`)
  console.log(`SKIP ${name} — ${reason}`)
}

function run(name, command, args, options = {}) {
  console.log(`\n==> ${name}`)
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CI: process.env.CI ?? '1' },
    ...options,
  })

  if (result.error) {
    failures.push(`${name}: ${result.error.message}`)
    console.error(`FAIL ${name}`)
    return false
  }

  if (result.status !== 0) {
    failures.push(`${name}: exit code ${result.status ?? 'unknown'}`)
    console.error(`FAIL ${name}`)
    return false
  }

  passes.push(name)
  console.log(`PASS ${name}`)
  return true
}

function readPackageVersion() {
  const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  return packageJson.version
}

function checkVersion() {
  const expected = process.env.BETA_EXPECTED_VERSION ?? process.env.GITHUB_REF_NAME?.replace(/^v/, '')
  if (!expected) {
    recordSkip('versão candidata', 'defina BETA_EXPECTED_VERSION ou GITHUB_REF_NAME para exigir comparação')
    return
  }

  const actual = readPackageVersion()
  if (actual !== expected) {
    failures.push(`versão candidata: package.json=${actual}, esperado=${expected}`)
    console.error(`FAIL versão candidata: package.json=${actual}, esperado=${expected}`)
    return
  }

  passes.push(`versão candidata ${actual}`)
  console.log(`PASS versão candidata ${actual}`)
}

function checkCleanTree() {
  if (envFlag('BETA_ALLOW_DIRTY')) {
    recordSkip('árvore Git limpa', 'BETA_ALLOW_DIRTY está habilitado explicitamente')
    return
  }

  const result = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) {
    failures.push('árvore Git limpa: não foi possível consultar git status')
    console.error('FAIL árvore Git limpa')
    return
  }

  if (result.stdout.trim()) {
    failures.push('árvore Git limpa: há arquivos modificados ou não rastreados')
    console.error('FAIL árvore Git limpa')
    console.error(result.stdout.trim())
    return
  }

  passes.push('árvore Git limpa')
  console.log('PASS árvore Git limpa')
}

function checkEvidenceManifest() {
  const manifestPath = process.env.BETA_EVIDENCE_MANIFEST
  const required = envFlag('BETA_PREFLIGHT_REQUIRE_EVIDENCE')
  if (!manifestPath) {
    if (required) {
      failures.push('manifesto beta: BETA_EVIDENCE_MANIFEST não foi definido')
      console.error('FAIL manifesto beta: defina BETA_EVIDENCE_MANIFEST com as evidências externas')
    } else {
      recordSkip('manifesto beta', 'defina BETA_EVIDENCE_MANIFEST; use BETA_PREFLIGHT_REQUIRE_EVIDENCE=1 para torná-lo obrigatório')
    }
    return
  }

  let manifest
  try {
    manifest = JSON.parse(readFileSync(resolve(process.cwd(), manifestPath), 'utf8'))
  } catch (error) {
    failures.push(`manifesto beta: não foi possível ler ou interpretar ${manifestPath}`)
    console.error(`FAIL manifesto beta: ${error instanceof Error ? error.message : String(error)}`)
    return
  }

  const expectedVersion = process.env.BETA_EXPECTED_VERSION ?? readPackageVersion()
  const errors = validateBetaEvidenceManifest(manifest, expectedVersion)
  if (errors.length > 0) {
    failures.push(`manifesto beta: ${errors.join('; ')}`)
    console.error(`FAIL manifesto beta: ${errors.join('; ')}`)
    return
  }

  passes.push(`manifesto beta ${expectedVersion}`)
  console.log(`PASS manifesto beta ${expectedVersion}`)
}

function checkSupabaseStructuralAudit() {
  const reportPath = process.env.BETA_SUPABASE_STRUCTURAL_REPORT
  const required = envFlag('BETA_PREFLIGHT_REQUIRE_SUPABASE_STRUCTURAL')
  if (!reportPath) {
    if (required) {
      failures.push('auditoria estrutural Supabase: BETA_SUPABASE_STRUCTURAL_REPORT não foi definido')
      console.error('FAIL auditoria estrutural Supabase: defina BETA_SUPABASE_STRUCTURAL_REPORT')
    } else {
      recordSkip('auditoria estrutural Supabase', 'defina BETA_SUPABASE_STRUCTURAL_REPORT; use BETA_PREFLIGHT_REQUIRE_SUPABASE_STRUCTURAL=1 para torná-la obrigatória')
    }
    return
  }

  let report
  try {
    report = JSON.parse(readFileSync(resolve(process.cwd(), reportPath), 'utf8'))
  } catch (error) {
    failures.push(`auditoria estrutural Supabase: não foi possível ler ou interpretar ${reportPath}`)
    console.error(`FAIL auditoria estrutural Supabase: ${error instanceof Error ? error.message : String(error)}`)
    return
  }

  const errors = validateSupabaseStructuralAudit(report, process.env.BETA_SUPABASE_PROJECT_ID)
  if (errors.length > 0) {
    failures.push(`auditoria estrutural Supabase: ${errors.join('; ')}`)
    console.error(`FAIL auditoria estrutural Supabase: ${errors.join('; ')}`)
    return
  }

  passes.push('auditoria estrutural Supabase')
  console.log('PASS auditoria estrutural Supabase')
}

function checkRlsReport() {
  const reportPath = process.env.BETA_RLS_REPORT
  const required = envFlag('BETA_PREFLIGHT_REQUIRE_RLS')
  if (!reportPath) {
    if (required) {
      failures.push('matriz RLS: BETA_RLS_REPORT não foi definido')
      console.error('FAIL matriz RLS: defina BETA_RLS_REPORT com o relatório real RLS-001…RLS-022')
    } else {
      recordSkip('matriz RLS real', 'defina BETA_RLS_REPORT; o preflight local não cria sessões Supabase automaticamente')
    }
    return
  }

  let report
  try {
    report = readFileSync(resolve(process.cwd(), reportPath), 'utf8')
  } catch (error) {
    failures.push(`matriz RLS: não foi possível ler ${reportPath}`)
    console.error(`FAIL matriz RLS: ${error instanceof Error ? error.message : String(error)}`)
    return
  }

  const missing = []
  for (let index = 1; index <= 22; index += 1) {
    const id = `RLS-${String(index).padStart(3, '0')}`
    if (!new RegExp(`${id}[^\\n]*(PASS|passed|aprovado|OK)`, 'i').test(report)) missing.push(id)
  }

  if (missing.length > 0) {
    failures.push(`matriz RLS: cenários sem PASS explícito: ${missing.join(', ')}`)
    console.error(`FAIL matriz RLS: cenários sem PASS explícito: ${missing.join(', ')}`)
    return
  }

  passes.push('matriz RLS real RLS-001…RLS-022')
  console.log('PASS matriz RLS real RLS-001…RLS-022')
}

console.log('Veritas beta preflight')
console.log(`Diretório: ${root}`)
console.log(`Versão no package.json: ${readPackageVersion()}`)

checkVersion()
checkCleanTree()

if (!envFlag('BETA_PREFLIGHT_SKIP_INSTALL')) {
  run('npm ci', 'npm', ['ci'])
} else {
  recordSkip('npm ci', 'BETA_PREFLIGHT_SKIP_INSTALL está habilitado')
}

run('testes automatizados', 'npm', ['test', '--', '--run'])
run('typecheck', 'npm', ['run', 'typecheck'])
run('lint', 'npm', ['run', 'lint'])
run('build frontend', 'npm', ['run', 'build'])
run('build MCP', 'npm', ['run', 'build:mcp'])

if (process.env.SMOKE_URL) {
  run('smoke externo/PWA', 'npm', ['run', 'smoke:release'], { env: { ...process.env, SMOKE_URL: process.env.SMOKE_URL } })
} else if (envFlag('BETA_PREFLIGHT_REQUIRE_SMOKE')) {
  failures.push('smoke externo/PWA: SMOKE_URL não foi definido')
  console.error('FAIL smoke externo/PWA: defina SMOKE_URL')
} else {
  recordSkip('smoke externo/PWA', 'defina SMOKE_URL; use BETA_PREFLIGHT_REQUIRE_SMOKE=1 para tornar obrigatório')
}

checkRlsReport()
checkEvidenceManifest()
checkSupabaseStructuralAudit()

console.log('\nResumo do preflight')
console.log(`PASS: ${passes.length}`)
console.log(`SKIP: ${skips.length}`)
console.log(`FAIL: ${failures.length}`)

if (skips.length > 0) {
  console.log('\nItens ignorados:')
  for (const item of skips) console.log(`- ${item}`)
}

if (failures.length > 0) {
  console.error('\nPromoção bloqueada:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('\nPreflight aprovado. Confirme manualmente o relatório de aceitação, rollback e aprovação formal antes de criar a tag beta.')
