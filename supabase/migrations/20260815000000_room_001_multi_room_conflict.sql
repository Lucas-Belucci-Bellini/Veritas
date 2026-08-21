-- ROOM-001: salas privadas isoladas e concorrência otimista explícita.

create table if not exists public.veritas_circuit_rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.veritas_circuit_projects(id) on delete cascade,
  room_id text not null check (room_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  kind text not null default 'document' check (kind in ('document', 'review', 'chat')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, room_id)
);

comment on table public.veritas_circuit_rooms is 'Salas privadas nomeadas por projeto para colaboração isolada do Veritas.';

create index if not exists veritas_circuit_rooms_project_idx
  on public.veritas_circuit_rooms (project_id, room_id);

alter table public.veritas_circuit_rooms enable row level security;
revoke all on table public.veritas_circuit_rooms from anon;
grant select on table public.veritas_circuit_rooms to authenticated;

drop policy if exists veritas_circuit_rooms_select_member on public.veritas_circuit_rooms;
create policy veritas_circuit_rooms_select_member
  on public.veritas_circuit_rooms for select to authenticated
  using (public.veritas_can_collaborate(project_id));

create policy veritas_circuit_rooms_insert_owner
  on public.veritas_circuit_rooms for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.veritas_is_project_owner(project_id)
  );

create or replace function public.veritas_room_is_allowed(
  p_project_id uuid,
  p_room_id text
)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select p_room_id = 'main'
      or exists (
        select 1
          from public.veritas_circuit_rooms r
         where r.project_id = p_project_id
           and r.room_id = p_room_id
      );
$$;

revoke all on function public.veritas_room_is_allowed(uuid, text) from public, anon;
grant execute on function public.veritas_room_is_allowed(uuid, text) to authenticated;

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
  if not public.veritas_is_project_owner(p_project_id) then
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

revoke all on function public.veritas_create_circuit_room(uuid, text, text) from public, anon;
grant execute on function public.veritas_create_circuit_room(uuid, text, text) to authenticated;

-- A versão do tópico agora inclui projeto e sala. O evento explícito limita o
-- canal document room ao contrato circuit_snapshot; Presence continua separado.
drop policy if exists veritas_realtime_circuit_read on realtime.messages;
drop policy if exists veritas_realtime_circuit_presence_write on realtime.messages;
drop policy if exists veritas_realtime_circuit_broadcast_write on realtime.messages;

create policy veritas_realtime_circuit_read
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() ~ '^veritas:project:[0-9a-fA-F-]{36}:room:[A-Za-z0-9_-]{1,64}$'
    and public.veritas_can_collaborate(
      substring(realtime.topic() from '^veritas:project:([0-9a-fA-F-]{36}):room:')::uuid
    )
    and public.veritas_room_is_allowed(
      substring(realtime.topic() from '^veritas:project:([0-9a-fA-F-]{36}):room:')::uuid,
      substring(realtime.topic() from '^veritas:project:[0-9a-fA-F-]{36}:room:([A-Za-z0-9_-]{1,64})$')
    )
    and (
      realtime.messages.extension = 'presence'
      or realtime.messages.event is null
      or realtime.messages.event = 'circuit_snapshot'
    )
  );

create policy veritas_realtime_circuit_presence_write
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and realtime.topic() ~ '^veritas:project:[0-9a-fA-F-]{36}:room:[A-Za-z0-9_-]{1,64}$'
    and public.veritas_can_collaborate(
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
    and realtime.messages.event = 'circuit_snapshot'
    and realtime.topic() ~ '^veritas:project:[0-9a-fA-F-]{36}:room:[A-Za-z0-9_-]{1,64}$'
    and public.veritas_can_edit_project(
      substring(realtime.topic() from '^veritas:project:([0-9a-fA-F-]{36}):room:')::uuid
    )
    and public.veritas_room_is_allowed(
      substring(realtime.topic() from '^veritas:project:([0-9a-fA-F-]{36}):room:')::uuid,
      substring(realtime.topic() from '^veritas:project:[0-9a-fA-F-]{36}:room:([A-Za-z0-9_-]{1,64})$')
    )
  );

-- Colaboradores autorizados devem conseguir consultar versões, mas inserção
-- direta continua bloqueada; salvamento passa pelo RPC transacional abaixo.
drop policy if exists veritas_circuit_versions_select_own on public.veritas_circuit_versions;
create policy veritas_circuit_versions_select_member
  on public.veritas_circuit_versions for select to authenticated
  using (public.veritas_can_collaborate(project_id));

drop policy if exists veritas_circuit_versions_insert_own on public.veritas_circuit_versions;
create policy veritas_circuit_versions_insert_editor
  on public.veritas_circuit_versions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.veritas_can_edit_project(project_id)
  );

drop policy if exists veritas_circuit_projects_update_own on public.veritas_circuit_projects;
create policy veritas_circuit_projects_update_editor
  on public.veritas_circuit_projects for update to authenticated
  using (public.veritas_can_edit_project(id))
  with check (user_id = (select p.user_id from public.veritas_circuit_projects as p where p.id = public.veritas_circuit_projects.id));

drop function if exists public.veritas_sync_circuit_project(uuid, text, jsonb, text, jsonb);
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
    if not public.veritas_can_edit_project(p_project_id) then
      raise exception 'Circuit project not found or not editable by current user';
    end if;

    select p.id, p.user_id, p.created_at, p.updated_at, p.name, p.document, p.content_hash
      into v_project_id, v_owner_id, v_created_at, v_updated_at, v_name, v_document, v_content_hash
      from public.veritas_circuit_projects p
     where p.id = p_project_id
     for update;

    if v_project_id is null then
      raise exception 'Circuit project not found or not editable by current user';
    end if;

    select coalesce(max(v.version_number), 0)
      into v_version_number
      from public.veritas_circuit_versions v
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
      from public.veritas_circuit_versions v
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

revoke all on function public.veritas_sync_circuit_project(uuid, text, jsonb, text, jsonb, integer) from public, anon;
grant execute on function public.veritas_sync_circuit_project(uuid, text, jsonb, text, jsonb, integer) to authenticated;
