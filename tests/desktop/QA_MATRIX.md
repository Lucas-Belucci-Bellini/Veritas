# Matriz de QA — Veritas Desktop

## Regra de promoção

Um workflow concluído prova somente que uma etapa de automação terminou. Cada plataforma deve avançar separadamente por **código compilado**, **artefato gerado**, **artefato verificado**, **aplicação executada**, **smoke aprovado**, **testes automatizados** e **release candidate**. Qualquer etapa que não possa ser executada deve permanecer como **NOT VERIFIED**, nunca como `PASSED`.

## Estado da prévia `0.1.0-alpha.1`

| Plataforma | Build | Artefato | Integridade/metadata | Startup | Editor/simulação | Persistência/remoção | Estado de promoção |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Linux x86_64 | PASSED | PASSED | PASSED | SMOKE VERIFIED: `.deb` instalado e binário iniciado sob Xvfb | NOT VERIFIED por fluxo interativo completo | Instalação/remoção do `.deb`: SMOKE VERIFIED; persistência: NOT VERIFIED | Prévia técnica |
| Windows x64 | PASSED no runner nativo | PASSED: NSIS `.exe` | PASSED: PE32/NSIS, `MZ`, SHA-256 | SMOKE VERIFIED no runner nativo | NOT VERIFIED | Instalação/atalho/desinstalação: SMOKE VERIFIED; persistência: NOT VERIFIED | Não estável |
| macOS arm64 | PASSED no runner nativo | PASSED: `.dmg` e `.app.zip` | PASSED: trailer DMG/ZIP íntegro, SHA-256 | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Não estável |

