# Changelog do Veritas

As mudanças relevantes do Veritas são registradas neste arquivo. As versões `0.y.z` continuam sendo candidatas de evolução da API e do formato de circuito.

## [Unreleased]

### Modelo comercial planejado

- Definido o modelo futuro para a Steam: demo/teste gratuita para avaliação e versão final paga como edição completa e oficial, ambas com login planejado e a edição final com licença/entitlement verificável; escopo, limites e condições da demo deverão ser publicados antes do uso.
- Registrada a política em `docs/COMMERCIAL_MODEL_STEAM.md`: login/licença não autorizam upload automático, projetos locais compatíveis não dependem de contratação de cloud e DLCs/serviços cloud continuam separados. Steamworks, licenciamento, pagamentos, backend comercial, pricing e cloud comercial permanecem `PLANNED / NOT IMPLEMENTED`; a diretriz também cobre Baluarte, Vanguard e futuros produtos sem afirmar que esses repositórios já tenham cobrança implementada.
- Criado `docs/PRODUCT_AUTH_LICENSE_BOUNDARY.md` com a fronteira planejada entre conta, licença, entitlement, capabilities, armazenamento local e cloud. O `AuthProvider` Supabase atual é classificado como infraestrutura técnica opcional, não como licença paga ou ownership Steam.

### Verification no testbench — v2.6.0 em desenvolvimento

- O `TestbenchReport` agora agrega snapshots observáveis por caso, contraexemplos determinísticos e a primeira divergência com sinal, passo e tique; o veredito funcional `passed`/`failed` permanece separado do diagnóstico bounded.
- Casos combinacionais multi-bit podem declarar `vectors`, com valores normalizados em binário MSB → LSB. A UI e o MCP expõem o resumo de observações sem converter `cycle-detected` ou `budget-exhausted` em falha lógica.
- A cobertura focal passou para 25 testes de domínio e 5 testes MCP do caminho `run_testbench`, incluindo register-4bit, counter-4bit, JK, SR, feedback, custom-chip, multi-bit e rejeição fail-closed de literal inválido. A release/tag v2.6.0 ainda não foi criada.

### Execution Safety — v2.7.0 em desenvolvimento

