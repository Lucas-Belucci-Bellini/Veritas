-- Beta security hardening: keep SECURITY DEFINER authorization helpers out of
-- the exposed public schema while preserving the authenticated RPC contracts.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.veritas_is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.veritas_circuit_projects as p
     where p.id = p_project_id
       and p.user_id = (select auth.uid())
  );
$$;

create or replace function private.veritas_can_collaborate(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.veritas_is_project_owner(p_project_id)
      or exists (
        select 1
          from public.veritas_circuit_collaborators as c
         where c.project_id = p_project_id
           and c.user_id = (select auth.uid())
      );
$$;

create or replace function private.veritas_can_edit_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.veritas_is_project_owner(p_project_id)
      or exists (
        select 1
          from public.veritas_circuit_collaborators as c
         where c.project_id = p_project_id
           and c.user_id = (select auth.uid())
           and c.role = 'editor'
      );
$$;

revoke all on function private.veritas_is_project_owner(uuid) from public, anon, authenticated;
revoke all on function private.veritas_can_collaborate(uuid) from public, anon, authenticated;
revoke all on function private.veritas_can_edit_project(uuid) from public, anon, authenticated;
grant execute on function private.veritas_is_project_owner(uuid) to authenticated;
grant execute on function private.veritas_can_collaborate(uuid) to authenticated;
grant execute on function private.veritas_can_edit_project(uuid) to authenticated;

-- Rebind every RLS/Reatime policy to the private helpers.
grant select, insert, update, delete on table public.veritas_circuit_collaborators to authenticated;

drop policy if exists veritas_circuit_collaborators_select_member on public.veritas_circuit_collaborators;
create policy veritas_circuit_collaborators_select_member
  on public.veritas_circuit_collaborators for select to authenticated
  using (private.veritas_can_collaborate(project_id));

drop policy if exists veritas_circuit_collaborators_insert_owner on public.veritas_circuit_collaborators;
create policy veritas_circuit_collaborators_insert_owner
  on public.veritas_circuit_collaborators for insert to authenticated
  with check (
    private.veritas_is_project_owner(project_id)
    and user_id <> (select auth.uid())
    and role in ('editor', 'viewer')
  );

drop policy if exists veritas_circuit_collaborators_update_owner on public.veritas_circuit_collaborators;
create policy veritas_circuit_collaborators_update_owner
  on public.veritas_circuit_collaborators for update to authenticated
  using (private.veritas_is_project_owner(project_id))
  with check (
    private.veritas_is_project_owner(project_id)
    and user_id <> (select auth.uid())
    and role in ('editor', 'viewer')
  );

drop policy if exists veritas_circuit_collaborators_delete_owner on public.veritas_circuit_collaborators;
create policy veritas_circuit_collaborators_delete_owner
  on public.veritas_circuit_collaborators for delete to authenticated
  using (private.veritas_is_project_owner(project_id));

drop policy if exists veritas_circuit_projects_select_collaborator on public.veritas_circuit_projects;
create policy veritas_circuit_projects_select_collaborator
  on public.veritas_circuit_projects for select to authenticated
  using (private.veritas_can_collaborate(id));

drop policy if exists veritas_circuit_rooms_select_member on public.veritas_circuit_rooms;
create policy veritas_circuit_rooms_select_member
  on public.veritas_circuit_rooms for select to authenticated
  using (private.veritas_can_collaborate(project_id));

drop policy if exists veritas_circuit_rooms_insert_owner on public.veritas_circuit_rooms;
create policy veritas_circuit_rooms_insert_owner
  on public.veritas_circuit_rooms for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.veritas_is_project_owner(project_id)
  );

drop policy if exists veritas_circuit_versions_select_member on public.veritas_circuit_versions;
create policy veritas_circuit_versions_select_member
  on public.veritas_circuit_versions for select to authenticated
  using (private.veritas_can_collaborate(project_id));

drop policy if exists veritas_circuit_versions_insert_editor on public.veritas_circuit_versions;
create policy veritas_circuit_versions_insert_editor
  on public.veritas_circuit_versions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and private.veritas_can_edit_project(project_id)
  );

drop policy if exists veritas_circuit_projects_update_editor on public.veritas_circuit_projects;
create policy veritas_circuit_projects_update_editor
  on public.veritas_circuit_projects for update to authenticated
  using (private.veritas_can_edit_project(id))
  with check (
    user_id = (
      select p.user_id
        from public.veritas_circuit_projects as p
       where p.id = public.veritas_circuit_projects.id
    )
  );

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

-- Keep the existing public RPC contracts, but route authorization through the
-- private helpers. These RPCs remain intentionally callable by authenticated
-- users and continue to enforce the owner check before changing collaborators.
create or replace function public.veritas_add_circuit_collaborator(
  p_project_id uuid,
  p_user_id uuid,
  p_role text default 'editor'
)
returns public.veritas_circuit_collaborators
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  result public.veritas_circuit_collaborators;
begin
  if not private.veritas_is_project_owner(p_project_id) then
    raise exception 'Only the project owner can manage collaborators';
  end if;
  if p_user_id is null or p_user_id = (select auth.uid()) then
    raise exception 'Invalid collaborator user';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'Invalid collaborator role';
  end if;

  insert into public.veritas_circuit_collaborators (project_id, user_id, role)
  values (p_project_id, p_user_id, p_role)
  on conflict (project_id, user_id) do update set role = excluded.role
  returning * into result;
  return result;
