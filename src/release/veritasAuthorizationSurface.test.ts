import { describe, expect, it } from 'vitest'
import { VERITAS_AUTHORIZATION_SURFACE } from '../../scripts/veritasAuthorizationSurface.mjs'

describe('hardening da superfície de autorização Supabase', () => {
  it('mantém helpers SECURITY DEFINER no schema private', () => {
    expect(VERITAS_AUTHORIZATION_SURFACE.privateHelpers).toEqual([
      'veritas_is_project_owner',
      'veritas_can_collaborate',
      'veritas_can_edit_project',
    ])
  })

  it('mantém os endpoints públicos como RPCs invoker com contrato estável', () => {
    expect(VERITAS_AUTHORIZATION_SURFACE.publicInvokerRpcs).toEqual([
      'veritas_add_circuit_collaborator',
      'veritas_remove_circuit_collaborator',
      'veritas_create_circuit_room',
      'veritas_sync_circuit_project',
    ])
  })

  it('exige policies de owner e isolamento Realtime', () => {
    expect(VERITAS_AUTHORIZATION_SURFACE.ownerPolicies).toEqual([
      'veritas_circuit_collaborators_insert_owner',
      'veritas_circuit_collaborators_update_owner',
      'veritas_circuit_collaborators_delete_owner',
    ])
    expect(VERITAS_AUTHORIZATION_SURFACE.realtimePolicies).toEqual([
      'veritas_realtime_circuit_read',
      'veritas_realtime_circuit_presence_write',
      'veritas_realtime_circuit_broadcast_write',
    ])
  })
})
