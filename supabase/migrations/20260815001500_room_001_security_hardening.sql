-- ROOM-001 hardening: manter as funções novas sob RLS do chamador.

grant insert on table public.veritas_circuit_rooms to authenticated;

drop policy if exists veritas_circuit_rooms_insert_owner on public.veritas_circuit_rooms;
create policy veritas_circuit_rooms_insert_owner
  on public.veritas_circuit_rooms for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.veritas_is_project_owner(project_id)
  );

alter function public.veritas_room_is_allowed(uuid, text) security invoker;
alter function public.veritas_create_circuit_room(uuid, text, text) security invoker;
alter function public.veritas_sync_circuit_project(uuid, text, jsonb, text, jsonb, integer) security invoker;

drop policy if exists veritas_circuit_versions_select_own on public.veritas_circuit_versions;
drop policy if exists veritas_circuit_versions_insert_own on public.veritas_circuit_versions;
drop policy if exists veritas_circuit_versions_select_member on public.veritas_circuit_versions;
drop policy if exists veritas_circuit_versions_insert_editor on public.veritas_circuit_versions;
create policy veritas_circuit_versions_select_member
  on public.veritas_circuit_versions for select to authenticated
  using (public.veritas_can_collaborate(project_id));
create policy veritas_circuit_versions_insert_editor
  on public.veritas_circuit_versions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.veritas_can_edit_project(project_id)
  );

drop policy if exists veritas_circuit_projects_update_own on public.veritas_circuit_projects;
drop policy if exists veritas_circuit_projects_update_editor on public.veritas_circuit_projects;
create policy veritas_circuit_projects_update_editor
  on public.veritas_circuit_projects for update to authenticated
  using (public.veritas_can_edit_project(id))
  with check (user_id = (select p.user_id from public.veritas_circuit_projects p where p.id = id));