- O `Simulator` passou a contabilizar budgets de operações por tique e acumulados por runtime, com rollback atômico quando o limite é excedido; a ponte `documentRuntime` encaminha as opções sem duplicar a engine.
- O adapter MCP `simulateCircuit` passou a aplicar budgets headless de operações e memória estimada, mantendo o limite público de 1000 tiques e executando `shutdown()` em `finally` para não reter o runtime após sucesso, erro ou watch inválido; as regressões MCP correspondentes passaram junto com a suíte.
- Adicionada a variante assíncrona `simulateCircuitAsync()`: o handler `simulate_circuit` agora encaminha o `RequestHandlerExtra.signal` do SDK MCP para `Simulator.tickAsync()`, com `yield_every`, `timeout_ms`, budgets headless, erro controlado e cleanup em `finally`. As regressões do adapter cobrem resultado temporal preservado, abort prévio e abort entre yields; isso não equivale a cancelamento observado em cliente MCP externo.
- Adicionado `SimulatorExecutionBudget`, quota explícita compartilhável entre runtimes de um mesmo documento/operação: tiques e operações são cumulativos, memória estimada é reservada antes da alocação e liberada por `shutdown()`, e falhas restauram os contadores da execução. `createDocumentRuntime()` encaminha a quota e previews diagnósticas encerram seu runtime isolado em `finally`.
- As regressões do Simulator e do `documentRuntime` cobrem quota agregada entre instâncias, rollback de operações e liberação idempotente de memória estimada; os testes do protocolo Worker cobrem contrato, snapshots, progresso, cancelamento, timeout, budget, duplicidade e teardown. Supervisor cross-worker, medição real de heap e uso desktop continuam fora deste slice.
- O gate local posterior ao slice passou com **737 testes aprovados e 1 skipped**, lint sem warnings, typecheck, build web/PWA e bundles MCP stdio/HTTP; esses resultados são evidência local de qualidade/build e não criam tag ou release.
- `src/simulation/workerProtocol.ts` e `simulation.worker.ts` implementam o primeiro protocolo Worker isolado: mensagens versionadas com `requestId`, validação fail-closed dos limites oficiais, snapshots/progresso bounded, cancelamento cooperativo, timeout, budget, deduplicação e teardown sem respostas tardias; a UI ainda não o orquestra e a simulação Tauri/Rust continua não iniciada.
- `docs/EXECUTION_WORKER_BOUNDARY.md` registra a fronteira Worker/Tauri, os limites de paridade e a classificação de evidências; o protocolo web testado não é `RUNTIME VERIFIED` no desktop.
- O gate local após o Worker v1 passou com **747 testes aprovados e 1 skipped**, em 83 arquivos aprovados e 1 skipped; lint, typecheck, build web/PWA e bundles MCP stdio/HTTP passaram. A saída Vite empacota o entrypoint Worker, mas execução real no navegador, integração de UI/Tauri, backpressure e smoke nativo continuam não verificados.
- `workerClient.ts` adiciona um cliente hospedeiro com uma execução ativa, callback de progresso, AbortSignal, timeout de host classificado como `forced-termination`, deduplicação e `dispose()` que encerra o handle; sua cobertura usa um handle fake e não simula um Worker real.
- O gate local posterior ao cliente passou com **753 testes aprovados e 1 skipped**, em 84 arquivos aprovados e 1 skipped; lint, typecheck, build web/PWA e bundles MCP stdio/HTTP passaram. Isso continua sendo evidência de qualidade/build, não release, e não comprova Worker real, UI interativa ou desktop.
- `buildDocumentRuntimeNetlist()` e `documentWorker.ts` criam a ponte validada `CircuitDocument → Netlist → request Worker`: preflight antes da construção, elaboração de clock/custom-chip pelo caminho canônico, inputs/watches explícitos, imutabilidade do documento e rejeição do contrato vetorial v1. O gate local posterior passou com **763 testes aprovados e 1 skipped**, em 86 arquivos aprovados e 1 skipped; Worker real foi validado somente no smoke local limitado, e a UI continua não verificada.
- Smoke web local executou o Worker e o cliente reais em Chromium: uma fixture escalar `input → not → output` teve snapshots finais iguais à engine direta (`tick=2`), e uma execução de clock foi cancelada após progresso (`type=cancelled`). A evidência é limitada a fixtures pequenas, não é `RUNTIME VERIFIED` desktop e não é release.
- `DocumentWorkerExecutor` compõe bridge documental e cliente Worker de modo opt-in, devolve preflight junto do resultado, controla ownership até `dispose()` e transforma falhas de construção em erro controlado. A cobertura focada passou com 4 testes do executor; a UI ativa ainda não usa essa camada. O gate completo posterior passou com **763 testes aprovados e 1 skipped**, em 86 arquivos aprovados e 1 skipped; lint, typecheck, build web/PWA e bundles MCP stdio/HTTP também passaram.
- O smoke web seguinte executou a ponte completa `CircuitDocument → DocumentWorkerExecutor → Worker` no Chromium local: preflight `acyclic`, resultado final em `tick=2` e documento inalterado. A evidência cobre somente uma fixture escalar pequena; custom-chip real, vetores, carga, UI e desktop continuam não verificados.
- O painel `SequentialCircuitPanel` agora oferece `Preview Worker` de forma explícita e opt-in. A execução usa o executor documental, mostra progresso e estado bounded, pode ser cancelada, é encerrada na troca de documento/reset/desmontagem e não substitui nem persiste o runtime temporal ativo. O smoke de UI no Chromium concluiu 8 tiques enquanto a timeline canônica permaneceu no tique 0. `Step`/`Run` ainda usam o runtime direto até existir continuidade de estado Worker validada.
- `SimulationWorkerSupervisor` adiciona concorrência e fila bounded no host, rejeição explícita de backpressure e `requestId` duplicado, cancelamento de requests enfileirados/ativos, `dispose()` idempotente e reservas agregadas declarativas de tiques, memória estimada e operações. Os seis testes focados passaram com clientes fake; esse contador de reserva não é medição efetiva de trabalho ou heap entre Workers.
- O gate completo após o supervisor passou com **769 testes aprovados e 1 skipped**, em 87 arquivos aprovados e 1 skipped; typecheck, lint, build web/PWA e bundles MCP/plugin passaram. O build do plugin gera um artefato rastreado, restaurado antes do `diff-check`, sem alteração funcional publicada.
- Smoke real adicional em Chromium local executou 5 requests escalares com Workers reais através do supervisor (`maxConcurrent=2`, `maxQueued=2`): 3 resultados em tick 32, cancelamento de 1 request ativo e 1 enfileirado, progresso por request, IDs distintos e reservas declarativas zeradas após cleanup. Isso é `SMOKE VERIFIED` somente para concorrência/fila/cancelamento/cleanup em fixture pequena; não mede CPU, heap efetivo, carga sustentada, Tauri/Rust ou desktop e não é release.
- Uma rajada bounded de 8 requests em Chromium local (`maxConcurrent=2`, `maxQueued=3`) ocupou 2 Workers e 3 posições de fila, aceitou 5 requests e rejeitou 3 imediatamente com `invalid-request`; os 5 resultados chegaram em tick 32. A baseline desta execução registrou latências de 128,5–382,3 ms, média 230,04 ms e reservas zeradas no cleanup. É `SMOKE VERIFIED`/`BASELINE RECORDED` apenas para esse cenário fixo; não é throughput sustentado, medição de heap/CPU ou capacidade editorial.
- Corrigido o bundling do Worker no caminho host-only: `workerFactory.ts` usa o módulo virtual `./simulation.worker?worker`, e o build de produção passou a gerar `simulation.worker-*.js` servido como `text/javascript`, em vez de tentar criar um `data:video/mp2t` inválido. A regressão da factory cobre criação quando a API existe e falha fechada quando ela não existe.
- O primeiro reteste de produção foi corretamente classificado como `FAILED` porque uma precache antiga do service worker carregou o bundle anterior; a causa foi isolada por instrumentação. Em uma origem limpa (`127.0.0.1:4174`), sem service worker e com `index-DuaF5h59.js`, a UI inseriu Clock e o `Preview Worker` concluiu 8 tiques com status `acyclic`, enquanto a timeline canônica permaneceu no tique 0. Esta é evidência `BUILD VERIFIED`/`SMOKE VERIFIED` web limitada, não `RUNTIME VERIFIED` desktop nem release.
- O gate final pós-correção passou com **771 testes aprovados e 1 skipped**, em 88 arquivos aprovados e 1 skipped; lint, typecheck, build web/PWA, bundles MCP stdio/HTTP e plugin passaram, com o `server.mjs` rastreado restaurado antes do `diff-check`. Esse resultado é evidência de build/qualidade e não cria tag ou release.
- A carga sustentada bounded em Chromium local executou seis rodadas, 48 requests totais, 36 resultados e 12 rejeições imediatas por backpressure, com `maxConcurrent=2`, `maxQueued=4`, throughput descritivo de 68,926 outcomes/s, latência média de 57,944 ms e p95 de 89,000 ms. Cada rodada atingiu pico `active=2`, `queued=4` e cleanup zerado. `performance.memory.usedJSHeapSize` foi observado entre 47.001.860 e 48.326.352 bytes, mas é heap da página, não heap isolado dos Workers; o registro é `SMOKE VERIFIED`/`BASELINE RECORDED` local e não é benchmark de produção, suporte a 5k/25k ou `RUNTIME VERIFIED` desktop.
- Adicionada regressão de paridade sequencial para a fixture `dff-clock`: o protocolo Worker e o `Simulator` canônico produziram snapshots idênticos nos tiques 0–4, incluindo D, CLK, Q e OUT. O smoke real no Chromium confirmou `result`, `requestId` preservado e `snapshotsMatch=true` em um único request; isso não autoriza substituir `Step`/`Run` nem prova continuidade entre requests independentes.
- Definido e implementado isoladamente o contrato `SimulationWorkerCheckpointV1`: assinatura FNV-1a canônica do netlist, estado temporal com `tickCount`/`operationCount`, parser e serializer JSON fail-closed, shape estrito, binding de ids/saídas/filas, limites de bytes/budget e rejeição de estado inválido. A suíte adicionou 7 regressões; o checkpoint ainda não entra no protocolo Worker v1, não habilita resume nem altera `Step`/`Run`.
- O gate local do contrato de checkpoint passou com **779 testes aprovados e 1 skipped**, em 90 arquivos aprovados e 1 skipped; typecheck, lint, build web/PWA, bundles MCP stdio/HTTP e plugin passaram. O artefato rastreado do plugin foi restaurado antes do `diff-check`; o resultado é qualidade/build verificado, não tag nem release.
- Documentada a proposta `docs/TAURI_SIMULATION_BOUNDARY.md` para o futuro comando Tauri/Rust: payload escalar versionado, validação duplicada fail-closed, canal de progresso bounded, cancelamento por `requestId`, teardown e golden parity antes de UI desktop. O shell nativo ainda não tem canal de progresso ou integração de UI.
- Implementado o primeiro slice Rust escalar: DTOs Serde com `deny_unknown_fields`, validação bounded de request, execução determinística de snapshots finais, budgets de tiques/operações/memória, `spawn_blocking`, registry de cancelamento por `requestId` e comandos Tauri `simulate_circuit_native`/`cancel_circuit_native`. `cargo test` passou com 4 testes no Linux e `cargo check` passou; o golden DFF compartilhado agora é `PASSED` em testes TypeScript/Rust, mas runtime interativo, Windows/macOS/Linux e `Veritas-Setup.exe` permanecem `NOT VERIFIED`.
- O canal nativo agora emite eventos bounded `veritas://simulation-progress` (máximo 64 por request), com cancelamento cooperativo entre tiques; `TauriSimulationClient` filtra payload por versão/requestId, traduz AbortSignal e falha fechado no navegador. O gate final passou com **782 testes TypeScript aprovados e 1 skipped** em 91 arquivos aprovados e 1 skipped, além de **6 testes Rust**; a UI ainda não invoca esse caminho e a emissão/teardown em desktop real permanecem `NOT VERIFIED`.
- O build Tauri Linux terminou com exit code 0 e produziu `Veritas_0.1.0-alpha.1_amd64.deb` (3.288.390 bytes, SHA-256 `76cd088db3305d715a8ec188eb73ec9109dce0fd1c185500fe9e7bef6d34d2a3`) e `Veritas_0.1.0-alpha.1_amd64.AppImage` (77.847.032 bytes, SHA-256 `4132ed61148d07989dd39e3b20881387f69f26d55191d7c81dbf27de10714407`). A inspeção confirmou tipo, arquitetura e conteúdo básico; instalação, abertura interativa, assinatura, Windows/macOS e `Veritas-Setup.exe` permanecem `NOT VERIFIED`. Isso é `BUILD VERIFIED`/`ARTIFACT VERIFIED`, não tag ou release.
- O workflow manual `desktop-artifact-verification` foi adicionado sem publicação de release. No run `33087842535` do commit `9db1cc1`, os runners Linux, Windows e macOS produziram os artefatos esperados, incluindo `Veritas-Setup.exe` e o bundle macOS arm64; os hashes completos estão em `docs/DESKTOP_ARTIFACT_VERIFICATION.md`. A matriz é `BUILD VERIFIED`/`ARTIFACT VERIFIED` por runner, mas não é evidência de runtime, instalação ou smoke interativo.
- O `.deb` Linux do run `33087842535` foi instalado, iniciado sob Xvfb por 10 segundos e removido no sandbox; o processo permaneceu iniciado até o timeout esperado (`124`), sem crash, e os arquivos de integração desapareceram após a remoção. O resultado é `SMOKE VERIFIED` limitado a instalação/startup/cleanup Linux; editor, simulação nativa, progresso, cancelamento, AppImage, Windows/macOS e release continuam fora do escopo.
- O lifecycle do primeiro canal Rust/Tauri foi endurecido com guarda RAII para remover o `requestId` em qualquer saída do comando, inclusive falha de join, e com testes de duplicidade, reutilização após cleanup, cancelamento idempotente e retorno antecipado. O loop nativo agora honra `yieldEvery` com `thread::yield_now()` e uma regressão observa cancelamento disparado por outra thread; o gate Rust local passou com **10 testes**. Isso não é smoke de invoke/evento em janela Tauri nem autoriza conectar a UI canônica.
- A parity temporal foi ampliada de forma incremental com `tests/fixtures/worker-sequential-tff.json`, cobrindo toggle em bordas de subida e hold quando T=0. O Worker web e o `Simulator` canônico TypeScript passaram a validar DFF e TFF contra snapshots compartilhados; o engine Rust também passou os dois goldens. O resultado é `PASSED` em 2 regressões TypeScript e **11 testes Rust**, sem generalizar a conclusão para JK, SR, delay, feedback, vetores ou runtime desktop.
- O painel temporal do editor passou a executar `Run` por lotes assíncronos canceláveis, com estado visual `executando`, botão `Cancelar execução`, timeout de 5 segundos e limpeza do runtime ao trocar documento ou desmontar o componente. A inspeção visual ainda permanece pendente.
- O workspace de demos sequenciais passou a usar `pulseClockAsync()` no modo de pulso manual, preservando os dois tiques alto/baixo e os tiques de acomodação sem adicionar passos ocultos. A inspeção visual e o smoke desktop continuam pendentes.
- O workspace trata rejeições de timeout/abort sem Promise não aguardada, informa falhas ao usuário e bloqueia alterações de entrada durante o Run; Reset e troca de demo cancelam a execução antes de liberar o simulador.
- Adicionados cancelamento cooperativo por `simulator.cancel()`, `AbortSignal`, `reset()` que limpa cancelamento e `shutdown()` idempotente que libera o estado interno. O preflight `documentRuntime` encaminha a análise estática de SCCs, o runtime rejeita netlists acima do budget de memória estimada antes de alocar filas de delay, e `tickAsync()` oferece yield/timeout com rollback. Os testes focados do domínio passaram: 57/57, sendo 35 de Simulator, 16 de documentRuntime e 6 de análise estática de circuitos; a suíte focada `mcp/src/tools.test.ts` passou com 56/56 após os cenários assíncronos.
- A fase v2.7 permanece `Unreleased`: supervisor, baselines bounded/sustentada, preview de produção web, parity DFF escalar e contrato/parser de checkpoint isolado foram concluídos em cenários limitados, mas integração de resume entre requests, integração Tauri/Rust, cancelamento observado por host externo, inspeção visual ampla, medição efetiva isolada de heap/CPU e QA nativo ainda não foram concluídos.

### Trajetória de plataforma

- A trajetória de continuidade foi ampliada de v2.5.0 para v5.0.0. `docs/VERITAS_V3_V5_ROADMAP.md` define os marcos pós-v2.5.0 — verification, segurança de execução, migrações, modularidade, plugins, workspace profissional, reprodutibilidade, distribuição e o gate final de Digital Logic Platform — sem promover qualquer versão automaticamente.
- A fila operacional detalhada de 26 fases foi preservada em `docs/VERITAS_MASTER_BUILD_QUEUE.md`, com gates explícitos para v2.6.0–v5.0.0, RC final, segurança de distribuição e validação multiplataforma.
- A primeira fatia da v2.6.0 integrou diagnósticos bounded ao `runTestbench`: casos sequenciais agora retornam `stabilized`, `cycle-detected` ou `budget-exhausted` em uma cópia isolada, o painel apresenta status acessível e o MCP serializa o diagnóstico. A cobertura focada passou; a release v2.6.0 e a validação visual/nativa permanecem pendentes.

### Qualidade e distribuição

