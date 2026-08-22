# Plano de lançamento do Veritas Digital Logic Sim

**Status:** proposta de lançamento progressivo
**Produto:** Veritas — editor e simulador didático de lógica digital
**Repositório:** https://github.com/Lucas-Belucci-Bellini/Veritas
**Preview/produção atual:** https://veritas-opal-seven.vercel.app
**Versão declarada no `package.json`:** `0.9.0-rc.9`

## 1. Decisão de posicionamento

O Veritas deve ser lançado primeiro como uma ferramenta web/PWA **local-first para aprender, desenhar, testar e compartilhar circuitos digitais combinacionais**, com uma segunda camada de algoritmos visuais e uma superfície MCP para agentes de IA. A promessa de lançamento não deve ser “um substituto completo de ferramentas industriais”; deve ser clara e verificável:

> **Desenhe uma lógica, veja a tabela verdade, entenda cada decisão e exporte um artefato HDL reproduzível.**

O público inicial é composto por estudantes de lógica digital, professores, autodidatas e desenvolvedores que precisam explicar ou validar circuitos pequenos. O escopo industrial completo, colaboração sem conflitos e execução de algoritmos com I/O externo ficam fora do primeiro release estável.

## 2. Diagnóstico atual

O projeto já possui uma base forte para uma prévia pública: editor visual combinacional, tabela verdade, persistência IndexedDB, autenticação e nuvem Supabase, histórico remoto, colaboração Realtime, exportação Verilog/VHDL, monitoramento da IA, workspace ALGO-001/002/003, runtime sequencial visual e ferramentas MCP locais. A suíte atual registra 256 testes aprovados, além de typecheck, lint, build frontend, build MCP e smoke PWA limpos.

Há, porém, quatro fatos que impedem chamar o estado atual de `1.0.0` sem uma rodada de endurecimento:

| Área | Estado atual | Consequência para o lançamento |
| --- | --- | --- |
| Versionamento | `package.json` está em `0.9.0-rc.9`; `v0.9.0-rc.8` está publicada e a nova RC está em preparação; ainda não há release estável. | Executar os gates da RC-9 e manter a sequência de pré-releases antes do estável. |
| Distribuição | Existe deployment Vercel público, mas o fluxo de Preview/Production, domínio, headers e rollback ainda precisa ser formalizado. | Tratar o deployment atual como preview até concluir o checklist. |
| MCP | Ferramentas determinísticas estão disponíveis por `stdio`; transporte HTTP remoto autenticado ainda é roadmap. | Não prometer integração web remota no lançamento inicial. |
| Colaboração | Broadcast de snapshots e Presence funcionam, mas não são CRDT nem merge campo a campo. | Rotular como colaboração beta/preview e documentar o risco de sobrescrita concorrente. |

## 3. Estratégia de releases

A recomendação é usar SemVer e manter os artefatos publicados imutáveis: correções devem sair como nova versão, funcionalidades compatíveis como incremento minor e mudanças incompatíveis como major [3]. Como a API pública ainda está evoluindo, a sequência deve permanecer em `0.y.z` até que o contrato do documento, exportadores, ferramentas MCP e persistência estejam estabilizados.

