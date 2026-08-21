-- Beta security hardening: qualify the target row in the owner-preservation check.
-- The previous ROOM-001 policy used `where p.id = id`, which could resolve
-- `id` to the inner alias and make the scalar subquery ambiguous.
drop policy if exists veritas_circuit_projects_update_editor on public.veritas_circuit_projects;

create policy veritas_circuit_projects_update_editor
  on public.veritas_circuit_projects for update to authenticated
  using (public.veritas_can_edit_project(id))
  with check (
    user_id = (
      select p.user_id
        from public.veritas_circuit_projects as p
       where p.id = public.veritas_circuit_projects.id
    )
  );