- Adicionado baseline permanente `Expression → TruthTable` versus `Circuit → Simulator` em `tests/regression/`, cobrindo portas fundamentais, meio somador, somador completo e multiplexador.
- Adicionados testes determinísticos do medidor desktop e do gerador `desktop-release-manifest.json`/`SHA256SUMS`, incluindo rejeição fail-closed de assets inesperados.
- O workflow desktop passou a bloquear builds nativos sem `test`, typecheck, lint e build web; os runners Windows/Linux também executam smoke de instalação, startup e remoção com limites explícitos.
- O painel de testbench agora edita casos sequenciais com passos, entradas `0/1/mantém`, ticks e expectativas por saída, usando o mesmo runner declarativo do domínio; a ponte UI→Simulator ganhou regressão permanente para um registrador.
- Testbenches agora podem ser salvos, atualizados, reabertos, removidos, importados e exportados localmente como `veritas-testbenches` versão 1; a nova tabela IndexedDB é associada ao circuito e o parser recusa formato, modos e limites inválidos.
- BENCH-001 adiciona `npm run bench:circuit-scale`, um benchmark determinístico separado da suíte padrão que mede o runtime `Simulator` real em cadeias de 10 e 100 gates, com warmup separado, validação de saída, checksum e relatórios JSON/Markdown ignorados em `artifacts/`.
- A primeira baseline Linux x86_64/Node `v22.13.0` observou 0,577 ms em 220 ticks para 10 gates e 17,271 ms em 2.020 ticks para 100 gates. Os alvos de 500, 1000 e 5000 gates ficaram `NOT SUPPORTED` pelos limites atuais de 256 nós/512 conexões; FPS, memória desktop, startup nativo e tamanho instalado continuam `NOT VERIFIED`.
- BENCH-002 adiciona a leitura de capacidade do runtime bruto: o mesmo fixture como `Netlist` passou em 10/100/500/1000/5000 gates, incluindo 5000 em 6.273,959 ms/15.003 ticks. Essa medição interna não altera os limites do editor nem declara suporte oficial para circuitos grandes, persistência, renderização ou desktop.
- O BENCH-002 foi incluído nos quality gates comuns e desktop; seus relatórios JSON/Markdown são retidos como artefatos de CI por 14 dias. Uma falha bloqueia o avanço do build desktop, mas um workflow verde não cria tag nem promove release automaticamente.
- Registrada a decisão em `docs/LARGE_CIRCUITS.md`: manter os limites oficiais do `CircuitDocument`, usar o Netlist bruto apenas para diagnóstico do Simulator e exigir contrato versionado, budgets, renderização, persistência, segurança e QA multiplataforma antes de anunciar suporte a circuitos grandes.
- Adicionados flip-flops JK e SR ao contrato de componentes, Simulator, editor visual, conversão de conexões, watches do runtime e proteção de chips customizados. A semântica é síncrona na borda de subida: JK cobre hold/set/reset/toggle; SR cobre hold/set/reset e trata S=R=1 de forma determinística, preservando o estado anterior.
- A cobertura de JK/SR inclui regressões de runtime, validação/conversão do editor e watches Q/Q̄ do `documentRuntime`; a inspeção visual interativa ainda permanece `NOT VERIFIED` neste ambiente sem Browser disponível.
- O workspace sequencial ganhou as demos `jk-clock` e `sr-clock`, com controles de entradas, clock automático, Step/Run/Reset, watches e timeline reutilizada; os contratos e pulsos principais têm regressões determinísticas.
- A seção de waveform do workspace agora projeta as amostras da timeline em faixas digitais acessíveis, com ticks, níveis 0/1 e labels de sinal; o helper puro possui cobertura de ordem, valores, snapshots vazios e compressão de mudanças.
- O workspace sequencial ganhou a demo `register-4bit`, um registrador paralelo didático composto por quatro DFFs com clock compartilhado, controles D0–D3 e watches Q0–Q3; a captura simultânea e a retenção entre bordas têm regressão determinística.
- O workspace sequencial ganhou a demo `counter-4bit`, um contador síncrono de 4 bits construído com quatro TFFs e carry combinacional AND. Cada pulso manual percorre a acomodação declarada de dois tiques e a regressão cobre 0000 → 1111 → 0000.
- O `Simulator` passou a validar os budgets de `settle()` e de tiques totais de forma fail-closed: apenas inteiros finitos entre 1 e 10.000 para acomodação e entre 1 e 1.000.000 para o orçamento acumulado, com `settle(0)` permitido como janela vazia; `tick()` e `restoreState()` não ultrapassam o limite. Clocks e feedback oscilantes continuam limitados sem loops infinitos. A decisão está documentada em `docs/FEEDBACK_HARDENING.md`.
- Adicionado `diagnoseSettle()` como caminho opt-in para diferenciar estabilização, ciclo detectado e esgotamento de budget, incluindo início e período do ciclo quando observáveis; `settle()` preserva sua semântica compatível baseada nas saídas.
- O `documentRuntime` agora expõe `diagnoseDocumentRuntime()` e encaminha `maxSettleTicks`/`maxTotalTicks` por documento, com regressões cross-layer para circuito combinacional estabilizado, clock cíclico e bloqueio do orçamento total.
- Adicionada `diagnoseDocumentRuntimePreview()`: uma execução diagnóstica em runtime isolado que pode restaurar estado e aplicar entradas sem mutar o runtime ativo, retornando diagnóstico, snapshot e estado final; o barrel de simulação também exporta o contrato de `documentRuntime`.
- O workspace sequencial agora oferece a ação explícita `Diagnosticar preview`, limitada a 64 tiques, com status acessível para estabilização, ciclo detectado ou budget esgotado. A ação usa a cópia isolada e informa que o runtime ativo não foi alterado; inspeção visual interativa continua pendente neste ambiente.

## [0.12.0] — 2026-08-25

### Adicionado

- Perfil combinacional real `BITREV-8` do catálogo DLS, na categoria `Outros`, com oito entradas escalares, oito saídas escalares, oito fios, nenhum subchip e nenhum componente catalogado em `parts`.
- Materialização allowlist explícita como oito inputs escalares e oito outputs escalares, com conexões diretas `A7→O0`, `A6→O1`, `A5→O2`, `A4→O3`, `A3→O4`, `A2→O5`, `A1→O6` e `A0→O7`; não há Combiner, Splitter, dependência ou execução de JSON/código DLS.
- Contrato fail-closed para nome, cardinalidades, larguras escalares, `parts={}`, `partCount=0`, `wireCount=8`, variáveis `A|B|C|D|E|G|H|I`, ausência de `pins`, nomes derivados `O0…O7` e expressões exatas `I|H|G|E|D|C|B|A`.

### Validação e limites

- Suíte completa: **70 arquivos e 615 testes aprovados**; a nova fatia contém 8 testes focados, cobrindo contrato do catálogo, topologia, quatro vetores de reversão, portas locais, HDL e rejeição de assinatura alterada.
- Suíte focada do adaptador: **136/136 testes aprovados**; typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local confirmou o card como modelo multi-bit, a persistência na biblioteca como **ID 21** com 20 chips e a instância no canvas com `BITREV-8 · 8 entradas · 8 saídas`; o DOM confirmou 16 handles acessíveis — oito entradas e oito saídas de 1 bit — e zero `[role=alert]`. As oito entradas ficaram desconectadas de propósito, portanto a validação exibiu oito problemas acionáveis.
- O beta readiness continua em 0 READY, 5 BLOCKED e 1 SKIP por credenciais/evidências externas Supabase ausentes; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Perfis tri-state, sequenciais, memória, ULA e conversores sem contrato permanecem fora do escopo.

## [0.11.9] — 2026-08-25

### Adicionado

- Perfil combinacional real `BITREV-4` do catálogo DLS, na categoria `Outros`, com quatro entradas escalares `A0…A3`, quatro saídas escalares `O0…O3`, quatro fios e nenhum subchip ou componente catalogado.
- Materialização allowlist explícita como quatro inputs escalares e quatro outputs escalares, com conexões diretas `A3→O0`, `A2→O1`, `A1→O2` e `A0→O3`; não há Combiner, Splitter, dependência ou execução de JSON/código DLS.
- Contrato fail-closed para nome, cardinalidades, larguras escalares, `parts={}`, `partCount=0`, `wireCount=4`, variáveis, pinos e expressões derivadas exatas `D|C|B|A`; a reversão é preservada no `CircuitDocument`, na biblioteca, no canvas e nos exportadores HDL.

### Validação e limites

- Suíte completa: **70 arquivos e 607 testes aprovados**; a nova fatia contém 8 testes focados, cobrindo contrato do catálogo, topologia, quatro vetores de reversão, portas locais, HDL e rejeição de assinatura alterada.
- Suíte focada do adaptador: **128/128 testes aprovados**; typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local confirmou o card como modelo multi-bit, a persistência na biblioteca como **ID 20** com 19 chips e a instância no canvas com `BITREV-4 · 4 entradas · 4 saídas`; o DOM confirmou 8 handles acessíveis — quatro entradas e quatro saídas de 1 bit — e zero `[role=alert]`. As quatro entradas ficaram desconectadas de propósito, portanto a validação exibiu quatro problemas acionáveis.
- O beta readiness continua em 0 READY, 5 BLOCKED e 1 SKIP por credenciais/evidências externas Supabase ausentes; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Perfis tri-state, sequenciais, memória e conversores sem contrato permanecem fora do escopo.

## [0.11.8] — 2026-08-25

### Adicionado

- Perfil combinacional real `SEXT-4-16` do catálogo DLS, com quatro entradas escalares, dezesseis saídas derivadas `A|B|C|D|D|D|D|D|D|D|D|D|D|D|D|D` e uma saída estrutural local `O0` de 16 bits.
- Materialização allowlist explícita como quatro inputs escalares, um Combiner de 16 partes e uma saída vetorial de 16 bits; os três primeiros canais recebem `A0…A2` e os treze canais restantes recebem `A3`, preservando `A0 A1 A2 A3 A3 A3 A3 A3 A3 A3 A3 A3 A3 A3 A3 A3` em MSB → LSB.
- O contrato é fail-closed: exige nome, cardinalidades, `parts={}`, `partCount=0`, `wireCount=16`, ausência de `pins` e expressões exatas; não executa JSON/código DLS nem infere dependências. A biblioteca prioriza o materializador vetorial sobre expressões escalares derivadas.

### Validação e limites

- Suíte completa: **70 arquivos e 599 testes aprovados**; a nova fatia contém 8 testes focados, cobrindo contrato do catálogo, estrutura, quatro vetores de extensão de sinal, portas locais, HDL e rejeição de assinatura alterada.
- Suíte focada do adaptador: **120/120 testes aprovados**; typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local confirmou o card como modelo multi-bit, a persistência na biblioteca como **ID 19** com 18 chips e a instância no canvas com `IN 1 + 1 + 1 + 1 bits · OUT 16 bits`; o DOM confirmou 5 handles acessíveis — quatro entradas de 1 bit e uma saída de 16 bits — e zero `[role=alert]`. As quatro entradas ficaram desconectadas de propósito, portanto a validação exibiu quatro problemas acionáveis.
- O beta readiness continua em 0 READY, 5 BLOCKED e 1 SKIP por credenciais/evidências externas Supabase ausentes; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Perfis tri-state, sequenciais, memória e conversores sem contrato permanecem fora do escopo.

