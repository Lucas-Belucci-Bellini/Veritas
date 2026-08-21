-- Allow the temporal collaboration events already emitted by roomCollaboration.ts.
-- Presence remains available to collaborators; all broadcast events still require edit permission.

drop policy if exists veritas_realtime_circuit_read on realtime.messages;
drop policy if exists veritas_realtime_circuit_presence_write on realtime.messages;
drop policy if exists veritas_realtime_circuit_broadcast_write on realtime.messages;

create policy veritas_realtime_circuit_read
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() ~ '^veritas:project:[0-9a-fA-F-]{36}:room:[A-Za-z0-9_-]{1,64}$'
    and private.veritas_can_collaborate(
      substring(realtime.topic() from '^veritas:project:([0-9a-fA-F-]{36}):room:')::uuid
    )
    and public.veritas_room_is_allowed(
      substring(realtime.topic() from '^veritas:project:([0-9a-fA-F-]{36}):room:')::uuid,
      substring(realtime.topic() from '^veritas:project:[0-9a-fA-F-]{36}:room:([A-Za-z0-9_-]{1,64})$')
    )
    and (
      realtime.messages.extension = 'presence'
      or realtime.messages.event is null
      or realtime.messages.event in ('circuit_snapshot', 'runtime_config', 'runtime_state')
    )
  );

create policy veritas_realtime_circuit_presence_write
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and realtime.topic() ~ '^veritas:project:[0-9a-fA-F-]{36}:room:[A-Za-z0-9_-]{1,64}$'
    and private.veritas_can_collaborate(
      substring(realtime.topic() from '^veritas:project:([0-9a-fA-F-]{36}):room:')::uuid
    )
    and public.veritas_room_is_allowed(
      substring(realtime.topic() from '^veritas:project:([0-9a-fA-F-]{36}):room:')::uuid,
      substring(realtime.topic() from '^veritas:project:[0-9a-fA-F-]{36}:room:([A-Za-z0-9_-]{1,64})$')
    )
  );

create policy veritas_realtime_circuit_broadcast_write
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and realtime.messages.event in ('circuit_snapshot', 'runtime_config', 'runtime_state')
    and realtime.topic() ~ '^veritas:project:[0-9a-fA-F-]{36}:room:[A-Za-z0-9_-]{1,64}$'
    and private.veritas_can_edit_project(
      substring(realtime.topic() from '^veritas:project:([0-9a-fA-F-]{36}):room:')::uuid
    )
    and public.veritas_room_is_allowed(
      substring(realtime.topic() from '^veritas:project:([0-9a-fA-F-]{36}):room:')::uuid,
      substring(realtime.topic() from '^veritas:project:[0-9a-fA-F-]{36}:room:([A-Za-z0-9_-]{1,64})$')
    )
  );
