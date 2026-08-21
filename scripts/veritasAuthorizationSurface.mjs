export const VERITAS_AUTHORIZATION_SURFACE = Object.freeze({
  privateHelpers: Object.freeze([
    'veritas_is_project_owner',
    'veritas_can_collaborate',
    'veritas_can_edit_project',
  ]),
  publicInvokerRpcs: Object.freeze([
    'veritas_add_circuit_collaborator',
    'veritas_remove_circuit_collaborator',
    'veritas_create_circuit_room',
    'veritas_sync_circuit_project',
  ]),
  ownerPolicies: Object.freeze([
    'veritas_circuit_collaborators_insert_owner',
    'veritas_circuit_collaborators_update_owner',
    'veritas_circuit_collaborators_delete_owner',
  ]),
  realtimePolicies: Object.freeze([
    'veritas_realtime_circuit_read',
    'veritas_realtime_circuit_presence_write',
    'veritas_realtime_circuit_broadcast_write',
  ]),
})
