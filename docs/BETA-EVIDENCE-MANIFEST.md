# Manifesto agregado de evidências beta

O comando `npm run beta:evidence` combina relatórios sanitizados da matriz RLS, da Edge Function e da auditoria estrutural Supabase em um único JSON consumível por `beta:preflight`. Ele não executa autenticação, não cria fixtures e não transforma uma ausência de relatório em aprovação.

```bash
BETA_EXPECTED_VERSION=0.9.0-rc.1 \
BETA_RLS_REPORT=artifacts/rls-acceptance.md \
BETA_EDGE_REPORT=artifacts/edge-acceptance.md \
BETA_REALTIME_REPORT=artifacts/realtime-acceptance.md \
BETA_HDL_REPORT=artifacts/hdl-acceptance.md \
BETA_ACCESSIBILITY_REPORT=artifacts/accessibility-acceptance.md \
BETA_ROLLBACK_REPORT=artifacts/rollback-acceptance.md \
BETA_SUPABASE_STRUCTURAL_REPORT=artifacts/supabase-structural.json \
BETA_SUPABASE_PROJECT_ID=hcwzsxdcvmswebunznak \
BETA_EVIDENCE_OUTPUT=artifacts/beta-evidence-manifest.json \
npm run beta:evidence
```

O agregador considera `PASS` somente quando todos os IDs esperados do relatório correspondente estão em `PASS`. Um caso `SKIP`, `PENDING`, `FAIL`, ausente ou um relatório estrutural inválido deixa o gate em `PENDING` e adiciona um bloqueador `openP1`. Uma falha explícita RLS adiciona `RLS-FAILURE` a `openP0`; um bypass de JWT em RLS-019 adiciona `EDGE-JWT-BYPASS` a `openP0`.

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
BETA_SUPABASE_STRUCTURAL_REPORT=artifacts/supabase-structural.json \
SMOKE_URL=https://veritas-opal-seven.vercel.app \
npm run beta:preflight
```
