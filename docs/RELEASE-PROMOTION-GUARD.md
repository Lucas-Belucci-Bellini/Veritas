# Guard de promoção SemVer

O Veritas usa o script `npm run release:guard` como uma barreira determinística antes da criação de uma release no GitHub. O guard classifica a versão solicitada e não cria tags, não altera releases e não substitui o preflight beta; ele apenas decide se a promoção pode continuar.

## Canais suportados

| Canal | Exemplo | Requisitos adicionais do guard |
| --- | --- | --- |
| Alpha | `v0.9.0-alpha.1` | Nenhum requisito beta. Os gates gerais do workflow continuam obrigatórios. |
| Beta | `v0.9.0-beta.1` | `RELEASE_PREFLIGHT_STRICT=1`, `RELEASE_EVIDENCE_STATUS=PASS` e `RELEASE_BETA_APPROVED=true`. |
| Release candidate | `v0.9.0-rc.14` | Nenhum requisito beta. O workflow executa testes, typecheck, lint, builds, readiness WASM-001, matriz golden/hardening WASM-003, benchmark comparativo e smoke; a ponte permanece opt-in e fora do produto. |
| Estável | `v1.0.0` | Nenhum requisito beta no guard; os critérios de estabilidade e rollback continuam sendo responsabilidade do processo de release. |

Versões sem sufixo são estáveis. Sufixos desconhecidos, formatos incompletos e versões que não seguem `MAJOR.MINOR.PATCH` são rejeitados como canal inválido.

## Política para beta

Uma promoção beta só é permitida quando **as três condições** são verdadeiras ao mesmo tempo:

1. O preflight foi executado em modo estrito, com `RELEASE_PREFLIGHT_STRICT=1`.
2. O manifesto de evidências foi revisado e está em `PASS`, representado por `RELEASE_EVIDENCE_STATUS=PASS` ou validado diretamente pelo caminho indicado em `RELEASE_EVIDENCE_MANIFEST`.
3. Uma aprovação explícita foi registrada em `RELEASE_BETA_APPROVED=true`.

O manifesto aceito deve ser produzido pelo fluxo de evidências beta e conter os gates obrigatórios, proveniência de execução real quando aplicável, nenhum `openP0`, nenhum `openP1` e somente resultados `PASS`. Relatórios `SAFE`, `SKIP`, `ANONYMOUS_ONLY` ou sem marcadores reais não podem ser usados para obter aprovação.

> O guard é uma barreira de promoção, não uma simulação dos testes cross-user. Ele não cria contas descartáveis, não abre sessões Supabase e não transforma ausência de configuração em aprovação.

## Uso local

Para uma RC, o comando pode ser executado sem variáveis beta:

```bash
RELEASE_VERSION=v0.9.0-rc.14 npm run release:guard
```

O resultado esperado é `Release guard PASS`. Para confirmar o fail-closed de beta:

```bash
RELEASE_VERSION=v0.9.0-beta.1 \
RELEASE_PREFLIGHT_STRICT=1 \
npm run release:guard
```

Esse segundo comando deve falhar porque ainda faltam o manifesto `PASS` e a aprovação explícita. Uma promoção beta autorizada somente pode ser ensaiada depois da execução do preflight estrito:

```bash
RELEASE_VERSION=v0.9.0-beta.1 \
RELEASE_PREFLIGHT_STRICT=1 \
RELEASE_EVIDENCE_MANIFEST=/caminho/para/beta-evidence-manifest.json \
RELEASE_BETA_APPROVED=true \
npm run release:guard
```

Quando `RELEASE_EVIDENCE_MANIFEST` é informado, o script lê o JSON local, confere a versão sem o prefixo `v`, valida timestamp, listas P0/P1 e todos os gates com `scripts/betaEvidence.mjs`. O status efetivo é `PASS` somente se a validação não produzir erros.

## Integração no GitHub Actions

O workflow `.github/workflows/release.yml` chama o guard automaticamente para qualquer versão contendo `-beta.`. Nesse job, o modo estrito é fixado em `1`; a evidência e a aprovação vêm das variáveis protegidas do repositório:

| Variável do repositório | Valor exigido para beta |
| --- | --- |
| `VERITAS_BETA_EVIDENCE_STATUS` | `PASS` |
| `VERITAS_BETA_APPROVED` | `true`, `1`, `yes` ou `on` |

As variáveis devem ser atualizadas somente depois que `npm run beta:preflight` tiver passado com manifestos reais revisados. Se estiverem ausentes, o workflow falha fechado e não publica a release beta. O caminho de RC, alpha e estável não depende dessas duas variáveis, mas continua sujeito aos gates gerais do workflow.

O `workflow_dispatch` também passa pelo mesmo guard quando a versão informada for beta. A etapa de publicação só executa depois que a validação de versão, o guard, a suíte, o typecheck, o lint, os builds e o smoke concluírem com sucesso.

## Escopo e limitações

O guard não move tags, não reescreve tags existentes, não cria contas descartáveis e não aprova RLS, Realtime ou Edge Function por conta própria. A evidência cross-user real continua sendo uma ação operacional separada, com credenciais descartáveis e relatórios sanitizados. A promoção beta permanece proibida enquanto os gates RLS-001 a RLS-022, RT-001 a RT-005, RLS-020/RLS-021 e a confirmação externa de onboarding não estiverem em `PASS` com proveniência válida.
