create table public.veritas_circuit_collaborators (
  project_id uuid not null references public.veritas_circuit_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

comment on table public.veritas_circuit_collaborators is 'Usuários autorizados a participar dos canais privados de colaboração do Veritas.';

create index veritas_circuit_collaborators_user_idx
  on public.veritas_circuit_collaborators (user_id, project_id);

alter table public.veritas_circuit_collaborators enable row level security;
revoke all on table public.veritas_circuit_collaborators from anon;
grant select on table public.veritas_circuit_collaborators to authenticated;

create or replace function public.veritas_is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.veritas_circuit_projects p
     where p.id = p_project_id and p.user_id = (select auth.uid())
  );
$$;

create or replace function public.veritas_can_collaborate(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.veritas_is_project_owner(p_project_id)
      or exists (
        select 1 from public.veritas_circuit_collaborators c
         where c.project_id = p_project_id and c.user_id = (select auth.uid())
      );
$$;

create or replace function public.veritas_can_edit_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.veritas_is_project_owner(p_project_id)
      or exists (
        select 1 from public.veritas_circuit_collaborators c
         where c.project_id = p_project_id
           and c.user_id = (select auth.uid())
           and c.role = 'editor'
      );
$$;

revoke all on function public.veritas_is_project_owner(uuid) from public, anon;
revoke all on function public.veritas_can_collaborate(uuid) from public, anon;
revoke all on function public.veritas_can_edit_project(uuid) from public, anon;
grant execute on function public.veritas_is_project_owner(uuid) to authenticated;
grant execute on function public.veritas_can_collaborate(uuid) to authenticated;
grant execute on function public.veritas_can_edit_project(uuid) to authenticated;

create policy veritas_circuit_collaborators_select_member
  on public.veritas_circuit_collaborators for select to authenticated
  using (public.veritas_can_collaborate(project_id));

create policy veritas_circuit_projects_select_collaborator
  on public.veritas_circuit_projects for select to authenticated
  using (public.veritas_can_collaborate(id));

create or replace function public.veritas_add_circuit_collaborator(
  p_project_id uuid,
  p_user_id uuid,
  p_role text default 'editor'
)
returns public.veritas_circuit_collaborators
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.veritas_circuit_collaborators;
begin
  if not public.veritas_is_project_owner(p_project_id) then
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
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.veritas_is_project_owner(p_project_id) then
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

create policy veritas_realtime_circuit_read
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() ~ '^veritas:circuit:[0-9a-fA-F-]{36}$'
    and public.veritas_can_collaborate(
      substring(realtime.topic() from '^veritas:circuit:([0-9a-fA-F-]{36})$')::uuid
    )
  );

create policy veritas_realtime_circuit_presence_write
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and realtime.topic() ~ '^veritas:circuit:[0-9a-fA-F-]{36}$'
    and public.veritas_can_collaborate(
      substring(realtime.topic() from '^veritas:circuit:([0-9a-fA-F-]{36})$')::uuid
    )
  );

create policy veritas_realtime_circuit_broadcast_write
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() ~ '^veritas:circuit:[0-9a-fA-F-]{36}$'
    and public.veritas_can_edit_project(
      substring(realtime.topic() from '^veritas:circuit:([0-9a-fA-F-]{36})$')::uuid
    )
  );
