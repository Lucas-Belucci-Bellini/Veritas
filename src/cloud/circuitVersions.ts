import type { CircuitDocument } from '../circuit'
import { buildCircuitContext, isCircuitDocumentShape, validateCircuit } from '../circuit'
import { supabase } from '../lib/supabase'
import { compareCircuitDocuments, type CircuitChangeSummary } from './circuitDiff'

export class CloudVersionConflictError extends Error {
  readonly code = 'CIRCUIT_CONFLICT'
  readonly currentVersion: number | null

  constructor(currentVersion: number | null = null) {
    super(currentVersion === null
      ? 'O circuito foi alterado por outra sessão. Recarregue a versão remota antes de salvar.'
      : `O circuito foi alterado por outra sessão. A versão remota atual é ${currentVersion}; recarregue-a antes de salvar.`)
    this.name = 'CloudVersionConflictError'
    this.currentVersion = currentVersion
  }
}

export interface CloudCircuitVersion {
  id: string
  projectId: string
  versionNumber: number
  name: string
  document: CircuitDocument
  contentHash: string
  changeSummary: CircuitChangeSummary
  createdAt: number
}

type VersionRow = {
  id: string
  project_id: string
  version_number: number
  name: string
  document: unknown
  content_hash: string
  change_summary: unknown
  created_at: string
}

type SyncRow = {
  project_id: string
  version_id: string
  version_number: number
  name: string
  document: unknown
  content_hash: string
  created_at: string
  updated_at: string
}

export async function listCloudCircuitVersions(projectId: string): Promise<CloudCircuitVersion[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('veritas_circuit_versions')
    .select('id,project_id,version_number,name,document,content_hash,change_summary,created_at')
    .eq('project_id', projectId)
    .order('version_number', { ascending: false })

  if (error) throw error
  return (data as VersionRow[]).flatMap((row) => {
    const version = toCloudVersion(row)
    return version ? [version] : []
  })
}

export async function syncCloudCircuitVersion(
  projectId: string | null,
  name: string,
  document: CircuitDocument,
  previousDocument: CircuitDocument | null,
  baseVersion = 0,
): Promise<{ projectId: string; version: CloudCircuitVersion }> {
  const client = requireSupabase()
  await currentUser()
  const context = buildCircuitContext(document)
  const normalizedDocument = context.payload.document
  const diff = compareCircuitDocuments(previousDocument, normalizedDocument)
  const { data, error } = await client.rpc('veritas_sync_circuit_project', {
    p_project_id: projectId,
    p_name: name.trim() || context.circuitName || 'Circuito sem nome',
    p_document: normalizedDocument,
    p_content_hash: context.contentHash,
    p_change_summary: diff,
    p_base_version: baseVersion,
  })

  if (error) {
    if (isConflictResponse(error)) throw new CloudVersionConflictError(parseCurrentVersion(error.message))
    throw error
  }
  const row = (data as SyncRow[] | null)?.[0]
  if (!row) throw new Error('O Supabase não devolveu a versão criada.')
  const version = toCloudVersion({
    id: row.version_id,
    project_id: row.project_id,
    version_number: row.version_number,
    name: row.name,
    document: row.document,
    content_hash: row.content_hash,
    change_summary: diff,
    created_at: row.created_at,
  })
  if (!version) throw new Error('O Supabase devolveu uma versão inválida.')
  return { projectId: row.project_id, version }
}

function isConflictResponse(error: unknown): error is { code?: string; message?: string } {
  return isRecord(error) && (error.code === 'CIRCUIT_CONFLICT' || error.code === 'P0001') && typeof error.message === 'string' && error.message.includes('CIRCUIT_CONFLICT')
}

function parseCurrentVersion(message: string | undefined): number | null {
  const match = message?.match(/current=(\d+)/)
  return match ? Number(match[1]) : null
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase não está configurado neste ambiente.')
  return supabase
}

async function currentUser() {
  const client = requireSupabase()
  const { data, error } = await client.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Faça login para sincronizar circuitos na nuvem.')
  return data.user
}

function toCloudVersion(row: VersionRow): CloudCircuitVersion | null {
  if (!isCircuitDocument(row.document)) return null
  return {
    id: row.id,
    projectId: row.project_id,
    versionNumber: row.version_number,
    name: row.name,
    document: row.document,
    contentHash: row.content_hash,
    changeSummary: isChangeSummary(row.change_summary) ? row.change_summary : emptySummary(row.document),
    createdAt: Date.parse(row.created_at),
  }
}

function emptySummary(document: unknown): CircuitChangeSummary {
  const count = isCircuitDocument(document) ? document.nodes.length : 0
  const connections = isCircuitDocument(document) ? document.connections.length : 0
  return {
    nameChanged: false,
    nodesAdded: 0,
    nodesRemoved: 0,
    nodesChanged: 0,
    connectionsAdded: 0,
    connectionsRemoved: 0,
    totalNodesBefore: count,
    totalNodesAfter: count,
    totalConnectionsBefore: connections,
    totalConnectionsAfter: connections,
  }
}

function isChangeSummary(value: unknown): value is CircuitChangeSummary {
  if (!isRecord(value)) return false
  return [
    'nameChanged',
    'nodesAdded',
    'nodesRemoved',
    'nodesChanged',
    'connectionsAdded',
    'connectionsRemoved',
    'totalNodesBefore',
    'totalNodesAfter',
    'totalConnectionsBefore',
    'totalConnectionsAfter',
  ].every((key) => typeof value[key] === (key === 'nameChanged' ? 'boolean' : 'number'))
}

function isCircuitDocument(value: unknown): value is CircuitDocument {
  return isCircuitDocumentShape(value) && validateCircuit(value, { allowBuses: true }).length === 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
