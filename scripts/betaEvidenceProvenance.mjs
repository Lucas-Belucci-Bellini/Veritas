export const REAL_EVIDENCE_REQUIREMENTS = {
  rls: {
    label: 'RLS',
    markers: [
      'Execution mode: REAL',
      'Runner guard: RLS_RUNNER_ALLOW_REAL=1',
      'Accounts: 4 disposable accounts',
    ],
    ids: Array.from({ length: 22 }, (_, index) => `RLS-${String(index + 1).padStart(3, '0')}`),
  },
  realtime: {
    label: 'Realtime',
    markers: [
      'Execution mode: REAL_REQUIRED',
      'Runner guard: REALTIME_RUNNER_ALLOW_REAL=1',
      'Required mode: RT_REQUIRE_REAL=1',
      'Accounts: authenticated disposable sessions',
    ],
    ids: ['RT-001', 'RT-002', 'RT-003', 'RT-004', 'RT-005'],
  },
  edge: {
    label: 'Edge',
    markers: [
      'Execution mode: REAL',
      'Authenticated mode: REAL_REQUIRED',
      'Authenticated disposable JWT: provided',
    ],
    ids: ['RLS-019', 'RLS-020', 'RLS-021'],
  },
  mobile: {
    label: 'Mobile manual',
    markers: [
      'Execution mode: REAL_MANUAL',
      'Runner guard: MOBILE_MANUAL_ALLOW_REAL=1',
      'Reviewer: ',
      'Device: ',
      'Browser: ',
      'Checked at: ',
    ],
    ids: ['MOBILE-001', 'MOBILE-002', 'MOBILE-003', 'MOBILE-004'],
  },
}

export function missingEvidenceMarkers(report, kind) {
  const requirement = REAL_EVIDENCE_REQUIREMENTS[kind]
  if (!requirement) return [`tipo de evidência desconhecido: ${kind}`]
  return requirement.markers.filter((marker) => !String(report ?? '').includes(marker))
}

export function missingPassScenarios(report, kind) {
  const requirement = REAL_EVIDENCE_REQUIREMENTS[kind]
  if (!requirement) return [`tipo de evidência desconhecido: ${kind}`]
  const text = String(report ?? '')
  return requirement.ids.filter((id) => !new RegExp(`^${id}\\s+PASS\\b`, 'mi').test(text))
}
