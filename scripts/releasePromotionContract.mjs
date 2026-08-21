export const RELEASE_CHANNELS = Object.freeze(['alpha', 'beta', 'rc', 'stable'])

export function classifyReleaseVersion(version) {
  const normalized = String(version ?? '').replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(normalized)) return 'invalid'
  const prerelease = normalized.split('-', 2)[1] ?? ''
  if (prerelease.startsWith('alpha.')) return 'alpha'
  if (prerelease.startsWith('beta.')) return 'beta'
  if (prerelease.startsWith('rc.')) return 'rc'
  return prerelease ? 'invalid' : 'stable'
}

export function validateReleasePromotion({ version, preflightStrict = false, evidenceStatus = '', approval = false } = {}) {
  const channel = classifyReleaseVersion(version)
  const errors = []
  if (channel === 'invalid') errors.push('versão SemVer ou canal inválido')
  if (channel === 'beta') {
    if (!preflightStrict) errors.push('promoção beta exige preflight estrito')
    if (evidenceStatus !== 'PASS') errors.push('promoção beta exige manifesto de evidências PASS')
    if (approval !== true) errors.push('promoção beta exige aprovação explícita')
  }
  return { channel, allowed: errors.length === 0, errors }
}