end;
$$;

create or replace function public.veritas_remove_circuit_collaborator(
  p_project_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not private.veritas_is_project_owner(p_project_id) then
    raise exception 'Only the project owner can manage collaborators';
  end if;
  delete from public.veritas_circuit_collaborators
   where project_id = p_project_id and user_id = p_user_id;
end;
$$;

revoke all on function public.veritas_add_circuit_collaborator(uuid, uuid, text) from public, anon;
revoke all on function public.veritas_remove_circuit_collaborator(uuid, uuid) from public, anon;
grant execute on function public.veritas_add_circuit_collaborator(uuid, uuid, text) to authenticated;
grant execute on function public.veritas_remove_circuit_collaborator(uuid, uuid) to authenticated;

create or replace function public.veritas_create_circuit_room(
  p_project_id uuid,
  p_room_id text,
  p_kind text default 'document'
)
returns public.veritas_circuit_rooms
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  result public.veritas_circuit_rooms;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if not private.veritas_is_project_owner(p_project_id) then
    raise exception 'Only the project owner can create rooms';
  end if;
  if p_room_id is null or p_room_id !~ '^[A-Za-z0-9_-]{1,64}$' then
    raise exception 'Invalid room id';
  end if;
  if p_kind not in ('document', 'review', 'chat') then
    raise exception 'Invalid room kind';
  end if;

  insert into public.veritas_circuit_rooms (project_id, room_id, kind, created_by)
  values (p_project_id, p_room_id, p_kind, v_user_id)
  on conflict (project_id, room_id) do update set kind = excluded.kind
  returning * into result;
  return result;
end;
$$;

create or replace function public.veritas_sync_circuit_project(
  p_project_id uuid,
  p_name text,
  p_document jsonb,
  p_content_hash text,
  p_change_summary jsonb default '{}'::jsonb,
  p_base_version integer default 0
)
returns table (
  project_id uuid,
  version_id uuid,
  version_number integer,
  name text,
  document jsonb,
  content_hash text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_owner_id uuid;
  v_version_number integer;
  v_created_at timestamptz;
  v_updated_at timestamptz;
  v_name text;
  v_document jsonb;
  v_content_hash text;
  v_version_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_base_version is null or p_base_version < 0 then
    raise exception 'Invalid base version';
  end if;

  if p_project_id is null then
    if p_base_version <> 0 then
      raise exception using errcode = 'P0001', message = 'CIRCUIT_CONFLICT current=0';
    end if;
    insert into public.veritas_circuit_projects (user_id, name, document, content_hash)
    values (v_user_id, p_name, p_document, p_content_hash)
    returning id, user_id, created_at, updated_at, name, document, content_hash
      into v_project_id, v_owner_id, v_created_at, v_updated_at, v_name, v_document, v_content_hash;
  else
    if not private.veritas_can_edit_project(p_project_id) then
      raise exception 'Circuit project not found or not editable by current user';
    end if;

    select p.id, p.user_id, p.created_at, p.updated_at, p.name, p.document, p.content_hash
      into v_project_id, v_owner_id, v_created_at, v_updated_at, v_name, v_document, v_content_hash
      from public.veritas_circuit_projects as p
     where p.id = p_project_id
     for update;

    if v_project_id is null then
      raise exception 'Circuit project not found or not editable by current user';
    end if;

    select coalesce(max(v.version_number), 0)
      into v_version_number
      from public.veritas_circuit_versions as v
     where v.project_id = v_project_id;

    if p_base_version <> v_version_number then
      raise exception using errcode = 'P0001', message = format('CIRCUIT_CONFLICT current=%s', v_version_number);
    end if;

    update public.veritas_circuit_projects
       set name = p_name,
           document = p_document,
           content_hash = p_content_hash,
           updated_at = now()
     where id = v_project_id;
  end if;

  if v_version_number is null then
    select coalesce(max(v.version_number), 0)
      into v_version_number
      from public.veritas_circuit_versions as v
     where v.project_id = v_project_id;
  end if;
  v_version_number := v_version_number + 1;

  insert into public.veritas_circuit_versions (
    project_id, user_id, version_number, name, document, content_hash, change_summary
  ) values (
    v_project_id, v_user_id, v_version_number, v_name, v_document, v_content_hash,
    coalesce(p_change_summary, '{}'::jsonb)
  ) returning id into v_version_id;

  return query select
    v_project_id,
    v_version_id,
    v_version_number,
    v_name,
    v_document,
    v_content_hash,
    v_created_at,
    v_updated_at;
end;
$$;

revoke all on function public.veritas_create_circuit_room(uuid, text, text) from public, anon;
revoke all on function public.veritas_sync_circuit_project(uuid, text, jsonb, text, jsonb, integer) from public, anon;
grant execute on function public.veritas_create_circuit_room(uuid, text, text) to authenticated;
grant execute on function public.veritas_sync_circuit_project(uuid, text, jsonb, text, jsonb, integer) to authenticated;

-- The old public helper endpoints are no longer needed after all policies and
-- RPCs have been rebound to private.*.
drop function if exists public.veritas_is_project_owner(uuid);
drop function if exists public.veritas_can_collaborate(uuid);
drop function if exists public.veritas_can_edit_project(uuid);
