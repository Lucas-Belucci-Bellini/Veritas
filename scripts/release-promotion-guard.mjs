import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateBetaEvidenceManifest } from './betaEvidence.mjs'
import { validateReleasePromotion } from './releasePromotionContract.mjs'

function truthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase())
}

function main() {
  const version = process.env.RELEASE_VERSION || process.env.VERSION || ''
  let evidenceStatus = process.env.RELEASE_EVIDENCE_STATUS || ''
  const evidencePath = process.env.RELEASE_EVIDENCE_MANIFEST || ''
  if (evidencePath) {
    const absolutePath = resolve(process.cwd(), evidencePath)
    if (!existsSync(absolutePath)) throw new Error('RELEASE_EVIDENCE_MANIFEST não foi encontrado')
    const manifest = JSON.parse(readFileSync(absolutePath, 'utf8'))
    const expectedVersion = version.replace(/^v/, '')
    const errors = validateBetaEvidenceManifest(manifest, expectedVersion)
    evidenceStatus = errors.length === 0 ? 'PASS' : 'FAIL'
    if (errors.length > 0) console.error(`Manifesto de evidências rejeitado: ${errors.join('; ')}`)
  }
  const result = validateReleasePromotion({
    version,
    preflightStrict: truthy(process.env.RELEASE_PREFLIGHT_STRICT),
    evidenceStatus,
    approval: truthy(process.env.RELEASE_BETA_APPROVED),
  })
  console.log(`Release guard: ${version || '[ausente]'} → ${result.channel}`)
  if (result.allowed) {
    console.log('Release guard PASS')
    return
  }
  for (const error of result.errors) console.error(`Release guard FAIL — ${error}`)
  process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(`Release guard abortado: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
