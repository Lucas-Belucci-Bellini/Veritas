# Doctor de prontidão beta real

O comando `npm run beta:readiness` é uma verificação local e não destrutiva para preparar a aceitação cross-user. Ele não abre sessões Supabase, não faz requests de rede, não executa os runners RLS/Realtime/Edge e não imprime valores de ambiente. Ele verifica somente presença de nomes, flags e arquivos esperados.

## Checks

| ID | Área | READY quando | BLOCKED quando |
|---|---|---|---|
| RDY-001 | Supabase público | `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` estão presentes. | Uma das variáveis não está presente. |
| RDY-002 | Contas RLS | Guard real e os quatro pares owner/other/editor/viewer estão presentes. | Guard ou qualquer credencial esperada está ausente. |
| RDY-003 | Realtime cross-user | Guard obrigatório, room, projeto e quatro tokens descartáveis estão presentes. | Guard, room ou token está ausente. |
| RDY-004 | Edge autenticada | Supabase, modo autenticado e JWT descartável estão presentes. | JWT ou flag autenticada está ausente. |
| RDY-005 | Artefatos | Relatórios RLS, Realtime, Edge, mobile manual e manifesto estão presentes. | Um ou mais arquivos ainda não foram gerados. |
| RDY-006 | Janela de promoção | `package.json` já está em uma versão `*-beta.N`. | A versão ainda é RC ou desenvolvimento; o check fica `SKIP`. |

`BLOCKED` significa que o operador precisa preparar algo antes de abrir qualquer sessão real. `SKIP` significa que o item não se aplica à versão atual, e não equivale a aprovação. O processo continua bloqueado quando qualquer check obrigatório está em `BLOCKED`.

## Execução

```bash
BETA_READINESS_REPORT_PATH=artifacts/beta-readiness.md \
npm run beta:readiness
```

O comando retorna código diferente de zero enquanto houver `BLOCKED`, mas sempre produz um relatório sanitizado útil para o operador. O relatório não inclui e-mails, passwords, JWTs, URLs ou valores de ambiente.

Depois que o doctor estiver pronto, execute os runners em ordem, sempre com contas descartáveis e tokens temporários:

```bash
RLS_RUNNER_ALLOW_REAL=1 npm run beta:rls
REALTIME_RUNNER_ALLOW_REAL=1 RT_REQUIRE_REAL=1 npm run beta:realtime
RLS_EDGE_REQUIRE_AUTHENTICATED=1 RLS_EDGE_ACCESS_TOKEN="$ACCESS_TOKEN_DE_TESTE" npm run beta:edge
```

Os runners reais continuam separados do doctor para reduzir o risco de executar operações contra o Supabase por engano. A inspeção mobile também permanece separada e exige revisão humana com `MOBILE_MANUAL_ALLOW_REAL=1`; o modo padrão gera `SKIP`. A saída `READY` só confirma presença de configuração; não confirma autorização, isolamento ou sucesso da matriz. Essas propriedades só podem ser confirmadas pelos relatórios com marcadores de proveniência real e todos os cenários em `PASS`.

## Proteções

Nunca cole credentials em issues, commits, chat ou anexos. Use contas descartáveis, publishable key e fixture com prefixo único. Se uma senha ou token aparecer em uma mensagem de erro, pare, revogue a credencial e substitua o relatório; o doctor foi projetado para não imprimir esses valores, mas o operador continua responsável por não executar comandos inseguros.

## Referências

[1]: ./BETA-RLS-ACCEPTANCE.md "Matriz real RLS"

[2]: ./BETA-REALTIME-ACCEPTANCE.md "Aceitação real Realtime"

[3]: ./BETA-EDGE-ACCEPTANCE.md "Smoke autenticado da Edge Function"

[4]: ./BETA-EVIDENCE-MANIFEST.md "Manifesto de evidências beta"

[5]: ./BETA-MOBILE-ACCEPTANCE.md "Aceitação mobile manual"
