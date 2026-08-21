import type { DocumentRuntimeSnapshot } from './documentRuntime'
import type { SimulatorState } from './simulator'

export interface RuntimeCheckpoint {
  version: 1
  documentKey: string
  savedAt: string
  inputs: Record<string, boolean>
  clockPeriods: Record<string, number>
  simulator: SimulatorState
  timeline: DocumentRuntimeSnapshot[]
}

export interface CheckpointStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const RUNTIME_CHECKPOINT_VERSION = 1 as const
export const RUNTIME_CHECKPOINT_PREFIX = 'veritas:sequential-runtime:'
export const RUNTIME_CHECKPOINT_TIMELINE_LIMIT = 32

export function runtimeDocumentKey(document: { format: string; version: number; nodes: readonly unknown[]; connections: readonly unknown[] }): string {
  const payload = JSON.stringify({
    format: document.format,
    version: document.version,
    nodes: document.nodes,
    connections: document.connections,
  })
  return `${RUNTIME_CHECKPOINT_PREFIX}${hashString(payload)}`
}

export function readRuntimeCheckpoint(
  documentKey: string,
  storage: CheckpointStorage | null,
): RuntimeCheckpoint | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(documentKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RuntimeCheckpoint>
    if (parsed.version !== RUNTIME_CHECKPOINT_VERSION || parsed.documentKey !== documentKey) return null
    if (!parsed.simulator || !Array.isArray(parsed.timeline) || !parsed.inputs || typeof parsed.inputs !== 'object') return null
    if (!parsed.timeline.every(isSnapshot)) return null
    return {
      version: RUNTIME_CHECKPOINT_VERSION,
      documentKey,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date(0).toISOString(),
      inputs: normalizeInputs(parsed.inputs),
      clockPeriods: normalizeClockPeriods(parsed.clockPeriods),
      simulator: parsed.simulator,
      timeline: parsed.timeline.slice(-RUNTIME_CHECKPOINT_TIMELINE_LIMIT),
    }
  } catch {
    return null
  }
}

export function writeRuntimeCheckpoint(
  checkpoint: RuntimeCheckpoint,
  storage: CheckpointStorage | null,
): boolean {
  if (!storage) return false
  try {
    storage.setItem(checkpoint.documentKey, JSON.stringify({
      ...checkpoint,
      timeline: checkpoint.timeline.slice(-RUNTIME_CHECKPOINT_TIMELINE_LIMIT),
    }))
    return true
  } catch {
    return false
  }
}

export function clearRuntimeCheckpoint(documentKey: string, storage: CheckpointStorage | null): void {
  try {
    storage?.removeItem(documentKey)
  } catch {
    // A falha de armazenamento nunca interrompe a simulação local.
  }
}

export function createRuntimeStorage(): CheckpointStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isSnapshot(value: unknown): value is DocumentRuntimeSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<DocumentRuntimeSnapshot>
  const tick = snapshot.tick
  return typeof tick === 'number' && Number.isInteger(tick) && tick >= 0 && Boolean(snapshot.values) && typeof snapshot.values === 'object'
}

function normalizeInputs(value: Record<string, unknown>): Record<string, boolean> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === 'boolean')) as Record<string, boolean>
}

function normalizeClockPeriods(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([id, period]) => {
      if (typeof period !== 'number' || !Number.isInteger(period) || period < 1 || period > 64) return []
      return [[id, period]]
    }),
  )
}

function hashString(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
