# Aceitação Beta — Supabase Realtime temporal

**Produto:** Veritas  
**Versão candidata:** `v0.9.0-rc.15`
**Projeto Supabase:** `hcwzsxdcvmswebunznak`  
**Objetivo:** provar que Presence continua limitado a colaboradores e que os eventos `circuit_snapshot`, `runtime_config` e `runtime_state` são recebidos somente em tópicos privados de rooms válidas, com publicação reservada a owner/editor.

## 1. Contrato autorizado

O cliente abre canais privados no formato `veritas:project:{projectId}:room:{roomId}`. O contrato de Broadcast permite somente os três eventos abaixo; qualquer outro nome fica fora da allowlist e não pode ser usado como evidência de colaboração temporal. No editor, a sala ativa, o estado da conexão, os participantes e a última versão remota aplicada são exibidos em português; quando a colaboração está desativada ou desconectada, o modo local-first continua sendo o caminho principal. Se houver alterações locais desde a última sincronização, um snapshot remoto fica pendente e o editor oferece `Aplicar alteração remota` ou `Manter alterações locais`, sem sobrescrita silenciosa.

| Evento | Finalidade | Leitura | Publicação |
|---|---|---|---|
| `circuit_snapshot` | Snapshot do documento combinacional | Colaborador autorizado | Owner/editor |
| `runtime_config` | Períodos de clock e configuração temporal | Colaborador autorizado | Owner/editor |
| `runtime_state` | Estado normalizado da simulação e timeline | Colaborador autorizado | Owner/editor |
| Presence | Presença, papel e identidade visual da sessão | Colaborador autorizado | Colaborador autorizado |

As policies são aplicadas em `realtime.messages`. A policy de leitura exige extensão `broadcast` ou `presence`, tópico no formato esperado, colaboração no projeto e room existente ou `main`. A policy de escrita de Broadcast exige adicionalmente `private.veritas_can_edit_project(project_id)`. Portanto, esconder o botão para um viewer não é a prova de segurança; a rejeição deve ocorrer no servidor quando o JWT do viewer tentar publicar.

A migration corretiva é `20260821060000_allow_temporal_realtime_events.sql`. As migrations `20260815000000_room_001_multi_room_conflict.sql` e `20260821033000_harden_veritas_authorization_surface.sql` também mantêm a mesma allowlist para instalações reproduzíveis. A autorização de Realtime deve ser validada com sessões autenticadas, sem service role, conforme a orientação de policies do Supabase [1] [2].

## 2. Pré-requisitos e segurança

Use quatro contas descartáveis: `owner`, `editor`, `viewer` e `other`. O owner deve possuir o projeto e a room de teste; o editor deve ter role `editor`; o viewer deve ter role `viewer`; `other` não deve ter qualquer relação com o projeto. Nunca use contas pessoais para a matriz.

O runner usa apenas a URL do Supabase e a publishable/anon key. Access tokens ficam em memória durante a execução e não são escritos no relatório. Service role key, passwords, headers completos e payloads privados são proibidos no terminal e nos artefatos.

```bash
export SUPABASE_URL="https://hcwzsxdcvmswebunznak.supabase.co"
export SUPABASE_ANON_KEY="<publishable-key>"
export RT_PROJECT_ID="<uuid-da-fixture>"
export RT_ROOM_ID="alpha"
export RT_OWNER_ACCESS_TOKEN="<token-descartavel-do-owner>"
export RT_EDITOR_ACCESS_TOKEN="<token-descartavel-do-editor>"
export RT_VIEWER_ACCESS_TOKEN="<token-descartavel-do-viewer>"
export RT_OTHER_ACCESS_TOKEN="<token-descartavel-do-other>"
```

Para execução controlada, configure também `RT_TIMEOUT_MS` quando a rede de teste exigir uma janela diferente. O runner aborta em `FAIL`; por padrão, ausência de credenciais ou modo real resulta em `SKIP`, nunca em falso `PASS`. Use `RT_REQUIRE_REAL=1` para transformar pré-requisitos ausentes em `FAIL`.

## 3. Cenários RT-001 a RT-005

Cada cenário deve ser executado com o tópico completo, canal privado, status de subscribe, resultado de `track`/`send`, eventos observados e horário. O relatório registra somente status e mensagens sanitizadas.

| ID | Sessão | Procedimento | Resultado esperado |
|---|---|---|---|
| RT-001 | owner | Assinar `main`/`alpha`, publicar Presence com `track` e observar a sessão. | Subscribe autorizado e `track` retorna `ok`; nenhum segredo aparece no relatório. |
| RT-002 | editor + owner | Abrir duas sessões, publicar `runtime_config` pelo editor e observar o evento no owner. | `send` permitido e payload recebido pelo owner; o evento permanece dentro da allowlist temporal. |
| RT-003 | viewer | Assinar a room autorizada e tentar publicar `runtime_state`. | A conexão de leitura pode existir, mas a escrita é rejeitada pela policy de edição. Se o viewer publicar, o cenário é `FAIL` P0/P1 conforme a triagem de autorização. |
| RT-004 | other | Tentar assinar o tópico de um projeto ao qual a conta não pertence. | Subscribe rejeitado; nenhum Presence ou Broadcast do projeto fica visível. |
| RT-005 | owner | Tentar assinar uma room inexistente diferente de `main`. | A room não permitida é rejeitada; nenhum evento é recebido ou publicado. |