## [0.11.7] — 2026-08-25

### Adicionado

- Perfil combinacional real `ZEXT-4-16` do catálogo DLS, com quatro entradas escalares `A0…A3`, dezesseis saídas derivadas no catálogo e uma saída estrutural local `O0` de 16 bits.
- Materialização allowlist explícita como quatro inputs escalares, uma constante `0` compartilhada por doze conexões, um Combiner de 16 partes e uma saída vetorial de 16 bits.
- Preservação do caminho vetorial na biblioteca quando o registro também possui expressões escalares derivadas, mantendo a largura pública de 16 bits no IndexedDB, na paleta e no canvas.

### Validação e limites

- Suíte completa: **70 arquivos e 591 testes aprovados**; a nova fatia contém 8 testes focados, cobrindo contrato do catálogo, estrutura, quatro vetores de extensão, portas locais, HDL e rejeição de assinatura alterada.
- Suíte focada do adaptador: **112/112 testes aprovados**; typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local confirmou o card como modelo multi-bit, a persistência na biblioteca como **ID 18** e a instância no canvas com `IN 1 + 1 + 1 + 1 bits · OUT 16 bits`; o DOM confirmou 5 handles acessíveis e zero `[role=alert]`. As quatro entradas ficaram desconectadas de propósito, portanto a validação exibiu quatro problemas acionáveis.
- O beta readiness continua em 0 READY, 5 BLOCKED e 1 SKIP por credenciais/evidências externas Supabase ausentes; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Perfis tri-state, sequenciais, memória e conversores sem contrato permanecem fora do escopo.

## [0.11.6] — 2026-08-25

### Adicionado

- Perfil combinacional real `SEXT-4-8` do catálogo DLS, com quatro entradas escalares `A0…A3`, oito saídas derivadas no catálogo e uma saída estrutural local `O0` de 8 bits.
- Materialização allowlist explícita como quatro inputs escalares, um Combiner de oito partes, fan-out do bit de sinal `A3` para as cinco partes superiores e uma saída vetorial de 8 bits.
- Prioridade do materializador vetorial na biblioteca quando um registro também possui expressões escalares derivadas, preservando a largura pública no IndexedDB, na paleta e no canvas.

### Validação e limites

- Suíte completa: **70 arquivos e 583 testes aprovados**; a nova fatia contém 8 testes focados, cobrindo estrutura, quatro vetores de extensão, portas locais, HDL e rejeição de assinatura alterada.
- Suíte focada do adaptador: **104/104 testes aprovados**; typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local final confirmou o card real como modelo multi-bit, a persistência na biblioteca como **ID 17** e a instância no canvas com `IN 1 + 1 + 1 + 1 bits · OUT 8 bits`; o DOM confirmou 5 handles acessíveis e zero `[role=alert]`. As quatro entradas ficaram desconectadas de propósito, portanto a validação exibiu quatro problemas acionáveis.
- O beta readiness continua em 0 READY, 5 BLOCKED e 1 SKIP por credenciais/evidências externas Supabase ausentes; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Perfis tri-state, sequenciais, memória e conversores sem contrato permanecem fora do escopo.

## [0.11.5] — 2026-08-25

### Adicionado

- Perfil combinacional real `ZEXT-4-8` do catálogo DLS, com quatro entradas escalares `A0…A3`, uma saída pública `O0` de 8 bits e a dependência real `1× 0`.
- Materialização allowlist explícita como quatro inputs escalares, uma constante `0` compartilhada quatro vezes, um Combiner de oito partes e uma saída vetorial de 8 bits; a extensão preserva os quatro sinais de entrada e acrescenta `0000` em MSB → LSB.
- A biblioteca agora dá prioridade ao materializador vetorial quando um perfil também possui expressões escalares derivadas, evitando que o mesmo fixture seja reduzido silenciosamente a oito saídas escalares.

### Validação e limites

- Suíte completa: **70 arquivos e 575 testes aprovados**; a nova fatia contém 5 testes focados, cobrindo estrutura, extensão com zeros, portas locais, HDL e rejeição quando a constante real está ausente.
- Typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local final confirmou a remoção da versão persistida antiga, a nova importação na biblioteca como **ID 16**, o card classificado como modelo multi-bit e a instância no canvas com `IN 1 + 1 + 1 + 1 bits · OUT 8 bits`; o DOM confirmou 5 handles acessíveis e zero `[role=alert]`. As quatro entradas ficaram desconectadas de propósito, portanto a validação exibiu quatro problemas acionáveis.
- O beta readiness continua em 0 READY, 5 BLOCKED e 1 SKIP por credenciais/evidências externas Supabase ausentes; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Perfis tri-state, sequenciais, memória e conversores sem contrato permanecem fora do escopo.

## [0.11.4] — 2026-08-25

### Adicionado

- Perfil combinacional real `16 para 8 e 4 bits` do catálogo DLS, com 16 entradas escalares, 10 saídas públicas e larguras de saída `[8, 8, 4, 8, 4, 4, 4, 8, 8, 8]`.
- Allowlist estrutural fechada para a assinatura `2× 1-8BIT`, `1× 8x2-AND` e `1× 8-4BIT`, sem executar JSON DLS, inferir dependências ou liberar estado/tri-state.
- Materialização local explícita em dois Combiners de 8 bits, dois Splitters de 8 bits, oito AND escalares, um Combiner do AND e um Splitter `[4,4]`; a ordem pública é `A, A, AND[0], A, AND[0], AND[1], AND[1], B, B, B`.
- Integração do perfil ao fluxo catálogo → IndexedDB → paleta de chips customizados → canvas, preservando os 26 handles acessíveis e as larguras individuais.

### Validação e limites

- Suíte completa: **70 arquivos e 570 testes aprovados**; a nova fatia contém 5 testes focados, cobrindo estrutura, ordem dos dez outputs com vetor não simétrico, portas locais, HDL e rejeição da assinatura sem `8-4BIT`.
- Typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local confirmou o card real, a persistência na biblioteca como **ID 14** e a instância no canvas com 16 entradas, 10 saídas e 26 handles acessíveis. O nó isolado exibiu 16 problemas de entradas desconectadas, comportamento esperado e acionável, não uma falha de materialização.
- O beta readiness continua em 0 READY, 5 BLOCKED e 1 SKIP por credenciais/evidências externas Supabase ausentes; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Perfis tri-state, sequenciais e memória permanecem fora do escopo.

## [0.11.3] — 2026-08-25

### Adicionado

- Perfil combinacional real `NEGATE-8` do catálogo DLS, com entrada vetorial de 8 bits, controle escalar de 1 bit e saída vetorial de 8 bits.
- Reconhecimento seguro da assinatura `1× 8-1BIT`, `1× 1-8BIT` e `8× XOR`, com materialização local como Splitter, oito XOR e Combiner.
- Integração do perfil ao fluxo catálogo → IndexedDB → paleta de chips customizados → canvas, preservando as larguras heterogêneas `8/1 → 8`.

### Validação e limites

- Suíte completa: 70 arquivos e 565 testes aprovados; a nova fatia contém 8 testes focados, com estrutura, quatro casos condicionais vetoriais, portas locais, HDL e rejeição de assinatura incompatível.
- Typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local confirmou o card `NEGATE-8`, sua persistência na biblioteca como ID 13 e a instância no canvas com `IN 8 + 1 bits · OUT 8 bits`; as três alças anunciaram 8/1/8 bits e não houve `[role=alert]`. A instância isolada exibiu dois problemas acionáveis de entradas desconectadas.
- O beta readiness continua bloqueado por credenciais/evidências externas Supabase; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Perfis temporais, memória e tri-state permanecem fora do escopo.

## [0.11.2] — 2026-08-25

### Adicionado

- Perfil combinacional real `NOT-8 Bits` do catálogo DLS, com uma entrada de 8 bits e uma saída de 8 bits.
- Reconhecimento seguro da assinatura hierárquica `1× NAND-8Bits`, com materialização local como um Splitter, oito NOT e um Combiner.
- Integração do perfil ao fluxo catálogo → IndexedDB → paleta de chips customizados → canvas, preservando a largura `8 → 8`.

### Validação e limites

- Suíte completa: 70 arquivos e 557 testes aprovados; a nova fatia contém 8 testes focados, com estrutura, quatro casos de negação vetorial, portas locais, HDL e rejeição de assinatura incompatível.
- Typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local confirmou o card `NOT-8 Bits`, sua persistência na biblioteca como ID 12 e a instância no canvas com `IN 8 bits · OUT 8 bits`; as duas alças anunciaram 8 bits e não houve `[role=alert]`. A entrada ficou desconectada de propósito, portanto a validação exibiu um problema acionável.
- O beta readiness continua bloqueado por credenciais/evidências externas Supabase; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Perfis temporais, memória e tri-state permanecem fora do escopo.

## [0.11.1] — 2026-08-25

### Adicionado

- Perfil combinacional real `1-8MUX` do catálogo DLS, com seleção escalar, duas entradas de 8 bits e saída de 8 bits.
- Materialização explícita como dois Splitters, uma NOT para a seleção, dezesseis AND, oito OR e um Combiner, sem tri-state nem memória.
- Integração do perfil ao fluxo catálogo → IndexedDB → paleta de chips customizados → canvas, preservando as larguras heterogêneas `1/8/8 → 8`.

### Validação e limites

- Suíte completa: 70 arquivos e 549 testes aprovados; a nova fatia contém 8 testes focados, com estrutura, quatro seleções vetoriais, portas locais, HDL e rejeição de assinatura incompatível.
- Typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local confirmou o card `1-8MUX`, sua persistência na biblioteca como ID 11 e a instância no canvas com `IN 1 + 8 + 8 bits · OUT 8 bits`; as quatro alças anunciaram as larguras corretas e não houve `[role=alert]`. As três entradas ficaram desconectadas de propósito, portanto a validação exibiu três problemas acionáveis.
- O beta readiness continua bloqueado por credenciais/evidências externas Supabase; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Perfis temporais, memória e tri-state permanecem fora do escopo.

## [0.11.0] — 2026-08-25

### Adicionado

