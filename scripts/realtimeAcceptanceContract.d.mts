export declare const REALTIME_TEMPORAL_EVENTS: readonly ['circuit_snapshot', 'runtime_config', 'runtime_state']
export declare const REALTIME_ACCEPTANCE_IDS: readonly ['RT-001', 'RT-002', 'RT-003', 'RT-004', 'RT-005']
export declare function isAllowedRealtimeEvent(event: unknown): boolean
export declare function isBlockedRealtimeStatus(status: unknown): boolean
export declare function sanitizeRealtimeMessage(value: unknown): string
export declare function realtimeTopic(projectId: string, roomId: string): string