| Release | Objetivo | Público | Critério de saída |
| --- | --- | --- | --- |
| `v0.8.0-alpha.1` | Alpha técnico multi-bit | Usuário interno e colaboradores próximos | Produto abre, salva localmente, avalia circuitos escalares e vetoriais limitados, sem blocker P0. |
| `v0.8.0-beta.1` | Beta pedagógico | 5–10 estudantes/professores convidados | Tutorial concluído, tabela vetorial limitada reproduzida e exportação HDL validada por fixtures. |
| `v0.8.0-rc.1` | Release candidate multi-bit | Testadores convidados e mantenedores | Quality gates verdes, RLS auditado, smoke externo aprovado e nenhum P0/P1 aberto. |
| `v0.9.0-rc.1` | Release candidate sequencial | Testadores convidados e mantenedores | Runtime temporal validado, smoke externo aprovado, contrato MCP alinhado e nenhum P0/P1 aberto. |
| `v0.9.0-rc.2` | Release candidate MCP vetorial | Testadores convidados e mantenedores | MCP-001…MCP-010, tabela vetorial, smoke local/externo e nenhum P0/P1 novo; beta continua condicionado aos gates reais. |
| `v0.9.0-rc.3` | Release candidate de endurecimento do CI | Testadores convidados e mantenedores | Rollback determinístico com histórico/tags, quality workflow verde, smoke local/externo e nenhum P0/P1 novo; beta continua condicionado aos gates reais. |
| `v0.9.0-rc.4` | Release candidate MCP-011 HTTP local | Testadores convidados e mantenedores | stdio preservado, HTTP local protegido, 9 checks HTTP PASS, quality/release workflows verdes e endpoint público ainda bloqueado até OAuth/HTTPS. |
| `v0.9.0-rc.5` | Release candidate MCP-012 metadata OAuth local | Testadores convidados e mantenedores | Contrato puro validado, URLs/escopos inseguros rejeitados, regressão MCP-011 verde e nenhuma rota OAuth pública habilitada. |
| `v0.9.0-rc.6` | Release candidate MCP-013 metadata local opt-in | Testadores convidados e mantenedores | Rota 404 por padrão, metadata configurada validada, Origin obrigatório, configuração parcial/HTTP remoto rejeitados, 14 checks HTTP/stdio relacionados verdes e nenhuma rota OAuth pública habilitada. |
| `v0.9.0-rc.7` | Release candidate MCP-014 CORS local explícito | Testadores convidados e mantenedores | Metadata anuncia apenas `GET, OPTIONS`, `/mcp` mantém `POST, OPTIONS` e Bearer, `POST` na metadata permanece 405, 17 checks HTTP locais verdes e nenhuma rota OAuth pública habilitada. |
| `v0.9.0-rc.8` | Release candidate MCP-015 proteção de paths locais | Testadores convidados e mantenedores | Path MCP coincidente com a rota de metadata é rejeitado no startup, paths válidos continuam funcionando, 18 checks HTTP locais verdes e nenhuma rota OAuth pública habilitada. |
| `v0.9.0-rc.9` | Release candidate EDITOR-001 + RUST-001 | Testadores convidados e mantenedores | NAND/NOR/XNOR estão alinhados no editor, avaliação e HDL; núcleo Rust experimental passa acceptance offline e paridade golden; workflows Quality/Release verdes; nenhum endpoint remoto é habilitado e o beta continua bloqueado sem evidência RLS/Realtime cross-user real. |
| `v0.9.0-beta.1` | Beta público sequencial | Estudantes/professores convidados | Manifesto de evidências completo, RLS/Realtime/HDL/mobile/acessibilidade/rollback aprovados e zero P0/P1. |
| `v0.8.x` | Correções de beta/RC | Usuários beta | Sem regressão nos quality gates; notas de mudança por release. |
| `v1.0.0` | Lançamento estável | Público geral | API/documento público estável, política de dados, suporte básico e critérios P0/P1 encerrados. |

Cada release deve ser criada a partir de uma tag Git e acompanhada de release notes; o GitHub permite publicar releases com notas, assets, prerelease e geração automática de changelog [1] [2].

## 4. Escopo do primeiro lançamento estável

O `v1.0.0` deve conter apenas capacidades que consigam ser explicadas, testadas e suportadas. O produto principal é o circuito combinacional; ALGO-001/002/003 entram como laboratório educacional integrado, não como uma linguagem de programação geral.