- Confirmação contra os fixtures reais `AND-8 Bits`, `NAND-8Bits`, `OR-8 Bits` e `XOR - 8 BIT` do catálogo DLS.
- Reconhecimento seguro das assinaturas hierárquicas de `OR-8 Bits` e `XOR - 8 BIT`, que encapsulam `NAND-8Bits` e `NOT-8 Bits`, sem executar o JSON de origem.
- Cobertura do fluxo catálogo → IndexedDB → paleta de chips customizados → canvas para um banco representativo `XOR - 8 BIT`, mantendo entradas e saída de 8 bits.

### Validação e limites

- Suíte completa: 70 arquivos e 541 testes aprovados; a nova fatia contém 5 testes focados, cobrindo os quatro fixtures reais, semântica vetorial `0xAA`/`0xCC`, portas locais, HDL e rejeição defensiva.
- Typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local manual confirmou o card `XOR - 8 BIT`, sua decomposição `3× NAND-8Bits, 2× NOT-8 Bits`, persistência na biblioteca como ID 10 e a instância no canvas com `IN 8 + 8 bits · OUT 8 bits`; as três alças anunciaram 8 bits e não houve `[role=alert]`. As duas entradas ficaram desconectadas de propósito, portanto a validação exibiu dois problemas acionáveis. AND, NAND e OR foram cobertos pelos testes automatizados, sem afirmação de smoke manual separado.
- O beta readiness continua bloqueado por credenciais/evidências externas Supabase; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Perfis sequenciais, memória e tri-state permanecem fora do escopo.

## [0.10.9] — 2026-08-25

### Adicionado

- Alias combinacional real `(8 Bits) 8-bit Adder` do catálogo DLS, com duas entradas de 8 bits, carry de entrada escalar, soma de 8 bits e carry de saída escalar.
- Reutilização controlada da topologia ripple-carry do `8-ADD`, preservando o contrato público `IN A 1-8`, `IN B 1-8`, `Carry IN`, `OUT` e `Carry OUT`.
- Integração do alias ao fluxo catálogo → IndexedDB → paleta de chips customizados → canvas, com larguras heterogêneas preservadas.

### Validação e limites

- Suíte completa: 70 arquivos e 536 testes aprovados; a nova fatia contém 8 testes focados, com estrutura ripple-carry, quatro casos vetoriais, portas 8/8/1, saídas 8/1, HDL e rejeição de assinatura incompatível.
- Typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local confirmou o card `(8 Bits) 8-bit Adder`, sua persistência na biblioteca e a instância no canvas com `IN 8 + 8 + 1 bits · OUT 8 + 1 bits`; as cinco alças anunciaram as larguras heterogêneas e não houve `[role=alert]`. As três entradas ficaram desconectadas de propósito, portanto a validação exibiu três problemas acionáveis.
- O beta readiness continua bloqueado por credenciais/evidências externas Supabase; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Perfis sequenciais, memória e tri-state permanecem fora do escopo.

## [0.10.8] — 2026-08-25

### Adicionado

- Perfil combinacional real `Full Adder - 8 Bits` do catálogo DLS, com três barramentos de entrada de 8 bits e duas saídas de 8 bits para soma e carry.
- Materialização explícita de oito somadores completos paralelos: três Splitters, 16 XOR, 16 AND, 8 OR e dois Combiners, preservando a convenção MSB → LSB.
- Integração do perfil ao fluxo catálogo → IndexedDB → paleta de chips customizados → canvas, com entradas `Carry IN`, `IN A` e `IN B` e saídas `BIT-8 Bits` e `Carry Out-8Bits`.

### Validação e limites

- Suíte completa: 70 arquivos e 528 testes aprovados; a nova fatia contém 8 testes focados, com estrutura, quatro casos vetoriais, portas locais, HDL e rejeição de assinatura incompatível.
- Typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local confirmou o card `Full Adder - 8 Bits`, sua persistência na biblioteca e a instância no canvas com `IN 8 + 8 + 8 bits · OUT 8 + 8 bits`; as cinco alças anunciaram 8 bits e não houve `[role=alert]`. As três entradas ficaram desconectadas de propósito, portanto a validação exibiu três problemas acionáveis.
- O beta readiness continua bloqueado por credenciais/evidências externas Supabase; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Perfis sequenciais, memória e tri-state permanecem fora do escopo.

## [0.10.7] — 2026-08-25

### Adicionado

- Perfil combinacional real `AND-3 8 bits` do catálogo DLS, com três barramentos de entrada de 8 bits e uma saída de 8 bits.
- Redução vetorial controlada de três entradas: três Splitters, dezesseis portas AND escalares em dois estágios e um Combiner, preservando a convenção MSB → LSB.
- Integração do perfil ao fluxo catálogo → IndexedDB → paleta de chips customizados → canvas, com entradas duplicadas normalizadas como `IN`, `IN_2` e `IN_3`.

### Validação e limites

- Suíte completa: 70 arquivos e 520 testes aprovados; a nova fatia contém 7 testes focados, com estrutura, casos vetoriais, portas locais, HDL e rejeição de assinatura incompatível.
- Typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local confirmou o card `AND-3 8 bits`, sua persistência na biblioteca e a instância no canvas com `IN 8 + 8 + 8 bits · OUT 8 bits`; as quatro alças anunciaram 8 bits e não houve `[role=alert]`. As três entradas ficaram desconectadas de propósito, portanto a validação exibiu três problemas acionáveis.
- O beta readiness continua bloqueado por credenciais/evidências externas Supabase; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Perfis sequenciais, memória e tri-state permanecem fora do escopo.

## [0.10.6] — 2026-08-25

### Adicionado

- Perfis combinacionais reais `8x2-AND`, `8x2-OR` e `8x2-XOR` do catálogo DLS, cada um com dois barramentos de 8 bits e uma saída de 8 bits.
- Cobertura estrutural com dois Splitters, oito portas escalares do operador correspondente e um Combiner, mantendo a convenção MSB → LSB.
- Integração dos três perfis ao fluxo catálogo → IndexedDB → canvas e normalização determinística das portas duplicadas `IN`/`IN_2` nos chips locais.

### Validação e limites

- Suíte completa: 70 arquivos e 513 testes aprovados; a suíte focada dos operadores vetoriais confirmou AND, OR e XOR com entradas `0xAA` e `0xCC`.
- Typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local confirmou o card `8x2-AND`, sua persistência na biblioteca e a peça no canvas com `IN 8 + 8 bits · OUT 8 bits`, sem alertas inesperados.
- O beta readiness continua bloqueado por credenciais/evidências externas Supabase; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Perfis sequenciais e memória permanecem fora do escopo.

## [0.10.5] — 2026-08-25

### Adicionado

- Perfil combinacional real `8-1AND` do catálogo DLS, com máscara de 1 bit aplicada a um barramento de 8 bits.
- Materialização explícita como um Splitter, oito portas AND escalares e um Combiner, preservando a convenção MSB → LSB.
- Integração do `8-1AND` ao fluxo catálogo → IndexedDB → canvas, com entrada escalar, entrada vetorial e saída vetorial dimensionadas individualmente.

### Validação e limites

- Suíte completa: 70 arquivos e 510 testes aprovados; a fatia 8-1AND cobre todos os 256 valores do barramento com máscara habilitada e desabilitada.
- Typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local confirmou o card 8-1AND, sua persistência na biblioteca e a peça no canvas com `IN 1 bit`, `IN_2 8 bits` e `OUT 8 bits`.
- O beta readiness continua bloqueado por credenciais/evidências externas Supabase; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Chips sequenciais e memória permanecem fora do escopo.

## [0.10.4] — 2026-08-25

### Adicionado

- Perfil combinacional real `8-ADD` do catálogo DLS, com oito somadores completos, dois barramentos de 8 bits, carry de entrada escalar e saída de carry escalar.
- Preservação da ordem pública do fixture `CARRY`, `IN`, `IN`: a biblioteca local expõe `CARRY`, `IN`, `IN_2`, com larguras 1, 8 e 8 bits.
- Integração do 8-ADD ao fluxo catálogo → IndexedDB → canvas, com cinco alças que anunciam as larguras individuais.

### Validação e limites

- Suíte completa: 70 arquivos e 505 testes aprovados; a fatia 8-ADD contém 8 testes focados, incluindo casos-limite de soma/carry, ordem dos pinos e catálogo real.
- Typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local confirmou o card 8-ADD, sua persistência na biblioteca e a peça no canvas com `CARRY 1 bit`, dois `IN 8 bits`, `OUT 8 bits` e `CARRY 1 bit`.
- O beta readiness continua bloqueado por credenciais/evidências externas Supabase; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Chips sequenciais e memória permanecem fora do escopo.

## [0.10.3] — 2026-08-25

### Adicionado

- Perfil combinacional real `EQUAL-4` do catálogo DLS, com dois barramentos de 4 bits, quatro XNOR e redução AND para uma saída escalar.
- Normalização determinística de portas DLS duplicadas: a interface `IN`, `IN` é exposta pelo chip customizado como `IN`, `IN_2`, preservando os dois IDs e suas larguras.
- Materialização e integração do comparador na biblioteca local e no canvas, mantendo a mesma política allowlist e sem executar JSON importado.

### Validação e limites

- Suíte completa: 70 arquivos e 497 testes aprovados; a fatia EQUAL-4 contém 8 testes focados, com validação, quatro casos de igualdade, portas, exportação e catálogo real.
- Typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- Smoke local confirmou catálogo → biblioteca IndexedDB → EQUAL-4 no canvas, com entradas 4/4 bits, saída 1 bit e zero alertas de interface.
- O beta readiness continua bloqueado por credenciais/evidências externas Supabase; `validate:plugin` continua bloqueado pela ausência do executável `claude` no sandbox. Chips sequenciais e memória permanecem fora do escopo.

## [0.10.2] — 2026-08-25

### Adicionado

- Adaptador seguro para perfis multi-bit combinacionais conhecidos do catálogo DLS: `4-ADD`, `AND-8 Bits`, `8x2-AND`, `NAND-8Bits`, `OR-8 Bits`, `8x2-OR`, `XOR - 8 BIT` e `8x2-XOR`.
- Materialização explícita em `CircuitDocument`: Splitter → portas escalares → Combiner para bancos vetoriais e ripple-carry de 4 bits para `4-ADD`, sem executar o JSON de origem nem transportar os 45 MB de definições para o navegador.
- `4-ADD` preserva as portas `4, 4, 1` bits de entrada e `4, 1` bits de saída, incluindo a semântica MSB → LSB e o carry.
- Biblioteca local e canvas identificam os modelos multi-bit prontos; handles do chip customizado anunciam as larguras individuais e a persistência continua no IndexedDB.

