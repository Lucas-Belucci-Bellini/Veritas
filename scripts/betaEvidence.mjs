export const REQUIRED_BETA_EVIDENCE_GATES = [
  'rls',
  'realtime',
  'hdl',
  'accessibility',
  'mobile',
  'rollback',
  'onboarding',
]

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateBetaEvidenceManifest(manifest, expectedVersion) {
  const errors = []
  if (!isRecord(manifest)) return ['manifesto precisa ser um objeto JSON']

  if (typeof expectedVersion !== 'string' || expectedVersion.length === 0) {
    errors.push('versão esperada não foi definida')
  } else if (manifest.version !== expectedVersion) {
    errors.push(`versão do manifesto=${String(manifest.version ?? '')}, esperado=${expectedVersion}`)
  }

  if (typeof manifest.generatedAt !== 'string' || manifest.generatedAt.trim().length === 0) {
    errors.push('generatedAt precisa ser uma string não vazia')
  }

  if (!Array.isArray(manifest.openP0) || manifest.openP0.length > 0) {
    errors.push('openP0 precisa ser uma lista vazia')
  }
  if (!Array.isArray(manifest.openP1) || manifest.openP1.length > 0) {
    errors.push('openP1 precisa ser uma lista vazia')
  }

  if (!isRecord(manifest.gates)) {
    errors.push('gates precisa ser um objeto')
    return errors
  }

  for (const gate of REQUIRED_BETA_EVIDENCE_GATES) {
    const entry = manifest.gates[gate]
    if (!isRecord(entry)) {
      errors.push(`gate ${gate} não foi declarado`)
      continue
    }
    if (entry.status !== 'PASS') errors.push(`gate ${gate} não está PASS`)
    if (typeof entry.evidence !== 'string' || entry.evidence.trim().length === 0) {
      errors.push(`gate ${gate} não possui evidência`) 
    }
  }

  return errors
}
