create table public.veritas_circuit_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  content_hash text not null check (char_length(content_hash) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.veritas_circuit_projects is 'Circuitos visuais sincronizados do Veritas, sempre isolados pelo usuário autenticado.';
comment on column public.veritas_circuit_projects.document is 'Documento veritas-circuit validado no cliente antes do envio.';

create unique index veritas_circuit_projects_user_hash_uidx
  on public.veritas_circuit_projects (user_id, content_hash);
create index veritas_circuit_projects_user_updated_idx
  on public.veritas_circuit_projects (user_id, updated_at desc);

alter table public.veritas_circuit_projects enable row level security;
revoke all on table public.veritas_circuit_projects from anon;
grant select, insert, update, delete on table public.veritas_circuit_projects to authenticated;

create policy veritas_circuit_projects_select_own
  on public.veritas_circuit_projects for select to authenticated
  using ((select auth.uid()) = user_id);
create policy veritas_circuit_projects_insert_own
  on public.veritas_circuit_projects for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy veritas_circuit_projects_update_own
  on public.veritas_circuit_projects for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy veritas_circuit_projects_delete_own
  on public.veritas_circuit_projects for delete to authenticated
  using ((select auth.uid()) = user_id);
