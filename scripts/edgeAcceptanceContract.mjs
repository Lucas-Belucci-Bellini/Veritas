export function isUnauthorizedStatus(status) {
  return status === 401 || status === 403
}

export function isSuccessfulAnalysisStatus(status) {
  return status >= 200 && status < 300
}

export function sanitizeEdgeMessage(value) {
  return String(value ?? '')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/(password|token|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .slice(0, 240)
}

export function edgeEndpoint(projectUrl, functionSlug = 'veritas-circuit-ai') {
  return `${projectUrl.replace(/\/$/, '')}/functions/v1/${functionSlug}`
}
