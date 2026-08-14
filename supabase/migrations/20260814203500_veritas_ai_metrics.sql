create table public.veritas_ai_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('analyze', 'optimize')),
  provider text not null check (provider in ('llm', 'heuristic', 'unknown')),
  latency_ms integer not null check (latency_ms >= 0),
  success boolean not null,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  content_hash text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

comment on table public.veritas_ai_metrics is 'Telemetria mínima e isolada das chamadas de análise/otimização da IA do Veritas.';

create index veritas_ai_metrics_user_created_idx
  on public.veritas_ai_metrics (user_id, created_at desc);
create index veritas_ai_metrics_user_action_idx
  on public.veritas_ai_metrics (user_id, action, created_at desc);

alter table public.veritas_ai_metrics enable row level security;
revoke all on table public.veritas_ai_metrics from anon;
grant select, insert on table public.veritas_ai_metrics to authenticated;

create policy veritas_ai_metrics_select_own
  on public.veritas_ai_metrics for select to authenticated
  using ((select auth.uid()) = user_id);

create policy veritas_ai_metrics_insert_own
  on public.veritas_ai_metrics for insert to authenticated
  with check ((select auth.uid()) = user_id);

do $$
begin
  alter publication supabase_realtime add table public.veritas_ai_metrics;
exception
  when duplicate_object then null;
end;
$$;
