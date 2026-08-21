import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { aggregateBetaEvidence } from './betaEvidenceAggregate.mjs'

function readOptional(path) {
  if (!path) return ''
  try {
    return readFileSync(resolve(process.cwd(), path), 'utf8')
  } catch {
    return ''
  }
}

function readJsonOptional(path) {
  const text = readOptional(path)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const outputPath = resolve(process.cwd(), process.env.BETA_EVIDENCE_OUTPUT || 'artifacts/beta-evidence-manifest.json')
const manifest = aggregateBetaEvidence({
  version: process.env.BETA_EXPECTED_VERSION || '',
  rlsReport: readOptional(process.env.BETA_RLS_REPORT),
  edgeReport: readOptional(process.env.BETA_EDGE_REPORT),
  realtimeReport: readOptional(process.env.BETA_REALTIME_REPORT),
  hdlReport: readOptional(process.env.BETA_HDL_REPORT),
  accessibilityReport: readOptional(process.env.BETA_ACCESSIBILITY_REPORT),
  rollbackReport: readOptional(process.env.BETA_ROLLBACK_REPORT),
  structuralReport: readJsonOptional(process.env.BETA_SUPABASE_STRUCTURAL_REPORT),
  structuralProjectId: process.env.BETA_SUPABASE_PROJECT_ID || '',
  evidencePaths: {
    rls: process.env.BETA_RLS_REPORT || '',
    edge: process.env.BETA_EDGE_REPORT || '',
    realtime: process.env.BETA_REALTIME_REPORT || '',
    hdl: process.env.BETA_HDL_REPORT || '',
    accessibility: process.env.BETA_ACCESSIBILITY_REPORT || '',
    rollback: process.env.BETA_ROLLBACK_REPORT || '',
    supabaseStructural: process.env.BETA_SUPABASE_STRUCTURAL_REPORT || '',
  },
})

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify(manifest, null, 2))
console.log(`Manifesto agregado: ${outputPath}`)
if (manifest.openP0.length > 0 || manifest.openP1.length > 0) process.exitCode = 1
