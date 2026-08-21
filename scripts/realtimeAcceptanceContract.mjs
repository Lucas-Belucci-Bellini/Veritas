export const REALTIME_TEMPORAL_EVENTS = ['circuit_snapshot', 'runtime_config', 'runtime_state']
export const REALTIME_ACCEPTANCE_IDS = ['RT-001', 'RT-002', 'RT-003', 'RT-004', 'RT-005']

export function isAllowedRealtimeEvent(event) {
  return REALTIME_TEMPORAL_EVENTS.includes(event)
}

export function isBlockedRealtimeStatus(status) {
  return status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'error' || status === 'timeout'
}

export function sanitizeRealtimeMessage(value) {
  return String(value ?? '')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/(password|token|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .slice(0, 240)
}

export function realtimeTopic(projectId, roomId) {
  return `veritas:project:${projectId}:room:${roomId}`
}