O runner também rejeita localmente nomes de eventos que não pertençam a `circuit_snapshot`, `runtime_config` ou `runtime_state`, sanitiza `Bearer`, `token`, `password` e `api_key`, e limita mensagens a 240 caracteres. Essas proteções reduzem vazamento no relatório, mas não substituem as policies PostgreSQL.

Após a validação estrutural, cada sessão aplica uma ordenação determinística independente para `circuit_snapshot`, `runtime_config` e `runtime_state`: maior `baseVersion`, depois `sentAt`, depois `clientId` e, por fim, o hash. Duplicatas e eventos atrasados são descartados antes de alcançar a UI, e o estado de ordenação é reiniciado ao desconectar da sala. Isso protege a convergência local contra entregas fora de ordem, mas não substitui a autorização do Supabase nem prova convergência cross-user real.

## 4. Execução e relatório

A execução segura padrão não abre sessões reais:

```bash
npm run beta:realtime
```

Para executar a aceitação real com tokens descartáveis:

```bash
REALTIME_RUNNER_ALLOW_REAL=1 \
RT_REQUIRE_REAL=1 \
RT_REPORT_PATH=artifacts/realtime-acceptance-$(date +%Y%m%d-%H%M%S).md \
npm run beta:realtime
```

O resultado deve conter uma linha explícita por cenário, por exemplo:

```text
RT-001 PASS — presença autorizada: owner conectou e publicou Presence
RT-002 PASS — runtime_config editor para owner: editor publicou runtime_config e owner recebeu o evento
RT-003 PASS — viewer não pode publicar runtime_state: viewer conectou, mas a policy rejeitou a publicação temporal
RT-004 PASS — usuário externo não acessa o projeto: usuário externo foi rejeitado ao assinar o tópico do projeto
RT-005 PASS — sala não permitida não é assinável: sala ghost foi rejeitada pela allowlist de salas
```

O agregador consome o relatório por `BETA_REALTIME_REPORT`:

```bash
BETA_EXPECTED_VERSION=0.9.0-rc.15 \
BETA_REALTIME_REPORT=artifacts/realtime-acceptance-<timestamp>.md \
npm run beta:evidence
```

O gate `realtime` só é `PASS` quando RT-001 a RT-005 possuem `PASS` explícito e o caminho da evidência está presente no manifesto. `SKIP`, `PENDING` ou ausência de qualquer ID mantém `REALTIME-EVIDENCE-INCOMPLETE` em `openP1`; portanto, esta correção não promove beta automaticamente sem as quatro contas reais.

## 5. Aplicação da migration e verificação

A migration deve ser aplicada no projeto existente `hcwzsxdcvmswebunznak`, nunca em um projeto Supabase novo. Depois, confirme no catálogo que as policies `veritas_realtime_circuit_read`, `veritas_realtime_circuit_presence_write` e `veritas_realtime_circuit_broadcast_write` existem e que os predicados contêm os três eventos temporais.

A consulta de catálogo deve retornar somente metadados de policy necessários para auditoria; não inclua tokens, documentos ou dados de usuários no relatório. Após a aplicação, repita pelo menos RT-001 e RT-002 para confirmar que o cliente que já emite `runtime_config` e `runtime_state` não encontra `CHANNEL_ERROR` por evento fora da allowlist.

## 6. Limites e critérios de promoção

Esta aceitação prova autorização de tópico, papel de publicação e entrega básica de eventos. Ela não prova, por si só, convergência de snapshots, resolução de conflitos, ordenação total de timeline, disponibilidade multi-região ou validação completa do documento temporal. Esses pontos permanecem cobertos pelo roadmap e por futuras fatias de teste.

Qualquer bypass cross-user, viewer publicando, room inexistente assinável ou evento temporal autorizado sem `veritas_can_edit_project` bloqueia a promoção. O gate Realtime deve ser anexado ao manifesto junto dos gates RLS, Edge e auditoria estrutural; a ausência de contas descartáveis deve ser declarada como `SKIP`, nunca mascarada como aprovação.

## Referências

[1]: https://supabase.com/docs/guides/realtime/authorization "Supabase Docs — Realtime Authorization"

[2]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase Docs — Row Level Security"

[3]: ../src/realtime/roomCollaboration.ts "Veritas — colaboração por sala e eventos temporais"

[4]: ../src/realtime/eventOrdering.ts "Veritas — ordenação determinística de eventos"

[5]: ../supabase/migrations/20260821060000_allow_temporal_realtime_events.sql "Veritas — allowlist Realtime temporal"
