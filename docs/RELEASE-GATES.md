# Gates de validação alpha e beta do Veritas

Este documento define o que precisa passar antes de publicar `alpha`, `beta`, release candidate e `v1.0.0`. O objetivo é impedir que o lançamento dependa apenas de um build verde: o Veritas precisa comprovar persistência local, autorização, semântica lógica, exportação e experiência de abertura.

## 1. Gates por estágio

| Estágio | Abrangência | Bloqueadores |
| --- | --- | --- |
| Alpha técnico | Testes automatizados, build, MCP local e smoke local da PWA. | Qualquer falha de teste, typecheck, lint, build, MCP ou carregamento. |
| Alpha pedagógico | Alpha técnico mais exercícios de lógica, onboarding e execução manual com usuários convidados. | Usuário não consegue completar o tutorial ou perde estado local. |
| Beta público | Alpha pedagógico mais RLS, Realtime, exportadores HDL, mobile, acessibilidade e rollback. | P0/P1 de segurança, perda de dados, exportação inválida ou deployment sem recuperação. |
| Release candidate | Repetição dos gates em ambiente de produção candidata e comparação com a tag anterior. | Qualquer regressão funcional ou mudança de contrato não documentada. |
| `v1.0.0` | Todos os gates, notas, tutorial, política de dados e suporte mínimo publicados. | Qualquer lacuna que obrigue conhecimento interno para usar o produto. |

## 2. Suíte automatizada do domínio

O job principal deve executar os comandos abaixo em cada pull request, push em `main` e candidato de release:

```bash
npm ci
npm test -- --run
npm run typecheck
npm run lint
npm run build
npm run build:mcp
```

Os testes devem cobrir a tabela verdade canônica, leis de De Morgan, implicação, equivalência, contrapositiva, Modus Ponens, Modus Tollens, validação de circuitos, DFS de ciclos, avaliação topológica, exportação Verilog/VHDL, IndexedDB, sincronização remota, RLS simulada, Edge Function mockada, While, Step/Run/Continue, breakpoints, Watch, BranchTrace, limites `maxSteps` e as três ferramentas MCP.

A asserção de determinismo deve comparar duas execuções com o mesmo documento e entradas, removendo apenas campos não determinísticos como timestamp ou identificador de sessão. O documento, trace, estado final, pausa e erro devem ser idênticos.

## 3. Smoke test HTTP/PWA

O script [`scripts/smoke-release.mjs`](../scripts/smoke-release.mjs) é executado com:

```bash
SMOKE_URL=https://veritas-opal-seven.vercel.app npm run smoke:release
```

O comando [`npm run beta:preflight`](../scripts/beta-preflight.mjs) consolida versão candidata, árvore Git, suíte, typecheck, lint, build frontend, build MCP, smoke e a presença de um relatório RLS. Para uma promoção beta, execute-o com os gates externos obrigatórios:

```bash
BETA_EXPECTED_VERSION=0.9.0-rc.1 \
SMOKE_URL=https://veritas-opal-seven.vercel.app \
BETA_PREFLIGHT_REQUIRE_SMOKE=1 \
BETA_PREFLIGHT_REQUIRE_RLS=1 \
BETA_RLS_REPORT=artifacts/rls-acceptance.md \
BETA_PREFLIGHT_REQUIRE_EVIDENCE=1 \
BETA_EVIDENCE_MANIFEST=artifacts/beta-evidence.json \
npm run beta:preflight
```

O manifesto JSON de evidências deve declarar a mesma versão candidata, `generatedAt`, listas vazias `openP0` e `openP1` e os gates `rls`, `realtime`, `hdl`, `accessibility`, `mobile`, `rollback` e `onboarding`. Cada gate precisa ter `status: "PASS"` e uma referência não vazia em `evidence`. O preflight valida o contrato, mas não inventa nem substitui as evidências externas.

Exemplo mínimo de estrutura, a ser preenchido somente com resultados reais:

```json
{
  "version": "0.9.0-rc.1",
  "generatedAt": "2026-08-21T02:00:00.000Z",
  "openP0": [],
  "openP1": [],
  "gates": {
    "rls": { "status": "PASS", "evidence": "artifacts/rls-acceptance.md" },
    "realtime": { "status": "PASS", "evidence": "artifacts/realtime-isolation.md" },
    "hdl": { "status": "PASS", "evidence": "artifacts/hdl-toolchains.md" },
    "accessibility": { "status": "PASS", "evidence": "artifacts/accessibility.md" },
    "mobile": { "status": "PASS", "evidence": "artifacts/mobile-pwa.md" },
    "rollback": { "status": "PASS", "evidence": "artifacts/rollback.md" },
    "onboarding": { "status": "PASS", "evidence": "artifacts/onboarding.md" }
  }
}
```

O preflight não cria sessões Supabase nem substitui a prova de RLS. Siga [`docs/BETA-RLS-ACCEPTANCE.md`](BETA-RLS-ACCEPTANCE.md) para executar RLS-001 a RLS-022 com usuários reais e produzir o relatório sanitizado.

