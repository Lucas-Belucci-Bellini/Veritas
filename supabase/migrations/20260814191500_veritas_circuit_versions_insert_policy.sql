grant insert on table public.veritas_circuit_versions to authenticated;

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
