# Auditoria estrutural do Supabase para o beta

**Data da captura:** 2026-08-21  
**Projeto:** `hcwzsxdcvmswebunznak`  
**Versão de referência:** `v0.9.0-rc.17`

## Escopo

Esta auditoria consulta somente metadados e catálogos do projeto Supabase existente. Ela não cria usuários, não usa service role key no frontend, não lê documentos privados e não substitui a matriz cross-user RLS-001 a RLS-022. O objetivo é detectar drift entre as migrations do repositório e o schema implantado antes da execução dos testes de aceitação com sessões reais.

As fontes foram `list_projects`, `list_migrations`, `list_tables`, `pg_class`/`pg_policy`, `pg_policies` e os Security Advisors do projeto. A captura foi feita por consultas limitadas e os resultados foram resumidos sem tokens, payloads ou linhas de negócio.

## Resultado estrutural

| Superfície | Resultado observado | Interpretação |
| --- | --- | --- |
| Projeto Supabase | `ACTIVE_HEALTHY`, PostgreSQL 17.6.1 | O projeto existente está operacional. |
| Tabelas Veritas | `veritas_ai_metrics`, `veritas_circuit_collaborators`, `veritas_circuit_context`, `veritas_circuit_projects`, `veritas_circuit_rooms` e `veritas_circuit_versions` encontradas | O conjunto principal do Veritas está implantado. |
| RLS | RLS habilitado em todas as seis tabelas | A barreira de row-level está presente. `force_rls=false` permanece registrado e não é tratado como prova de isolamento cross-user. |
| Policies públicas | Contagens observadas: 2, 1, 4, 5, 2 e 2, respectivamente | Há policies específicas por usuário, membro, editor/viewer e versões. |
| Realtime | Quatro policies do Veritas em `realtime.messages` | Leitura, Presence, Broadcast de snapshot e métricas têm tópicos/roles definidos. |
| Migrations Veritas | Contexto, projetos, versões, colaboração, métricas, ROOM-001 e hardening aparecem na lista implantada | Não foi detectada ausência dessas migrations no catálogo retornado. |

## Correção aplicada

A policy `veritas_circuit_projects_update_editor` estava materializada com a expressão `p.id = p.id` no subselect de `WITH CHECK`, o que não qualificava a linha-alvo e podia tornar a verificação ambígua. Foi aplicada a migration `20260821030000_fix_veritas_project_update_policy`, que usa `p.id = public.veritas_circuit_projects.id`. A policy foi reconsultada após a aplicação e passou a exibir a referência explícita à tabela-alvo.

A mesma correção foi refletida nas migrations ROOM-001 originais e no hardening, para que uma instalação nova não recrie o contrato anterior. A migration não altera dados, não desabilita RLS e não concede permissões novas.

## Resultado do hardening

Após a aplicação da migration `20260821033000_harden_veritas_authorization_surface`, a consulta `pg_proc` confirmou os três helpers somente em `private`, com `anon_execute=false`; os quatro endpoints públicos do Veritas ficaram `SECURITY INVOKER`, também sem execução por `anon`. Os Security Advisors deixaram de listar os helpers e RPCs do Veritas.

## Avisos que continuam bloqueando o beta

Permanecem avisos fora do escopo desta fatia: `subscription_events` sem policy, funções legadas `bump_view`, `bump_visits`, `buscar_juris` e `current_tenant_role` como `SECURITY DEFINER` expostas e proteção contra senhas vazadas desabilitada no Auth. Essas superfícies não foram alteradas porque pertencem a outros domínios do projeto e exigem revisão própria.

Este documento ainda **não** pode ser usado como `rls` ou `security` `PASS` no manifesto beta: a auditoria estrutural confirma catálogo e grants, mas não executa RLS-001 a RLS-022 com dois usuários. O preflight continua bloqueando a promoção quando `openP0` ou `openP1` não estiver vazio.

## Próximo teste obrigatório

Executar RLS-001 a RLS-022 com pelo menos um owner e outro usuário distinto, além de editor/viewer quando aplicável. O relatório deve registrar somente role lógico, operação, status/erro, linhas retornadas e estado final da fixture, sem access tokens. Em particular, confirmar RLS-009, RLS-011, RLS-013, RLS-015, RLS-016, RLS-018, RLS-019, RLS-021 e RLS-022 contra o projeto `hcwzsxdcvmswebunznak`.
