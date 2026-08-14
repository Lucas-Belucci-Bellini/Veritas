create table public.veritas_circuit_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.veritas_circuit_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  name text not null check (char_length(name) between 1 and 200),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  content_hash text not null check (char_length(content_hash) between 1 and 200),
  change_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(change_summary) = 'object'),
  created_at timestamptz not null default now(),
  unique (project_id, version_number)
);

comment on table public.veritas_circuit_versions is 'Histórico imutável de cada salvamento de circuito do Veritas.';
comment on column public.veritas_circuit_versions.change_summary is 'Metadados calculados pelo cliente para exibição rápida do diff entre versões.';

create index veritas_circuit_versions_project_created_idx
  on public.veritas_circuit_versions (project_id, created_at desc);
create index veritas_circuit_versions_user_created_idx
  on public.veritas_circuit_versions (user_id, created_at desc);

alter table public.veritas_circuit_versions enable row level security;
revoke all on table public.veritas_circuit_versions from anon;
grant select, insert on table public.veritas_circuit_versions to authenticated;

create policy veritas_circuit_versions_select_own
  on public.veritas_circuit_versions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy veritas_circuit_versions_insert_own
  on public.veritas_circuit_versions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
        from public.veritas_circuit_projects p
       where p.id = project_id
         and p.user_id = (select auth.uid())
    )
  );

create or replace function public.veritas_sync_circuit_project(
  p_project_id uuid,
  p_name text,
  p_document jsonb,
  p_content_hash text,
  p_change_summary jsonb default '{}'::jsonb
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
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
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

  if p_project_id is null then
    insert into public.veritas_circuit_projects (user_id, name, document, content_hash)
    values (v_user_id, p_name, p_document, p_content_hash)
    returning id, created_at, updated_at, name, document, content_hash
      into v_project_id, v_created_at, v_updated_at, v_name, v_document, v_content_hash;
  else
    update public.veritas_circuit_projects
       set name = p_name,
           document = p_document,
           content_hash = p_content_hash,
           updated_at = now()
     where id = p_project_id
       and user_id = v_user_id
    returning id, created_at, updated_at, name, document, content_hash
      into v_project_id, v_created_at, v_updated_at, v_name, v_document, v_content_hash;

    if v_project_id is null then
      raise exception 'Circuit project not found or not owned by current user';
    end if;
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_version_number
    from public.veritas_circuit_versions
   where project_id = v_project_id;

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

revoke all on function public.veritas_sync_circuit_project(uuid, text, jsonb, text, jsonb) from public, anon;
grant execute on function public.veritas_sync_circuit_project(uuid, text, jsonb, text, jsonb) to authenticated;
