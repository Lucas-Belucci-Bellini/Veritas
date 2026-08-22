# Manifesto agregado de evidências beta

O comando `npm run beta:evidence` combina relatórios sanitizados da matriz RLS, da Edge Function e da auditoria estrutural Supabase em um único JSON consumível por `beta:preflight`. Ele não executa autenticação, não cria fixtures e não transforma uma ausência de relatório em aprovação.

```bash
BETA_EXPECTED_VERSION=0.9.0-rc.4 \
BETA_RLS_REPORT=artifacts/rls-acceptance.md \
BETA_EDGE_REPORT=artifacts/edge-acceptance.md \
BETA_REALTIME_REPORT=artifacts/realtime-acceptance.md \
BETA_HDL_REPORT=artifacts/hdl-acceptance.md \
BETA_ACCESSIBILITY_REPORT=artifacts/accessibility-acceptance.md \
BETA_ROLLBACK_REPORT=artifacts/rollback-acceptance.md \
BETA_ONBOARDING_REPORT=artifacts/onboarding-acceptance.md \
BETA_MCP_REPORT=artifacts/mcp-acceptance.md \
BETA_MOBILE_REPORT=artifacts/mobile-acceptance.md \
BETA_SUPABASE_STRUCTURAL_REPORT=artifacts/supabase-structural.json \
BETA_SUPABASE_PROJECT_ID=hcwzsxdcvmswebunznak \
BETA_EVIDENCE_OUTPUT=artifacts/beta-evidence-manifest.json \
npm run beta:evidence
```

O agregador considera `PASS` somente quando todos os IDs esperados do relatório correspondente estão em `PASS`. Um caso `SKIP`, `PENDING`, `FAIL`, ausente ou um relatório estrutural inválido deixa o gate em `PENDING` e adiciona um bloqueador `openP1`. Uma falha explícita RLS adiciona `RLS-FAILURE` a `openP0`; um bypass de JWT em RLS-019 adiciona `EDGE-JWT-BYPASS` a `openP0`.

O workflow de qualidade preserva o conjunto `artifacts/*.md` como artefato `veritas-acceptance-reports-{run_id}` por 14 dias. São enviados somente relatórios Markdown sanitizados; manifests JSON, arquivos de ambiente, tokens e logs de preview não fazem parte desse pacote. A retenção facilita auditoria e diagnóstico, mas não converte `SKIP`, mocks ou execução anônima em evidência beta.

## Contrato produzido

O manifesto contém `version`, `generatedAt`, listas `openP0` e `openP1` e os gates `rls`, `edge`, `supabaseStructural`, `realtime`, `hdl`, `accessibility`, `mobile`, `rollback` e `onboarding`. Cada gate possui ao menos `status` e `evidence`; os gates de relatório também conservam uma lista sanitizada de status por ID.

A execução atual, usando o relatório real da Edge sem JWT, produziu `RLS-019 PASS`, `RLS-020 SKIP` e `RLS-021 SKIP`. Como a matriz cross-user ainda não foi executada e não foi anexado um relatório estrutural nesta agregação, o resultado correto foi `aggregator_exit=1` com bloqueadores explícitos. Esse resultado é esperado e não deve ser substituído manualmente por um manifesto PASS.

Para liberar a promoção beta, gere os relatórios reais com quatro contas descartáveis, anexe evidências de Realtime, HDL, acessibilidade/mobile, rollback e onboarding, execute o agregador e depois rode o preflight em modo obrigatório:

```bash
BETA_PREFLIGHT_REQUIRE_EVIDENCE=1 \
BETA_PREFLIGHT_REQUIRE_RLS=1 \
BETA_PREFLIGHT_REQUIRE_SUPABASE_STRUCTURAL=1 \
BETA_PREFLIGHT_REQUIRE_SMOKE=1 \
BETA_EVIDENCE_MANIFEST=artifacts/beta-evidence-manifest.json \
BETA_RLS_REPORT=artifacts/rls-acceptance.md \
BETA_REALTIME_REPORT=artifacts/realtime-acceptance.md \
BETA_HDL_REPORT=artifacts/hdl-acceptance.md \
BETA_ACCESSIBILITY_REPORT=artifacts/accessibility-acceptance.md \
BETA_ROLLBACK_REPORT=artifacts/rollback-acceptance.md \
BETA_ONBOARDING_REPORT=artifacts/onboarding-acceptance.md \
BETA_MCP_REPORT=artifacts/mcp-acceptance.md \
BETA_MOBILE_REPORT=artifacts/mobile-acceptance.md \
BETA_SUPABASE_STRUCTURAL_REPORT=artifacts/supabase-structural.json \
SMOKE_URL=https://veritas-opal-seven.vercel.app \
npm run beta:preflight
```