### Validação e limites

- Suíte completa: 70 arquivos e 489 testes aprovados; a nova suíte vetorial contém 10 testes, incluindo todas as 512 combinações do `4-ADD`, instanciação local e exportação Verilog/VHDL.
- Typecheck, lint, build do frontend, lib, MCP stdio/HTTP e plugin aprovados; MCP 16/16, MCP HTTP 18/18, acessibilidade 5/5, WASM isolation 5/5, Rust 2/2 e HDL 3/3.
- O gate beta readiness permanece bloqueado por credenciais/evidências externas Supabase ausentes; `validate:plugin` permanece bloqueado porque o executável `claude` não existe no sandbox. Esses bloqueios não afetam o caminho local-first.
- A implementação é deliberadamente allowlist: chips DLS sequenciais, memória, tri-state, conversores não cobertos e dependências arbitrárias continuam não materializáveis até existir contrato vetorial/temporal correspondente.

## [0.9.0-rc.18] — 2026-08-25

### Adicionado

- **Importação estrutural de chips do Digital Logic Sim.** `src/circuit/dlsImport.ts` lê a netlist de um chip do DLS — pinos, sub-chips e fios — e a transcreve para um `CircuitDocument`, com cada sub-chip virando uma instância do chip correspondente. A hierarquia que o autor montou continua navegável e editável aqui dentro; o NAND é a única folha nativa, porque o projeto constrói o próprio AND, OR, NOT e XOR a partir dele e trocá-los por portas nativas apagaria justamente o que ele construiu.
- Painel de importação na Biblioteca local do editor: o operador escolhe os arquivos da pasta `Chips`, a leitura acontece no navegador e nada sai da máquina.
- `importDlsChipProjects` no storage, com a biblioteca carregada uma vez e crescendo em memória — salvar chip a chip pelo caminho comum releria a tabela inteira a cada um, e com centenas de chips a importação vira O(n²) de leitura.
- `tests/dlsLibraryParity.test.ts`: confere o importador contra uma biblioteca inteira do DLS. Não roda por padrão — aponte `VERITAS_DLS_CHIPS` para a pasta `Chips` de um projeto.

### Corrigido

- **Os pinos de um chip customizado podiam trocar de lugar em silêncio.** O `buildCustomChipDefinition` ordenava as portas por ID e a elaboração as ordenava pela ordem do documento. Onde as duas discordavam, o sinal ligado na porta *k* chegava em outro pino — sem erro, sem aviso, só o valor errado. E discordar era fácil: os IDs do editor são `input-1`, `input-2`, …, e `"input-11"` vem *antes* de `"input-2"` na ordenação textual, então bastava acrescentar um pino depois do nono componente. `orderCustomChipPins` passa a ser a fonte única dessa ordem, e a validação, a interface e a elaboração agora dizem a mesma coisa. Um chip afetado que já estava salvo passa a se comportar como os rótulos da interface sempre prometeram.

### Validação e limites

- Suíte com 499 testes. Os três de ordem de pinos falham sem a correção e passam com ela — o de hierarquia só depois de quebrar a simetria entre os níveis, porque com a mesma permutação nos dois a troca se cancelava e o teste passava sobre o defeito.
- Sobre a biblioteca real do UMBRA LIMA ALFA: **775 dos 1121 chips** importados com estrutura completa, contra 388 que o caminho antigo alcançava por expressão booleana.
- **212 desses chips foram cruzados com as tabelas verdade que o `catalog.json` já trazia, com zero divergências.** São dois caminhos independentes — um simula o chip e destila a expressão, o outro transcreve a netlist e roda pelo simulador do Veritas — então um erro teria que estar nos dois, do mesmo jeito, no mesmo chip.
- No navegador, pelo caminho real do produto: nove arquivos do DLS escolhidos no painel, oito chips na biblioteca com os pinos certos e um recusado — o `Full Adder`, que tem dois fios no mesmo pino de saída no arquivo de origem, e cuja recusa nomeia o pino exato. Nenhum erro de console.
- **A importação não promete equivalência com o DLS**: ela transcreve a netlist, não confere comportamento. Para isso existe a comparação de equivalência, que roda depois sobre o chip já importado.
- Ficam de fora, com o motivo dito um a um: 35 chips com pino multi-bit (o Veritas ainda não liga barramento dentro de chip), 29 sem pinos de entrada, 6 que usam componentes do DLS que não existem aqui, 6 acima dos limites de 256 componentes ou 512 conexões, 2 com ciclo combinacional, 2 com defeito no próprio arquivo — e 267 que dependem de algum dos anteriores.

## [0.9.0-rc.17] — 2026-08-25

### Adicionado

- **Chips funcionam na simulação temporal.** `createDocumentRuntime` achata instâncias `custom-chip` antes de montar o netlist, reusando a elaboração que já serve à exportação HDL. Um registrador ou contador montado com chips agora roda por tiques.
- `customChips` propagado para o painel sequencial, o testbench e a comparação temporal (`customChipsA`/`customChipsB`, alinhado à equivalência).

### Corrigido

- O `Simulator` ignorava a ligação de um `input` marcado como fronteira interna de chip — sua regra era "só muda por setInput". O avaliador combinacional já seguia essa convenção; o simulador não. O efeito era **silencioso e errado**, não um erro: o chip rodava com a entrada em zero, e um inversor alimentado com 1 devolvia 1.

### Removido

- A guarda `sequential-custom-chip` do testbench, que existia só porque o runtime não expandia chips. O teste que documentava a limitação foi substituído por um que prova o oposto.

### Validação e limites

- Suíte com 483 testes, três novos no runtime: propagação de valor através do chip nos dois sentidos, preservação dos IDs de topo após o achatamento e recusa quando a definição não veio.
- O defeito do simulador só apareceu porque o teste verificava o valor propagado, e não apenas que a simulação não quebrava.
- `beta:mcp` 16 PASS, `beta:mcp:http` 18 PASS, `beta:accessibility` 5 PASS. No navegador, um registrador com chip simulou oito tiques sem erro de console.
- Chips continuam combinacionais; achatar preserva o comportamento porque não há estado dentro deles.
- O beta público continua bloqueado até a evidência real de RLS-001…RLS-022, RT-001…RT-005, mobile, onboarding externo e demais gates exigidos.

## [0.9.0-rc.16] — 2026-08-25

### Alterado

- **Chips customizados podem conter outros chips.** A restrição em `buildCustomChipDefinition` era resquício de antes do CHIP-002 e sobrevivia em três lugares: o domínio, um aviso do editor e o botão “Salvar como chip” desabilitado. O motor já recursava com detecção de ciclo e limite de profundidade; faltava deixar construir. É o loop do Digital Logic Sim — construir, empacotar, reusar — destravado.
- `createCustomChipProject` e `updateCustomChipProject` carregam a biblioteca local para validar hierarquia, sem mudar a API do storage.
- `normalizeCustomChipLibrary` (MCP) resolve os chips em ordem de dependência, com memoização e detecção de ciclo; antes falhava quando o pai vinha antes do filho no payload.

### Adicionado

- `assertNoCustomChipCycle`: recusa uma atualização que faria o chip conter a si mesmo, direta ou indiretamente.
- `assertCustomChipDepthWithinLimit`: recusa ao salvar a hierarquia que estouraria o limite ao simular, em vez de deixar o erro aparecer na primeira execução.

### Validação e limites

- Suíte com 480 testes; 10 deles cobrem a hierarquia, incluindo somador completo com dois meio somadores nas oito combinações, somador de dois bits em terceiro nível, elaboração HDL achatada, ciclo recusado e os dois lados do limite de profundidade.
- Um teste verifica que o guard de criação e o de avaliação concordam: o que é aceito ao salvar realmente roda.
- Verificação no navegador pelo caminho real do produto: com o meio somador na biblioteca e um somador completo válido no canvas, “Salvar como chip” ficou habilitado e salvou o chip aninhado, sem erro de console.
- Chips continuam combinacionais; o aninhamento não muda isso. Instâncias em casos sequenciais ainda dependem de CHIP-006.
- O beta público continua bloqueado até a evidência real de RLS-001…RLS-022, RT-001…RT-005, mobile, onboarding externo e demais gates exigidos.

## [0.9.0-rc.15] — 2026-08-25

### Adicionado

- Testbench declarativo (`runTestbench`): roda um documento `veritas-testbench` contra um circuito e devolve quais casos falharam, com saída, valor esperado e obtido. O teste é dado, não código — nenhuma expressão do usuário é avaliada.
- Casos combinacionais (`inputs` + `expect`) e sequenciais (`steps` com `set`/`ticks`/`expect`), com recusa explícita de casos que misturam os dois modos ou que não declaram nenhuma expectativa.
- Painel “Testes do circuito”, em que a tabela **é** o documento de teste: as colunas saem das portas do circuito escolhido.
- Ferramenta MCP `run_testbench`, com checks `MCP-TB-001`/`MCP-TB-002` no acceptance stdio.

### Alterado

- `collectPorts`, que estava duplicado em `equivalence.ts` e `differential.ts`, foi extraído para `src/circuit/portIdentity.ts`. A ordem canônica, a regra de rótulo-com-reserva-no-ID e a mensagem de rótulo duplicado passam a ter uma definição só; as duas fatias anteriores atravessaram o refactor sem alterar nenhum teste.

### Validação e limites

- Suíte com 470 testes, typecheck, lint, builds de frontend/MCP stdio/MCP HTTP/lib/plugin; `beta:mcp` 16 PASS, `beta:mcp:http` 18 PASS, `beta:accessibility` 5 PASS, `beta:rust` 2 PASS e `beta:wasm:isolation` 5 PASS, todos sem FAIL.
- O painel foi verificado no Chromium com um meio somador de vai-um errado: o caso que expõe o defeito reprovou e o que não expõe passou, sem erro de console.
- Passar num testbench cobre exatamente os casos escritos, e o relatório diz isso junto do resultado positivo. Prova sobre todo o espaço de entrada continua sendo `circuit_equivalence`.
- Casos sequenciais ainda não expandem instâncias `custom-chip`; existe um erro próprio (`sequential-custom-chip`) explicando o que fazer, em vez de um erro genérico do netlist.
- O beta público continua bloqueado até a evidência real de RLS-001…RLS-022, RT-001…RT-005, mobile, onboarding externo e demais gates exigidos.