A release pública [`desktop-v0.1.0-alpha.1`](https://github.com/Lucas-Belucci-Bellini/Veritas/releases/tag/desktop-v0.1.0-alpha.1) é uma **pré-release**. Ela contém artefatos para os três alvos, `SHA256SUMS` e `desktop-release-manifest.json`, mas não é uma declaração de suporte estável.

## Gate Windows — instalador `.exe`

| Verificação | Critério | Estado em `0.1.0-alpha.1` |
| --- | --- | --- |
| Build Windows | Job nativo concluído | PASSED |
| Executável/instalador | Arquivo `.exe` presente e PE/NSIS | PASSED |
| SHA-256 | Hash publicado e reproduzível | PASSED |
| Release | Asset anexado a uma release prévia | PASSED |
| Instalação limpa | Instalar em diretório temporário no runner Windows nativo | SMOKE VERIFIED; Windows limpo de usuário final ainda não verificado |
| Atalho | Criar e localizar atalho Veritas | SMOKE VERIFIED no runner Windows; abrir pelo atalho ainda não verificado |
| Inicialização | Abrir sem erro por 8 segundos | SMOKE VERIFIED no runner Windows; startup da UI/editor ainda não verificado |
| Editor | Criar e editar circuito | NOT VERIFIED |
| Persistência | Salvar e reabrir projeto | NOT VERIFIED |
| Offline | Repetir fluxo sem rede | NOT VERIFIED |
| Simulação | Avaliar circuito e sequência | NOT VERIFIED |
| Encerramento | Fechar normalmente | NOT VERIFIED; smoke encerra o processo de teste à força após startup |
| Desinstalação | Remover sem deixar instalação inválida | SMOKE VERIFIED no runner Windows; máquina de usuário final ainda não verificada |
| Atualização | Atualizar preservando projetos | NOT VERIFIED |

## Gate macOS

O runner macOS confirmou build, bundle e upload de `Veritas_0.1.0-alpha.1_aarch64.dmg` e do ZIP do `.app`. Startup, editor, simulação, IndexedDB, atualização, assinatura e notarização continuam **NOT VERIFIED**. O smoke de instalação Windows não é evidência para macOS. O suporte final deve incluir uma matriz para arm64 e, se o produto prometer Intel, um alvo Intel separado.

## Gate Linux

O Linux possui a maior evidência desta prévia. O build Tauri, o pacote Debian, o AppImage, os metadados e a inicialização controlada do binário foram verificados no sandbox. O runner Linux também instalou o `.deb`, confirmou `/usr/bin/veritas` e `Veritas.desktop`, iniciou o app sob Xvfb e removeu o pacote; esses pontos são `SMOKE VERIFIED`. Ainda faltam execução distribuída do AppImage em uma distribuição independente, atualização e smoke funcional interativo completo do editor/simulador.

## Gates automatizados do núcleo e da distribuição

| Gate | Cobertura atual | Estado |
| --- | --- | --- |
| Regressão cruzada permanente | 12 casos: AND, NAND, OR, NOR, XOR, XNOR, NOT, meio somador, somador completo e multiplexador; todas as combinações possíveis em cada caso | PASSED localmente |
| Helpers de métricas desktop | 4 testes: parser de RSS, tamanho de arquivos, binário ausente e geração de JSON/Markdown sem rede | PASSED localmente |
| Gerador de manifesto/checksum | 2 testes: determinismo para os cinco assets allowlisted e rejeição fail-closed de arquivo inesperado | PASSED localmente |
| Testbench sequencial UI→domínio | 4 testes puros de rascunho e 1 regressão cross-layer com registrador, além de 19 testes do runner de domínio | PASSED localmente |
| Testbench local persistente | 4 testes: CRUD por circuito, ordenação, round-trip/import e rejeição de JSON/formato/modos inválidos | PASSED localmente |
| Medição Linux | `npm run desktop:metrics`, baseline de tamanho, spawn e RSS ocioso; simulação e installed size explicitamente não inferidos | PASSED para medidas disponíveis; demais campos `NOT VERIFIED` |
| BENCH-001 — escala de gates | `npm run bench:circuit-scale`; cadeia determinística `input → N × NOT → output`, runtime `Simulator`, warmup separado, checksum e JSON/Markdown | BASELINE RECORDED: caminho `CircuitDocument` mediu 10/100 no Linux x86_64; 500/1000/5000 `NOT SUPPORTED` pelos limites atuais; FPS, memória desktop e startup nativo `NOT VERIFIED` |
| BENCH-002 — capacidade bruta do runtime | Mesmo fixture como `Netlist` bruto, executado diretamente pelo `Simulator`, sem alterar limites do editor | BASELINE RECORDED: 10/100/500/1000/5000 medidos no Linux x86_64; isso não promove suporte oficial, persistência, editor ou renderização nessa escala |
| Demos sequenciais JK/SR | Workspace com demos `jk-clock` e `sr-clock`, controles de entradas, clock automático, watches Q/Q̄ e timeline reutilizada | PASSED em testes de workspace/runtime; inspeção visual interativa e smoke desktop permanecem `NOT VERIFIED` |
| Waveform sequencial | Helper puro `buildWaveform` projeta watches e snapshots; workspace renderiza ticks, níveis 0/1, labels acessíveis e janela limitada pela timeline | PASSED em testes determinísticos e build; inspeção visual interativa, FPS e exportação de waveform permanecem `NOT VERIFIED` |
| Demo de registrador 4-bit | `register-4bit` usa quatro DFFs com clock compartilhado, controles D0–D3 e watches Q0–Q3 | PASSED em testes de workspace; inspeção visual interativa, persistência do demo e smoke desktop permanecem `NOT VERIFIED` |
| Demo de contador 4-bit | `counter-4bit` usa quatro TFFs síncronos, carry AND, pulso manual e dois tiques de acomodação | PASSED na regressão 0000 → 1111 → 0000; inspeção visual interativa, persistência do demo e smoke desktop permanecem `NOT VERIFIED` |
| Hardening de feedback/settle | `settle()` aceita budgets finitos entre 1 e 10.000, `settle(0)` é vazio; o runtime também limita o total acumulado entre 1 e 1.000.000, além de validar `tick()` e `restoreState()` | PASSED em regressões do Simulator; budget de memória estimada do runtime foi PASSED, mas uso de heap/memória desktop permanece `NOT VERIFIED` |
| Diagnóstico de estabilização | `diagnoseSettle()` diferencia `stabilized`, `cycle-detected` e `budget-exhausted`, informando tiques e período observado quando há repetição | PASSED em regressões do Simulator; classificação estática foi PASSED no analisador de domínio, enquanto budgets de memória, integração desktop e medição durante simulação permanecem `NOT VERIFIED` |
| Diagnóstico cross-layer | `diagnoseDocumentRuntime()` expõe o diagnóstico pela ponte `CircuitDocument → Simulator`; `maxSettleTicks`, `maxTotalTicks`, budgets de operação/memória e `AbortSignal` são configuráveis por documento; `tickDocumentRuntimeAsync()` oferece timeout/yield | PASSED em testes de documentRuntime; integração visual, Worker/desktop, medição de heap e smoke desktop permanecem `NOT VERIFIED` |
| Preview diagnóstica isolada | `diagnoseDocumentRuntimePreview()` reconstrói uma cópia, restaura estado/aplica entradas opcionalmente e retorna diagnóstico, snapshot e estado final sem mutar o runtime original | PASSED em testes de documentRuntime; integração visual está implementada com limite de 64 tiques, mas inspeção visual, integração de preflight e smoke desktop permanecem `NOT VERIFIED` |
| Testbench v2.6.0 + diagnóstico bounded | Casos sequenciais retornam `stabilized`, `cycle-detected` ou `budget-exhausted`; o relatório também agrega snapshots, contraexemplos e primeira divergência; a janela padrão é 64 tiques e o diagnóstico roda sobre cópia isolada | PASSED em 25 testes do domínio e 51 testes MCP; painel visual e smoke desktop permanecem `NOT VERIFIED` |
| Execution Safety v2.7 — primeiro slice | `Simulator` com budgets de operações por tique/total e memória estimada, rollback atômico, `cancel()`, `AbortSignal`, `tickAsync()` com yield/timeout, `reset()` e `shutdown()` idempotente; `documentRuntime` encaminha as opções; preflight classifica SCCs; `simulateCircuit`/`simulateCircuitAsync` aplicam budgets headless e cleanup; o handler MCP encaminha `RequestHandlerExtra.signal`; `SimulatorExecutionBudget` agrega quotas entre runtimes; `SimulationWorkerSupervisor` limita concorrência/fila e reservas declarativas no host | PASSED no gate local mais recente com 782 testes aprovados e 1 skipped em 91 arquivos aprovados e 1 skipped; os testes focados do supervisor/Worker/factory/checkpoint/Tauri passaram com 33 testes. Typecheck, lint, builds web/MCP/plugin passaram; o bundle plugin gerado foi restaurado antes do diff-check. Smoke web limitado do Worker/cliente/ponte/UI foi validado em Chromium; smokes reais do supervisor cobriram 5 requests com cancelamento e uma rajada de 8 requests com concorrência/fila bounded e rejeição explícita do excesso. Latências da rajada foram `BASELINE RECORDED`; seis rodadas sustentadas no browser também foram `SMOKE VERIFIED`/`BASELINE RECORDED` (48 submetidos, 36 resultados, 12 rejeições, média 57,944 ms, p95 89,000 ms, heap da página observado e não isolado). Medição efetiva de operações/memória, extrapolação de produção, integração Worker/desktop e QA nativo permanecem `NOT VERIFIED` |
| Protocolo Worker isolado | `workerProtocol.ts` e `simulation.worker.ts` com protocolo v1, requestId, validação fail-closed, snapshots/progresso bounded, cancelamento, timeout, budget, deduplicação e dispose; factory host-only Vite com asset `simulation.worker-*.js` | PASSED em 10 testes determinísticos com endpoint fake; `SMOKE VERIFIED` em Chromium local para uma fixture escalar pequena, com snapshots/progresso e paridade final. Backpressure sob carga, integração com UI/Tauri e runtime desktop permanecem `NOT VERIFIED` |
| Paridade sequencial Worker | Fixtures `dff-clock`, `tff-clock` e `jk-clock` escalares, com etapas de entrada/clock e watches D/T/J/K/CLK/Q/OUT, comparadas contra snapshots do `Simulator` canônico | PASSED em 3 regressões determinísticas; `SMOKE VERIFIED` no Chromium com `SimulationWorkerClient` real, snapshots idênticos e `requestId` preservado para DFF, TFF e JK. SR, delay, feedback, continuidade entre requests, vector/custom-chip, Step/Run canônicos e desktop permanecem `NOT VERIFIED` |
| Contrato de checkpoint Worker | `SimulationWorkerCheckpointV1` com assinatura canônica FNV-1a, estado temporal, parser/serializer JSON fail-closed, shape estrito, binding de netlist, limites de bytes/budget e invariantes de filas/flip-flops | PASSED em 7 regressões determinísticas de round-trip e rejeição; contrato exportado, porém ainda isolado. Resume entre requests, integração no protocolo v1, Step/Run canônicos, vector/custom-chip e desktop permanecem `NOT VERIFIED` |
| Primeiro comando Tauri/Rust escalar | DTOs Serde com `deny_unknown_fields`, validação bounded, budgets, snapshots finais, cleanup RAII e comandos `simulate_circuit_native`/`cancel_circuit_native` com `spawn_blocking` | PASSED em 12 testes Rust, `cargo test` e `cargo check` no Linux; `BUILD VERIFIED` para o crate. Goldens DFF, TFF e JK compartilhados são `PASSED` em TypeScript/Rust; duplicidade, cleanup, cancelamento idempotente e cancelamento observado por outra thread passaram, mas invoke/evento/teardown em runtime interativo e parity nativa ampla permanecem `NOT VERIFIED` |
| Bundles Tauri Linux alpha.1 | `Veritas_0.1.0-alpha.1_amd64.deb` e `Veritas_0.1.0-alpha.1_amd64.AppImage`, com inspeção de tipo, arquitetura, desktop entry, binário e SHA-256 | `BUILD VERIFIED`/`ARTIFACT VERIFIED` no Linux x86-64; `.deb` instalado, iniciado sob Xvfb e removido: `SMOKE VERIFIED` limitado. AppImage em distribuição independente, editor/simulação funcional, assinatura, Windows/macOS e `Veritas-Setup.exe` permanecem `NOT VERIFIED` |
| Workflow desktop cross-platform sem release | Run `33087842535` no commit `9db1cc1`: matriz nativa Linux/Windows/macOS, normalização do `Veritas-Setup.exe`, ZIP macOS arm64 e upload temporário | `BUILD VERIFIED`/`ARTIFACT VERIFIED` nos três runners; hashes registrados em `docs/DESKTOP_ARTIFACT_VERIFICATION.md`. Não é `RUNTIME VERIFIED`/`SMOKE VERIFIED`; instalação, UI, assinatura/notarização, Intel macOS, Windows/macOS runtime e release permanecem `NOT VERIFIED` |
| Cliente hospedeiro Worker | `workerClient.ts` mantém um request ativo, entrega progresso, encaminha AbortSignal, envia cancel, classifica timeout como `forced-termination` e resolve dispose | PASSED em 6 testes com handle fake; `SMOKE VERIFIED` em Chromium local para resultado, cancelamento após progresso, uso pelo preview temporal e conclusão do Preview Worker em preview de produção limpo. Continuidade de estado, backpressure de navegador e runtime desktop permanecem `NOT VERIFIED` |
| Supervisor Worker bounded | `workerSupervisor.ts` limita concorrência e fila, rejeita backpressure, impede requestId duplicado, reserva budgets declarativos agregados no host e libera reservas em cancelamento/resultado/dispose | PASSED em 6 testes com clientes fake; `SMOKE VERIFIED` em Chromium local com Workers reais para 5 requests escalares: `maxConcurrent=2`, fila bounded, cancelamento ativo/enfileirado, progresso por request, IDs independentes e reservas zeradas após cleanup. Uma rajada de 8 requests também produziu `active=2`, `queued=3`, 5 aceitos, 3 rejeitados com `invalid-request` e resultados aceitos em tick 32; `BASELINE RECORDED` de latências: 128,5–382,3 ms, média 230,04 ms. Medição efetiva de operações/memória, extrapolação de produção, throughput de escala e backpressure prolongado permanecem `NOT VERIFIED` |
| Ponte CircuitDocument → Worker | `buildDocumentRuntimeNetlist()` e `buildDocumentWorkerRequest()` executam preflight, elaboração/canonicalização, validação de inputs/watches e rejeição do contrato vetorial v1 sem mutar o documento | PASSED em 6 testes documentais; `SMOKE VERIFIED` em Chromium local para uma fixture `CircuitDocument` escalar com preflight `acyclic` e documento inalterado. Custom-chip real, vetores, carga, execução concorrente efetiva e desktop permanecem `NOT VERIFIED` |
| Executor documental Worker | `DocumentWorkerExecutor` compõe bridge e cliente, devolve preflight/result, transforma falhas de construção em erro controlado e assume ownership até `dispose()` | PASSED em 4 testes com handle fake; `SMOKE VERIFIED` em Chromium local para uma execução documental escalar curta pelo preview do painel temporal e pelo preview de produção em origem limpa, sem substituir o runtime ativo. Continuidade de estado Worker para `Step`/`Run`, carga/backpressure efetiva e desktop permanecem `NOT VERIFIED` |

A regressão cruzada usa `buildTruthTable(parse(expression))` como intenção e `createDocumentRuntime()`/`Simulator` como execução do `CircuitDocument`. Qualquer divergência ou não-estabilização faz o teste falhar e impede o gate automatizado da release; isso não transforma um teste local em validação de runtime desktop.

O BENCH-001 mediu, nesta execução Linux x86_64/Node `v22.13.0`, 0,577 ms em 220 ticks para 10 gates e 17,271 ms em 2.020 ticks para 100 gates. O BENCH-002 também executou o Netlist bruto nos cinco alvos, incluindo 5000 gates em 6.273,959 ms/15.003 ticks. Os valores são baseline da máquina/processo, não são comparáveis entre plataformas sem ambiente equivalente e não promovem suporte editorial, persistência ou renderização nessa escala.

A decisão de capacidade em `docs/LARGE_CIRCUITS.md` mantém os limites canônicos de 256 nós, 512 conexões e 500.000 bytes serializados. A fixture cobre o máximo linear válido de 254 gates e recusa 255 gates; o caminho Netlist bruto é diagnóstico do Simulator, não evidência de suporte oficial do editor.

## Início formal dos testes — desktop `0.5.0`

A `0.5.0` só será aberta quando houver builds por plataforma e um conjunto de máquinas ou runners capazes de executar os fluxos. O checklist mínimo será repetido em cada sistema: instalar, criar circuito, conectar portas, simular, salvar projeto local, fechar, reabrir, exportar/importar `.veritas`, exportar Verilog/VHDL, testar sem rede, atualizar e desinstalar. O resultado deverá incluir logs, versões do sistema, hash dos artefatos e a classificação de cada caso como `BUILD VERIFIED`, `RUNTIME VERIFIED`, `SMOKE VERIFIED`, `FAILED` ou `NOT VERIFIED`.

## Promoção estável — desktop `1.0.0`

A `1.0.0` não será criada por calendário nem porque um instalador existe. Ela exige estabilidade comprovada em todos os alvos suportados, zero defeitos críticos abertos, regressão do núcleo, acessibilidade, desempenho dentro dos limites publicados, instalação/atualização/remoção verificadas, assinatura de distribuição configurada e documentação final. Se um alvo não atender ao gate, a promoção deve ser bloqueada ou o alvo deve ser explicitamente retirado da matriz suportada.


## Modelo comercial planejado — Steam, DLC e cloud

| Área | Estado atual | Gate futuro |
|---|---|---|
| Demo/teste gratuita | **PLANNED POLICY** | Escopo, limites, login de sessão, criação, simulação, salvamento e exportação dentro das condições publicadas |
| Edição final paga | **NOT IMPLEMENTED** | Login, licença/entitlement, grace period offline, criação, simulação, salvamento e recuperação verificados por plataforma |
| DLC local | **NOT IMPLEMENTED** | Entitlement, conteúdo versionado, checksum, allowlist, fallback e execução verificados por plataforma |
| Ownership Steam | **NOT IMPLEMENTED** | Testes nativos com licença presente, ausente, expirada e atualização |
| Steam Wallet/microtransações | **NOT IMPLEMENTED** | API oficial, reconciliação, refund/chargeback e auditoria de transações |
| Backup e sincronização cloud | **NOT IMPLEMENTED** | Quotas, criptografia, retenção, exportação, exclusão, conflitos e recovery |
| Colaboração hospedada | **NOT IMPLEMENTED** | Papéis, permissões, auditoria, resolução de conflito e desligamento sem perda local |
| Offline após serviço expirado | **NOT VERIFIED** | Projetos locais continuam simuláveis e exportáveis sem serviço ativo |
| Windows/Steam | **NOT VERIFIED** | `Veritas-Setup.exe`, ownership, DLC, atualização e rollback reais |
| macOS/Steam | **NOT VERIFIED** | App bundle, ownership, DLC, assinatura/notarização e rollback reais |
| Linux/Steam | **NOT VERIFIED** | Pacote, ownership, DLC, assinatura e rollback reais |

A política completa está em [`docs/COMMERCIAL_MODEL_STEAM.md`](../../docs/COMMERCIAL_MODEL_STEAM.md). A presença desta seção não significa que demo comercial, edição final paga, cobrança, Steamworks, licenciamento ou nuvem comercial estejam implementados.
