import { supabase } from '../lib/supabase'
import type { RoomKind } from './roomCollaboration'

export interface CircuitRoom {
  id: string
  projectId: string
  roomId: string
  kind: RoomKind
  createdBy: string
  createdAt: number
}

type RoomRow = {
  id: string
  project_id: string
  room_id: string
  kind: string
  created_by: string
  created_at: string
}

export async function listCircuitRooms(projectId: string): Promise<CircuitRoom[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('veritas_circuit_rooms')
    .select('id,project_id,room_id,kind,created_by,created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as RoomRow[]).flatMap((row) => {
    const room = toRoom(row)
    return room ? [room] : []
  })
}

export async function createCircuitRoom(projectId: string, roomId: string, kind: RoomKind = 'document'): Promise<CircuitRoom> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('veritas_create_circuit_room', {
    p_project_id: projectId,
    p_room_id: roomId.trim(),
    p_kind: kind,
  })
  if (error) throw error
  const room = toRoom(data as RoomRow)
  if (!room) throw new Error('O Supabase devolveu uma sala inválida.')
  return room
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase não está configurado neste ambiente.')
  return supabase
}

function toRoom(row: RoomRow | null): CircuitRoom | null {
  if (!row || typeof row.id !== 'string' || typeof row.project_id !== 'string' || typeof row.room_id !== 'string' || typeof row.created_by !== 'string') return null
  if (row.kind !== 'document' && row.kind !== 'review' && row.kind !== 'chat') return null
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    kind: row.kind,
    createdBy: row.created_by,
    createdAt: Date.parse(row.created_at),
  }
}
