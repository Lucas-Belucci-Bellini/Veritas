# Inspeção externa do Supabase — 2026-08-14

O conector Supabase está habilitado e o projeto existente encontrado foi `hcwzsxdcvmswebunznak`, nome `Lucas-Belucci-Bellini's Project`, região `us-west-2`, estado `ACTIVE_HEALTHY`.

A inspeção do schema público encontrou a camada de IA já existente com `memories`, `knowledge_items`, `knowledge_notes`, `knowledge_sources`, `ai_skills`, `skill_knowledge_links` e `learning_audit_events`. As policies existentes limitam memórias e notas ao proprietário autenticado, e conhecimento publicado ou criado pelo próprio usuário fica visível conforme o ciclo de vida.

A migração `veritas_circuit_context_foundation` foi aplicada com sucesso. Ela cria `public.veritas_circuit_context`, usa `auth.users` como proprietário, habilita RLS, revoga acesso de `anon`, concede CRUD apenas a `authenticated` e cria quatro policies próprias do usuário. A tabela tem `payload jsonb`, tags, hash de conteúdo, status de ciclo de vida e índices por usuário/data, tags e hash.

O consultor oficial retornou avisos anteriores à migração: `subscription_events` com RLS sem policy, funções `SECURITY DEFINER` expostas (`bump_view`, `bump_visits`, `buscar_juris`, `current_tenant_role`) e proteção de senha vazada desabilitada. Esses pontos não foram alterados nesta tarefa por não pertencerem ao fluxo do Veritas.

## Fontes oficiais consultadas

- https://supabase.com/docs/guides/auth/auth-mfa — autorização e RLS com identidade autenticada.
- https://supabase.com/docs/guides/database/postgres/column-level-security — políticas por linha e privilégios por coluna.
- https://supabase.com/docs/guides/database/database-advisors — avisos de segurança do banco.