## [0.9.0-rc.14] — 2026-08-25

### Adicionado

- Verificador de equivalência comportamental entre dois `CircuitDocument` combinacionais (`compareCircuitEquivalence`), com pareamento de portas por rótulo, ordem canônica e contraexemplo determinístico da primeira combinação divergente.
- Painel “Equivalência entre circuitos” sobre os circuitos salvos localmente, mostrando veredito, entradas do contraexemplo e o valor produzido por cada lado.
- Ferramenta MCP `circuit_equivalence`, com Markdown determinístico, bibliotecas `custom_chips_a`/`custom_chips_b` separadas e checks `MCP-EQ-001`/`MCP-EQ-002` no acceptance stdio.
- `docs/VERIFICATION.md` com o contrato do relatório, a política de exaustividade e os limites medidos.

- Comparação temporal entre dois circuitos (`compareCircuitTimelines`): roda a mesma sequência de entradas nos dois e aponta o primeiro tique divergente, cobrindo a classe sequencial (clock, DFF, TFF, delay) que a equivalência exaustiva recusa.
- Painel “Comparação temporal” com editor de roteiro sobre os circuitos salvos, e ferramenta MCP `circuit_differential` com checks `MCP-DIFF-001`/`MCP-DIFF-002` no acceptance stdio.
- Seletor de circuito extraído para `CircuitPicker`, compartilhado pelos dois painéis de verificação.

### Corrigido

- `scripts/mcpAcceptanceContract.d.mts` declarava apenas `MCP-001…MCP-006` enquanto o runner já usava dez cenários; a declaração voltou a espelhar o contrato real.

### Validação e limites

- Suíte com 447 testes, typecheck, lint, build do frontend, builds MCP stdio/HTTP, lib e plugin aprovados; `npm run beta:mcp` com 14 PASS, `npm run beta:mcp:http` com 18 PASS, `npm run beta:wasm:isolation` com 5 PASS e `npm run beta:accessibility` com 5 PASS, todos sem FAIL.
- Os dois painéis foram verificados no navegador (Chromium) nos dois desfechos cada — equivalente/divergente com contraexemplo, e idêntico/divergente com o primeiro tique — sem erro de console.
- A comparação temporal nunca afirma equivalência: o melhor veredito é “idêntico neste roteiro”, e tanto o MCP quanto o painel dizem em texto que concordar num roteiro não prova que não exista outro que separe os circuitos.
- A comparação é exaustiva por definição: acima de 12 bits de entrada por padrão (teto de 16) ela é **recusada** em vez de truncada, porque uma comparação parcial não prova equivalência. Circuitos com `clock`, `dff`, `tff` ou `delay` não são aceitos.
- Limites escolhidos por medição local: 12 bits ≈ 85 ms e 16 bits ≈ 776 ms na mesma máquina; são justificativa da escolha, não promessa de desempenho.
- O beta público continua bloqueado até a evidência real de RLS-001…RLS-022, RT-001…RT-005, mobile, onboarding externo e demais gates exigidos.

## [0.9.0-rc.13] — 2026-08-22

### Adicionado

- Matriz golden WASM-003 para netlists combinacionais uniformes de 1, 8, 32 e 64 bits, cobrindo constantes, overrides, portas AND/NAND/OR/NOR/XOR/XNOR/NOT e saídas.
- Runner experimental que compara bytes VNET/VRES, valores, saídas e ordem topológica entre o fixture independente e o módulo Rust/WASM.
- Hardening end-to-end da fronteira host/WASM para magic, versão, largura, truncamento, shape, referência, ciclo e capacidade inválidos, com retorno zero e códigos estáveis.

### Validação e limites

- WASM-003 passou localmente e no Quality do GitHub no commit `c91be1c`, com zero imports, capabilities `3` e quatro casos golden executados.
- A feature `wasm-netlist-abi` continua opt-in e não entra no build produtivo, no navegador, no MCP ou no plugin. O TypeScript continua como runtime produtivo e fallback local-first.
- O beta público continua bloqueado até a evidência real de RLS-001…RLS-022, RT-001…RT-005, mobile, onboarding externo e demais gates exigidos.

## [0.9.0-rc.12] — 2026-08-22

### Adicionado

- Contrato experimental VNET/VRES versionado para um subconjunto de netlists combinacionais uniformes de 1 a 64 bits, com payload little-endian, limites explícitos e códigos de erro estáveis.
- Adaptador TypeScript fail-closed e decoder Rust/WASM-002 com buffer linear opt-in; componentes sequenciais, `custom-chip`, wireless, múltiplas larguras e `CircuitDocument` permanecem fora da ponte.
- Gate `npm run beta:wasm:parity` integrado aos workflows Quality e Release, comparando bytes, valores e ordem topológica contra fixture golden independente.

### Validação e limites

- WASM-002 passou localmente e no Quality do GitHub com zero imports, capabilities `3`, payload VNET de 104 bytes, resultado VRES de 60 bytes e paridade confirmada; os números de build são observações da execução, não promessa de desempenho.
- A feature `wasm-netlist-abi` é opt-in e não entra no build produtivo, no navegador, no MCP ou no plugin. O TypeScript continua como runtime produtivo e fallback local-first.
- O beta público continua bloqueado até a evidência real de RLS-001…RLS-022, RT-001…RT-005, mobile, onboarding externo e demais gates exigidos.

## [0.9.0-rc.11] — 2026-08-22

### Adicionado

- Gate experimental WASM-001 (`npm run beta:wasm`) com compilação para `wasm32-unknown-unknown` usando Rust 1.75, ABI mínimo versionado e validação por API WASM nativa do Node.
- Teste determinístico do contrato WASM que aceita somente as duas funções ABI (`veritas_wasm_abi_version` e `veritas_wasm_capabilities`) e os metadados técnicos conhecidos do linker, rejeitando imports e exports desconhecidos.
- Relatório sanitizado local com tamanho bruto/gzip, imports, exports, cold start e 100 instanciações repetidas; artefatos continuam fora do Git e do bundle do navegador.

### Validação e limites

- WASM-001 passou localmente e no Quality do GitHub; o módulo não recebe documentos, tokens, rede ou IndexedDB, não expõe uma API pública de memória e não avalia netlists.
- O runtime produtivo continua em TypeScript, com fallback local-first preservado; nenhuma integração WASM no navegador, Web Worker, MCP ou plugin foi habilitada.
- O beta público continua bloqueado até a evidência real de RLS-001…RLS-022, RT-001…RT-005, mobile, onboarding externo e demais gates exigidos.

## [0.9.0-rc.10] — 2026-08-22

### Adicionado

- Benchmark comparativo controlado `npm run bench:compare`, com fixture compartilhado entre TypeScript e Rust, quatro larguras, aquecimento separado e saída/checksum independentes.
- Gate RUST-002 integrado aos workflows Quality e Release; divergência de saída ou checksum encerra a validação.

### Validação e limites

- RUST-002 passou em quatro cenários com paridade de saída; os tempos registrados são observações da mesma execução e não comprovam superioridade de desempenho entre runtimes.
- O avaliador TypeScript permanece no caminho produtivo e o núcleo Rust continua experimental, sem WASM, sem mudança no navegador e com fallback TypeScript preservado.
- O beta público continua bloqueado até a evidência real de RLS-001…RLS-022, RT-001…RT-005, mobile, onboarding externo e demais gates exigidos.

## [0.9.0-rc.9] — 2026-08-22

### Adicionado

- Núcleo experimental `engine-rs/` em Rust, sem dependências externas, para avaliação combinacional determinística com sinais de 1 a 64 bits.
- Contrato `Signal`, operadores AND/NAND/OR/NOR/XOR/XNOR/NOT, ordenação topológica estável, erros explícitos e fixture golden compartilhado com as primitivas vetoriais TypeScript.
- Acceptance `npm run beta:rust`, comandos `test:rust`/`bench:rust`, documentação de arquitetura e gate Rust nos workflows de qualidade e release.

### Limites e validação

- O motor TypeScript continua sendo o runtime de produção; Rust ainda não é carregado pelo navegador, não substitui MCP/HDL/IndexedDB e não habilita WASM automaticamente.
- `RUST-001` e `RUST-002` passam em modo offline; o benchmark é somente baseline local e não comprova superioridade de desempenho entre runtimes.
- A referência Digital Logic Sim foi analisada somente em leitura; nenhum código, asset ou binário foi copiado. O beta segue bloqueado por falta de evidência RLS/Realtime cross-user real.

## [0.9.0-rc.8] — 2026-08-22

### Segurança e validação

- MCP-015 rejeita no startup qualquer configuração em que o path do MCP coincida com `/.well-known/oauth-protected-resource`, preservando a separação entre o endpoint protegido e a rota de metadata local.
- Acceptance combinado MCP-011/MCP-013/MCP-014/MCP-015 com 18 checks PASS, além de testes do handler, typecheck e build HTTP; nenhuma rota OAuth pública, token estático ou deployment remoto foi habilitado.
- RLS-001…RLS-022 e RT-001…RT-005 reais continuam pendentes e bloqueiam o beta público.

## [0.9.0-rc.7] — 2026-08-22

### Alterado

- MCP-014 torna explícita a política CORS da metadata local: somente `GET, OPTIONS`, `Vary: Origin` e `POST` bloqueado; o endpoint `/mcp` mantém `POST, OPTIONS` e Bearer obrigatório.

### Segurança e validação

- A alteração é local-only, não cria rota nova, não emite tokens e não modifica o transporte stdio, schemas das ferramentas ou qualquer deployment remoto.
- Acceptance combinado MCP-011/MCP-013/MCP-014 com 17 checks PASS, além dos testes do handler, typecheck e build HTTP; RLS-001…RLS-022 e RT-001…RT-005 reais continuam pendentes e bloqueiam o beta público.

## [0.9.0-rc.6] — 2026-08-22

### Adicionado

- Rota local opt-in `/.well-known/oauth-protected-resource` integrada ao transporte HTTP do MCP para discovery controlada de Protected Resource Metadata.
- Configuração por `VERITAS_MCP_HTTP_RESOURCE`, `VERITAS_MCP_HTTP_AUTHORIZATION_SERVERS` e `VERITAS_MCP_HTTP_SCOPES`, com 404 por padrão e falha fechada para configuração parcial ou recurso remoto sem HTTPS.