Ele valida três superfícies públicas sem acessar conta de usuário: a homepage deve retornar HTML com `#root`, `manifest.webmanifest` deve ser JSON com `name`, `start_url`, `display` e ícones, e `sw.js` deve conter o service worker esperado. O mesmo script roda no Preview local do Vite para detectar falhas de build antes do deployment.

Para uma validação beta, o smoke HTTP deve ser complementado por uma matriz de navegadores. A matriz mínima inclui Chromium desktop, Firefox desktop, Safari/iOS ou WebKit, viewport móvel e uma segunda abertura em modo offline após o service worker ter sido instalado.

## 4. Testes de integração beta

| Área | Cenário automatizado | Critério de aceite |
| --- | --- | --- |
| IndexedDB | Criar, atualizar, listar, recarregar e excluir circuito/algoritmo com Supabase ausente. | Nenhum erro de rede é necessário para continuar. |
| Auth/Supabase | Sessão expirada, usuário sem projeto, projeto de outro usuário e RLS por `auth.uid()`. | Dados de outro usuário nunca aparecem. |
| Realtime | Canal privado, Presence, Broadcast, viewer/editor, payload inválido e reconexão. | Evento fora do tópico não altera o documento local. |
| Histórico | Salvar versão, comparar e restaurar uma versão autorizada. | Restaurar não remove versões anteriores. |
| HDL | Fixtures equivalentes em Verilog e VHDL. | Texto determinístico e compilação pelo toolchain de referência. |
| IA | Sucesso, timeout, fallback e falha de telemetria. | Observabilidade nunca interrompe o fluxo principal. |
| PWA | Manifesto, service worker, reload offline e atualização de cache. | App abre e preserva documentos locais. |
| Acessibilidade | Tab order, foco, labels e mensagens de erro. | Fluxo principal utilizável sem mouse. |

## 5. MCP release gate

O servidor MCP deve ser construído e interrogado em um teste de subprocesso, sem depender de uma sessão de IA:

```bash
npm run build:mcp
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"release-smoke","version":"1.0"}}}' \
  | node mcp/dist/server.js
```

Depois, a suíte MCP deve chamar `tools/list` e cada ferramenta com vetores golden:

| Ferramenta | Golden response |
| --- | --- |
| `logic_case` | Caso de implicação com exatamente um contraexemplo em `P=V,Q=F`. |
| `propositional_truth_table` | Expressão com até quatro variáveis, número de linhas esperado e conectivos preservados. |
| `debug_algorithm` | Documento com breakpoint em `end`, pausa antes da execução e finalização após a segunda chamada. |

Os mesmos JSON de entrada devem ser executados pelo pacote MCP diretamente e por cada cliente suportado. A comparação deve ignorar somente ordenação de metadados ou timestamps explicitamente não semânticos.

## 6. Workflow GitHub Actions

O workflow [`quality.yml`](../.github/workflows/quality.yml) roda em pull requests e pushes para `main`. Ele executa a suíte, constrói a aplicação e o MCP, inicia o preview Vite e executa `npm run smoke:release` contra `http://127.0.0.1:4173`.

O workflow [`release.yml`](../.github/workflows/release.yml) aceita dois modos. No modo automático, o push de uma tag SemVer como `v0.9.0-rc.1` ou `v1.0.0` inicia validação, smoke e publicação; tags com hífen são marcadas como pre-release. No modo manual, abra **Actions → Veritas release → Run workflow**, informe uma versão como `v0.9.0-rc.1` e marque `prerelease=true`. Em ambos os modos, o job de validação roda antes do job de publicação e `gh release create` gera as notas automaticamente. O workflow não cria tags automaticamente a partir de qualquer commit: a tag continua sendo o ponto explícito de promoção e rastreabilidade.

O arquivo [`release.yml`](../.github/release.yml) organiza as notas por labels `breaking-change`, `feature`, `bug`, `security`, `documentation` e `education`. PRs sem categoria caem em `Other changes`.

A permissão `contents: write` existe somente no workflow de release; o workflow de qualidade usa `contents: read`. O token padrão não deve ser usado para publicar segredos, alterar workflows ou acessar Supabase.

## 7. Critérios de promoção

A promoção de alpha para beta exige zero P0 e zero P1 de segurança, perda de dados ou bloqueio do fluxo principal. A promoção de beta para release candidate exige que o tutorial seja concluível, a matriz móvel tenha sido executada, os fixtures HDL passem e o rollback da deployment tenha sido ensaiado. A promoção para `v1.0.0` exige que o contrato público esteja documentado e que qualquer recurso ainda instável esteja explicitamente marcado como beta ou roadmap.

## Referências

[1]: https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions "GitHub Docs — Workflow syntax"
[2]: https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes "GitHub Docs — Automatically generated release notes"
[3]: https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository "GitHub Docs — Managing releases"
[4]: https://vercel.com/docs/deployments "Vercel Docs — Deploying to Vercel"