## Preflight estrito para promoção beta

O `beta-preflight` mantém um modo local permissivo para desenvolvimento, mas entra automaticamente em modo estrito quando `BETA_PREFLIGHT_STRICT=1`, quando `BETA_PREFLIGHT_REQUIRE_EVIDENCE=1` ou quando `BETA_EXPECTED_VERSION`/`GITHUB_REF_NAME` identifica uma versão `*-beta.N`. Nesse modo, não é permitido transformar ausência em `SKIP` para as evidências de promoção.

O preflight estrito exige, no mínimo, `BETA_EVIDENCE_MANIFEST`, `BETA_RLS_REPORT`, `BETA_SUPABASE_STRUCTURAL_REPORT` e `SMOKE_URL`. O manifesto validado exige todos os gates formais, incluindo RLS, Realtime, HDL, acessibilidade, mobile, rollback, onboarding e MCP, com `PASS` explícito, evidência não vazia e `openP0`/`openP1` vazios. A matriz RLS precisa conter RLS-001 a RLS-022 aprovados; o agregador continua classificando sessões ausentes ou `SKIP` como bloqueadores.

Exemplo de execução de promoção:

```bash
BETA_PREFLIGHT_STRICT=1 \
BETA_EXPECTED_VERSION=0.9.0-beta.1 \
BETA_EVIDENCE_MANIFEST=artifacts/beta-evidence-manifest.json \
BETA_RLS_REPORT=artifacts/rls-acceptance.md \
BETA_SUPABASE_STRUCTURAL_REPORT=artifacts/supabase-structural.json \
BETA_SUPABASE_PROJECT_ID=hcwzsxdcvmswebunznak \
SMOKE_URL=https://veritas-opal-seven.vercel.app \
npm run beta:preflight
```

A execução local sem essas variáveis continua útil para desenvolvimento e informa `SKIP`, mas não pode ser usada como prova de promoção. O ensaio de 2026-08-21 confirmou que o modo estrito bloqueia quando manifesto, RLS, auditoria Supabase ou smoke não estão disponíveis.

## Proveniência anti-simulação

O preflight estrito não aceita somente linhas `PASS`. Relatórios de RLS, Realtime e Edge precisam carregar marcadores de execução real emitidos pelos próprios runners:

| Evidência | Marcadores obrigatórios | Condição adicional |
| --- | --- | --- |
| RLS | `Execution mode: REAL`, guard `RLS_RUNNER_ALLOW_REAL=1` e `Accounts: 4 disposable accounts`. | RLS-001 a RLS-022 em PASS. |
| Realtime | `Execution mode: REAL_REQUIRED`, guard `REALTIME_RUNNER_ALLOW_REAL=1`, `RT_REQUIRE_REAL=1` e sessões autenticadas descartáveis. | RT-001 a RT-005 em PASS. |
| Edge | `Execution mode: REAL`, `Authenticated mode: REAL_REQUIRED` e `Authenticated disposable JWT: provided`. | RLS-019, RLS-020 e RLS-021 em PASS. |
| Mobile | `Execution mode: REAL_MANUAL`, `Runner guard: MOBILE_MANUAL_ALLOW_REAL=1`, revisor, dispositivo, navegador e timestamp. | MOBILE-001 a MOBILE-004 em PASS com evidência não vazia. |

O runner seguro local pode gerar relatórios úteis para desenvolvimento, mas seus marcadores `SAFE`, `SKIP` ou `ANONYMOUS_ONLY` não são aceitos como evidência de promoção. Isso evita que um relatório manualmente editado ou uma execução sem contas reais mascare um bloqueador P0/P1.
