import type { CircuitDocument } from './editorModel'

export type RemoteConflictAction = 'apply' | 'ignore' | 'defer'
export type RemoteConflictReason = 'clean-local' | 'already-current' | 'local-changes'

export interface RemoteConflictDecision {
  action: RemoteConflictAction
  reason: RemoteConflictReason
}

export function decideRemoteCircuitUpdate(
  localDocument: CircuitDocument,
  lastSyncedDocument: CircuitDocument | null,
  remoteDocument: CircuitDocument,
): RemoteConflictDecision {
  if (sameDocument(localDocument, remoteDocument)) {
    return { action: 'ignore', reason: 'already-current' }
  }

  if (lastSyncedDocument && !sameDocument(localDocument, lastSyncedDocument)) {
    return { action: 'defer', reason: 'local-changes' }
  }

  return { action: 'apply', reason: 'clean-local' }
}

function sameDocument(left: CircuitDocument, right: CircuitDocument): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
