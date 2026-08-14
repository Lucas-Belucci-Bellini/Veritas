-- Contexto estruturado do Veritas para consumo futuro por assistentes de IA.
-- O payload deve conter apenas snapshots validados e metadados não sensíveis.
create table public.veritas_circuit_context (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_ref text not null check (char_length(source_ref) between 1 and 200),
  context_type text not null default 'circuit' check (context_type in ('circuit', 'simulation', 'feedback', 'preference')),
  circuit_name text not null check (char_length(circuit_name) between 1 and 200),
  summary text not null check (char_length(summary) between 1 and 4000),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  tags text[] not null default '{}',
  content_hash text,
  status text not null default 'active' check (status in ('active', 'archived', 'superseded')),
  usage_count integer not null default 0 check (usage_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz
);

comment on table public.veritas_circuit_context is 'Contexto estruturado do Veritas para consumo futuro por assistentes de IA; o payload não deve conter segredos.';
comment on column public.veritas_circuit_context.payload is 'Snapshot validado do circuito, metadados de simulação e resultados resumidos; sem tokens ou credenciais.';
comment on column public.veritas_circuit_context.content_hash is 'Fingerprint opcional para deduplicar o mesmo contexto por usuário.';

create unique index veritas_circuit_context_user_hash_uidx
  on public.veritas_circuit_context (user_id, content_hash)
  where content_hash is not null;
create index veritas_circuit_context_user_updated_idx
  on public.veritas_circuit_context (user_id, updated_at desc);
create index veritas_circuit_context_tags_gin_idx
  on public.veritas_circuit_context using gin (tags);

alter table public.veritas_circuit_context enable row level security;
revoke all on table public.veritas_circuit_context from anon;
grant select, insert, update, delete on table public.veritas_circuit_context to authenticated;

create policy veritas_circuit_context_select_own
  on public.veritas_circuit_context for select to authenticated
  using ((select auth.uid()) = user_id);
create policy veritas_circuit_context_insert_own
  on public.veritas_circuit_context for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy veritas_circuit_context_update_own
  on public.veritas_circuit_context for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy veritas_circuit_context_delete_own
  on public.veritas_circuit_context for delete to authenticated
  using ((select auth.uid()) = user_id);
