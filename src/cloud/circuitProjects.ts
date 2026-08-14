import type { CircuitDocument } from '../circuit'
import { buildCircuitContext } from '../circuit'
import { supabase } from '../lib/supabase'

export interface CloudCircuitProject {
  id: string
  name: string
  document: CircuitDocument
  contentHash: string
  createdAt: number
  updatedAt: number
}

type CloudCircuitRow = {
  id: string
  name: string
  document: unknown
  content_hash: string
  created_at: string
  updated_at: string
}

export async function listCloudCircuitProjects(): Promise<CloudCircuitProject[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('veritas_circuit_projects')
    .select('id,name,document,content_hash,created_at,updated_at')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data as CloudCircuitRow[]).flatMap((row) => {
    const project = toCloudProject(row)
    return project ? [project] : []
  })
}

export async function upsertCloudCircuitProject(
  name: string,
  document: CircuitDocument,
  id?: string,
): Promise<CloudCircuitProject> {
  const client = requireSupabase()
  const user = await currentUser()
  const context = buildCircuitContext(document)
  const row = {
    ...(id ? { id } : {}),
    user_id: user.id,
    name: name.trim() || document.name || 'Circuito sem nome',
    document,
    content_hash: context.contentHash,
  }

  const { data, error } = await client
    .from('veritas_circuit_projects')
    .upsert(row, { onConflict: id ? 'id' : 'user_id,content_hash' })
    .select('id,name,document,content_hash,created_at,updated_at')
    .single()

  if (error) throw error
  const project = toCloudProject(data as CloudCircuitRow)
  if (!project) throw new Error('O Supabase devolveu um circuito inválido.')
  return project
}

export async function deleteCloudCircuitProject(id: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('veritas_circuit_projects').delete().eq('id', id)
  if (error) throw error
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

function toCloudProject(row: CloudCircuitRow): CloudCircuitProject | null {
  if (!isCircuitDocument(row.document)) return null
  return {
    id: row.id,
    name: row.name,
    document: row.document,
    contentHash: row.content_hash,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
  }
}

function isCircuitDocument(value: unknown): value is CircuitDocument {
  if (!isRecord(value) || value.format !== 'veritas-circuit' || value.version !== 1) return false
  if (typeof value.name !== 'string' || !Array.isArray(value.nodes) || !Array.isArray(value.connections)) return false
  return value.nodes.every(isCircuitNode) && value.connections.every(isCircuitConnection)
}

function isCircuitNode(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string') return false
  if (!isRecord(value.position) || !isFiniteNumber(value.position.x) || !isFiniteNumber(value.position.y)) return false
  return value.label === undefined || typeof value.label === 'string'
}

function isCircuitConnection(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.source) || !isRecord(value.target)) return false
  return typeof value.source.node === 'string' && typeof value.target.node === 'string' && Number.isInteger(value.target.port)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
