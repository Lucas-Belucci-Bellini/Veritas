import { REQUIRED_BETA_EVIDENCE_GATES } from './betaEvidence.mjs'
import { validateSupabaseStructuralAudit } from './supabaseStructuralAudit.mjs'

export const AGGREGATED_BETA_GATES = [...REQUIRED_BETA_EVIDENCE_GATES, 'edge', 'supabaseStructural']

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseStatusLine(line) {
  const match = line.match(/^(RLS-\d{3}|RLS-EDGE-\d{3}|RLS-019|RLS-020|RLS-021|RT-\d{3})\s+(PASS|FAIL|SKIP|PENDING)\b/i)
  return match ? { id: match[1], status: match[2].toUpperCase() } : null
}

export function parseEvidenceReport(text) {
  const statuses = {}
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const parsed = parseStatusLine(line.trim())
    if (parsed) statuses[parsed.id] = parsed.status
  }
  return statuses
}

function gateFromStatuses(statuses, ids, evidence) {
  const entries = ids.map((id) => ({ id, status: statuses[id] ?? 'PENDING' }))
  const allPass = entries.length > 0 && entries.every((entry) => entry.status === 'PASS')
  return {
    status: allPass ? 'PASS' : 'PENDING',
    evidence: allPass ? evidence : '',
    statuses: entries,
  }
}

function addBlocker(openP1, label, gate) {
  if (gate.status !== 'PASS') openP1.push(label)
}

export function aggregateBetaEvidence({
  version,
  generatedAt = new Date().toISOString(),
  rlsReport = '',
  edgeReport = '',
  realtimeReport = '',
  structuralReport = null,
  structuralProjectId = '',
  evidencePaths = {},
} = {}) {
  const rlsStatuses = parseEvidenceReport(rlsReport)
  const edgeStatuses = parseEvidenceReport(edgeReport)
  const realtimeStatuses = parseEvidenceReport(realtimeReport)
  const openP0 = []
  const openP1 = []
  const gates = {}

  const rlsIds = Array.from({ length: 22 }, (_, index) => `RLS-${String(index + 1).padStart(3, '0')}`)
  gates.rls = gateFromStatuses(rlsStatuses, rlsIds, evidencePaths.rls ?? '')
  if (Object.values(rlsStatuses).some((status) => status === 'FAIL')) openP0.push('RLS-FAILURE')
  addBlocker(openP1, 'RLS-EVIDENCE-INCOMPLETE', gates.rls)

  const edgeIds = ['RLS-019', 'RLS-020', 'RLS-021']
  gates.edge = gateFromStatuses(edgeStatuses, edgeIds, evidencePaths.edge ?? '')
  if (edgeStatuses['RLS-019'] === 'FAIL') openP0.push('EDGE-JWT-BYPASS')
  addBlocker(openP1, 'EDGE-EVIDENCE-INCOMPLETE', gates.edge)

  const realtimeIds = ['RT-001', 'RT-002', 'RT-003', 'RT-004', 'RT-005']
  gates.realtime = gateFromStatuses(realtimeStatuses, realtimeIds, evidencePaths.realtime ?? '')
  addBlocker(openP1, 'REALTIME-EVIDENCE-INCOMPLETE', gates.realtime)

  const structuralErrors = structuralReport
    ? validateSupabaseStructuralAudit(structuralReport, structuralProjectId)
    : ['relatório estrutural ausente']
  gates.supabaseStructural = {
    status: structuralErrors.length === 0 ? 'PASS' : 'PENDING',
    evidence: structuralErrors.length === 0 ? evidencePaths.supabaseStructural ?? '' : '',
    errors: structuralErrors,
  }
  addBlocker(openP1, 'SUPABASE-STRUCTURAL-EVIDENCE-INCOMPLETE', gates.supabaseStructural)

  for (const gateName of REQUIRED_BETA_EVIDENCE_GATES) {
    if (!gates[gateName]) {
      gates[gateName] = { status: 'PENDING', evidence: '' }
      openP1.push(`${gateName.toUpperCase()}-EVIDENCE-INCOMPLETE`)
    }
  }

  return {
    version: version ?? '',
    generatedAt,
    openP0: [...new Set(openP0)],
    openP1: [...new Set(openP1)],
    gates,
  }
}

export function isAggregatedManifest(value) {
  return isRecord(value) && isRecord(value.gates) && Array.isArray(value.openP0) && Array.isArray(value.openP1)
}