| Dentro do `v1.0.0` | Fora do `v1.0.0` ou explicitamente beta |
| --- | --- |
| Canvas de portas `input`, `output`, `constant`, `and`, `or`, `not`, `xor`. | ALU, memória e simulação sequencial completa; barramentos avançados permanecem em evolução. |
| Tabela verdade com limite de interface documentado. | Tabelas ilimitadas ou expressões com milhões de linhas na UI. |
| IndexedDB funcionando sem conta ou Supabase configurado. | Dependência obrigatória de rede para abrir e editar um circuito. |
| Login, salvamento, histórico e RLS por usuário. | Compartilhamento sem política de autorização. |
| Colaboração Realtime rotulada como beta, com viewer/editor. | Promessa de merge automático ou colaboração CRDT. |
| Exportação Verilog/VHDL validada por fixtures e compiladores no CI. | Garantia de síntese para qualquer ferramenta industrial. |
| ALGO-001/002/003 para execução didática segura. | Arquivos, rede, turtle graphics, plugins arbitrários ou execução de código externo. |
| MCP local `stdio` com ferramentas read-only e determinísticas; metadata HTTP local opt-in explicitamente documentada. | MCP HTTP público sem autenticação, rate limit e observabilidade; OAuth remoto sem provedor aprovado. |

## 5. Quality gates obrigatórios

