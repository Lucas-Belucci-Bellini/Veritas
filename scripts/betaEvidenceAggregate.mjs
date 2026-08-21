import { REQUIRED_BETA_EVIDENCE_GATES } from './betaEvidence.mjs'
import { validateSupabaseStructuralAudit } from './supabaseStructuralAudit.mjs'

export const AGGREGATED_BETA_GATES = [...REQUIRED_BETA_EVIDENCE_GATES, 'edge', 'supabaseStructural']

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseStatusLine(line) {
  const match = line.match(/^(RLS-\d{3}|RLS-EDGE-\d{3}|RLS-019|RLS-020|RLS-021|RT-\d{3}|HDL-\d{3}|A11Y-\d{3}|RB-\d{3}|ONB-\d{3}|MCP-\d{3})\s+(PASS|FAIL|SKIP|PENDING)\b/i)
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
  hdlReport = '',
  accessibilityReport = '',
  rollbackReport = '',
  onboardingReport = '',
  mcpReport = '',
  structuralReport = null,
  structuralProjectId = '',
  evidencePaths = {},
} = {}) {
  const rlsStatuses = parseEvidenceReport(rlsReport)
  const edgeStatuses = parseEvidenceReport(edgeReport)
  const realtimeStatuses = parseEvidenceReport(realtimeReport)
  const hdlStatuses = parseEvidenceReport(hdlReport)
  const accessibilityStatuses = parseEvidenceReport(accessibilityReport)
  const rollbackStatuses = parseEvidenceReport(rollbackReport)
  const onboardingStatuses = parseEvidenceReport(onboardingReport)
  const mcpStatuses = parseEvidenceReport(mcpReport)
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

  const hdlIds = ['HDL-001', 'HDL-002', 'HDL-003']
  gates.hdl = gateFromStatuses(hdlStatuses, hdlIds, evidencePaths.hdl ?? '')
  addBlocker(openP1, 'HDL-EVIDENCE-INCOMPLETE', gates.hdl)

  const accessibilityIds = ['A11Y-001', 'A11Y-002', 'A11Y-003', 'A11Y-004', 'A11Y-005']
  gates.accessibility = gateFromStatuses(accessibilityStatuses, accessibilityIds, evidencePaths.accessibility ?? '')
  addBlocker(openP1, 'ACCESSIBILITY-EVIDENCE-INCOMPLETE', gates.accessibility)

  const rollbackIds = ['RB-001', 'RB-002', 'RB-003', 'RB-004', 'RB-005']
  gates.rollback = gateFromStatuses(rollbackStatuses, rollbackIds, evidencePaths.rollback ?? '')
  addBlocker(openP1, 'ROLLBACK-EVIDENCE-INCOMPLETE', gates.rollback)

  const onboardingIds = ['ONB-001', 'ONB-002', 'ONB-003', 'ONB-004']
  gates.onboarding = gateFromStatuses(onboardingStatuses, onboardingIds, evidencePaths.onboarding ?? '')
  addBlocker(openP1, 'ONBOARDING-EVIDENCE-INCOMPLETE', gates.onboarding)

  const mcpIds = ['MCP-001', 'MCP-002', 'MCP-003', 'MCP-004', 'MCP-005', 'MCP-006']
  gates.mcp = gateFromStatuses(mcpStatuses, mcpIds, evidencePaths.mcp ?? '')
  addBlocker(openP1, 'MCP-EVIDENCE-INCOMPLETE', gates.mcp)

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