### Segurança e validação

- A metadata exige Origin explicitamente permitida, não exige Bearer para a leitura de discovery, não emite tokens e não altera o Bearer obrigatório do endpoint `/mcp`.
- O stdio permanece preservado; nenhum endpoint OAuth público, provider, login, PKCE ou deployment remoto foi habilitado.
- Acceptance HTTP MCP-011 e MCP-013, com 14 checks PASS, além de regressões unitárias do contrato e do handler; RLS-001…RLS-022 e RT-001…RT-005 reais continuam pendentes e bloqueiam o beta público.

## [0.9.0-rc.5] — 2026-08-22

### Adicionado

- Contrato puro `buildProtectedResourceMetadata` para Protected Resource Metadata, sem descoberta, login, rede ou persistência.
- Normalização determinística de `resource`, `authorization_servers`, escopos e `bearer_methods_supported`, com HTTPS obrigatório fora de localhost.
- Rejeição controlada de credenciais, query strings, fragmentos, escopos inválidos/duplicados e authorization servers ausentes.

### Segurança e validação

- O MCP-012 não publica rota `.well-known`, não emite tokens e não altera o transporte stdio ou o HTTP local do MCP-011.
- Foram adicionados cinco testes unitários positivos/negativos; os gates MCP-001…MCP-010 e MCP-011 HTTP continuam sendo executados como regressão.
- RLS-001…RLS-022 e RT-001…RT-005 reais continuam pendentes e bloqueiam o beta público.

## [0.9.0-rc.4] — 2026-08-22

### Adicionado

- Primeira camada do MCP-011: fábrica comum de ferramentas, entrypoint stdio preservado e transporte HTTP local stateless baseado na SDK oficial.
- Build separado `build:mcp:http`, comando `mcp:http` e binário `veritas-mcp-http-server` para execução controlada em localhost.
- Aceitação HTTP com Bearer obrigatório, allowlist de Origin, headers de protocolo, HeaderMismatch, limite de payload, rejeição de GET e equivalência com os goldens stdio.

### Segurança e documentação

- O transporte HTTP exige configuração por ambiente, faz bind em `127.0.0.1` por padrão e não publica HTTPS, não acessa Supabase e não coloca tokens no frontend.
- Quality e release workflows agora executam o build/acceptance HTTP além da matriz MCP stdio MCP-001…MCP-010.
- O transporte remoto OAuth continua fora desta RC até haver provedor aprovado, metadata de recurso, audience/resource, PKCE, HTTPS, rate limiting, threat model e smoke externo.

## [0.9.0-rc.3] — 2026-08-22

### Corrigido

- Quality workflow agora baixa o histórico completo e as tags Git necessárias para validar rollback de forma determinística.
- O baseline do rollback foi atualizado para a última RC publicada, evitando comparar uma candidata com uma tag futura.

### Validação

- Quality workflow da main aprovado após a correção: testes, typecheck, lint, build frontend, build MCP, MCP-001…MCP-010, HDL, acessibilidade, rollback, onboarding e smoke PWA local.
- A RC-2 permanece imutável e continua disponível para reprodução; esta versão é uma nova candidata de correção, não uma reescrita.
- RLS-001…RLS-022 e RT-001…RT-005 reais continuam pendentes e bloqueiam o beta público.

## [0.9.0-rc.2] — 2026-08-22

### Adicionado

- Ferramenta MCP local `circuit_vector_truth_table` para tabelas verdade determinísticas de circuitos com barramentos.
- Limite explícito de até 12 bits de entrada e até 4096 linhas geradas, com suporte a truncamento controlado, `output_id` e definições portáteis de `custom_chips`.
- Golden MCP-010 integrado ao gate stdio, elevando a superfície validada para 14 ferramentas e MCP-001…MCP-010.

### Documentação e validação

- README do MCP, roadmap e runbook de aceitação atualizados com payload vetorial e limites operacionais.
- 382 testes aprovados em 59 arquivos; typecheck, lint, build frontend/PWA, build MCP, build do plugin, verificações de sintaxe e smoke PWA local aprovados.
- A candidata continua sendo uma RC: RLS-001…RLS-022 e RT-001…RT-005 reais permanecem pendentes e bloqueiam o beta público.

## [0.9.0-rc.1] — 2026-08-21

### Adicionado

- Workspace sequencial observável com `Step`, `Run`/`Continue`, `Reset`, Watch e timeline limitada para documentos de algoritmo e circuitos.
- Componentes sequenciais visuais `clock`, `dff`, `tff` e `delay`, com feedback permitido quando atravessa estado e rejeição de ciclos combinacionais puros.
- Adaptador `CircuitDocument` → `Simulator` para simular documentos sequenciais arbitrários desenhados no canvas.
- Checkpoint local-first do runtime temporal em `localStorage`, com restauração defensiva e degradação automática para memória quando o storage não está disponível.
- Configuração editável de período de clock entre 1 e 64 tiques, persistida junto do checkpoint e sincronizada opcionalmente por Realtime.
- Broadcast privado de `runtime_state` com estado do simulador, entradas, períodos, snapshot, timeline, hash, `baseVersion`, autor e timestamp.
- Política de frescor para ofertas temporais: expiração após 30 segundos, tolerância de até 5 segundos no futuro e rejeição de timestamps inválidos.
- Presence temporal, métricas locais de colaboração e histórico em memória dos últimos 12 eventos genéricos.
- Revalidação da versão-base no momento da aplicação manual, bloqueio visual de ofertas obsoletas e confirmação de sucesso/falha sem substituição silenciosa do runtime local.

### Alterado

- O editor temporal mantém documento estrutural, configuração de clock e estado de execução como fontes de verdade separadas.
- A aplicação de um estado remoto agora exige confirmação explícita e uma `baseVersion` ainda compatível com o documento atual.
- Falhas de observabilidade e de colaboração continuam best-effort; o runtime local segue executável sem Supabase ou Realtime.
- O pipeline de qualidade valida a suíte, typecheck, lint, build frontend, build MCP e smoke PWA antes da promoção da candidata.

### Limitações conhecidas

- A colaboração temporal usa Broadcast/Presence transitórios; o histórico remoto versionado continua sendo a fonte de verdade do documento.
- O runtime temporal ainda é escalar e não oferece simulação sequencial vetorial, memória ou merge CRDT.
- O MCP remoto por HTTP autenticado permanece no roadmap; o perfil publicado continua baseado em stdio local.
- Tabela verdade, análise de IA e exportação HDL continuam bloqueadas para documentos com estado sequencial.
- A candidata ainda requer validação operacional real de dois usuários, toolchains HDL, acessibilidade/mobile e rollback antes do beta definitivo.

### Validação

- 256 testes aprovados em 31 arquivos.
- Typecheck frontend e MCP sem erros.
- Lint sem warnings ou erros.
- Build frontend/PWA e build MCP aprovados.
- Smoke PWA remoto aprovado em `https://veritas-opal-seven.vercel.app`.
- `git diff --check` aprovado.

### Próximos passos

- Executar os gates RC no workflow do GitHub e publicar a release `v0.9.0-rc.1`.
- Validar RLS, isolamento Realtime, toolchains HDL, acessibilidade/mobile e rollback em ambiente controlado.
- Continuar o ciclo v0.9.0 com os próximos requisitos sequenciais antes de promover uma versão estável.

## [0.8.0-rc.1] — 2026-08-15

### Adicionado

- Fundação imutável `BitVector` para sinais de 1 a 64 bits, com literais binários e hexadecimais, conversão para `bigint`, operações AND/OR/XOR/NOT e splitter/combiner.
- Campo opcional `options.width` no modelo de componentes, preservado no editor, IndexedDB e snapshots Realtime.
- Validação defensiva de largura, incluindo rejeição de overflow, largura inválida, conexão entre larguras incompatíveis e payload remoto malformado.
- API `evaluateCircuitVectors()` para avaliação combinacional bitwise com entradas `BitVector`, `bigint`, número ou literal binário/hexadecimal.
- Tabela verdade vetorial limitada por número total de bits, com colunas dimensionadas, truncamento determinístico e bloqueio acima de 12 bits de entrada por padrão.
- Seletor visual de largura para novos componentes, preview binário em entradas/saídas e seleção acessível de linhas da tabela vetorial para iluminar o canvas.
- Exportação vetorial Verilog e VHDL com portas, wires/sinais dimensionados e constantes vetoriais seguras.
- Histórico local de undo/redo no editor, atalhos `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` e `Ctrl/Cmd+Y`.
- Colaboração ROOM-001 com salas nomeadas, `baseVersion`, conflitos explícitos e isolamento multi-room.

### Alterado

- A API booleana `evaluateCircuit()` e a tabela verdade clássica permanecem estritamente escalares para preservar compatibilidade com documentos existentes.
- A análise de IA continua desabilitada para circuitos multi-bit até que o contexto vetorial e o contrato de otimização sejam finalizados.
- O smoke test de release valida homepage, manifesto PWA e service worker em Preview ou Production.
- O pipeline GitHub Actions executa 226 testes, typecheck, lint, build frontend, build MCP e smoke PWA antes de cada promoção.

### Limitações conhecidas

- O limite padrão da tabela verdade vetorial é de 12 bits totais de entrada, equivalente a no máximo 4.096 combinações.
- Presença e Broadcast Realtime continuam transitórios; o histórico remoto versionado permanece a fonte de verdade.
- O MCP remoto por HTTP autenticado ainda é roadmap; o perfil publicado continua baseado em stdio local.
- A candidata não promete simulação sequencial vetorial, memória, ALU ou merge CRDT.

### Validação

- 226 testes aprovados em 25 arquivos.
- Typecheck frontend e MCP sem erros.
- Lint sem warnings ou erros.
- Build frontend/PWA e build MCP aprovados.
- Smoke PWA remoto aprovado no workflow `Veritas quality`.

### Próximos passos

- Publicar manualmente `v0.8.0-rc.1` pelo workflow **Actions → Veritas release → Run workflow**, usando `prerelease=true`.
- Executar smoke contra a URL candidata e validar RLS, Realtime, exportadores HDL em toolchains de referência e rollback.
- Iniciar o planejamento v0.9.0 para o workspace sequencial visual.
