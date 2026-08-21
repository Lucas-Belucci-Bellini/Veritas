export const REQUIRED_VERITAS_TABLES = [
  'veritas_ai_metrics',
  'veritas_circuit_collaborators',
  'veritas_circuit_context',
  'veritas_circuit_projects',
  'veritas_circuit_rooms',
  'veritas_circuit_versions',
]

export const REQUIRED_REALTIME_POLICIES = [
  'veritas_realtime_ai_metrics_read',
  'veritas_realtime_circuit_broadcast_write',
  'veritas_realtime_circuit_presence_write',
  'veritas_realtime_circuit_read',
]

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateSupabaseStructuralAudit(report, expectedProjectId) {
  const errors = []
  if (!isRecord(report)) return ['relatório estrutural precisa ser um objeto JSON']

  if (typeof expectedProjectId === 'string' && expectedProjectId.length > 0 && report.projectId !== expectedProjectId) {
    errors.push(`projectId do relatório=${String(report.projectId ?? '')}, esperado=${expectedProjectId}`)
  }

  if (!Array.isArray(report.tables)) {
    errors.push('tables precisa ser uma lista')
  } else {
    for (const tableName of REQUIRED_VERITAS_TABLES) {
      const table = report.tables.find((entry) => isRecord(entry) && entry.tableName === tableName)
      if (!table) {
        errors.push(`tabela ${tableName} não foi declarada`)
        continue
      }
      if (table.rlsEnabled !== true) errors.push(`tabela ${tableName} está sem RLS habilitado`)
      if (!Number.isInteger(table.policyCount) || table.policyCount < 1) errors.push(`tabela ${tableName} não possui policy registrada`)
    }
  }

  if (!Array.isArray(report.realtimePolicies)) {
    errors.push('realtimePolicies precisa ser uma lista')
  } else {
    for (const policyName of REQUIRED_REALTIME_POLICIES) {
      if (!report.realtimePolicies.includes(policyName)) errors.push(`policy Realtime ${policyName} não foi declarada`)
    }
  }

  return errors
}
