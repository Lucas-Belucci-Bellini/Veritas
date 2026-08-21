# Aceitação da Edge Function no beta

**Endpoint implantado:** `https://hcwzsxdcvmswebunznak.supabase.co/functions/v1/veritas-circuit-ai`
**Função:** `veritas-circuit-ai`
**Estado observado:** `ACTIVE`, `verify_jwt=true`, versão 4.

## Contrato observado

A Edge Function exige `POST`, aceita `action` igual a `analyze` ou `optimize`, recebe `context` com `circuitName`, `summary` e um documento `veritas-circuit` versionado, limita instruções adicionais a 1200 caracteres e rejeita contexto acima de 200.000 bytes. Sem provedor LLM configurado, retorna fallback heurístico sem interromper o fluxo principal.

A autenticação é uma barreira do runtime da função: o endpoint implantado está com `verify_jwt=true`. O smoke real executado sem `Authorization` respondeu HTTP `401`, cobrindo RLS-019 sem criar sessão ou registrar chave.

## Runner

O comando `npm run beta:edge` usa `SUPABASE_URL` para montar o endpoint, executa RLS-019 sempre e grava um relatório sanitizado em `artifacts/`. Para validar também RLS-020 e RLS-021, forneça um token de uma conta descartável via ambiente protegido:

```bash
SUPABASE_URL="https://hcwzsxdcvmswebunznak.supabase.co" \
RLS_EDGE_REQUIRE_AUTHENTICATED=1 \
RLS_EDGE_ACCESS_TOKEN="$ACCESS_TOKEN_DE_TESTE" \
RLS_EDGE_ABUSE_USER_ID="uuid-de-outro-usuario" \
RLS_EDGE_ABUSE_PROJECT_ID="uuid-de-outro-projeto" \
npm run beta:edge
```

O token não é impresso nem gravado. O relatório guarda somente ID do cenário, status HTTP, operação e mensagem truncada com Bearer/token/password/API key removidos. Sem `RLS_EDGE_REQUIRE_AUTHENTICATED=1`, os cenários autenticados ficam `SKIP`, nunca `PASS`.

## Critérios

| Cenário | PASS quando | Limite |
| --- | --- | --- |
| RLS-019 | Sem JWT retorna 401/403 | Não prova análise autenticada |
| RLS-020 | JWT de teste retorna 2xx em payload mínimo válido | Não deve usar token pessoal |
| RLS-021 | Campos de usuário/projeto estrangeiros não elevam acesso nem aparecem na resposta | Precisa de UUIDs de outra conta |

O smoke sem JWT foi comprovado no endpoint implantado. RLS-020 e RLS-021 continuam pendentes até o runner ser executado com uma conta descartável e UUIDs de outro usuário/projeto. Essa evidência não promove beta sozinha; o manifesto também exige RLS-001 a RLS-018 e RLS-022, Realtime, HDL, acessibilidade/mobile e rollback.
