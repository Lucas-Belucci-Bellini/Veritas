import { supabase } from '../lib/supabase'

export type CollaboratorRole = 'editor' | 'viewer'

export interface CircuitCollaborator {
  projectId: string
  userId: string
  role: CollaboratorRole
  createdAt: number
}

type CollaboratorRow = { project_id: string; user_id: string; role: string; created_at: string }

export async function listCircuitCollaborators(projectId: string): Promise<CircuitCollaborator[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('veritas_circuit_collaborators')
    .select('project_id,user_id,role,created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as CollaboratorRow[]).flatMap((row) => {
    const collaborator = toCollaborator(row)
    return collaborator ? [collaborator] : []
  })
}

export async function addCircuitCollaborator(projectId: string, userId: string, role: CollaboratorRole): Promise<CircuitCollaborator> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('veritas_add_circuit_collaborator', { p_project_id: projectId, p_user_id: userId.trim(), p_role: role })
  if (error) throw error
  const collaborator = toCollaborator(data as CollaboratorRow)
  if (!collaborator) throw new Error('O Supabase devolveu um colaborador inválido.')
  return collaborator
}

export async function removeCircuitCollaborator(projectId: string, userId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('veritas_remove_circuit_collaborator', { p_project_id: projectId, p_user_id: userId })
  if (error) throw error
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase não está configurado neste ambiente.')
  return supabase
}

function toCollaborator(row: CollaboratorRow | null): CircuitCollaborator | null {
  if (!row || typeof row.project_id !== 'string' || typeof row.user_id !== 'string' || (row.role !== 'editor' && row.role !== 'viewer')) return null
  return { projectId: row.project_id, userId: row.user_id, role: row.role, createdAt: Date.parse(row.created_at) }
}