Nenhuma tag de release deve ser criada enquanto um gate abaixo estiver vermelho. Os comandos mínimos atuais são:

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run build
npm run build:mcp
npm run build:mcp:http
npm run beta:rust
```

O checklist funcional deve complementar os comandos automatizados:

| Gate | Teste de aceite |
| --- | --- |
| Local-first | Com variáveis Supabase ausentes, criar, editar, salvar, recarregar e excluir circuito/algoritmo no IndexedDB. |
| Segurança de dados | Usuário A não lê, edita ou recebe Realtime de projeto de usuário B; revisar RLS por `auth.uid()`. |
| Tabela verdade | Comparar casos canônicos, limites de linhas, tautologia, contradição, implicação e equivalência. |
| Validação | Rejeitar nó/aresta inválido, entrada ausente, porta duplicada, conexão própria e ciclo combinacional. |
| HDL | Gerar fixtures e executar Verilog com Icarus/Verilator e VHDL com GHDL em CI; comparar arquivos determinísticos. |
| ALGO | Exercitar `Step`, `Run`, `Continue`, `While`, breakpoint, `awaiting-input`, `BranchTrace` e `maxSteps`. |
| Realtime | Isolar tópicos, testar viewer/editor, presença, snapshot inválido, reconexão e edição concorrente documentada. |
| MCP | Rodar `tools/list` e golden responses de `logic_case`, `propositional_truth_table` e `debug_algorithm`; executar MCP-011-HTTP-001…009 e MCP-013-HTTP-001…005. |
| PWA | Testar carregamento offline, atualização de service worker e migração IndexedDB sem perda de documentos. |
| Observabilidade | Confirmar que falha de telemetria de IA não interrompe análise, exportação ou execução. |
| Acessibilidade | Navegação por teclado, foco visível, labels, contraste e mensagens de erro em português claro. |
| Recuperação | Ensaiar rollback da deployment anterior e restaurar uma versão de circuito do histórico remoto. |

Os limites de produto devem ser explícitos. A tabela booleana mantém limite próprio de variáveis e a tabela vetorial usa, por padrão, até 12 bits totais de entrada, com `maxRows` limitado e rejeição de qualquer expansão que comprometa a responsividade.

## 6. Distribuição web/PWA

O deployment Vercel deve adotar três ambientes: Local, Preview e Production. A integração Git deve criar Preview para pull requests/branches e Production somente a partir de `main` aprovado ou de uma promoção explícita. A Vercel documenta deployments com URLs únicas de preview e separação entre Local, Preview e Production [4].

### Preparação recomendada

1. Definir um domínio público curto para o produto, sem comprar nada automaticamente. O domínio atual `veritas-opal-seven.vercel.app` pode continuar como preview até o domínio final ser escolhido.
2. Configurar variáveis somente no ambiente apropriado: URL Supabase e publishable key no frontend; nunca service key, token privado ou segredo de Edge Function.
3. Configurar headers de segurança, política de conteúdo compatível com Supabase/Vercel e páginas de erro úteis.
4. Confirmar manifest, ícones, service worker, instalação PWA, atualização de versão e fallback offline.
5. Adicionar uma página inicial com proposta, tutorial de três passos, exemplos carregáveis, limitações e link para documentação.
6. Fazer um smoke test da Production em navegador limpo, dispositivo móvel e modo offline antes de promover.

## 7. Onboarding e materiais

O lançamento deve começar com três exemplos prontos: uma porta AND com tabela verdade, um somador didático futuro sinalizado como roadmap e um algoritmo `P → Q` para demonstrar ALGO-002/003. Cada exemplo deve ter botão “abrir cópia”, descrição do objetivo, entradas esperadas e resultado esperado.

A documentação pública precisa separar quatro trilhas: **circuitos**, **algoritmos**, **MCP** e **privacidade/segurança**. O tutorial deve ensinar primeiro o fluxo sem login, depois salvar localmente, entrar na conta, compartilhar como viewer/editor, gerar tabela verdade e exportar HDL.

O suporte inicial pode usar GitHub Issues para bugs reproduzíveis e Discussions para dúvidas/aulas. Os templates devem pedir navegador, versão, circuito mínimo, passos de reprodução, screenshot opcional e se o problema ocorreu offline ou online.

## 8. Observabilidade e operação

O lançamento precisa medir saúde antes de medir crescimento. Os primeiros eventos operacionais devem ser: abertura do app, criação de circuito, salvamento local, login, salvamento remoto, exportação HDL, execução de tabela verdade, erro de validação, falha MCP e erro de runtime. Dados de uso devem ser minimizados e documentados; telemetria de IA deve continuar best-effort.

A operação mínima inclui alertas para build falho, aumento de erros de runtime, falhas Supabase, latência anormal da Edge Function e queda de exportações. O Vercel oferece logs e informações de deployments, e releases GitHub permitem acompanhar downloads de assets por API [1] [4]. O objetivo não é coletar tudo: é saber se o usuário consegue abrir, salvar, testar e recuperar seu trabalho.

## 9. Cronograma proposto

O cronograma abaixo é uma sequência operacional para uma equipe pequena; os prazos são metas, não garantias.

| Semana | Trabalho | Saída verificável |
| --- | --- | --- |
| 0 | Freeze de escopo, inventário de riscos, escolha do nome/domínio, definição de limites e política de dados. | Documento de release aprovado. |
| 1 | Endurecimento P0: RLS, IndexedDB, PWA, exportadores, ciclos, loops, MCP e erros. | Quality gates automatizados e smoke checklist. |
| 2 | `v0.8.0-alpha.1` e teste interno com circuitos escalares/vetoriais limitados. | Tag, GitHub prerelease, release notes e feedback registrado. |
| 3 | Correções e tutorial; alpha convidado com 5–10 pessoas. | Relatório de onboarding e lista P1/P2. |
| 4 | `v0.8.0-beta.1`, Preview/Production formalizados, monitoramento e rollback ensaiados. | Beta público com limitações visíveis. |
| 5 | Gates externos da v0.9.0: RLS, Realtime, HDL, acessibilidade, mobile, onboarding e rollback, usando manifesto de evidências. | `v0.9.0-beta.1` somente se não houver P0/P1 aberto. |
| 6 | `v1.0.0`, anúncio, documentação, exemplos e canal de suporte. | Release estável e postmortem de lançamento agendado. |

## 10. Critério objetivo para dizer “lançamos”

O Veritas estará pronto quando uma pessoa que nunca viu o projeto conseguir, sem intervenção da equipe, abrir um exemplo, desenhar uma alteração, ver a tabela verdade, recarregar a página sem perder o trabalho, criar uma conta opcional, recuperar uma versão, compartilhar com papel definido e exportar um arquivo HDL que passe pelo compilador de referência. Em paralelo, um agente local deve descobrir as três ferramentas MCP e receber respostas golden iguais às dos testes de domínio.

Se esse fluxo ainda exigir conhecimento interno, o produto deve permanecer em beta. Essa disciplina aumenta a chance de o lançamento ser lembrado pelo aprendizado e pela confiabilidade, não por uma promessa maior que a implementação.

## Referências

[1]: https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases "GitHub Docs — About releases"
[2]: https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository "GitHub Docs — Managing releases"
[3]: https://semver.org/ "Semantic Versioning 2.0.0"
[4]: https://vercel.com/docs/deployments "Vercel Docs — Deploying to Vercel"
