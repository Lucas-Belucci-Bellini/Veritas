# Hardening da superfície de autorização Supabase

**Escopo:** Veritas `0.9.0-rc.1`
**Projeto existente:** `hcwzsxdcvmswebunznak`

## Motivo

O Security Advisor do Supabase identificou helpers de autorização do Veritas como funções `SECURITY DEFINER` executáveis por `authenticated` no schema `public`. A execução estava restrita de `anon`, mas o schema público continua sendo a superfície exposta pelo Data API. A documentação oficial recomenda que funções `SECURITY DEFINER` usadas por policies fiquem em schema não exposto e que `EXECUTE` seja concedido somente aos papéis que precisam chamá-las [1] [2].

A auditoria também confirmou que o frontend usa somente os contratos RPC `veritas_add_circuit_collaborator`, `veritas_remove_circuit_collaborator`, `veritas_create_circuit_room` e `veritas_sync_circuit_project`; não há consumidor do frontend chamando diretamente os helpers de autorização. Isso permite reduzir a superfície sem alterar nomes ou payloads públicos usados pela aplicação.

## Mudança aplicada

A migration `20260821033000_harden_veritas_authorization_surface.sql` cria o schema `private`, revoga seu uso geral e concede `USAGE`/`EXECUTE` apenas ao papel `authenticated`. Os três helpers `veritas_is_project_owner`, `veritas_can_collaborate` e `veritas_can_edit_project` passam a existir em `private` como `SECURITY DEFINER`, com `search_path` fixo em `public, pg_temp`; os equivalentes públicos são removidos.

As policies de projetos, colaboradores, rooms, versões e Realtime passam a chamar `private.veritas_*`. Os endpoints públicos de colaboradores mantêm os mesmos nomes e parâmetros, mas passam a `SECURITY INVOKER` e recebem `INSERT`, `UPDATE` e `DELETE` controlados por policies que exigem owner. As RPCs de room e sincronização continuam invoker e também chamam o helper privado. Nenhuma chave privada, service role key ou credencial foi adicionada ao frontend.

| Contrato | Antes | Depois |
| --- | --- | --- |
| Helpers de autorização | `public`, `SECURITY DEFINER`, execute para authenticated | `private`, `SECURITY DEFINER`, execute explícito para authenticated |
| Add/remove collaborator | `public`, `SECURITY DEFINER` | `public`, `SECURITY INVOKER`, RLS de owner |
| Create room/sync project | `public`, `SECURITY INVOKER` | Mantidos públicos, invoker, com helper privado |
| Policies RLS/Realtime | Chamavam `public.veritas_*` | Chamam `private.veritas_*` |
| Frontend local-first | Sem dependência de schema privado offline | Inalterado; IndexedDB continua sendo fallback |

## Critérios de não regressão

A aplicação deve continuar usando os mesmos nomes de RPC e os mesmos argumentos. Owner deve conseguir convidar/remover colaboradores e criar rooms; editor deve sincronizar projeto; viewer deve continuar sem publicar snapshots ou alterar versões. Usuário anônimo não recebe `USAGE` no schema privado nem `EXECUTE` nas funções. Os testes cross-user RLS-001 a RLS-022 continuam obrigatórios e não são substituídos por esta migration.

## Estado verificado após a aplicação

A migration foi aplicada com sucesso no projeto `hcwzsxdcvmswebunznak`. A consulta pós-migration mostrou os três helpers somente em `private`, com `security_definer=true`, `anon_execute=false` e `authenticated_execute=true`. Os quatro endpoints públicos preservaram os nomes e argumentos, passaram a `security_definer=false`, mantiveram `anon_execute=false` e continuam executáveis por `authenticated`.

Os Security Advisors deixaram de listar os helpers e RPCs do Veritas. Permanecem somente avisos fora deste escopo: `subscription_events` sem policy, funções legadas `bump_view`, `bump_visits`, `buscar_juris` e `current_tenant_role` como SECURITY DEFINER expostas, além da proteção contra senhas vazadas desabilitada no Auth. Esses avisos continuam classificados separadamente e não são mascarados como PASS do beta.

## Referências

[1]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase — Row Level Security"

[2]: https://supabase.com/docs/guides/database/secure-data "Supabase — Securing your API"
