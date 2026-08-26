# Veritas — Plano executável do produto

> Este documento é a fonte de verdade do roadmap do Veritas. O arquivo [`issue.md`](../issue.md) continua preservado como registro de descoberta e ideias, mas não deve ser interpretado como uma fila linear de implementação.

## 1. Estado atual

A versão de referência da implementação local é a **Release 0.12.0**, na branch `feature/chip-hierarchy-v1`. O projeto possui um motor lógico reutilizável, interface React, tabela verdade virtualizada, visualização de circuito derivada da expressão, projetos locais, PWA, simplificação, mapas de Karnaugh, formas normais, simulação sequencial, editor visual, barramentos, composição hierárquica, allowlist DLS combinacional e servidor MCP. O shell desktop atual é a prévia independente `desktop-v0.1.0-alpha.1`; ele tem builds nativos publicados, mas ainda não tem runtime interativo Windows/macOS verificado.

| Área | Situação real | Evidência no repositório |
| --- | --- | --- |
| Motor lógico combinacional | Entregue | `src/engine/` |
| Interface da calculadora | Entregue | `src/App.tsx` e `src/components/` |
| Circuito derivado da expressão | Entregue | `src/circuit/` |
| Persistência local e `.veritas` | Entregue | `src/storage/` |
| PWA offline-first | Entregue | `vite.config.ts` e `vite-plugin-pwa` |
| Karnaugh, simplificação e formas normais | Entregue | `src/engine/` |
| Simulação sequencial de base | Entregue no motor; edição visual ainda não | `src/simulation/` |
| MCP para uso headless por IAs | Entregue | `mcp/` e `plugins/veritas-logic/` |
| Editor visual combinacional | Entregue em prévia | `src/components/CircuitEditor.tsx` e `src/circuit/` |
| Tabela verdade e persistência local | Entregue | `src/circuit/truthTable.ts`, `src/storage/` e testes Vitest |
| Autenticação, sync e histórico em nuvem | Entregue | `src/auth/`, `src/cloud/`, migrações Supabase e `docs/CLOUD-HISTORY.md` |
| Colaboração Realtime | Entregue em prévia | Broadcast, Presence, convite por papel e canvas visualizador |
| Exportação Verilog/VHDL | Entregue em prévia | `src/circuit/export.ts` e testes determinísticos |
| Monitoramento de IA | Entregue em prévia | `veritas_ai_metrics`, Realtime, cliente e painel |
| Barramentos multi-bit | Entregue em prévia | BitVector, Splitter/Combiner, avaliação vetorial e exportação HDL dimensionada |
| Chips customizados hierárquicos | Entregue em prévia | Composição local, expansão com limite e ciclo recusado |
| Aplicativo desktop Tauri/Rust | Prévia técnica `desktop-v0.1.0-alpha.1` | Build Linux e inicialização controlada local; Windows/macOS têm build nativo publicado, mas runtime interativo **NOT VERIFIED** |
| 3D, PCB, impressão e 250 subagentes | Visão de longo prazo | Não fazem parte do próximo ciclo |

## 2. Decisões de produto

O Veritas será construído primeiro como uma ferramenta **local-first, client-side e offline-first** para estudar, projetar e validar circuitos digitais. A mesma engine TypeScript continuará sendo usada pela interface web, pelo importador de chips e pelo servidor MCP, evitando implementações paralelas que possam divergir.

A calculadora de expressões continua sendo uma experiência de entrada rápida. O próximo salto do produto não é adicionar mais painéis à tela atual, mas permitir que o usuário **edite o circuito visualmente**, simule esse circuito e converta o resultado para uma expressão ou tabela verdade quando isso for matematicamente possível.

Recursos de nuvem, colaboração, agentes em larga escala, renderização 3D e fabricação física continuam sendo linhas posteriores. O desktop nativo já entrou como shell Tauri leve, mas só poderá avançar de alpha para beta/estável após QA nativo, métricas, assinatura e critérios de promoção explícitos. Todas as fases preservam o núcleo local-first/offline-first/privacy-first e a fronteira de que IA propõe, valida, mostra preview, aguarda confirmação e só então aplica.

## 3. Roadmap por releases

| Release | Objetivo | Entregas incluídas | Critério de saída |
| --- | --- | --- | --- |
| **v0.7.0** | Editor visual mínimo viável | Canvas editável; entradas, constantes, saídas e portas AND/OR/NOT/XOR; criação e remoção de conexões; avaliação combinacional; mensagens de erro; exportação/importação de circuito | Um usuário consegue criar um circuito simples sem digitar uma expressão e validar sua tabela verdade |
| **v0.7.1** | Usabilidade e confiabilidade do editor | Seleção, exclusão, atalhos, desfazer/refazer, layout inicial, validação de ciclos combinacionais, testes de interação e persistência do novo formato | O editor é utilizável em projetos pequenos e não perde dados em operações comuns |
| **v0.7.2** | Integrações colaborativas e industriais | Colaboração Realtime privada com Presence/Broadcast, convite editor/visualizador, histórico remoto, exportação Verilog/VHDL, Edge Function autenticada e painel de métricas de IA | Usuários autenticados compartilham um circuito com papéis explícitos, exportam um netlist válido e acompanham telemetria sem expor dados de terceiros |
| **v0.8.0** | Barramentos multi-bit | Largura explícita de sinal; operações bitwise; displays binário/hexadecimal; splitter/combiner; limites de largura e testes de compatibilidade | Um circuito de 8 bits consegue ser criado, simulado, salvo e reaberto com resultado determinístico |
| **v0.9.0** | Workspace sequencial | Edição visual de clock, DFF/TFF, delay, contadores e observação de ticks; pausa, avanço manual e reset | Um contador e um circuito com feedback podem ser simulados sem congelar a interface |
| **v0.10.0** | Abstração e chips customizados | Pinos de entrada/saída; criação de subcircuito; biblioteca local de chips; execução hierárquica com limites de profundidade | Um subcircuito salvo pode ser reutilizado como componente em outro projeto |
| **v0.10.1** | Barramentos visuais particionáveis | Splitter/Combiner, partições editáveis, avaliação vetorial multi-saída e persistência reversível | Um barramento pode ser dividido, recombinado, salvo e reaberto |
| **v0.10.2** | Chips multi-bit combinacionais DLS | Allowlist estrutural de `4-ADD` e bancos AND/NAND/OR/XOR de 8 bits, biblioteca local e portas heterogêneas | Um chip multi-bit suportado pode ser importado, reutilizado, avaliado e exportado localmente |
| **v0.10.3** | Comparador multi-bit DLS | `EQUAL-4` com dois barramentos de 4 bits, XNOR, redução AND, portas determinísticas e integração local | Um comparador multi-bit suportado pode ser importado, reutilizado, avaliado e exportado localmente |
| **v0.10.4** | Somador multi-bit DLS | `8-ADD` com ripple-carry, carry de entrada/saída e ordem de portas preservada | Um somador de 8 bits suportado pode ser importado, reutilizado, avaliado e exportado localmente |
| **v0.10.5** | Máscara multi-bit DLS | `8-1AND` com máscara escalar, barramento de 8 bits, oito AND e integração local | Uma máscara vetorial suportada pode ser importada, reutilizada, avaliada e exportada localmente |
| **v0.10.6** | Operadores binários de barramento DLS | `8x2-AND`, `8x2-OR` e `8x2-XOR`, com dois barramentos de 8 bits e saída vetorial | Operadores binários suportados podem ser importados, reutilizados, avaliados e exportados localmente |
| **v0.10.7** | AND-3 vetorial DLS | `AND-3 8 bits`, com três barramentos de 8 bits, redução em dois estágios e integração local | Um AND de três entradas suportado pode ser importado, reutilizado, avaliado e exportado localmente |
| **v0.10.8** | Full Adder vetorial DLS | `Full Adder - 8 Bits`, com três barramentos de entrada, soma e carry vetoriais e integração local | Um somador completo paralelo de 8 bits suportado pode ser importado, reutilizado, avaliado e exportado localmente |
| **v0.10.9** | Alias ripple-carry DLS | `(8 Bits) 8-bit Adder`, com entradas 8/8/1, saídas 8/1 e ordem pública preservada | Um alias real de somador ripple-carry suportado pode ser importado, reutilizado, avaliado e exportado localmente |
| **v0.11.0** | Bancos base de barramento DLS | `AND-8 Bits`, `NAND-8Bits`, `OR-8 Bits` e `XOR - 8 BIT`, com assinaturas diretas e hierárquicas confirmadas | Os quatro bancos reais de 8 bits podem ser importados, reutilizados, avaliados e exportados localmente |
| **v0.11.1** | Multiplexador vetorial DLS | `1-8MUX`, com seleção escalar, duas entradas de 8 bits e saída de 8 bits, sem tri-state | Um multiplexador vetorial combinacional real pode ser importado, reutilizado, avaliado e exportado localmente |
| **v0.11.2** | Inversor vetorial DLS | `NOT-8 Bits`, com uma entrada e uma saída de 8 bits, usando `NAND-8Bits` hierárquico | Um inversor vetorial combinacional real pode ser importado, reutilizado, avaliado e exportado localmente |
| **v0.11.3** | Negação condicional DLS | `NEGATE-8`, com entrada de dados de 8 bits, controle escalar e saída de 8 bits, usando oito XOR | Uma negação condicional vetorial real pode ser importada, reutilizada, avaliada e exportada localmente |
| **v0.11.4** | Roteador misto de barramentos DLS | `16 para 8 e 4 bits`, com 16 entradas escalares, dez saídas, AND vetorial e divisão `[4,4]` | Um roteador combinacional real pode ser importado, reutilizado, avaliado e exportado localmente sem executar JSON DLS |
| **v0.11.5** | Expansor vetorial DLS | `ZEXT-4-8`, com quatro entradas escalares, uma constante `0`, Combiner de oito partes e saída de 8 bits | Um expansor combinacional real pode ser importado, reutilizado, avaliado e exportado localmente sem reduzir a saída a oito portas escalares |
| **v0.11.6** | Expansor de sinal vetorial DLS | `SEXT-4-8`, com quatro entradas escalares, fan-out do bit de sinal e saída de 8 bits | Um expansor de sinal combinacional real pode ser importado, reutilizado, avaliado e exportado localmente sem reduzir a saída a oito portas escalares |
| **v0.11.7** | Expansor vetorial de 16 bits DLS | `ZEXT-4-16`, com quatro entradas escalares, uma constante `0`, Combiner de 16 partes e saída de 16 bits | Um expansor combinacional real de 16 bits pode ser importado, reutilizado, avaliado e exportado localmente sem reduzir a saída a portas escalares |
| **v0.11.8** | Expansor de sinal vetorial de 16 bits DLS | `SEXT-4-16`, com quatro entradas escalares, fan-out de `A3`, Combiner de 16 partes e saída de 16 bits | Um expansor de sinal combinacional real de 16 bits pode ser importado, reutilizado, avaliado e exportado localmente sem reduzir a saída a portas escalares |
| **v0.11.9** | Reversor escalar DLS | `BITREV-4`, com quatro entradas, quatro saídas e conexões diretas em ordem invertida | Um reversor combinacional real pode ser importado, reutilizado, avaliado e exportado localmente sem executar JSON DLS |
| **v0.12.0** | Reversor escalar DLS | `BITREV-8`, com oito entradas, oito saídas e conexões diretas em ordem invertida | Um reversor combinacional real de oito bits pode ser importado, reutilizado, avaliado e exportado localmente sem executar JSON DLS |
| **v1.0.0** | Plataforma estável para pessoas e IAs | API de contexto do canvas; operações MCP de leitura e simulação; plano de mudanças; dry-run; logs; documentação de integração | Uma IA consegue consultar e propor alterações sem editar silenciosamente o projeto |
| **v1.x** | Expansão controlada | Barramentos, chips customizados, desktop Tauri/Rust, agentes de fundo e recursos 3D | Cada iniciativa tem caso de uso validado, orçamento técnico e modelo de segurança definido |
| **desktop 0.1.x-alpha** | Shell desktop leve | Tauri 2 sobre o build Vite/React, assets embutidos e execução local em Windows, macOS e Linux | O shell compila no Linux; o workflow prepara `.exe` NSIS, `.app`/`.dmg` e `.deb`/`.AppImage` em runners nativos |
| **desktop 0.5.0** | Início dos testes do aplicativo | Matriz de instalação, offline, IndexedDB, simulação, importação/exportação e remoção nos três sistemas | Os testes públicos começam somente depois de checklist repetível e artefatos por plataforma |
| **desktop 1.0.0** | Promoção estável | Regressão completa, atualização, acessibilidade, desempenho, assinatura e segurança de distribuição | Só é criada com estabilidade comprovada em todos os alvos suportados e sem bloqueios críticos abertos |

### Trajetória mestre de maturidade — desktop 0.5.0 até Veritas 2.5.0

A tabela abaixo materializa o alvo ampliado sem reclassificar funcionalidades de prévia como estabilidade. O núcleo atual já contém várias capacidades dos marcos históricos; o trabalho futuro é endurecer contratos, regressões, desempenho, distribuição e experiência multiplataforma. Cada marco só fecha com código necessário, testes, documentação, commit, tag, release e relatório quando houver uma mudança publicável.

| Marco | Foco | Estado real e escopo disciplinado | Gate de saída |
| --- | --- | --- | --- |
| **desktop 0.5.0** | Início formal de QA do produto | Planejado; a prévia `0.1.0-alpha.1` já fornece o shell e os pacotes, mas ainda faltam smoke nativo interativo e instalação/remoção em Windows/macOS | Matriz repetível Windows/macOS/Linux para instalação, inicialização offline, editor, IndexedDB, simulação, import/export, acessibilidade, atualização, encerramento e remoção; classificar cada item como `BUILD VERIFIED`, `RUNTIME VERIFIED`, `SMOKE VERIFIED` ou `NOT VERIFIED` |
| **v0.6.0** | Fortalecimento da simulação sequencial | Base de clock, delay, DFF, TFF, reset, Step/Run e timeline já existe; JK/SR, waveform e hardening de feedback permanecem trabalho planejado | Casos fundamentais determinísticos, limites de ticks, ausência de loops de UI, comparação temporal e regressão em cada release |
| **v0.7.0** | Maturidade do editor | Editor combinacional, seleção, undo/redo, conexão, layout e persistência já estão em prévia; multi-seleção, clipboard e ergonomia multiplataforma ainda exigem cobertura de produto | Operações drag/drop, seleção, conexão/desconexão, snap, zoom/pan, undo/redo, copy/paste, duplicate, delete, alinhamento e auto-layout cobertas por testes e smoke visual |
| **v0.8.0** | Multi-bit completo e seguro | BitVector, larguras, Splitter/Combiner, avaliação vetorial, HDL e allowlist DLS já existem em prévia; cobertura ampla, limites e performance continuam sendo endurecidos | 1/2/4/8/16/32/64 bits, validação de largura, binário/hexadecimal, compatibilidade de documentos, regressão vetorial e nenhum truncamento silencioso |
| **v0.9.0** | Workspace sequencial | Workspace visual, Watch, Step/Run/Reset, timeline e checkpoints existem; waveform, componentes adicionais e QA de persistência/colaboração precisam fechar | Roteiros temporais determinísticos, feedback seguro, restauração validada, isolamento entre documentos e nenhuma aplicação remota silenciosa |
| **v1.0.0** | Primeira estabilidade do produto | Não iniciada como release estável; a regra é estabilidade acima de velocidade e uso de RCs se necessário | Core, engine, editor, simulator, storage, import/export, Windows, macOS, Linux, testes, CI, performance, documentação, zero P0 e zero P1 conhecidos; atualização, remoção, assinatura e offline verificados |
| **v1.1.0** | Portabilidade de projetos e migrações | Planejado; consolidar versões do formato `.veritas`, diagnósticos de migração e compatibilidade entre web/PWA/desktop | Fixtures versionados, migração explícita ou rejeição clara, round-trip e rollback sem perda de dados |
| **v1.2.0** | HDL e interoperabilidade controladas | Exportação Verilog/VHDL existe em prévia; importação e casos de incompatibilidade ainda devem ser especificados, não inferidos | Golden files HDL, parser/validator de entrada quando contratado, mensagens acionáveis e equivalência ou divergência demonstrável |
| **v1.3.0** | Testbench e assertions | Testbench declarativo já existe como base; asserções sobre sinais dependem de contrato formal e reuso do parser, nunca `eval`/`Function` | Casos PASS/FAIL, `assert ALWAYS/NEVER` com limites, contraexemplos, snapshots e regressão bloqueante |
| **v1.4.0** | Performance e limites reais | BENCH-001 adicionou baseline determinística real para 10 e 100 gates no runtime TypeScript; 500/1000/5000 permanecem não suportados pelo limite atual de 256 nós/512 conexões; startup, desktop e renderização continuam planejados | Tempo, RSS, startup, tamanho de download/instalação, tempo de simulação e renderização medidos por plataforma, com comparação entre releases e investigação de regressões |
| **v1.5.0** | Acessibilidade e experiência educacional | Cobertura inicial existe; ampliar teclado, foco, mensagens, tutoriais e exemplos didáticos | Testes automatizados e smoke de teclado/leitor, canvas compreensível, limites explicados e fluxos para estudantes sem conta |
| **v1.6.0** | Atualização e distribuição segura | Pipeline nativo e manifesto/checksum existem; assinatura Authenticode, assinatura Apple/notarização e atualização runtime ainda não verificadas | Instalação, atualização, preservação de projetos, rollback e desinstalação nativos, com credenciais fora do repositório |
| **v1.7.0** | Colaboração e sincronização opt-in | Supabase/Realtime existem como caminhos opcionais; conflitos, privacidade, offline e recuperação precisam de auditoria contínua | Local-first intacto, sincronização explícita, conflitos visíveis, RLS/roles verificados e nenhum dado enviado sem ação do usuário |
| **v1.8.0** | IA controlada | Propostas e validação conservadoras já existem em partes; contratos de intenção, preview, confirmação, logs e rollback devem ser uniformizados | Nenhuma alteração silenciosa, schema validado, diff mostrado, confirmação explícita e fallback local seguro |
| **v1.9.0** | Pré-2.0 hardening | Planejado; fechar contratos públicos, telemetria opt-in, compatibilidade e inventário de dependências antes da mudança arquitetural | Auditoria de dependências, API/formatos documentados, regressão completa e decisão explícita de entrada em 2.0 |
| **v2.0.0** | Nova geração arquitetural | Não iniciada; antes dela devem existir `docs/V2_ARCHITECTURE.md`, `docs/V2_MIGRATION.md` e `docs/V2_MASTER_PLAN.md` aprovados no repositório | Engine, simulator, storage, plugins, verification, AI contracts, desktop e migration system definidos, versionados e migráveis sem quebra silenciosa |
| **v2.1.0** | Modularidade | Planejado; separar Core, Engine, Circuit, Simulator, Storage, Renderer, HDL, Verification, AI, Plugins e Desktop evitando dependências circulares | Boundaries verificáveis, testes por módulo e nenhum acoplamento circular introduzido |
| **v2.2.0** | Plugins seguros | Planejado; gates, chips, exporters, analyzers e visualizations por contratos declarativos | Manifesto/permissions, sandbox ou capability boundary adequada, validação, versão e rejeição de execução arbitrária |
| **v2.3.0** | Workspace profissional | Planejado; tabs, project explorer, hierarchy, component browser, inspector, command palette, waveform, simulation e verification panels | Projetos grandes navegáveis, ações reversíveis, desempenho medido e persistência compatível |
| **v2.4.0** | Verificação automatizada | Planejado; testbench, assertions, regression, equivalence, snapshots e benchmarks como fluxo de produto | Testbench reproduzível com PASS/FAIL, contraexemplo, snapshot, benchmark e release bloqueada quando houver divergência |
| **v2.5.0** | Objetivo desta fase | Não é uma data nem uma promessa antecipada; é o produto final desta trajetória | Engine/editor/simulator estáveis; lógica combinacional/sequencial; multi-bit; chips customizados; verification; testbench; HDL; projetos; plugins; IA controlada; desktop Windows/macOS/Linux; performance, segurança, documentação, CI/CD e releases reais |

### Regras de release e classificação de evidência

Uma release oficial deve ter mudança intencional, commits rastreáveis, testes e gates (`lint`, `typecheck`, `test`, `build`), tag, GitHub Release, changelog, artefatos e relatório. Alpha, beta e RC são válidos quando o marco ainda não é estável; CI verde não promove automaticamente a versão. Para cada asset, o manifesto deve registrar `filename`, `platform`, `architecture`, `size`, `sha256`, `commit` e `version`.

`BUILD VERIFIED` significa que o runner nativo produziu e validou o artefato. `RUNTIME VERIFIED` exige executar o aplicativo nesse sistema; `SMOKE VERIFIED` exige concluir o roteiro funcional definido. O sandbox Linux não pode converter um build Windows/macOS em validação de runtime. A ausência de hardware nativo é um bloqueio de evidência, não uma licença para afirmar sucesso.

### Implementação QA-001 — métricas e regressão cross-runtime — 2026-08-25

O medidor desktop foi refatorado para expor helpers determinísticos, separar a coleta da execução CLI e manter `NOT VERIFIED` explícito para binário ausente, memória de simulação e installed size. Os testes cobrem parsing de `VmRSS`, tamanho de arquivos regulares, ausência de binário e geração local de JSON/Markdown sem rede. `npm run desktop:metrics` foi executado novamente no Linux para atualizar a linha de base observada.

A suíte permanente `tests/regression/cross-runtime.test.ts` compara `buildTruthTable(parse(expression))` com `createDocumentRuntime()`/`Simulator` para todas as combinações das portas AND, NAND, OR, NOR, XOR, XNOR e NOT, além de meio somador, somador completo e multiplexador 2:1. São 12 casos de circuito e 23 testes novos no conjunto de QA, incluindo métricas, manifesto e a ponte sequencial UI→Simulator; uma divergência ou não-estabilização falha o teste, portanto o gate de release não pode prosseguir. Os fixtures são `CircuitDocument` declarativos e não executam JSON DLS, código importado ou uma linguagem de expressões. O gerador `desktop-release-manifest.mjs` também ganhou dois testes de integração: um verifica determinismo, ordenação e hashes dos cinco assets allowlisted em diretórios aninhados; o outro comprova rejeição fail-closed de arquivo inesperado.

A publicação quality-gated `desktop-v0.1.0-alpha.1` também executou um smoke nativo Windows: instalação silenciosa em diretório temporário, localização do binário, startup por oito segundos, existência de atalho e desinstalação. Esses cinco pontos agora têm evidência `SMOKE VERIFIED` no runner Windows; editor, persistência, simulação, offline, atualização e encerramento normal continuam fora da evidência disponível.

O painel de testbench deixou de ser apenas combinacional: agora permite criar casos sequenciais, editar passos, alternar entradas entre `0`, `1` e `mantém`, definir ticks e conferir expectativas por saída. A transformação continua declarativa e reutiliza `runTestbench`; `tests/regression/sequential-testbench.test.ts` prova a ponte UI→Simulator com um registrador. A verificação visual interativa do painel não foi executada neste ambiente porque o navegador de sandbox não estava disponível; o preview HTTP e o build web passaram.

Testbenches agora também são dados persistentes: a versão 5 do IndexedDB adiciona `testbenchProjects` associado ao circuito, e a UI oferece novo, salvar, atualizar, carregar, remover, importar e exportar. O formato `veritas-testbenches` versão 1 é validado fail-closed, aplica os limites canônicos de casos/tiques e não executa conteúdo importado. Os fluxos de salvar/reabrir no navegador real e a inspeção visual interativa continuam aguardando smoke de runtime; os testes fake-IndexedDB e de round-trip passaram localmente.

### Atualização da implementação — BENCH-001 — 2026-08-26

Foi criado um benchmark de escala separado da suíte padrão, executável por `npm run bench:circuit-scale`. Ele gera deterministicamente uma cadeia `input → N × NOT → output`, valida o `CircuitDocument`, converte-o em netlist e mede o `createDocumentRuntime()`/`Simulator` real. O aquecimento fica fora da janela medida; cada amostra alterna a entrada, executa ticks suficientes para a profundidade da cadeia, valida a saída e calcula checksum SHA-256. O benchmark grava JSON e Markdown em `artifacts/`, que permanece ignorado pelo Git.

A primeira baseline foi realmente executada em Linux x86_64, Node `v22.13.0`, CPU reportada como AMD EPYC e versão do projeto `0.9.0-rc.15`. Em 10 gates foram observados 0,577 ms em 220 ticks, média de 0,003 ms/tick e RSS Node de 70.632 para 70.632 kB; em 100 gates, 17,271 ms em 2.020 ticks, média de 0,009 ms/tick e RSS de 75.440 para 81.364 kB. Esses valores são específicos da máquina/processo e não são comparação científica entre plataformas.

Os alvos de 500, 1000 e 5000 gates foram classificados honestamente como `NOT SUPPORTED`, sem zero, estimativa ou dado fabricado: a cadeia exigiria 502, 1002 e 5002 nós, enquanto o contrato atual limita documentos a 256 nós e 512 conexões. Renderização/FPS, memória isolada da simulação, startup nativo, tamanho instalado, offline e comparação multiplataforma seguem `NOT VERIFIED`. Este marco mede a lacuna e não promove uma release nem declara suporte a circuitos grandes.

### Atualização da implementação — Desktop 0.1.0-alpha.1

O Veritas agora possui um shell desktop leve em Tauri 2, separado da numeração do núcleo web. A configuração embute `dist/` no binário, usa a porta fixa `5173` no desenvolvimento e não introduz servidor, conta, telemetria ou endpoint obrigatório. O fluxo de cálculo, simulação, IndexedDB local e exportação permanece no frontend já validado.

O build Linux foi validado localmente com Rust/Cargo 1.98.0, gerando o executável otimizado `veritas`, `Veritas_0.1.0-alpha.1_amd64.deb` e `Veritas_0.1.0-alpha.1_amd64.AppImage`. O workflow [`desktop-release.yml`](../.github/workflows/desktop-release.yml) executa primeiro `npm test`, typecheck, lint e build web em um job de qualidade, e só então prepara builds nativos em `ubuntu-22.04`, `windows-latest` e `macos-latest`; o alvo Windows usa NSIS e normaliza o arquivo para `Veritas-Setup.exe`, e o alvo macOS usa `.app.zip`/`.dmg`. A release pública também anexa `SHA256SUMS` e `desktop-release-manifest.json`; a tag final e o manifesto apontam para o mesmo commit de build.

A compilação e a assinatura de Windows e macOS não são declaradas como validadas no sandbox Linux. Windows exige WebView2 e Microsoft C++ Build Tools; macOS exige Xcode ou Command Line Tools. A assinatura Authenticode e a notarização Apple permanecem fora do repositório e são pré-requisitos para tratar os artefatos como distribuição estável.

O marco desktop `0.5.0` inicia os testes formais por plataforma, com instalação limpa, inicialização sem rede, persistência, importação/exportação, simulação combinacional e temporal, acessibilidade e remoção. A versão desktop `1.0.0` só será promovida depois de estabilidade comprovada em Windows, macOS e Linux, atualização verificada, ausência de bloqueios críticos e documentação final. Até lá, o shell é uma prévia experimental.

### Atualização da implementação — Release 0.12.0

A Release 0.12.0 fecha a allowlist do fixture real `Chips/BITREV-8.json`, da categoria `Outros`. O contrato aceito exige nome exato, oito entradas e oito saídas escalares, ausência de larguras vetoriais, `parts={}`, `partCount=0`, `wireCount=8`, variáveis `A|B|C|D|E|G|H|I`, ausência de `pins`, nomes derivados `O0…O7` e expressões `I|H|G|E|D|C|B|A`. A inspeção do fixture bruto confirmou zero subchips e os oito fios `A7→O0`, `A6→O1`, `A5→O2`, `A4→O3`, `A3→O4`, `A2→O5`, `A1→O6`, `A0→O7`; o adaptador não executa JSON, não avalia código e não infere dependências.

A construção local cria oito inputs escalares, oito outputs escalares e oito conexões diretas na topologia observada. Como o catálogo não publica `pins`, os labels de entrada são derivados exclusivamente das variáveis catalogadas; as saídas preservam os nomes `O0…O7`. Os testes comprovam quatro vetores de reversão, a estrutura, as portas locais, a exportação HDL e a rejeição quando a assinatura allowlist diverge.

A suíte focada, a suíte completa, os gates locais e o smoke catálogo → IndexedDB → paleta → canvas foram executados. O beta readiness permanece bloqueado por evidências/credenciais Supabase externas, e `validate:plugin` por `claude` ausente; tri-state, memória, estado, ULA e conversores sem contrato continuam fora do escopo.

### Atualização da implementação — Release 0.11.9

A Release 0.11.9 fecha a allowlist do fixture real `Chips/BITREV-4.json`, da categoria `Outros`. O contrato aceito exige nome exato, quatro entradas e quatro saídas escalares, larguras `[1,1,1,1]`, `parts={}`, `partCount=0`, `wireCount=4`, variáveis `A|B|C|D`, pinos `A0|A1|A2|A3`/`O0|O1|O2|O3` e expressões derivadas `D|C|B|A`. A inspeção do fixture bruto também confirmou zero subchips e os quatro fios `A3→O0`, `A2→O1`, `A1→O2`, `A0→O3`; o adaptador não executa JSON, não avalia código e não infere dependências.

A construção local cria quatro inputs escalares, quatro outputs escalares e quatro conexões diretas na topologia observada. Não há Combiner, Splitter ou componente interno a materializar. Os testes comprovam os quatro vetores de reversão, as portas locais, a exportação HDL e a rejeição quando qualquer parte da assinatura allowlist diverge.

A suíte focada, a suíte completa, os gates locais e o smoke catálogo → IndexedDB → paleta → canvas foram executados. O beta readiness permanece bloqueado por evidências/credenciais Supabase externas, e `validate:plugin` por `claude` ausente; tri-state, memória, estado, ULA e conversores sem contrato continuam fora do escopo.

### Atualização da implementação — Release 0.11.8

A Release 0.11.8 fecha a allowlist do fixture real `Chips/SEXT-4-16.json`, da categoria `Outros`. O contrato aceito exige nome exato, quatro entradas, 16 saídas derivadas, ausência da chave `pins`, `parts={}`, `partCount=0`, `wireCount=16` e as expressões `A`, `B`, `C`, `D` seguidas por doze ocorrências de `D`. O adaptador lê somente o registro catalogado e materializa um `CircuitDocument`; não executa JSON, não avalia código e não infere dependências.

A construção local cria quatro inputs escalares `A0…A3`, um Combiner com 16 partes e uma saída vetorial `O0` de 16 bits. Os canais 0–2 recebem `A0`, `A1` e `A2`; os canais 3–15 recebem `A3`. A saída comprovada é `A0 A1 A2 A3 A3 A3 A3 A3 A3 A3 A3 A3 A3 A3 A3 A3` em ordem MSB → LSB, preservando a extensão de sinal real observada nas expressões.

Como o registro também publica 16 expressões escalares derivadas, a biblioteca prioriza o documento vetorial quando a assinatura allowlisted coincide. Assim, a persistência local, a paleta e o canvas mostram `IN 1 + 1 + 1 + 1 bits · OUT 16 bits`; a porta pública continua sendo uma saída estrutural de 16 bits, não dezesseis saídas escalares independentes. A suíte focada, a suíte completa, os gates locais e o smoke catálogo → IndexedDB → paleta → canvas foram executados. O beta readiness permanece bloqueado por evidências/credenciais Supabase externas, e `validate:plugin` por `claude` ausente; tri-state, memória e estado continuam fora do escopo.

### Atualização da implementação — Release 0.11.7

A Release 0.11.7 fecha a allowlist do fixture real `Chips/ZEXT-4-16.json`, da categoria Outros. O contrato aceito exige nome exato, quatro entradas, 16 saídas derivadas, ausência da chave `pins`, a dependência `1× 0`, `partCount=1` e 16 fios. As expressões derivadas precisam ser `A`, `B`, `C`, `D` seguidas por doze ocorrências de `0`; o adaptador não executa JSON, não avalia código e não infere dependências.

A construção local cria quatro inputs escalares, uma única constante `0`, um Combiner com 16 partes e uma saída vetorial `O0` de 16 bits. Os quatro primeiros canais preservam `A0…A3`; os doze canais restantes recebem a constante compartilhada. A saída comprovada é `A0 A1 A2 A3 000000000000` em ordem MSB → LSB.

Como o registro também publica 16 expressões escalares derivadas, a biblioteca prioriza o documento vetorial quando a assinatura allowlisted coincide. Assim, a persistência local, a paleta e o canvas mostram `IN 1 + 1 + 1 + 1 bits · OUT 16 bits`. A suíte focada, os gates locais e o smoke catálogo → IndexedDB → paleta → canvas foram executados; tri-state, memória e estado continuam fora do escopo.

### Atualização da implementação — Release 0.11.6

A Release 0.11.6 fecha a allowlist do fixture real `Chips/SEXT-4-8.json`, da categoria Outros. O contrato aceito exige nome exato, quatro entradas, oito saídas derivadas, os pinos `A0…A3`/`O0…O7`, oito fios, zero subchips e zero dependências. O importador lê o registro catalogado e materializa um `CircuitDocument`; não executa JSON, não avalia código e não infere dependências.

A construção local cria quatro inputs escalares, um Combiner com oito partes e uma saída vetorial `O0` de 8 bits. Os três primeiros canais recebem `A0`, `A1` e `A2`; os cinco canais restantes recebem o mesmo `A3`. A saída comprovada é `A0 A1 A2 A3 A3 A3 A3 A3` em ordem MSB → LSB, preservando a extensão de sinal real observada nos fios.

Como o registro também contém oito expressões escalares derivadas, a biblioteca prioriza o documento vetorial quando a assinatura allowlisted coincide. Assim, a persistência local, a paleta e o canvas mostram `IN 1 + 1 + 1 + 1 bits · OUT 8 bits`. A suíte focada, os gates locais e o smoke catálogo → IndexedDB → paleta → canvas foram executados; tri-state, memória e estado continuam fora do escopo.

### Atualização da implementação — Release 0.11.5

A Release 0.11.5 fecha a allowlist do fixture real `Chips/ZEXT-4-8.json`, da categoria Outros. O contrato aceito exige nome exato, quatro entradas, oito saídas derivadas no catálogo, a saída estrutural `O0` de 8 bits e a dependência `1× 0`. O importador lê o registro catalogado e materializa um `CircuitDocument`; não executa JSON, não avalia código e não infere dependências.

A construção local cria quatro inputs escalares `A0…A3`, uma única constante `0`, um Combiner com oito partes e uma saída vetorial `O0`. Os quatro primeiros canais preservam os sinais de entrada e os quatro últimos recebem a constante compartilhada, resultando em `A0 A1 A2 A3 0000` em ordem MSB → LSB.

Como o registro também contém oito expressões escalares derivadas, a biblioteca agora prioriza o documento vetorial quando a allowlist coincide. Assim, a persistência local, a paleta e o canvas mostram `IN 1 + 1 + 1 + 1 bits · OUT 8 bits`, em vez de materializar oito saídas escalares. A validação focada, a suíte completa, os gates locais e o smoke catálogo → IndexedDB → paleta → canvas foram executados; tri-state, memória e estado continuam fora do escopo.

### Atualização da implementação — Release 0.11.4

A Release 0.11.4 fecha a allowlist do fixture real `Chips/16 para 8 e 4 bits.json`, da categoria Barramentos. O contrato aceito exige nome exato, 16 entradas, 10 saídas, larguras públicas `[1, 4, 8]` e as dependências `2× 1-8BIT`, `1× 8x2-AND` e `1× 8-4BIT`. O importador continua sendo um adaptador seguro: lê o registro já catalogado e materializa um `CircuitDocument`; não executa JSON, não avalia código e não infere dependências que não estejam na assinatura.

A construção local separa as entradas 1–8 no barramento `A` e as entradas 9–16 no barramento `B`. Cada barramento é dividido em bits, os oito pares passam por AND escalar e o resultado é recombinado e dividido em `[4,4]`. As dez saídas preservam a ordem observada no fixture: `A, A, AND[0], A, AND[0], AND[1], AND[1], B, B, B`, com larguras `[8, 8, 4, 8, 4, 4, 4, 8, 8, 8]` e convenção MSB → LSB.

O critério de saída foi satisfeito por testes focados de estrutura, avaliação com vetor não simétrico, portas de chip customizado, exportação Verilog/VHDL e rejeição defensiva; pela suíte completa, typecheck, lint, builds, acceptance MCP/HTTP, acessibilidade, isolamento WASM, Rust e HDL; e pelo smoke local catálogo → IndexedDB → paleta → canvas. Tri-state, memória e chips com estado continuam em releases posteriores, dependentes de contratos específicos.

## 4. Histórico do ciclo v0.7.1

A primeira implementação organizada foi o **editor visual combinacional** e está disponível em prévia. O ciclo seguinte concentrou-se em usabilidade e confiabilidade: desfazer/refazer, atalhos, seleção consistente, layout inicial e testes de interação. A calculadora de expressões continua funcionando de forma independente do editor.

O editor passou a ter um modelo de dados próprio, independente dos objetos internos do React Flow. A interface converte esse modelo para nós e arestas visuais; a engine recebe um netlist normalizado. Essa separação permite salvar arquivos estáveis, testar o cálculo sem DOM e trocar a biblioteca de canvas sem reescrever o domínio.

| Item | Decisão para v0.7.0 |
| --- | --- |
| Componentes | `input`, `constant`, `and`, `or`, `not`, `xor`, `output` |
| Sinais | Booleanos de um bit |
| Conectividade | Uma saída pode alimentar múltiplas entradas; cada entrada aceita no máximo uma conexão |
| Avaliação | Ordenação topológica e propagação determinística |
| Ciclos | Rejeitados no modo combinacional, com erro acionável |
| Conversão para expressão | Permitida quando o grafo possui uma saída selecionada e não tem ciclo |
| Persistência | Novo formato versionado dentro de `.veritas`, mantendo compatibilidade de leitura |
| Segurança | Sem execução de código importado; validar tipos, IDs, referências e limites |

## 5. Backlog organizado

Os itens abaixo serão implementados nessa ordem. Cada item deve gerar código, teste e documentação mínima antes de ser marcado como concluído.

| ID | Prioridade | Trabalho | Dependências |
| --- | --- | --- | --- |
| VRT-001 | P0 | Definir tipos canônicos de circuito, portas, conexões e versão do formato | Nenhuma |
| VRT-002 | P0 | Criar normalizador e validador de netlist | VRT-001 |
| VRT-003 | P0 | Implementar avaliação combinacional do netlist | VRT-001, VRT-002 |
| VRT-004 | P0 | Criar adaptador netlist ↔ React Flow | VRT-001 |
| VRT-005 | P0 | Implementar canvas editável com componentes básicos | VRT-004 |
| VRT-006 | P0 | Exibir erros de conexão, entradas faltantes e ciclos | VRT-002, VRT-003 |
| VRT-007 | P1 | Gerar tabela verdade a partir do circuito | VRT-003 |
| VRT-008 | P1 | Converter circuito acíclico para expressão quando possível | VRT-003 |
| VRT-009 | P1 | Salvar e reabrir projetos visuais | VRT-001, camada de storage atual |
| VRT-010 | P1 | Desfazer/refazer e atalhos essenciais | VRT-005 |
| VRT-011 | P1 | Testes cruzados entre expressão, circuito e tabela | VRT-003, VRT-007, engine atual |
| VRT-012 | P2 | Tutorial inicial de uso e exemplos de circuitos | VRT-005 |

## 6. Fora do próximo ciclo

Não serão iniciados no ciclo v0.7.0 o sync com Supabase, autenticação, CRDT, WebSockets, 250 subagentes, WebLLM, integração de GitHub com permissões de escrita, Tauri, Rust, Three.js, exportação para PCB, G-Code ou impressão 3D. Essas ideias continuam registradas no `issue.md`, mas iniciar qualquer uma delas agora aumentaria a superfície técnica antes de o editor possuir um modelo estável.

Também não será implementada uma execução arbitrária de comandos recebidos de IA ou de arquivos importados. A futura integração agentic deverá trabalhar com operações declarativas, validação, permissões e confirmação explícita do usuário.

## 7. Definição de pronto

Uma funcionalidade só será considerada pronta quando estiver implementada na camada correta, coberta por testes automatizados, validada por `lint`, `typecheck`, `test` e `build`, documentada no README quando alterar o fluxo do usuário e compatível com o princípio offline-first. Mudanças no formato `.veritas` devem incluir versão, validação defensiva e teste de migração ou rejeição clara.

Para cada release, será produzido um pequeno registro com as decisões tomadas, as limitações conhecidas e os próximos itens. O número de versão só avançará quando os critérios de saída da tabela forem atendidos.

## 8. Riscos e controles

| Risco | Controle |
| --- | --- |
| O editor virar uma cópia difícil de manter da engine | Netlist canônico e engine sem dependência de React/DOM |
| Circuitos inválidos congelarem a aplicação | Limites de nós/arestas, detecção de ciclos e avaliação com falhas explícitas |
| Arquivos importados corromperem projetos | Validação de esquema, versão de formato e rejeição defensiva |
| O roadmap crescer mais rápido que a capacidade de entrega | Releases curtas, backlog priorizado e itens fora de escopo explícitos |
| Integrações com IA alterarem dados sem controle | Propostas declarativas, dry-run, logs e confirmação do usuário |
| Desktop ser confundido com estabilidade | Manter shell Tauri separado do núcleo, exigir QA nativo, assinatura, métricas e classificação `BUILD VERIFIED`/`RUNTIME VERIFIED` antes de promover |

## 9. Referências

[1]: https://github.com/Lucas-Belucci-Bellini/Veritas/blob/main/issue.md "Registro de descoberta do Veritas"
[2]: https://reactflow.dev/ "React Flow — documentação oficial"
[3]: https://modelcontextprotocol.io/ "Model Context Protocol — documentação oficial"
[4]: https://tauri.app/ "Tauri — documentação oficial"

## Atualização da implementação — 2026-08-14

A primeira parte da v0.7.0 foi implementada no repositório. O editor agora gera uma tabela verdade diretamente do netlist visual, permite selecionar uma linha para acender os sinais no canvas, suporta múltiplas saídas com seleção da saída principal e preserva o formato `V/F` ou `1/0` usando o componente de tabela já existente.

Os circuitos visuais também podem ser salvos, reabertos, excluídos, exportados e importados no IndexedDB. O banco local recebeu a tabela `circuitProjects` na versão 2, sem alterar a tabela de projetos de expressões.

No Supabase existente foi aplicada a migração `veritas_circuit_context_foundation`. Ela cria uma tabela própria com RLS por `auth.uid()`, índices para usuário, tags e deduplicação, mas ainda não conecta o frontend diretamente porque a aplicação não possui autenticação. O módulo `src/circuit/context.ts` já produz o pacote determinístico que a futura camada autenticada poderá persistir.

## Atualização da implementação — autenticação, nuvem e IA

O frontend agora possui autenticação Supabase por e-mail e senha, restauração de sessão e logout. O IndexedDB permanece local-first, enquanto usuários autenticados podem sincronizar explicitamente circuitos na tabela `veritas_circuit_projects`, protegida por RLS e deduplicada por usuário e hash de conteúdo.

O contexto produzido por `buildCircuitContext()` é enviado à Edge Function autenticada `veritas-circuit-ai`. A função usa saída JSON estruturada quando um provedor LLM é configurado por secrets e mantém uma heurística conservadora como fallback. A otimização nunca é aplicada silenciosamente: o usuário revisa sugestões e confirma a aplicação no canvas.

Nesta etapa também foram ampliados os testes de tabela verdade e IndexedDB para cobrir múltiplas saídas, seleção de saída, truncamento, limites de segurança, reabertura do banco, atualização de documentos e normalização de importação.

## Atualização da implementação — histórico remoto e API de IA

O Veritas agora mantém histórico imutável dos salvamentos autenticados em `veritas_circuit_versions`. A função RPC `veritas_sync_circuit_project` atualiza o estado atual e registra a versão em uma operação transacional. O editor permite selecionar duas versões, visualizar nós e conexões adicionados, removidos ou alterados e abrir uma versão anterior como prévia antes de sincronizá-la como novo salvamento.

Também foram adicionados testes específicos para o diff estrutural, listagem/RPC de versões Supabase e chamadas do cliente para a Edge Function, incluindo instruções opcionais, otimizações válidas, respostas inválidas e erros de transporte. A API da Edge Function e exemplos de prompts estão documentados em `docs/EDGE-FUNCTION-API.md`.

## Atualização da implementação — colaboração, exportação e métricas

A release v0.7.2 foi implementada em fatias verticais e publicada com o commit `feat: add realtime collaboration verilog vhdl export and ai metrics`:

| Entrega | Implementação e critério verificado |
| --- | --- |
| Colaboração Realtime | Canal Supabase privado por circuito, Broadcast de snapshots, Presence de participantes, convite/remoção de colaboradores e bloqueio visualizador |
| Exportação HDL | Exportadores determinísticos para Verilog-2001 e VHDL-2008, com sanitização de identificadores e rejeição de circuitos inválidos |
| Monitoramento da IA | Tabela `veritas_ai_metrics` com RLS, publicação Realtime, cliente, hook, painel e telemetria best-effort |
| Segurança e documentação | Migrações aplicadas no projeto existente, policies de Realtime e `docs/REALTIME-EXPORT-METRICS.md` |

A colaboração permanece em prévia: o snapshot é uma atualização transitória e a persistência oficial continua sendo o salvamento versionado. A próxima etapa deve adicionar desfazer/refazer e, antes de uma colaboração declarativa de maior escala, definir estratégia de conflitos, presença de cursores e resolução de alterações concorrentes.

## Atualização da implementação — testes didáticos e backlog multi-room

Os seis materiais fornecidos foram mapeados em `docs/EDUCATIONAL-TESTS-MULTIROOM.md`. A nova suíte `src/engine/courseMaterials.test.ts` cobre tautologias, contradições, equivalências de De Morgan, condicional equivalente a `¬P ∨ Q`, contrapositiva, recíproca com contraexemplo e regras de inferência. A validação passou com 18 arquivos e 179 testes, além de typecheck, lint e build.

O conteúdo de arquitetura de computadores foi incorporado ao backlog conceitual de barramentos multi-bit, ALU didática, registradores e interconexões. A próxima etapa de colaboração é `ROOM-001`: extrair sessões por sala, isolar tópicos, incluir `baseVersion` nos snapshots, rejeitar conflitos otimistas no RPC e criar testes de isolamento entre duas salas. A resolução deverá começar com conflito explícito, antes de qualquer CRDT ou LWW silencioso.

## Atualização da implementação — insights do Flowgorithm

Os arquivos enviados do Flowgorithm foram inspecionados estaticamente, sem executar o `.exe` e sem importar assemblies externos. A análise está em `docs/FLOWGORITHM-INSIGHTS.md`. O núcleo `ALGO-001` foi implementado como workspace independente do editor combinacional: `AlgorithmDocument` versionado, nós Start/End/Declare/Assign/If/Input/Output, validação estrutural, avaliador de expressões restrito, executor puro Step/Run, fila de entrada, trace e persistência local em `algorithmProjects` (Dexie v3). Os testes cobrem transições, entrada, ramificação, documento inválido, limite de passos e CRUD IndexedDB.

A etapa `ALGO-002` foi implementada sobre `ExecutionState`: Watch de variáveis, `BranchTrace`, entrada tipada, Step/Run/Reset, laboratório de casos lógicos e integração demonstrativa no App. A implementação está em `src/components/AlgorithmVariableWatch.tsx`, `src/components/AlgorithmBranchTrace.tsx`, `src/components/AlgorithmWorkspace.tsx` e `src/components/LogicCaseLab.tsx`; os critérios estão em `docs/ALGO-002-UI.md`. Os exercícios dos materiais enviados foram convertidos em `src/algorithms/logicCases.ts` e testes para conectivos, implicação, tautologias, contradições, contrapositiva, contraexemplos e regras de inferência.

A etapa `ALGO-003` foi implementada com nó `while`, depuração `Step`/`Run`/`Continue`, breakpoints por ID, razões de pausa (`step`, `breakpoint`, `input`, `finished`, `error`, `max-steps`) e limite contra loops infinitos. A documentação está em `docs/ALGO-003-DEBUG.md`. `logicCases.ts` também expõe tabelas proposicionais completas reutilizando `parse()`, `evaluateWithSteps()` e `buildTruthTable()` da engine para AND, NAND, OR, NOR, XOR, XNOR, NOT, implicação e bicondicional.

O MCP recebeu `logic_case`, `propositional_truth_table` e `debug_algorithm`, mantendo ferramentas puras independentes do transporte stdio. A documentação de interoperabilidade para Claude, Codex, ChatGPT, Manus e hosts MCP compatíveis está em `docs/MCP-INTEROPERABILITY.md`; Streamable HTTP autenticado permanece como próxima etapa de transporte remoto. Depois entram `ALGO-004` (funções/call stack) e `ALGO-005` (arrays/templates). Geração de código, I/O de arquivos, recursão irrestrita e recursos gráficos só entram após o IR, a segurança e os limites de execução estarem validados.

## Atualização da implementação — ROOM-001 multi-room e conflitos explícitos — 2026-08-15

A colaboração foi extraída para sessões de sala nomeadas em `src/realtime/roomCollaboration.ts`. Cada sessão usa o tópico `veritas:project:{projectId}:room:{roomId}`, mantém listeners e estado de conexão próprios, normaliza Presence com projeto/sala/tipo/papel e rejeita snapshots de outra sala antes de encaminhá-los à interface. `RoomManager` desconecta a sala anterior antes de ativar a próxima e fornece `disconnectAll()` para cleanup de usuário ou editor.

O contrato de snapshot agora inclui `projectId`, `roomId`, `contentHash`, `baseVersion`, `clientId` e `sentAt`. O cliente envia `baseVersion` ao RPC de sincronização e converte a resposta `CIRCUIT_CONFLICT` em `CloudVersionConflictError`, sem substituir silenciosamente o documento remoto. A persistência continua sendo a fonte de verdade; Broadcast permanece transitório.

A migração `supabase/migrations/20260815000000_room_001_multi_room_conflict.sql` foi aplicada no projeto Supabase existente `hcwzsxdcvmswebunznak`. Ela cria `veritas_circuit_rooms`, o RPC de criação de salas, policies por tópico multi-room, escrita de `circuit_snapshot` apenas para owner/editor e sincronização transacional com rejeição quando `p_base_version` diverge da versão atual. A sala `main` é reconhecida sem registro adicional; salas nomeadas precisam existir no banco.

A entrega adicionou o cliente `src/realtime/circuitRooms.ts`, testes de isolamento entre `alpha` e `beta`, validação de identificadores, troca de sala, baseVersion e conflito RPC. O estado local-first permanece funcional sem Supabase. A suíte passou com 22 arquivos e 206 testes, além de typecheck e lint limpos.

## Atualização da implementação — v0.7.1 undo/redo e atalhos — 2026-08-15

O editor visual agora mantém um histórico local de snapshots `CircuitDocument` por meio de `CircuitHistory`. O histórico deduplica documentos idênticos, limita a memória a 100 entradas por padrão (máximo configurável de 500), clona snapshots para impedir mutação externa, descarta o futuro após nova edição e limpa passado/futuro quando um documento diferente é aberto.

A barra do editor expõe `Desfazer` e `Refazer`. Os atalhos `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` e `Ctrl/Cmd+Y` funcionam quando o foco não está em input, textarea, select ou elemento editável. Viewers em colaboração não alteram o histórico nem executam undo/redo. O documento restaurado passa pelos mesmos conversores `CircuitDocument`/React Flow usados pelo carregamento local e remoto, preservando o modo local-first.

O histórico é de sessão do editor e não substitui o histórico remoto imutável. Salvamento local, sincronização Supabase, Broadcast e versionamento continuam independentes; undo/redo serve para recuperar rapidamente alterações da sessão antes de salvar ou sincronizar.

## Atualização da implementação — fundação v0.8.0 de barramentos — 2026-08-15

A primeira fatia do próximo release foi iniciada em `src/bus/bitVector.ts`. `BitVector` representa sinais como bits imutáveis em ordem MSB → LSB, com largura entre 1 e 64 bits. O núcleo oferece parse de literais binários e hexadecimais, formatação binária/hexadecimal, conversão para `bigint`, AND/OR/XOR/NOT bitwise, `splitBus` e `combineBus`.

O contrato rejeita valores negativos, overflow, largura zero, literais inválidos, partes incompatíveis e combinações cujo total não coincide com a largura original. Essa fundação é deliberadamente independente da engine escalar atual: nenhuma avaliação 1-bit foi alterada silenciosamente. A próxima fatia deverá adicionar largura explícita a portas do modelo visual, migração defensiva do formato e operações de compatibilidade antes de tocar no exportador HDL ou na tabela verdade.

## Atualização da implementação — schema seguro de width — 2026-08-15

O campo opcional `options.width` agora atravessa `ComponentOptions`, o estado visual do CircuitEditor, serialização do documento, hidratação de projetos e validação de arquivos locais. A ausência do campo continua significando `width = 1`, preservando documentos v1 existentes.

O modelo valida largura entre 1 e 64 bits, rejeita width inválido e informa `unsupported-width` para sinais vetoriais enquanto `evaluateCircuit`, tabela verdade e exportadores ainda são escalares. Conexões entre larguras válidas diferentes produzem `width-mismatch`; snapshots Realtime e importação local rejeitam widths malformados antes de alcançar a UI. A próxima fatia implementará avaliação vetorial e só então habilitará a largura no editor para criação de novos sinais.

## Atualização da implementação — avaliação vetorial v0.8.0 — 2026-08-15

A API `evaluateCircuitVectors()` foi adicionada em paralelo à avaliação booleana. Ela usa o mesmo netlist e a mesma ordenação topológica, mas aceita `BitVector`, `bigint`, número ou literal binário/hexadecimal como entrada e retorna valores vetoriais para todos os componentes e saídas. AND, OR, XOR e NOT operam bit a bit e exigem larguras compatíveis.

A API vetorial chama `toNetlist(document, { allowBuses: true })`; a API `evaluateCircuit()` continua chamando a validação padrão e rejeita width diferente de 1. Isso cria uma transição explícita: documentos escalares existentes continuam funcionando, enquanto circuitos vetoriais podem ser avaliados por testes e futuras telas sem habilitar silenciosamente a tabela verdade ou os exportadores escalares.

O CircuitEditor agora permite escolher 1, 2, 4, 8, 16, 32 ou 64 bits para novos componentes, preserva a largura no IndexedDB e mostra o valor binário avaliado em entradas e saídas vetoriais. A colaboração e a normalização remota continuam rejeitando widths malformados. A tabela verdade, a análise de IA e os exportadores Verilog/VHDL permanecem bloqueados para documentos multi-bit até receberem contratos vetoriais próprios; o circuito escalar mantém todos esses fluxos.

A função `buildCircuitVectorTruthTable()` e o componente `VectorTruthTableView` adicionam a tabela vetorial com colunas dimensionadas, valores MSB → LSB e truncamento determinístico. O limite padrão é de 12 bits totais de entrada, equivalente a no máximo 4.096 combinações; tabelas acima desse limite são rejeitadas em vez de congelar a interface. A tabela booleana existente e a seleção de linhas continuam disponíveis somente no caminho escalar.

Os exportadores agora aceitam widths válidos: Verilog usa `input [N-1:0]`, `output [N-1:0]` e `wire [N-1:0]`; VHDL usa `std_logic_vector(N-1 downto 0)`. Constantes vetoriais são emitidas com replicação segura no Verilog e `(others => '0'/'1')` no VHDL. A seleção de linha vetorial é clicável e acessível pelo teclado, converte os valores MSB → LSB em `BitVector` e ilumina o canvas para a combinação escolhida.

## Atualização da implementação — primeira fatia do v0.9.0

A aplicação agora inclui o `SequentialWorkspace`, uma camada React de observação e controle sobre o `Simulator` existente. A prévia apresenta quatro demos determinísticas: flip-flop D com clock automático, flip-flop T com clock automático, atraso de propagação e contador de 1 bit com feedback. A interface oferece seleção de demo, entradas controláveis, `Step`, `Run`/`Continue`, pulso manual de clock, `Reset`, Watch de sinais e linha do tempo limitada aos últimos 24 estados.

O domínio permanece separado da UI em `src/simulation/workspace.ts`, com contratos para demos, snapshots, aplicação de entradas, pulsos e leitura de sinais. Os testes cobrem captura na borda de subida, alternância T, fila de atraso, contador por feedback e serialização de snapshots. Esta etapa não habilita edição visual de `clock`, `dff`, `tff` ou `delay` dentro do `CircuitEditor`, nem persistência do workspace; esses são os próximos incrementos do v0.9.0.

## Atualização da implementação — componentes sequenciais no editor visual

A segunda fatia do v0.9.0 amplia o `CircuitDocument` e o `CircuitEditor` para aceitar `clock`, `dff`, `tff` e `delay` como componentes visuais de 1 bit. A paleta agora cria esses nós com handles de entrada/saída nomeados, parâmetros padrão de período do clock e quantidade de tiques do atraso, além de preservar `period`, `ticks` e `initial` no formato local, no sync e na reabertura do documento.

A validação continua rejeitando ciclos puramente combinacionais, mas permite feedback quando o ciclo passa por um componente com estado, como o Q̄ de um DFF ligado de volta ao D. Isso prepara contadores e latches sem transformar um ciclo combinacional em comportamento indefinido. Widths vetoriais em componentes sequenciais continuam rejeitados nesta etapa.

Tabela verdade, avaliação por seleção de linha, análise de IA e exportação HDL permanecem explicitamente bloqueadas quando o documento contém estado sequencial. O próximo incremento deverá conectar um `CircuitDocument` sequencial ao `Simulator`, com controles de Step/Run/Reset e observação do timeline para circuitos arbitrários criados no canvas.

## Atualização da implementação — runtime temporal para documentos do canvas

A terceira fatia do v0.9.0 conecta documentos sequenciais arbitrários do `CircuitEditor` ao `Simulator`. O adaptador `src/simulation/documentRuntime.ts` transforma o documento validado em netlist, aplica valores iniciais das entradas e expõe snapshots e Watchs derivados dos nós reais do canvas.

O `SequentialCircuitPanel` adiciona `Step` de um tique, `Run` de oito tiques, `Reset`, alternância manual das entradas, Watch de `input`, `clock`, `dff`, `tff`, `delay` e `output`, além de uma timeline limitada aos últimos 32 estados. O canvas reflete o snapshot temporal: nós e fios ativos são iluminados sem reutilizar a tabela verdade combinacional.

O runtime mantém a propagação síncrona do simulador e falha de forma visível quando o documento é inválido. Nesta etapa, a execução é local e em memória; persistência da timeline, clock editável durante a execução e colaboração do estado temporal permanecem para incrementos posteriores.

## Atualização da implementação — checkpoint local do runtime sequencial

A quarta fatia do v0.9.0 adiciona `exportState()` e `restoreState()` ao `Simulator` e persiste o checkpoint do documento sequencial no `localStorage` quando disponível. A chave é derivada do conteúdo estrutural do documento, sem usar nome ou credenciais, e o payload guarda o estado interno necessário para continuar clock, flip-flops e delays no mesmo tique.

O checkpoint inclui entradas, snapshot do simulador e os últimos 32 estados da timeline. Ao reabrir o mesmo documento, o painel restaura automaticamente o estado; `Reset` remove o checkpoint e começa novamente pelos valores iniciais. Ausência, quota excedida ou corrupção do armazenamento degradam para execução somente em memória e nunca interrompem a funcionalidade principal.

## Atualização da implementação — período de clock configurável no runtime

A quinta fatia do v0.9.0 permite alterar o período de cada componente `clock` diretamente no painel temporal, com opções de 1 a 64 tiques. A mudança não muta o documento visual: ela cria um runtime derivado, reinicia a execução e limpa a timeline anterior para que estados produzidos por cadências diferentes não sejam misturados.

A configuração escolhida é persistida junto ao checkpoint do documento e restaurada na próxima abertura. Períodos inválidos são descartados pelo parser local; valores efetivos permanecem limitados ao intervalo seguro de 1 a 64 tiques. O próximo passo é levar essa configuração temporal para a colaboração opcional, preservando o documento canônico e tratando mudanças concorrentes explicitamente.

## Atualização da implementação — configuração temporal em colaboração Realtime

A sexta fatia do v0.9.0 adiciona o evento privado `runtime_config` ao tópico já isolado por projeto e room. O payload carrega apenas `clockPeriods`, `baseVersion`, `configHash`, `clientId` e timestamp; o documento canônico e a timeline não são transmitidos por esse evento.

O cliente valida projeto, room, versão-base, identificadores, faixa de 1–64 tiques e hash canônico antes de aplicar uma configuração remota. Se a versão-base recebida divergir da versão remota atual, o editor rejeita explicitamente a mudança. Viewers não podem publicar configuração temporal; editors e owners podem transmitir apenas quando conectados à room autorizada. A aplicação remota reinicia somente o runtime local e não altera o documento do circuito.

## Atualização da implementação — estado temporal colaborativo com confirmação

A sétima fatia do v0.9.0 adiciona o evento privado `runtime_state`. Ele transmite, separadamente do documento, as entradas, períodos de clock, estado interno do `Simulator`, snapshot atual e os últimos 32 estados da timeline, protegidos por hash e `baseVersion`.

O estado remoto nunca substitui automaticamente o runtime local. Ao receber uma mensagem válida da mesma room e versão-base, o editor exibe um aviso e oferece `Aplicar estado remoto`; somente essa ação restaura o estado no Simulator e no checkpoint local. Viewers não publicam estados. Assim, edição estrutural, configuração temporal e execução temporal continuam sendo fontes de verdade distintas e podem evoluir sem sobrescrita silenciosa.

## Atualização da implementação — frescor, retenção e presença temporal

A oitava fatia do v0.9.0 adiciona uma política de retenção para ofertas `runtime_state`: mensagens com mais de 30 segundos são descartadas antes da UI; timestamps até 5 segundos no futuro são tolerados para acomodar pequenas diferenças de relógio; timestamps inválidos ou muito futuros também são rejeitados.

O painel exibe o status da colaboração temporal e a quantidade de participantes Presence online. Uma oferta válida mostra autor, tique e idade aproximada; após 30 segundos ela expira automaticamente e deixa de ser aplicável. A retenção é best-effort e em memória: o checkpoint local continua disponível para o usuário, mas uma oferta Realtime antiga nunca fica reutilizável indefinidamente.

## Atualização da implementação — métricas locais de execução temporal

A nona fatia do v0.9.0 adiciona um reducer local para contar estados temporais recebidos, aplicados, publicados, conflitos de versão, ofertas expiradas/rejeitadas e falhas de publicação. O painel mostra esses contadores junto da presença temporal e do status de conexão.

As métricas são somente de sessão e não enviam documento, inputs, estado interno, timeline, IDs de projeto ou conteúdo de circuito para telemetria. Elas existem para feedback operacional imediato e são reiniciadas quando o documento/room muda; falhas de colaboração continuam best-effort e não interrompem o runtime local.

## Atualização da implementação — histórico local de eventos temporais

A décima fatia do v0.9.0 transforma os contadores temporais em um histórico local dos últimos 12 eventos. Cada registro contém apenas horário, tipo e mensagem genérica: recebimento, aplicação, conflito, expiração/rejeição, publicação ou falha. O histórico é imutável por reducer, limitado em memória e reiniciado ao trocar documento ou room.

A UI oferece uma lista recolhível junto dos contadores, permitindo diagnosticar o fluxo sem enviar conteúdo de circuito, inputs, timeline, IDs de projeto ou estado interno para telemetria. O histórico é informativo e nunca se torna requisito para executar, salvar ou colaborar localmente.

## Atualização da implementação — confirmação e proteção de ofertas temporais — 2026-08-21

A décima-primeira fatia do v0.9.0 fecha o fluxo de aplicação manual do `runtime_state`. Cada oferta remota mantém sua `baseVersion` e o painel compara essa versão com a versão estrutural atual no momento da aplicação, não apenas no recebimento. Se houver divergência, o botão fica desabilitado, a oferta é descartada e o usuário recebe a orientação para aguardar um novo estado.

Quando a restauração do `Simulator`, do snapshot e do checkpoint local termina, a interface mostra confirmação explícita de sucesso e limpa a oferta pendente. Exceções durante a restauração produzem uma mensagem de erro sem interromper o runtime local. O reducer de métricas diferencia aplicação concluída, conflito de versão e falha de aplicação; nenhuma dessas métricas envia conteúdo do circuito ou estado temporal para telemetria.

A decisão de versão foi isolada em `src/realtime/runtimeOffer.ts` e coberta por teste unitário. A suíte completa passou com 31 arquivos e 256 testes, seguida por typecheck, lint, build do frontend, build do MCP, `git diff --check` e smoke público do PWA.

## Atualização da implementação — contrato de evidências para beta — 2026-08-21

Após a publicação da `v0.9.0-rc.1`, o beta preflight foi ampliado sem alterar o caminho local-first. O módulo puro `scripts/betaEvidence.mjs` valida um manifesto externo com a versão candidata, timestamp, listas vazias de P0/P1 e evidências `PASS` para RLS, Realtime, HDL, acessibilidade, mobile, rollback e onboarding.

A checagem é opcional para desenvolvimento local e torna-se obrigatória com `BETA_PREFLIGHT_REQUIRE_EVIDENCE=1` e `BETA_EVIDENCE_MANIFEST=...`. O preflight continua sem criar sessões Supabase ou inventar resultados: ele apenas rejeita manifestos incompletos, versões divergentes, gates pendentes e bloqueadores abertos. Foram adicionados testes para manifesto válido, versão divergente, P1 aberto, gate pendente, evidência vazia e gate ausente.

Os documentos `docs/RELEASE-GATES.md`, `docs/BETA-RLS-ACCEPTANCE.md` e `docs/RELEASE-PLAN.md` agora apontam para a `v0.9.0-rc.1` e explicitam que nenhuma `v0.9.0-beta.1` deve ser criada sem evidências externas reais e zero P0/P1.

## Atualização da implementação — auditoria estrutural Supabase e correção de policy — 2026-08-21

A validação beta agora possui uma auditoria estrutural separada em `docs/BETA-SUPABASE-STRUCTURAL-AUDIT.md`. No projeto Supabase existente `hcwzsxdcvmswebunznak`, as seis tabelas Veritas foram encontradas com RLS habilitado e policies registradas; as quatro policies Realtime ROOM-001 também foram encontradas no catálogo implantado. Essa captura confirma schema e configuração, mas não é uma aprovação cross-user.

Durante a auditoria foi detectada uma expressão ambígua na policy `veritas_circuit_projects_update_editor`: o subselect materializado usava `p.id = p.id`. A migration `20260821030000_fix_veritas_project_update_policy.sql` foi aplicada no Supabase existente e a policy foi reconsultada com referência explícita a `public.veritas_circuit_projects.id`. As migrations ROOM-001 original e de hardening foram alinhadas para preservar a reprodutibilidade em novos ambientes.

O beta preflight agora aceita `BETA_SUPABASE_STRUCTURAL_REPORT` e, quando `BETA_PREFLIGHT_REQUIRE_SUPABASE_STRUCTURAL=1`, rejeita project_id divergente, tabelas sem RLS/policy e policies Realtime obrigatórias ausentes. Os Security Advisors ainda reportam avisos de funções `SECURITY DEFINER` executáveis por usuários autenticados, proteção contra senhas vazadas desabilitada e uma tabela externa sem policy; esses avisos permanecem documentados como bloqueadores de revisão e não foram mascarados como PASS.

## Atualização da implementação — hardening da superfície de autorização Supabase — 2026-08-21

A migration `20260821033000_harden_veritas_authorization_surface.sql` foi aplicada no projeto Supabase existente. Os helpers `veritas_is_project_owner`, `veritas_can_collaborate` e `veritas_can_edit_project` foram movidos para o schema `private`, com `SECURITY DEFINER`, `search_path` fixo e `EXECUTE` explícito somente para `authenticated`. As policies de projetos, colaboradores, rooms, versões e Realtime foram reatadas aos helpers privados.

As RPCs públicas de colaboradores preservaram nomes e argumentos, mas passaram a `SECURITY INVOKER` com policies RLS de owner para insert/update/delete. As RPCs de room e sincronização continuaram invoker. A consulta pós-migration confirmou que os três helpers existem somente em `private`, que os quatro endpoints públicos do Veritas estão invoker e que `anon` não executa nenhum deles. Os Security Advisors deixaram de reportar os helpers/RPCs do Veritas.

Continuam bloqueadores externos à fatia: funções legadas `bump_view`, `bump_visits`, `buscar_juris` e `current_tenant_role`, proteção contra senhas vazadas desabilitada e `subscription_events` sem policy. O beta ainda exige a execução real de RLS-001 a RLS-022 com owner, outro usuário e papéis editor/viewer; catálogo, grants e advisors não substituem isolamento cross-user.

## Atualização da implementação — runner real da matriz RLS-001 a RLS-022 — 2026-08-21

O Veritas agora possui o comando `npm run beta:rls`, implementado em `scripts/rls-acceptance.mjs`. O runner exige `RLS_RUNNER_ALLOW_REAL=1`, usa somente `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` com quatro contas descartáveis (`owner`, `other`, `editor` e `viewer`), cria uma fixture prefixada, executa os cenários de dados, RPC, conflito, Realtime e Edge Function, tenta limpar as linhas no `finally` e escreve um relatório sanitizado fora do frontend.

O contrato puro em `scripts/rlsAcceptanceContract.mjs` garante os IDs RLS-001 a RLS-022 e remove Bearer tokens/passwords do relatório. Foram adicionados testes determinísticos para ordem dos IDs e redaction. A documentação de aceitação agora inclui o comando, as variáveis e os limites: casos Realtime/Edge sem configuração ficam `SKIP` e não liberam beta; o relatório real só entra no manifesto após revisão da limpeza e dos resultados.

A execução foi validada com `node --check` e o guard de segurança bloqueou corretamente a chamada sem `RLS_RUNNER_ALLOW_REAL=1`. Nenhuma sessão real foi criada nesta etapa, portanto a matriz continua pendente e a promoção beta permanece bloqueada até o runner ser executado com contas descartáveis reais.

## Atualização da implementação — validação server-side de CircuitDocument — 2026-08-21

A RPC `veritas_sync_circuit_project` agora chama `private.veritas_validate_circuit_document` antes de criar ou atualizar o projeto. A função SQL verifica formato `veritas-circuit`, versão 1, nome, nós/tipos/posições, referências, portas, entradas obrigatórias, larguras, conexões duplicadas e ciclos combinacionais. Feedback que passa por componentes stateful (`clock`, `dff`, `tff` ou `delay`) permanece compatível com o simulador temporal.

A migration `20260821043000_validate_circuit_document_server_side.sql` foi aplicada no Supabase existente. A migration corretiva `20260821043500_fix_circuit_document_validation_cycle_alias.sql` removeu uma ambiguidade de alias detectada pelo PostgreSQL durante o contrato de teste e foi versionada para manter o histórico reproduzível.

A consulta real confirmou documento válido com `[]` e documento com referência ausente com `missing-node`/`missing-input`.
O helper privado possui grants restritos e a RPC continua `SECURITY INVOKER`.

O runner RLS também foi corrigido para criar fixtures com `connections`, o campo canônico do `CircuitDocument`. O cenário RLS-022 passa a ter uma barreira server-side contra clientes adulterados; a matriz cross-user completa continua pendente e ainda bloqueia a promoção beta.

## Atualização da implementação — smoke da Edge Function e RLS-019 — 2026-08-21

A Edge Function `veritas-circuit-ai` foi auditada no projeto Supabase existente e está `ACTIVE`, com `verify_jwt=true` e versão 4. O endpoint confirmado é `https://hcwzsxdcvmswebunznak.supabase.co/functions/v1/veritas-circuit-ai`. Um POST descartável sem `Authorization` respondeu HTTP `401`, produzindo o primeiro resultado real `RLS-019 PASS` sem criar sessão ou registrar chaves.

Foi criado o comando `npm run beta:edge`, com contrato puro testável para classificação de status, montagem de endpoint e redaction. O runner executa RLS-019 sempre; RLS-020 e RLS-021 exigem explicitamente `RLS_EDGE_REQUIRE_AUTHENTICATED=1` e um token de conta descartável fornecido por variável de ambiente. Sem isso, ficam `SKIP`, nunca `PASS`.

A documentação registra o contrato implantado, o limite de payload, o fallback heurístico e o procedimento sanitizado. A promoção beta continua bloqueada até a análise autenticada e a tentativa de elevação RLS-021 serem executadas com uma conta descartável e UUIDs de outro usuário/projeto, além da matriz restante.

## Atualização da implementação — agregador de evidências beta — 2026-08-21

Foi criado o comando `npm run beta:evidence`, que combina relatórios sanitizados RLS, Edge Function e auditoria estrutural Supabase em `beta-evidence-manifest.json`. O agregador considera `PASS` somente quando todos os IDs esperados passam; `SKIP`, `PENDING`, `FAIL`, relatório ausente ou auditoria inválida deixam o gate `PENDING` e adicionam bloqueadores `openP1`. Falhas RLS explícitas e bypass de JWT são classificados como P0.

A execução real usando o relatório da Edge confirmou `RLS-019 PASS`, `RLS-020 SKIP` e `RLS-021 SKIP`, e terminou com exit code 1, como esperado. O manifesto parcial não foi usado para liberar beta. Os gates ainda pendentes são a matriz cross-user completa, auditoria estrutural anexada nessa execução, Realtime, HDL, acessibilidade/mobile, rollback e onboarding.

## Atualização da implementação — autorização Realtime temporal e runner de aceitação — 2026-08-21

A auditoria da colaboração temporal encontrou uma lacuna: `src/realtime/roomCollaboration.ts` já emitia `runtime_config` e `runtime_state`, mas as policies ROOM-001 permitiam apenas `circuit_snapshot`. A migration `20260821060000_allow_temporal_realtime_events.sql` corrige a allowlist de leitura e escrita para `circuit_snapshot`, `runtime_config` e `runtime_state`. Presence continua disponível somente para colaboradores, enquanto todos os eventos Broadcast exigem `private.veritas_can_edit_project(project_id)`, impedindo publicação por viewer.

As migrations `20260815000000_room_001_multi_room_conflict.sql` e `20260821033000_harden_veritas_authorization_surface.sql` foram alinhadas para manter o mesmo contrato em instalações reproduzíveis. O contrato puro `scripts/realtimeAcceptanceContract.mjs` e a declaração TypeScript correspondente expõem a allowlist, os IDs `RT-001` a `RT-005`, a classificação de status bloqueados, a sanitização de mensagens e a montagem do tópico privado.

Foi adicionado `npm run beta:realtime`. O runner exige `REALTIME_RUNNER_ALLOW_REAL=1` antes de abrir sessões e, no modo obrigatório, `RT_REQUIRE_REAL=1`. Os cinco cenários cobrem Presence do owner, `runtime_config` editor→owner, bloqueio de `runtime_state` por viewer, rejeição de usuário externo e rejeição de room inexistente. Tokens não são persistidos e mensagens são truncadas/sanitizadas.

O agregador `npm run beta:evidence` agora consome `BETA_REALTIME_REPORT` e só marca o gate `realtime` como `PASS` quando RT-001 a RT-005 possuem `PASS` explícito. Sem quatro contas descartáveis e sem verificação pós-migration no Supabase existente, o gate permanece `PENDING` e `REALTIME-EVIDENCE-INCOMPLETE` continua bloqueando a promoção para beta.

## Atualização da implementação — fortalecimento do gate HDL — 2026-08-21

A próxima fatia do roadmap fortalece o gate de exportação industrial sem alterar o escopo combinacional já entregue. Foram criadas fixtures públicas equivalentes `tests/fixtures/hdl/vector_and.v` e `tests/fixtures/hdl/vector_and.vhd`, ambas representando o mesmo AND vetorial de quatro bits. O teste `src/release/hdlAcceptanceContract.test.ts` compara o texto completo gerado por `exportVerilog` e `exportVhdl`, além de cobrir o contrato de relatório e sanitização.

O novo `npm run beta:hdl` executa HDL-001 com `iverilog -g2005`, HDL-002 com `ghdl -a --std=08` e HDL-003 com a regressão determinística do exportador. Sem toolchains, o modo local fica explicitamente em `SKIP`; com `HDL_REQUIRE_TOOLCHAINS=1`, a ausência de qualquer compilador vira `FAIL`. A execução real no sandbox produziu `HDL-001 PASS`, `HDL-002 PASS` e `HDL-003 PASS` após a correção da flag do iverilog.

O workflow `.github/workflows/quality.yml` agora instala `iverilog` e `ghdl` e executa o gate obrigatório em cada push/pull request. O agregador de evidências beta consome `BETA_HDL_REPORT` e só marca `gates.hdl` como `PASS` quando HDL-001 a HDL-003 possuem PASS explícito. A documentação operacional está em `docs/BETA-HDL-ACCEPTANCE.md`; ausência de evidência HDL continua mantendo `HDL-EVIDENCE-INCOMPLETE` e bloqueando a promoção beta.

## Atualização da implementação — acessibilidade, teclado e mobile/PWA — 2026-08-21

A fatia de acessibilidade adiciona um contrato executável A11Y-001 a A11Y-005 e o comando `npm run beta:accessibility`. O runner verifica skip link e landmarks do shell, navegação por teclado na tabela verdade, regiões `aria-live` para status offline/PWA e CircuitEditor, viewport `pt-BR` e canvas limitado pela viewport, além de uma regressão Vitest do contrato.

No produto, o `main` recebeu identificação e foco programático, o shell ganhou “Pular para o conteúdo principal”, as linhas interativas da tabela verdade respondem a Enter/Espaço e exibem `aria-selected`, e o foco visível global passou a ser consistente. O PWA anuncia atualização/conectividade com `aria-live="polite"`; o editor nomeia paleta, canvas, status e UUID de colaborador, respeitando `prefers-reduced-motion` e uma altura responsiva mínima para telas pequenas.

O workflow de qualidade executa o gate A11Y em cada push/pull request. O agregador beta consome `BETA_ACCESSIBILITY_REPORT` e só marca `gates.accessibility` como `PASS` quando os cinco IDs possuem PASS explícito. O relatório operacional está em `docs/BETA-ACCESSIBILITY-ACCEPTANCE.md`. A evidência estrutural não substitui inspeção manual em Chromium, Firefox, WebKit/iOS, viewport móvel, leitor de tela, zoom e instalação PWA; a promoção beta continua bloqueada até esses testes e os demais gates externos.

## Atualização da implementação — rollback ensaiável e recuperação operacional — 2026-08-21

Foi criado `npm run beta:rollback` com os cenários RB-001 a RB-005. O runner confirma que `v0.9.0-rc.1` resolve para um commit estável, que existe parent e release anterior recuperável, que o runbook contém salvaguardas P0/P1, que IndexedDB e histórico de versões passam os testes de recuperação e que o workflow de release valida refs sem reescrever tags existentes.

O ensaio é deliberadamente não destrutivo: não move tags, não apaga releases, não reescreve migrations, não altera Supabase, não executa rollback de deployment e não limpa IndexedDB. A recuperação real de produção continua sendo uma ação operacional no provedor de deployment, seguida de `smoke:release`, abertura de circuito local, leitura de versão remota autorizada e registro do incidente. O runbook completo está em `docs/ROLLBACK-RUNBOOK.md`.

O workflow de qualidade agora executa o runner de rollback. O agregador beta consome `BETA_ROLLBACK_REPORT` e só marca `gates.rollback` como `PASS` quando RB-001 a RB-005 possuem PASS explícito. Sem o ensaio e sem o registro operacional, `ROLLBACK-EVIDENCE-INCOMPLETE` permanece em `openP1` e a promoção beta continua bloqueada.

## Atualização da implementação — onboarding externo e primeiros passos — 2026-08-21

O Veritas agora apresenta um guia de primeiros passos no App, em português, com quatro ações visíveis: escrever uma expressão, observar tabela/circuito, preservar o trabalho local e decidir quando usar colaboração em nuvem. O guia explica que o primeiro uso não exige conta e inclui uma seção sobre o que continua funcionando offline.

Foi criado `docs/ONBOARDING.md` com o fluxo externo completo, checklist de conclusão, solução de problemas, limites beta e orientações para não compartilhar tokens ou dados privados. O README aponta para esse guia. O modo local-first continua sendo o caminho de entrada; autenticação, IA, sincronização e colaboração são explicitamente opcionais.

O novo `npm run beta:onboarding` executa ONB-001 (tutorial no app), ONB-002 (link no README), ONB-003 (guia cobre IndexedDB/rollback/limites) e ONB-004 (confirmação externa). Os três primeiros passaram; ONB-004 permanece `SKIP` por padrão e só pode virar PASS quando uma pessoa externa concluir o checklist com `ONBOARDING_EXTERNAL_PASS=1`. O agregador beta consome `BETA_ONBOARDING_REPORT`, mantendo `ONBOARDING-EVIDENCE-INCOMPLETE` em `openP1` enquanto a confirmação humana não existir.

## Atualização da implementação — interoperabilidade MCP por stdio — 2026-08-21

Foi criado `npm run beta:mcp`, um runner de subprocesso que negocia `initialize`, verifica `tools/list`, chama vetores golden de `truth_table`, `logic_case` e `propositional_truth_table`, valida erro controlado e confirma que stdout contém somente respostas JSON-RPC 2.0. Os seis cenários MCP-001 a MCP-006 passaram no servidor compilado.

O gate foi integrado ao workflow de qualidade e ao agregador por `BETA_MCP_REPORT`. A documentação em `docs/BETA-MCP-ACCEPTANCE.md` explica a configuração stdio para Claude Code, Codex, Hermes, OpenClaw, Manus e outros clientes MCP locais, sem exigir API key. O contrato separa falhas de domínio, schema, protocolo, transporte e configuração do cliente.

A aceitação prova interoperabilidade local do protocolo e das respostas, mas não substitui o teste de configuração visual em cada host, transporte remoto Streamable HTTP, autenticação remota ou teste de carga. O gate beta continua exigindo repetição da matriz por cliente quando uma integração específica for publicada.

## Atualização da implementação — preflight beta estrito — 2026-08-21

O validador formal `betaEvidence` agora inclui o gate `mcp` na lista obrigatória. O `beta-preflight` ganhou um contrato puro que ativa modo estrito com `BETA_PREFLIGHT_STRICT=1`, com `BETA_PREFLIGHT_REQUIRE_EVIDENCE=1` ou automaticamente para versões `*-beta.N`.

No modo estrito, a ausência de `BETA_EVIDENCE_MANIFEST`, `BETA_RLS_REPORT`, `BETA_SUPABASE_STRUCTURAL_REPORT` ou `SMOKE_URL` é FAIL, não SKIP. O manifesto também precisa declarar RLS, Realtime, HDL, acessibilidade, mobile, rollback, onboarding e MCP como PASS com evidência não vazia e nenhum P0/P1 aberto. O ensaio sem essas variáveis bloqueou a promoção como esperado, preservando a política de não promover sem contas descartáveis e evidências cross-user reais.

## Atualização da implementação — proveniência anti-simulação das evidências — 2026-08-21

Os runners RLS, Realtime e Edge agora escrevem marcadores de proveniência em seus relatórios. O preflight estrito valida esses marcadores, além dos IDs em PASS: quatro contas descartáveis e `RLS_RUNNER_ALLOW_REAL=1` para RLS; `REALTIME_RUNNER_ALLOW_REAL=1`, `RT_REQUIRE_REAL=1` e sessões autenticadas para Realtime; `RLS_EDGE_REQUIRE_AUTHENTICATED=1` e JWT descartável para Edge.

Relatórios `SAFE`, `SKIP`, `ANONYMOUS_ONLY`, sem marcador, com cenário faltante ou com qualquer cenário não-PASS não são aceitos como evidência de promoção. A mudança não cria contas nem acessa credenciais; ela apenas torna o preflight incapaz de confundir smoke local com aceitação cross-user real.

## Atualização da implementação — doctor de prontidão beta real — 2026-08-21

Foi criado `npm run beta:readiness`, um diagnóstico local e não destrutivo que verifica seis áreas: Supabase público, quatro contas RLS, Realtime cross-user, Edge autenticada, artefatos de evidência e janela de versão beta. O comando não abre sessões, não faz requests, não lê valores de credenciais e não executa runners reais.

O relatório usa `READY`, `BLOCKED` e `SKIP`. No estado atual `v0.9.0-rc.1`, o ensaio local resultou em 0 READY, 5 BLOCKED e 1 SKIP, sem expor segredos. Isso é esperado: as credenciais descartáveis, tokens Realtime, JWT da Edge e artefatos reais ainda não foram fornecidos. O runbook está em `docs/BETA-READINESS-DOCTOR.md`; `READY` confirma apenas presença de configuração, nunca isolamento ou autorização.

## Atualização da implementação — guard de promoção SemVer — 2026-08-21

Foi criado o contrato puro `scripts/releasePromotionContract.mjs`, com classificação explícita de canais `alpha`, `beta`, `rc` e estável. O novo comando `npm run release:guard` rejeita versões inválidas e mantém o fail-closed para beta: o preflight deve estar estrito, o manifesto de evidências deve estar em `PASS` e uma aprovação explícita deve existir. O guard não cria tags, não publica releases e não substitui os runners reais.

O workflow `.github/workflows/release.yml` executa o guard automaticamente quando a versão contém `-beta.`. No CI, `VERITAS_BETA_EVIDENCE_STATUS=PASS` e `VERITAS_BETA_APPROVED=true` são variáveis protegidas; sem elas a promoção beta falha antes dos passos de publicação. RC, alpha e estável continuam no fluxo geral de testes, typecheck, lint, builds e smoke.

A documentação operacional está em `docs/RELEASE-PROMOTION-GUARD.md`, incluindo uso local, integração CI, validação opcional direta de `beta-evidence-manifest.json` e limites anti-simulação. Os testes determinísticos cobrem classificação SemVer, bloqueio de beta incompleto, autorização completa e ausência de bloqueio beta para RC/estável. A promoção beta continua bloqueada até RLS-001 a RLS-022, RT-001 a RT-005, RLS-020/RLS-021 e ONB-004 possuírem evidências reais, revisadas e sem P0/P1.

## Atualização do processo de entrega — habilidade reutilizável — 2026-08-21

A habilidade reutilizável `veritas-feature-delivery` foi atualizada no ambiente de trabalho do agente para refletir o estado atual do projeto. O fluxo agora inclui `beta:readiness` como diagnóstico não destrutivo, `beta:preflight` estrito, proveniência anti-simulação para RLS/Realtime/Edge, o agregador de evidências e `release:guard` antes de qualquer tag. A referência RLS também passou a documentar os eventos temporais `runtime_config` e `runtime_state`, além do isolamento por projeto e room.

A habilidade foi validada com `quick_validate.py` e permanece abaixo do limite de 500 linhas no arquivo principal. O artefato reutilizável continua separado do código de produto; esta entrada registra apenas a atualização do processo para que futuras fatias sigam os mesmos gates e sejam publicadas na `main`.

## Atualização da implementação — feedback acionável e tooltips do editor — 2026-08-21

O editor visual agora transforma os códigos de `CircuitIssue` em orientações reutilizáveis em português, com título, ação de correção e componente afetado. O status do canvas exibe o total de problemas, mostra até três correções prioritárias e informa quando existem itens adicionais, sem alterar a validação canônica nem o comportamento local-first.

Foi adicionado o componente `AccessibleTooltip`, que associa cada orientação a uma descrição acessível por foco e hover. Os controles de largura de sinal, período de Clock e tiques de Delay agora explicam seus efeitos sem depender somente do atributo `title`. O contrato `validationFeedback` possui testes determinísticos para todos os códigos de validação, circuito válido e resumo de múltiplos problemas.

A suíte completa, typecheck, lint, build frontend/PWA, build MCP e smoke local passaram. A inspeção no build local confirmou a presença do resumo `Validação do circuito` e do tooltip acessível. A inspeção manual em navegadores móveis, leitor de tela e zoom continua parte do gate beta externo e não foi convertida em aprovação automática.

## Atualização da implementação — gate A11Y para feedback e tooltips — 2026-08-21

O runner `npm run beta:accessibility` foi fortalecido sem alterar os cinco IDs públicos A11Y-001 a A11Y-005. O cenário A11Y-004 agora verifica, além de viewport e canvas responsivo, o status vivo do CircuitEditor, o resumo `Validação do circuito`, a lista de orientações e o componente `AccessibleTooltip` com gatilho focável, `aria-describedby`, `role="tooltip"` e visibilidade por foco.

O cenário A11Y-005 executa em conjunto os testes do contrato de acessibilidade e de `validationFeedback`, evitando que o novo feedback perca cobertura. O runbook `docs/BETA-ACCESSIBILITY-ACCEPTANCE.md` foi alinhado. A execução produziu 5 PASS, e a suíte completa permaneceu com 314 testes aprovados; typecheck, lint, build frontend/PWA e build MCP também passaram.

Esse gate estrutural não substitui a inspeção manual com leitor de tela, navegadores móveis, zoom, rotação e dispositivo físico. A promoção beta continua bloqueada até essas evidências externas e os demais gates cross-user reais estarem completos.

## Atualização da implementação — gate mobile manual e proveniência — 2026-08-21

Foi criado `npm run beta:mobile` com os cenários MOBILE-001 a MOBILE-004. Sem `MOBILE_MANUAL_EVIDENCE_PATH`, o runner gera `SKIP` explícito e não simula inspeção. Para aceitar uma revisão externa, exige `MOBILE_MANUAL_ALLOW_REAL=1`, JSON com `executionMode: REAL_MANUAL`, guard, revisor, dispositivo, navegador, timestamp e todos os cenários em `PASS` com evidência não vazia.

O agregador beta agora consome `BETA_MOBILE_REPORT`, o preflight estrito exige essa fonte e valida seus marcadores de proveniência, e o readiness doctor passou a considerar `artifacts/mobile-acceptance.md` no conjunto de artefatos. O workflow de qualidade executa o runner no modo seguro; assim, a CI continua determinística, mas o manifesto mantém `MOBILE-EVIDENCE-INCOMPLETE` enquanto a inspeção humana não for anexada.

A documentação operacional está em `docs/BETA-MOBILE-ACCEPTANCE.md`; `docs/BETA-EVIDENCE-MANIFEST.md`, `docs/BETA-READINESS-DOCTOR.md` e `docs/RELEASE-GATES.md` foram alinhados. O relatório estrutural de teste passa apenas no ensaio local e não representa aprovação mobile real.

## Atualização da implementação — retenção de evidências sanitizadas no CI — 2026-08-21

O workflow `quality.yml` agora preserva, sempre que a execução termina, somente `artifacts/*.md` no artefato `veritas-acceptance-reports-{run_id}` com retenção de 14 dias. O pacote não inclui manifests JSON, arquivos de ambiente, tokens ou logs de preview. A medida melhora a auditoria dos gates A11Y, mobile, HDL, rollback, onboarding e MCP sem transformar `SKIP`, mocks ou relatórios anônimos em aprovação.

A política foi documentada em `docs/BETA-EVIDENCE-MANIFEST.md`. A permissão do workflow continua limitada a `contents: read`; o upload não publica releases, não cria tags e não acessa o Supabase.

## Atualização da implementação — feedback de sintaxe localizado — 2026-08-21

A calculadora agora aproveita os offsets já fornecidos por `VeritasError` para exibir posição linha/coluna, trecho afetado e um marcador visual no campo de expressão. O formatter puro `src/engine/expressionErrorPresentation.ts` mantém a semântica do parser intacta, trata erros no fim da entrada e continua funcionando no modo local-first.

O `ExpressionInput` associa o feedback ao campo com `aria-describedby`, mantém `aria-invalid` e anuncia o erro em uma região `role="alert"`. A mensagem original e a sugestão do parser continuam preservadas; o novo contexto não depende apenas de cor ou de hover. Foram adicionados testes para primeira linha, quebra de linha e EOF.

## Atualização da implementação — ordenação determinística Realtime — 2026-08-21

A colaboração Realtime passou a usar o contrato puro `src/realtime/eventOrdering.ts`. Cada sala mantém um último evento por tipo (`snapshot`, `runtime_config` e `runtime_state`) e aceita somente a ordem lexicográfica por `baseVersion`, timestamp ISO, `clientId` e hash. Duplicatas, eventos atrasados e desempates perdedores são descartados antes de notificar a UI; a ordenação é reiniciada ao desconectar.

A validação estrutural agora rejeita timestamps inválidos, e os eventos locais entram no mesmo redutor antes do envio. Foram adicionados testes unitários para a ordem determinística e teste de integração com snapshots fora de ordem. O runbook `docs/BETA-REALTIME-ACCEPTANCE.md` registra o comportamento e sua limitação: isso protege convergência local, mas não substitui RLS/Realtime cross-user real nem prova autorização do Supabase.

## Atualização da implementação — feedback de colaboração no editor — 2026-08-21

O hook `useCircuitCollaboration` passou a encaminhar o envelope completo do snapshot remoto, preservando `baseVersion` para a camada de UI. O CircuitEditor agora informa quando uma alteração remota foi aplicada e exibe a última versão remota aplicada em uma região acessível com `role="status"` e `aria-live="polite"`, junto da sala ativa, conexão e participantes.

A mudança não altera a política de autorização nem aplica documentos fora do fluxo já validado. Quando a colaboração está desativada ou desconectada, o editor continua funcionando localmente. O gate A11Y mantém a regressão estrutural do novo status.

## Atualização da implementação — proteção contra sobrescrita remota — 2026-08-21

O CircuitEditor agora compara o documento local com o último baseline sincronizado antes de aplicar um snapshot Realtime. Se o local estiver limpo, a atualização remota é aplicada; se já estiver refletida, é ignorada; se houver alterações locais não sincronizadas, o snapshot fica pendente e o usuário escolhe entre `Aplicar alteração remota` e `Manter alterações locais`.

O baseline é atualizado ao abrir ou sincronizar um projeto cloud e é limpo ao abrir um projeto local. O callback de colaboração informa ao hook se o snapshot foi realmente aplicado, evitando que a versão remota exibida no painel represente uma mensagem apenas adiada. O contrato puro `src/circuit/remoteConflict.ts` e seus testes cobrem as três decisões.

## Atualização da implementação — versão remota aplicada com precisão — 2026-08-21

A indicação `Última atualização remota aplicada` passou a ser um estado local do CircuitEditor, atualizado dentro de `applyRemoteSnapshot`. Assim, um snapshot adiado por conflito ou ignorado por já estar refletido não aparece como aplicado; ao clicar em `Aplicar alteração remota`, a versão passa a ser registrada corretamente. A troca para projeto local e a sincronização de um novo projeto limpam esse indicador.

## Atualização da implementação — code splitting dos workspaces — 2026-08-21

Os workspaces ALGO-002, LogicCaseLab, SequentialWorkspace, ProjectsPanel e ChipLibrary passaram a ser carregados sob demanda com `React.lazy` e `Suspense`. A calculadora principal permanece no carregamento inicial, enquanto cada bloco avançado possui fallback `role="status"` com anúncio em português.

O chunk inicial caiu de aproximadamente 565 kB para 456 kB após a primeira separação, ficando abaixo do limite de aviso de 500 kB. O build PWA passou a gerar os chunks independentes dos workspaces e preserva o funcionamento local-first; o gate A11Y protege o fallback acessível.

## Atualização da implementação — recuperação de chunks lazy — 2026-08-21

Foi adicionado `WorkspaceBoundary` ao App para capturar falhas de carregamento dos módulos sob demanda. O usuário recebe uma mensagem em português, sem detalhes internos do bundle, e o botão `Tentar novamente` recarrega a aplicação para buscar os chunks novamente. O fallback usa `role="alert"` e `aria-live="assertive"`; o estado de carregamento continua em `role="status"`/`aria-live="polite"`.

O boundary cobre ALGO-002, LogicCaseLab, SequentialWorkspace, CircuitEditor, ProjectsPanel e ChipLibrary. A calculadora principal continua fora dessa fronteira, e o modo local-first não depende do carregamento dos workspaces avançados.

## Atualização da implementação — contrato de canais wireless — 2026-08-21

Foi criado `src/circuit/wirelessChannels.ts` com normalização e resolução determinística de canais `transmitter`/`receiver`. A regra aceita um transmissor por canal, ordena receptores por `nodeId`, valida canal vazio, endpoint duplicado, receptor órfão e largura incompatível.

Esta é uma fatia de domínio intencionalmente segura: ainda não adiciona tipos wireless ao documento persistido, ao canvas, ao avaliador ou aos exportadores. A próxima etapa deverá integrar esses tipos de forma coordenada para não aceitar parcialmente circuitos que a validação, o Realtime ou o HDL não consigam representar.

## Atualização da implementação — auditoria Veritas Next — 2026-08-22

A auditoria factual do repositório foi registrada em [`VERITAS_AUDIT.md`](../VERITAS_AUDIT.md). O estado encontrado confirma uma base funcional ampla — engine pura, CircuitDocument v1, editor visual, simulação temporal, IndexedDB, Supabase/Auth/Realtime, HDL, ALGO-001/002/003, MCP stdio e gates de release — mas também identifica contratos duplicados de validação, concentração de responsabilidades no `CircuitEditor.tsx`, divergência de versão do plugin e ausência de evidências cross-user reais para promoção beta.

O próximo incremento foi definido como `FOUNDATION-001`: consolidar contrato runtime do documento, normalização defensiva, limites, migração de schema, topo sort compartilhado, vetores de validação entre TypeScript/SQL/Edge e alinhamento do artefato do plugin. A expansão wireless permanece isolada até atravessar domínio, validação, engine, UI, persistência e HDL com uma fatia vertical completa.

## Implementação FOUNDATION-001 — contrato canônico e normalização — 2026-08-22

A fundação começou em `src/circuit/documentContract.ts`, `src/circuit/documentLimits.ts` e `src/circuit/topology.ts`. O contrato agora normaliza nome, IDs, labels e referências sem mutar documentos; aplica limites de nome, cardinalidade e payload; expõe guard estrutural; e centraliza a ordem topológica determinística usada pela avaliação escalar e vetorial.

A integração alcança netlist, contexto/hash de IA, tabelas verdade, otimização, exportadores HDL, IndexedDB, diffs de histórico e clientes cloud/IA. A Edge Function recebeu a réplica defensiva dos limites e exige Bearer antes de processar payload. O plugin foi alinhado para `0.9.0-rc.1` e o bundle autocontido foi regenerado.

A etapa mantém `CircuitDocument` v1, não habilita novos componentes e não aplica migração destrutiva. Os testes de fundação cobrem normalização, limites, payload serializado, ordem topológica, ciclos, consumidores, IndexedDB e diffs. Ainda faltam os gates completos finais antes da publicação.

## Implementação WIRELESS-001 — integração vertical inicial — 2026-08-22

A fundação wireless agora atravessa o modelo canônico: `transmitter` e `receiver` foram adicionados ao `ComponentType`, `EditorComponentType`, paleta e serialização do CircuitEditor. O transmissor possui uma entrada convencional; o receptor recebe uma entrada virtual derivada do canal e não cria conexão visual de entrada.

`validateCircuit` resolve canais antes de aceitar o documento e publica feedback acionável para canal ausente, transmissor duplicado e receptor órfão. O netlist injeta a dependência `{ node: transmitterId }` para cada receptor. Avaliação escalar, avaliação vetorial e simulador temporal tratam ambos como pass-throughs, preservando a ordem topológica determinística.

O CircuitEditor oferece o campo `Canal`, exibe TX/RX com canal e largura, restaura os nós wireless ao abrir documentos e mostra canais ativos no status de validação. IndexedDB, cloud, Realtime e IA continuam usando o documento canônico existente. Verilog e VHDL exportam os endpoints como sinais internos, sem inventar portas físicas para o canal.

A fatia não inclui latência, arbitragem, tri-state, sinais `X/Z`, edição inline de canal em nó existente ou radio físico. O canal atual é um túnel lógico combinacional determinístico com um transmissor por canal.

## Planejamento WIRELESS-002 — edição de canal no nó — 2026-08-22

Após a integração inicial, o principal gap de usabilidade é que o campo `Canal` da toolbar só define novos nós; documentos importados ou nós já criados não podem corrigir o canal sem serem recriados. A próxima fatia será vertical e limitada: selecionar um nó wireless, editar seu canal em um painel acessível, normalizar o valor, refletir a alteração no canvas/documento e manter os gates existentes bloqueando canais inválidos.

Critérios de aceite: seleção de transmitter/receiver sem alterar seleção de tabela, edição somente para nós wireless, canal vazio e acima de 64 caracteres com feedback em português, histórico undo/redo preservado, persistência local/cloud usando o documento canônico e regressão de acessibilidade sem alterar a semântica de canais ou conexões convencionais.

## Planejamento CHIP-001 — biblioteca local de definições — 2026-08-22

Após estabilizar o editor e os canais wireless, a próxima fatia priorizada do ciclo v0.10 será uma fundação de hierarquia sem alterar ainda o netlist existente: transformar um `CircuitDocument` combinacional válido em uma definição serializável de chip customizado e persistir essa definição localmente no IndexedDB.

Critérios de aceite: somente documentos v1 válidos, acíclicos e combinacionais podem virar chip; entradas e saídas devem ter ordem determinística e nomes normalizados; a definição deve manter o documento original sem mutação; o schema Dexie deve evoluir sem quebrar stores existentes; o editor deve oferecer salvar como chip com feedback em português; ausência de IndexedDB deve degradar sem interromper o circuito; avaliação hierárquica e instanciação no canvas ficam explicitamente para CHIP-002.

## Implementação CHIP-002 — instanciação e avaliação hierárquica — 2026-08-22
A biblioteca local de chips agora pode ser usada como componente `custom-chip` no documento canônico e na paleta do CircuitEditor. Cada instância referencia um `customChipId`, exibe handles indexados por entrada/saída, é serializada de forma reversível e é reconstruída com as portas da definição disponível. A validação usa a cardinalidade e a largura das portas da definição, rejeitando referências ausentes com feedback acionável sem quebrar o documento local.

A avaliação escalar e vetorial foi estendida com expansão hierárquica recursiva, limite seguro de oito níveis e ordem topológica determinística. Saídas múltiplas são mantidas no redutor interno; consumidores vetoriais públicos preservam o contrato de um valor por nó, expondo a primeira saída para compatibilidade. A tabela-verdade aceita a biblioteca local e continua enumerando apenas as entradas externas. Instâncias aninhadas, HDL e análise/otimização de IA permanecem bloqueadas nesta etapa para não emitir artefatos incompletos; a criação de chips aninhados também é rejeitada.

Critérios de aceite: instâncias combinacionais locais devem ser inseridas no canvas, conectadas por handles indexados, salvas/reabertas sem perder portas, avaliadas em sinais escalares e vetoriais, aparecer na tabela-verdade externa, rejeitar definições ausentes e preservar o fallback quando IndexedDB não estiver disponível. A próxima etapa pode tratar exportação HDL hierárquica e contexto de IA, somente após contratos e testes específicos.

## Implementação CHIP-003 — exportação HDL de chips instanciados — 2026-08-22
A exportação industrial agora aceita instâncias `custom-chip` por meio de uma etapa de elaboração hierárquica. A elaboração valida as definições locais, cria namespaces determinísticos para nós internos, remapeia conexões de fronteira e marca entradas/saídas internas para que sejam emitidas como sinais, não como portas externas. Canais wireless internos recebem namespace por instância para impedir colisões entre reutilizações da mesma definição.

Verilog e VHDL continuam gerando um único módulo/entity achatado, com nomes alocados de forma segura e largura vetorial preservada. A API de exportação recebe `customChips` opcional; chamadas antigas continuam funcionando para circuitos nativos, enquanto uma instância sem definição local falha antes de produzir artefato. A análise e otimização de IA permanecem bloqueadas no editor para circuitos hierárquicos até que exista um contrato próprio para contexto e documentos otimizados.

Critérios de aceite: exportar Verilog e VHDL para uma instância válida sem expor portas internas; preservar atribuições internas, larguras e fronteira externa; rejeitar definição ausente, recursão e profundidade insegura; manter canais wireless isolados; aprovar suíte completa, typecheck, lint, builds MCP/plugin e smoke PWA antes do commit na main.

## Implementação CHIP-004 — contexto hierárquico para IA — 2026-08-22
O contexto de circuito agora aceita a biblioteca local de chips e mantém duas representações complementares: `payload.document` continua sendo o documento hierárquico canônico salvo/sincronizado, enquanto `payload.elaboratedDocument` é uma representação achatada, validada e namespaced para análise. O payload inclui apenas metadados mínimos das definições usadas — ID, nome e nomes de portas — sem credenciais ou conteúdo de projetos não referenciados.

O cliente `requestCircuitAi` encaminha essas definições, valida respostas otimizadas com a mesma biblioteca local e preserva a aplicação manual da sugestão. O hook cloud e os clientes de projetos/versões passaram a usar as definições locais para validar, hashear, listar e sincronizar circuitos com `custom-chip`, mantendo o diff e o documento hierárquico original. A Edge Function valida o documento hierárquico e o elaborado, usa a representação elaborada no fallback heurístico e ignora portas internas marcadas como fronteira ao determinar saídas.

Critérios de aceite: contexto nativo permanece determinístico e compatível; circuito hierárquico inclui elaboração e metadados; resposta otimizada hierárquica é aceita somente com definição local válida; cloud preserva a forma original; ausência de credenciais Supabase continua permitindo o modo local-first. O gate real da Edge Function executado contra o projeto existente confirmou RLS-019 PASS sem JWT; RLS-020 e RLS-021 permaneceram SKIP por ausência deliberada de JWT descartável, sem promoção de beta.

## Implementação MCP-007 — simulação de chips customizados — 2026-08-22
O servidor MCP passou a aceitar `custom-chip` na ferramenta `simulate_circuit`. Cada instância referencia `options.customChipId` e recebe a definição correspondente em `custom_chips`, permitindo que Claude Code, Codex, Hermes, OpenClaw, Manus e outros clientes stdio simulem chips sem acessar o IndexedDB do navegador.

O núcleo MCP valida IDs únicos, limite de 128 definições por chamada, documentos `veritas-circuit` válidos e definições combinacionais CHIP-001 antes de expandir as instâncias. A expansão preserva os componentes temporais externos, converte as fronteiras internas em componentes compatíveis com o simulador e oferece aliases para acompanhar a saída da instância no `watch`. Referências ausentes, documentos inválidos, chips aninhados e tipos não representáveis são retornados como erros controlados.

O contrato de aceitação foi ampliado para MCP-007, com vetor golden no runner stdio, cobrindo propagação de uma instância NOT e a forma textual do diagrama de tempo. Os cenários MCP-001 a MCP-007 permanecem locais, determinísticos e sem credenciais; esse gate comprova interoperabilidade do protocolo e do conteúdo, não autenticação remota, transporte HTTP ou testes específicos de cada host.

## Implementação MCP-008 — tabela-verdade de circuitos no MCP — 2026-08-22
O servidor MCP agora expõe `circuit_truth_table`, uma ferramenta portátil que recebe um `CircuitDocument` serializável, permite selecionar `output_id`, limita a enumeração por `max_rows` e devolve Markdown determinístico com colunas, linhas e classificação. Circuitos com `custom-chip` usam o mesmo array explícito `custom_chips` do MCP-007, sem depender do IndexedDB do navegador.

A ferramenta reaproveita `buildCircuitTruthTable` e o avaliador hierárquico do domínio. Definições locais são reconstruídas e validadas antes da enumeração; referências ausentes, chips inválidos e circuitos sequenciais ou vetoriais incompatíveis retornam erro controlado. A aceitação MCP foi ampliada para MCP-008, com golden de um NOT customizado e verificação de doze ferramentas no `tools/list`.

Critérios de aceite: chamadas anteriores permanecem compatíveis; documento nativo e documento com custom-chip geram tabela correta; `output_id`, limite de linhas e erros são determinísticos; o vetor stdio mantém somente JSON-RPC no stdout; clientes interoperáveis recebem o mesmo conteúdo sem credenciais ou acesso a dados privados. A ferramenta é escalar por desenho: tabelas vetoriais e circuitos sequenciais continuam fora deste contrato.

## Implementação MCP-009 — exportação HDL pelo MCP — 2026-08-22
O servidor MCP agora expõe `export_circuit_hdl`, recebendo um `CircuitDocument`, o formato `verilog` ou `vhdl` e, opcionalmente, o array explícito `custom_chips`. A ferramenta reaproveita os exportadores centrais, a elaboração hierárquica CHIP-003 e os mesmos contratos de validação utilizados pelo editor.

Circuitos com `custom-chip` são elaborados antes da emissão, preservando somente a interface externa e convertendo portas internas em sinais namespaced. Definições ausentes, documentos inválidos, recursão, larguras incompatíveis e outros erros de HDL são devolvidos como respostas MCP controladas, sem produzir artefato enganoso. Chamadas anteriores continuam compatíveis e não exigem credenciais ou acesso ao navegador.

O gate stdio foi ampliado para MCP-009, com golden de Verilog contendo instância NOT, verificação da interface externa e erro para definição ausente. A ferramenta é local por desenho; transporte remoto, autenticação HTTP e testes específicos de cada host continuam fora desta etapa.

## Planejamento MCP-010 — tabela verdade vetorial no MCP — 2026-08-22
A próxima fatia formal do MCP será `circuit_vector_truth_table`, uma ferramenta local e determinística para circuitos `CircuitDocument` com barramentos. Ela reutilizará `buildCircuitVectorTruthTable`, receberá `document`, `output_id`, `max_bits`, `max_rows` e `custom_chips`, e devolverá Markdown estável com colunas, larguras, combinações binárias, contagem de linhas, truncamento e classificação. O limite público será de até 12 bits de entrada e no máximo 4096 linhas geradas, conforme o contrato vetorial já validado no domínio.

A implementação não criará transporte remoto nem exigirá autenticação, IndexedDB ou acesso ao Supabase. Definições `custom-chip` continuarão sendo explícitas no payload; documentos inválidos, referências ausentes, widths incompatíveis, limites excedidos e circuitos não suportados retornarão erros MCP controlados. O MCP-010 não altera os schemas das 13 ferramentas existentes e mantém stdio como transporte interoperável para Claude Code, Hermes, OpenClaw, Codex, Manus, ChatGPT e outros hosts compatíveis.

Critérios de aceite: teste unitário do formatador e dos limites; golden stdio de AND vetorial de quatro bits; validação de `output_id`, `max_bits`, `max_rows` e `custom_chips`; erro determinístico para definição ausente e documento incompatível; `tools/list` com a nova ferramenta; stdout contendo somente JSON-RPC; suíte, typecheck, lint, builds e smoke MCP verdes. A matriz RLS-001…RLS-022 e RT-001…RT-005 permanece independente e continua bloqueando o beta até possuir evidência real PASS.

## Planejamento MCP-011 — transporte remoto autenticado — 2026-08-22
O próximo bloco de interoperabilidade será um adaptador remoto opcional para clientes que exigem uma URL, sem substituir o servidor stdio local. O contrato seguirá a revisão Streamable HTTP escolhida no momento da implementação: endpoint único POST, respostas JSON ou SSE por requisição, validação de `Origin`, cabeçalhos de versão/método/nome e nenhuma dependência do IndexedDB ou de segredos no frontend. A revisão exata deverá ser fixada no código e nos testes; não serão misturados mecanismos legados de GET, sessão ou `Last-Event-ID` sem uma decisão de compatibilidade explícita.

A autenticação será tratada como requisito obrigatório do transporte HTTP, com um resource server OAuth compatível com o provedor selecionado, descoberta de Protected Resource Metadata, resource indicator/audience, PKCE no fluxo do cliente e validação de escopo/audience no servidor. Não será criado um endpoint público com token estático apenas para “parecer remoto”. O servidor deverá limitar origem, método, tamanho de corpo, tempo de execução e exposição de mensagens, além de manter logs sanitizados e respostas 401/403/400 determinísticas.

A implementação será separada em uma entrada HTTP testável e uma fábrica comum de ferramentas MCP, preservando os 14 schemas atuais e o transporte stdio. O escopo inicial não incluirá deploy público nem alteração no frontend; primeiro serão entregues contrato, testes de conformidade de headers/origin/auth, smoke local com servidor efêmero e documentação para configuração segura. O beta continua independente e só poderá avançar com RLS/Realtime reais, mesmo que MCP-011 seja aprovado.

Critérios de aceite: contrato de versão registrado; testes negativos para Origin ausente/inválido conforme política adotada, método/path incorretos, body excedente, header/body divergente e bearer inválido; 401 com metadados de recurso quando aplicável; teste positivo com autorização real do provedor sem registrar tokens; equivalência dos golden MCP-001…MCP-010 entre stdio e HTTP; smoke local/HTTPS controlado; auditoria sem segredo no bundle/frontend; documentação de threat model, rate limit, observabilidade e rollback. A publicação remota ficará bloqueada até o contrato e o provedor de autorização serem aprovados.

## Implementação MCP-011 — transporte HTTP local protegido — 2026-08-22
A primeira fatia do MCP-011 foi entregue sem substituir o stdio. `mcp/src/server.ts` agora expõe `createVeritasServer` e `registerVeritasTools`; `mcp/src/stdio.ts` mantém o entrypoint local; `mcp/src/http-entry.ts` inicia o transporte HTTP somente quando recebe Bearer e allowlist de Origin por ambiente; e `mcp/src/http-server.ts` encapsula o handler stateless baseado em `StreamableHTTPServerTransport`. O build separado produz `mcp/dist/http-server.js`, enquanto `mcp/dist/server.js` continua sendo o binário stdio.

O contrato implementado fixa `2025-11-25`, exige `POST /mcp`, `Accept` com JSON e SSE, `Content-Type: application/json`, `MCP-Protocol-Version`, Bearer exato, Origin permitida e limite padrão de 1 MiB. `GET`, JSON inválido, HeaderMismatch, credencial ausente, Origin inválida e payload excedente geram respostas controladas. O servidor faz bind em `127.0.0.1` por padrão, não persiste tokens e não publica endpoint HTTPS.

Critérios de aceite realizados: cinco testes unitários do handler; nove checks HTTP locais; equivalência de `initialize`, `tools/list` e `truth_table` com a superfície stdio; typecheck; build separado dos dois transports; `node --check` dos bundles; e runner sanitizado `beta:mcp:http` com 9 PASS, 0 FAIL e 0 SKIP. Os workflows de quality e release foram atualizados para executar o build/acceptance HTTP. A etapa remota OAuth continua bloqueada até escolha de provedor, metadata de recurso, audience/resource, PKCE, HTTPS, rate limiting, threat model e smoke externo.

## Planejamento MCP-012 — contrato local de Protected Resource Metadata — 2026-08-22
A próxima fatia será um contrato puro e testável para gerar Protected Resource Metadata sem expor um endpoint remoto por padrão. O módulo receberá uma configuração explícita de `resource`, `authorization_servers`, `scopes_supported` e `bearer_methods_supported`, rejeitará URLs não HTTPS fora de localhost e devolverá somente o documento mínimo necessário para um future HTTP adapter. O MCP-012 não fará login, não emitirá tokens, não armazenará credenciais e não alterará o transporte stdio.

Critérios de aceite: schema versionado e validado; normalização determinística de URLs; rejeição de `resource`/authorization server inválidos, credenciais em query string e escopos vazios; testes positivos/negativos sem rede; documentação do contrato e do threat model; integração apenas em configuração local do handler, sem rota pública habilitada. A implementação OAuth real, descoberta dinâmica, PKCE e smoke HTTPS permanecerão condicionados à escolha e aprovação de um provedor.

## Planejamento MCP-013 — rota local opt-in de Protected Resource Metadata — 2026-08-22
Depois do contrato puro MCP-012, a próxima fatia será integrar a metadata ao servidor HTTP local sem mudar o default seguro. A rota `/.well-known/oauth-protected-resource` existirá somente quando uma configuração explícita e completa for fornecida pelo ambiente, continuará disponível apenas no bind local por padrão, rejeitará configurações parcialmente preenchidas e não emitirá tokens nem fará descoberta dinâmica.

Critérios de aceite: default sem metadata continua retornando 404; configuração completa retorna JSON determinístico no path well-known; configurações incompletas ou inválidas impedem o processo de iniciar; a rota não exige Bearer apenas para leitura de metadata, mas mantém CORS/origin controlado; testes cobrem ausência, sucesso, URL insegura e ausência de segredos; nenhum deployment público será criado nesta etapa.

## Implementação MCP-013 — rota local opt-in de Protected Resource Metadata — 2026-08-22
A rota `/.well-known/oauth-protected-resource` foi integrada ao handler HTTP local somente quando `VERITAS_MCP_HTTP_RESOURCE` e `VERITAS_MCP_HTTP_AUTHORIZATION_SERVERS` são definidos no ambiente. `VERITAS_MCP_HTTP_SCOPES` é opcional; qualquer configuração parcial falha antes de iniciar o processo. O default continua 404, o MCP `/mcp` continua exigindo Bearer e o stdio permanece inalterado.

Critérios realizados: metadata ausente retorna 404; metadata opt-in retorna JSON determinístico; Origin ausente retorna 403; cinco testes unitários do contrato MCP-012, sete testes do handler HTTP, nove checks de regressão MCP-011 e cinco checks MCP-013; typecheck, build HTTP, `node --check` e runner combinado com 14 PASS, 0 FAIL e 0 SKIP. Nenhum token é emitido/persistido e nenhuma rota pública foi habilitada. OAuth real, HTTPS público, discovery dinâmica, PKCE, rate limiting, threat model e smoke remoto continuam bloqueados até provedor aprovado.

## Planejamento MCP-014 — conformidade CORS da metadata local — 2026-08-22
Com o modo remoto deliberadamente adiado, a próxima fatia local-only será corrigir e explicitar a resposta CORS da rota de Protected Resource Metadata. A rota deve anunciar somente `GET, OPTIONS`, manter `POST` bloqueado, devolver `Vary: Origin` e não ampliar a superfície de headers ou métodos do endpoint MCP protegido. O contrato será testado no handler e no runner sanitizado, sem rede pública, login ou mudança no stdio.

Critérios de aceite: `GET` e preflight `OPTIONS` da metadata retornam `Access-Control-Allow-Methods: GET, OPTIONS`; `POST` continua `405`; Origin fora da allowlist continua `403`; o endpoint `/mcp` continua anunciando somente `POST, OPTIONS` e exigindo Bearer; regressão dos 14 checks anteriores, suíte, builds e smoke permanecem verdes.

## Implementação MCP-014 — conformidade CORS da metadata local — 2026-08-22
O handler agora usa headers CORS específicos para a rota de metadata: somente `GET, OPTIONS` são anunciados, `Vary: Origin` é preservado e `POST` continua bloqueado. O endpoint `/mcp` manteve seu contrato separado de `POST, OPTIONS`, Bearer obrigatório e allowlist de Origin. O stdio, o schema das ferramentas e a exposição local-only não foram alterados.

Critérios realizados: regressões unitárias do preflight MCP, GET/OPTIONS da metadata, `Vary: Origin`, POST 405 e Bearer no `/mcp`; acceptance combinado MCP-011/MCP-013/MCP-014 com 17 PASS, 0 FAIL e 0 SKIP; typecheck e build HTTP aprovados. OAuth remoto, HTTPS público e qualquer deployment externo continuam fora do escopo.

## Planejamento MCP-015 — proteção contra colisão de paths locais — 2026-08-22
A próxima fatia local-only será tornar fail-closed a configuração do path HTTP: o path configurável do MCP não poderá coincidir com `/.well-known/oauth-protected-resource`, rota reservada à metadata opt-in. Isso evita que uma configuração acidental torne o `/mcp` inacessível ou faça o handler interpretar requisições MCP como discovery. A mudança não altera stdio, schemas, OAuth ou a disponibilidade da metadata.

Critérios de aceite: configuração com path MCP igual ao path reservado falha no startup com mensagem determinística; paths válidos continuam funcionando; o runner sanitizado cobre a rejeição; suíte, builds e smoke permanecem verdes.

## Implementação MCP-015 — proteção contra colisão de paths locais — 2026-08-22
`normalizeOptions` agora rejeita no startup qualquer path MCP igual a `/.well-known/oauth-protected-resource`, preservando a separação entre o endpoint protegido `/mcp` e a rota reservada de metadata. A rejeição é fail-closed e não altera stdio, schemas, autenticação Bearer ou a disponibilidade da metadata opt-in.

Critérios realizados: teste unitário da colisão, acceptance `MCP-015-HTTP-001` com startup rejeitado, regressão dos checks MCP-011/MCP-013/MCP-014, typecheck e build HTTP aprovados. O resultado não habilita OAuth remoto nem qualquer endpoint público.

## Planejamento EDITOR-001 — paridade visual das portas combinacionais — 2026-08-22
A auditoria identificou uma divergência concreta: a engine e os símbolos ANSI já conhecem `nand`, `nor` e `xnor`, mas o modelo visual e a paleta do `CircuitEditor` ainda não permitem criá-los. A próxima fatia local-first vai fechar esse contrato de ponta a ponta, sem criar novos tipos persistidos: editor, validação, avaliação, tabela verdade, exportadores e MCP devem reconhecer os mesmos componentes já suportados pelo domínio.

Critérios de aceite: NAND, NOR e XNOR aparecem na paleta com descrições em português; podem ser criados, serializados, reabertos e avaliados no editor; símbolos preservam corpo e bolha de inversão corretos; validação, tabela verdade e HDL não regressam; documentos existentes continuam compatíveis; a suíte e os gates de distribuição permanecem verdes.

## Implementação EDITOR-001 — paridade visual das portas combinacionais — 2026-08-22
O contrato do editor agora inclui `nand`, `nor` e `xnor` no `EditorComponentType`, na lista de componentes aceitos, na contagem de entradas, na paleta e nos rótulos do `CircuitEditor`. Os símbolos ANSI existentes já diferenciavam as portas por família e bolha de inversão; o editor passou a encaminhar corretamente os três `GateOp`.

A avaliação escalar e vetorial foi alinhada ao domínio: NAND aplica NOT ao AND, NOR aplica NOT ao OR e XNOR aplica NOT ao XOR, preservando widths e a ordem topológica. Verilog e VHDL emitem as expressões negadas correspondentes. O MCP continua aceitando o union completo sem narrowing impossível, e documentos v1 existentes permanecem compatíveis.

Critérios realizados: regressão de modelo com 12 testes, exportação HDL com 9 testes, avaliação vetorial com 7 testes; conjunto focado com 28 PASS, typecheck e lint aprovados. A etapa não altera persistência, Supabase, Realtime ou transporte MCP e não habilita OAuth remoto.

## Implementação RUST-001 — núcleo combinacional experimental — 2026-08-22

A primeira fatia do motor Rust foi criada em `engine-rs/` como crate sem dependências externas. Ela oferece `Signal` de 1 a 64 bits, operações AND/NAND/OR/NOR/XOR/XNOR/NOT, nós `Input`/`Constant`/`Output`, avaliação de netlist e ordenação topológica determinística por ID. Ciclos, dependências ausentes, IDs duplicados, widths inválidos e valores fora da máscara são rejeitados explicitamente.

O núcleo Rust não substitui o avaliador TypeScript, não é carregado pelo navegador e não altera IndexedDB, MCP, Supabase ou exportadores HDL. O fixture `tests/fixtures/rust-engine/gates.tsv` é compartilhado por `engine-rs/tests/golden.rs` e `src/circuit/rustEngineParity.test.ts` para comparar as operações bitwise em 1, 8, 32 e 64 bits. A documentação de arquitetura, fallback e integração WASM futura está em `docs/RUST-ENGINE.md`.

O acceptance `npm run beta:rust` executa `cargo fmt --check` e `cargo test --offline`; a primeira execução produziu RUST-001 e RUST-002 em PASS. Os testes Rust nativos e o teste Vitest de paridade também passaram. Isso comprova o contrato coberto, mas ainda não comprova superioridade de desempenho nem autoriza trocar o runtime: o próximo critério é benchmark controlado e decisão explícita sobre WASM.

A análise do Digital Logic Sim foi somente leitura. O projeto de referência é uma aplicação Unity publicada sob MIT, com módulos separados de simulação, gráficos e persistência; nenhuma implementação, asset ou binário foi copiado. O Veritas preserva seu núcleo TypeScript e o modo local-first enquanto a hipótese Rust é medida de forma independente.

## Implementação RUST-002 — benchmark comparativo controlado TypeScript/Rust — 2026-08-22

A próxima fatia mede o mesmo netlist combinacional pelos dois runtimes, com cenários fixos de 1, 8, 32 e 64 bits, entradas determinísticas, aquecimento separado, número de iterações declarado, checksum de saída e tempo de execução medido somente na avaliação. O harness TypeScript deve atravessar `evaluateCircuitVectors()` e o harness Rust deve usar `evaluate()` com a mesma topologia e os mesmos valores; compilação, parsing, build e inicialização ficam fora da janela de medição.

O resultado é evidência de comparabilidade do cenário, não uma promessa de que Rust é mais rápido. O relatório deve registrar runtime, modo de compilação, versão das ferramentas, sistema, iterações, checksum e duração por cenário; execuções em máquinas diferentes não devem ser comparadas como série científica. Nenhuma integração WASM, troca do runtime produtivo ou remoção do fallback TypeScript faz parte desta etapa.

Critérios de aceite: os dois runtimes produzem os mesmos checksums em todos os cenários; entradas e topologia são carregadas de fixture compartilhado; resultados de tempo são reproduzíveis no formato, mas não precisam ser numericamente idênticos; falhas ou divergências encerram o gate; artefatos locais ficam fora do Git; e a decisão sobre WASM permanece bloqueada até uma etapa posterior que também meça tamanho, cold start, memória, repetição e comportamento offline.

## Próxima fatia — WASM-001 readiness experimental — 2026-08-22

A etapa seguinte será um gate de prontidão, não uma migração do runtime. O crate Rust deverá compilar para `wasm32-unknown-unknown` com um ABI mínimo e explícito, sem DOM, rede, tokens, API de memória linear/pointers para consumidores ou execução de documentos arbitrários. A primeira superfície terá somente um marcador de versão/capacidades para confirmar que o artefato pode ser carregado; a avaliação de circuitos continuará no caminho nativo/TypeScript até existir um adaptador de `Netlist` formal.

O runner WASM-001 deverá validar o target, gerar um `.wasm` fora do Git, instanciar o módulo com a API nativa do Node e verificar os exports permitidos. Também registrará tamanho bruto e comprimido apenas como observação da execução, além de cold start e instanciações repetidas em cenários controlados. Nenhum número será usado para declarar superioridade, e nenhum artefato será inserido no bundle do navegador.

Critérios de aceite: ABI mínimo versionado e documentado; build determinístico no Rust 1.75 fixado do CI; instanciação sem imports externos; somente os dois exports ABI de função e os metadados auxiliares conhecidos do linker; teste determinístico da validação de shape; relatório sanitizado; target presente no workflow; falha fechada quando o módulo não compilar ou exportar algo inesperado; TypeScript continua como runtime produtivo/fallback; e beta, MCP remoto, Tauri e integração WASM no frontend permanecem fora do escopo.

## Próxima fatia — WASM-002 adapter/netlist ABI e golden parity — 2026-08-22

A etapa WASM-002 implementa um contrato experimental de buffer para um subconjunto combinacional de `Netlist`, sem receber `CircuitDocument`, labels, posições, componentes sequenciais, `custom-chip`, wireless ou múltiplas larguras. O payload é versionado, limitado, little-endian e validado antes da avaliação; o resultado tem valores e ordem topológica determinísticos. A ponte é compilada somente sob uma feature explícita e continua fora do build de produção, do navegador, do MCP e do plugin.

A prova de paridade compara o mesmo fixture público nos caminhos TypeScript e Rust/WASM, incluindo bytes, valores, saídas e ordem topológica. Payload inválido, import externo, export desconhecido, código de erro instável ou divergência golden encerra o gate. O módulo expõe memória linear somente para o buffer experimental e não tem API de execução arbitrária, rede, tokens, IndexedDB ou memória compartilhada.

Critérios realizados: contrato `VNET`/`VRES` versionado e documentado; adaptador TypeScript fail-closed; decoder Rust sem dependências externas; exports e capabilities explícitos; fixture golden com largura vetorial, overrides e bytes fixos; paridade TypeScript/Rust/WASM; testes negativos de truncamento, referências, aridades, widths, ciclos e overrides; relatório sanitizado; e TypeScript continua como runtime produtivo/fallback. A etapa não desbloqueia beta nem integração no navegador.

## Implementação WASM-003 matriz golden e hardening de fronteira — 2026-08-22

A etapa WASM-003 ampliou a evidência do contrato VNET/VRES sem ampliar a superfície de produto. O fixture cobre larguras de 1, 8, 32 e 64 bits, constantes, overrides, famílias de portas e ordem topológica estável. O mesmo conjunto é comparado no avaliador vetorial TypeScript, no crate Rust e no módulo WASM compilado com a feature opt-in.

O runner também exercita a fronteira host/WASM com payloads truncados, magic/versão inválidos, referências e shape inválidos, largura inválida, ciclo e chamadas com buffer excedido. Cada falha retorna zero e um código estável, sem expor texto livre, memória fora do buffer, rede, tokens ou dados de usuário. A bridge continua fora do navegador, MCP, plugin, bundle produtivo e beta.

Critérios realizados localmente: matriz golden multi-largura independente; paridade de bytes, valores, saídas e ordem; testes nativos e end-to-end dos códigos de erro; validação do limite de capacidade; relatório sanitizado; execução no Quality/Release pendente para este commit; nenhum aumento de capability sem revisão do contrato; e TypeScript preservado como runtime produtivo/fallback.

## Próxima fatia — WASM-004 isolamento do runtime produtivo — 2026-08-22

A etapa WASM-004 adicionará um guard determinístico para provar que o caminho experimental WASM permanece fora dos bundles do navegador, do MCP e do plugin. O guard verificará a ausência de imports do adaptador e de símbolos VNET/VRES nos artefatos distribuíveis, a manutenção do runtime TypeScript como caminho produtivo e a separação da feature Rust opt-in.

A validação não carregará WASM no navegador, não criará loader, Worker, endpoint ou integração remota. Ela deverá falhar quando um bundle produtivo passar a depender da ponte experimental, quando a feature deixar de ser opt-in ou quando um artefato distribuível incluir símbolos do avaliador WASM. O beta permanece bloqueado e o rollback continuará apontando para a última release publicada.

Critérios de aceite: guard executável em CI; frontend, MCP e plugin construídos e verificados sem símbolos experimentais; feature `wasm-netlist-abi` ausente do build padrão; TypeScript e IndexedDB continuam intactos; testes negativos do próprio guard; documentação e relatório sanitizado; e nenhuma capability ou integração de produção ampliada.

## Implementação VERIFY-001 — equivalência comportamental e contraexemplo — 2026-08-24

A auditoria registrou "Verification" como lacuna P1: o repositório tinha tabelas verdade, gates de release e otimização conservadora, mas nenhuma forma de responder se **dois circuitos fazem a mesma coisa**. Esta fatia entrega essa resposta atravessando domínio, MCP, interface, testes e documentação, na ordem prevista pelo roadmap (fundação → editor → simulação → verificação).

`compareCircuitEquivalence` compara dois `CircuitDocument` combinacionais por comportamento, não por estrutura. As portas são pareadas pelo rótulo visual, com fallback para o ID, o que permite reconhecer implementações topologicamente diferentes da mesma função — um XOR direto e o mesmo XOR em soma de produtos são equivalentes. A ordem das portas é canônica por nome, e não a ordem de declaração, o que dá simetria verificada: `compare(a, b)` e `compare(b, a)` encontram a mesma linha divergente. Rótulos duplicados, interfaces diferentes e larguras incompatíveis são recusados antes de qualquer avaliação.

A decisão de projeto mais importante é a exaustividade. A comparação percorre todas as combinações de entrada ou não acontece: acima do limite ela devolve `status: 'incomparable'` com `comparedRows: 0`, em vez de avaliar um prefixo e chamar isso de equivalência. `exhaustive` é campo de primeira classe do relatório justamente para que nenhum consumidor confunda "não achei divergência ainda" com prova. Componentes `clock`, `dff`, `tff` e `delay` são recusados com código próprio, reusando `isStatefulEditorType` do modelo do editor para não criar uma segunda definição de "componente com estado"; instâncias `custom-chip` são aceitas porque a construção de um chip já é combinacional por contrato.

Os limites saíram de medição, não de estimativa: no mesmo circuito de barramentos, 12 bits de entrada levaram cerca de 85 ms e 16 bits cerca de 776 ms. O padrão ficou em 12 bits e o teto absoluto em 16. Para sustentar esse custo, o netlist de cada lado é construído uma vez e só a avaliação entra no laço.

Critérios realizados: 15 testes de domínio, 4 testes da ferramenta MCP, checks `MCP-EQ-001` e `MCP-EQ-002` no acceptance stdio (12 PASS, 0 FAIL, 0 SKIP), suíte completa com 429 testes, typecheck, lint, build do frontend, builds MCP stdio/HTTP e do plugin, `beta:wasm:isolation` com 5 PASS e verificação do painel no Chromium nos dois desfechos. A declaração `mcpAcceptanceContract.d.mts`, que havia ficado presa em `MCP-006`, voltou a espelhar o runner. A etapa não altera persistência, Supabase, Realtime, transporte MCP nem o runtime produtivo, e não desbloqueia o beta.

## Próxima fatia — VERIFY-002 simulação diferencial e testbench

Com o contrato de equivalência fechado, a continuação natural é a comparação **temporal**: aplicar a mesma sequência de entradas a dois circuitos sequenciais e apontar o primeiro tique em que divergem, reusando o runtime já existente em `src/simulation/`. Isso cobre a classe que VERIFY-001 recusa explicitamente e não exige inventar um motor novo.

Depois dela, o testbench declarativo passa a ser possível sem DSL executável: um conjunto de vetores de entrada e saídas esperadas, avaliado pelo mesmo caminho da equivalência, com o mesmo formato de contraexemplo. As asserções (`assert ALWAYS`, `assert NEVER`) e a verificação de propriedades dependem dessa base e continuam fora do escopo até ela existir.

## Implementação VERIFY-002 — comparação temporal e primeiro tique divergente — 2026-08-25

VERIFY-001 fechou a equivalência exaustiva e recusou explicitamente a classe sequencial. Esta fatia entrega a resposta para essa classe: `compareCircuitTimelines` roda a mesma sequência de entradas em dois circuitos e aponta o **primeiro tique** em que discordam, reusando o runtime já existente em `src/simulation/` em vez de inventar um motor novo.

A decisão de projeto mais importante é de vocabulário, não de algoritmo. A equivalência percorre todo o espaço de entrada e por isso pode dizer `equivalent`; a comparação temporal percorre apenas o roteiro que o autor escreveu, então o melhor veredito possível é `identical` — "concordaram **neste roteiro**". O campo se chama `identical` justamente para que nenhum consumidor leia mais força do que existe, e tanto o relatório do MCP quanto o painel afirmam em texto, junto do resultado positivo, que aquilo não é prova de equivalência. Um teste cobre esse aviso, e o gate `MCP-DIFF-001` também.

As regras de identidade são as mesmas de VERIFY-001: portas pareadas por rótulo, com rótulo duplicado, interface divergente e entrada desconhecida no roteiro recusados **antes** de simular, com `comparedTicks: 0`. O limite é de 1000 tiques somados, e um roteiro maior é recusado sem simular nada, pelo mesmo motivo que a equivalência recusa em vez de truncar. A simulação é escalar porque é o que o runtime oferece hoje; barramentos ficam para quando o runtime os suportar, e isso está escrito no contrato em vez de implícito.

O painel “Comparação temporal” traz um editor de roteiro sobre os circuitos salvos: cada passo define quais entradas mudam, com que valor, e por quantos tiques rodar. O seletor de circuito foi extraído para `CircuitPicker` e é compartilhado com o painel de equivalência, para que os dois não divirjam.

Critérios realizados: 14 testes de domínio (incluindo uma divergência que só aparece depois de vários ciclos, com atrasos de 1 contra 3 tiques, e a repetição determinística da comparação), 4 testes da ferramenta MCP, checks `MCP-DIFF-001` e `MCP-DIFF-002` no acceptance stdio (14 PASS, 0 FAIL, 0 SKIP), suíte completa com 447 testes, typecheck, lint, builds de frontend/MCP stdio/MCP HTTP/lib/plugin, `beta:mcp:http` com 18 PASS, `beta:wasm:isolation` com 5 PASS, `beta:accessibility` com 5 PASS, e verificação do painel no Chromium nos dois desfechos sem erro de console. A etapa não altera persistência, Supabase, Realtime nem o runtime produtivo, e não desbloqueia o beta.

## Próxima fatia — VERIFY-003 testbench declarativo

Com os dois contratos de comparação fechados, o testbench passa a ser possível sem inventar uma DSL executável: um conjunto de vetores de entrada e saídas esperadas, avaliado pelo mesmo caminho da equivalência (combinacional) ou da comparação temporal (sequencial), com o mesmo formato de contraexemplo. O documento de teste é dado, não código — o que mantém a fronteira de segurança do §70 do plano mestre intacta.

Só depois disso vêm as asserções (`assert ALWAYS`, `assert NEVER`) e a verificação de propriedades, que precisam de um avaliador de expressões sobre sinais — e esse avaliador deve reusar o parser da engine, não um `eval`.

## Implementação VERIFY-003 — testbench declarativo — 2026-08-25

VERIFY-001 e VERIFY-002 comparam circuito com circuito. Esta fatia fecha o triângulo comparando o circuito com a **intenção declarada do autor**: `runTestbench` recebe um documento `veritas-testbench` e devolve quais casos falharam, com a saída, o valor esperado e o obtido.

A restrição central é que o teste é **dado, não código**. Um caso declara valores; nenhuma expressão do usuário é avaliada, nada é compilado, e abrir um documento de teste não é mais arriscado que abrir um `.veritas`. Isso é deliberado e preserva a fronteira do §70 do plano mestre: assim que um testbench aceita expressões, ele vira uma linguagem, e uma linguagem exige sandbox. As asserções (`assert ALWAYS`/`NEVER`) vão precisar de um avaliador sobre sinais, e ele deve reusar o parser da engine.

Três decisões de contrato que valem registro. Primeira: um caso é combinacional (`inputs` + `expect`) ou sequencial (`steps`), nunca os dois — misturar torna a intenção ambígua e é recusado. Segunda: um caso sem nenhuma saída esperada é recusado em vez de contar como aprovado, porque um caso que não pode falhar não testa nada, só produz sensação de cobertura. Terceira: todos os casos rodam, mesmo depois do primeiro que falha, porque o produto útil é saber quantos e quais quebraram.

O vocabulário do relatório segue a mesma disciplina das fatias anteriores: `passed` cobre **exatamente os casos escritos**, e tanto o MCP quanto o painel dizem isso junto do resultado positivo, apontando `circuit_equivalence` como o caminho para prova sobre todo o espaço de entrada.

Casos sequenciais ainda não expandem `custom-chip`, porque `createDocumentRuntime` não recebe a biblioteca de chips. Em vez de esconder isso, existe uma guarda explícita (`sequential-custom-chip`) que diz o que fazer — sem ela o usuário receberia um "componente sem definição" genérico do netlist, que não explica que o problema é a combinação de modo com chip.

Como efeito colateral necessário, `collectPorts` — que estava duplicado em `equivalence.ts` e `differential.ts` — foi extraído para `src/circuit/portIdentity.ts`. Uma terceira cópia teria criado três definições de "identidade de porta" livres para divergir. A ordem canônica, a regra de rótulo-com-reserva-no-ID e a mensagem de duplicata agora moram num lugar só, e as duas fatias anteriores passaram no refactor sem alterar um único teste.

Critérios realizados: 19 testes de domínio, 4 testes da ferramenta MCP, checks `MCP-TB-001` e `MCP-TB-002` no acceptance stdio (16 PASS, 0 FAIL, 0 SKIP), suíte completa com 470 testes, typecheck, lint, builds de frontend/MCP stdio/MCP HTTP/lib/plugin, `beta:mcp:http` 18 PASS, `beta:accessibility` 5 PASS, `beta:rust` 2 PASS, `beta:wasm:isolation` 5 PASS, e verificação do painel no Chromium com um meio somador de vai-um errado — caso #1 reprovado e caso #2 aprovado, sem erro de console.

## Próxima fatia — VERIFY-004 asserções e casos gerados

Com o testbench declarativo fechado, os dois caminhos naturais são: um editor de roteiro com expectativas na interface (hoje o painel cobre só o modo combinacional, enquanto o domínio e o MCP já fazem os dois), e a geração de casos a partir da tabela verdade, para transformar o comportamento atual em regressão.

As asserções continuam depois disso, e não antes, porque exigem um avaliador de expressões sobre sinais. A regra que já vale: esse avaliador reusa `src/engine/parser.ts`, nunca `eval` nem `Function`.


## Atualização da implementação — CHIP-005/006/007 — fundação da V1 — 2026-08-25

O loop central do Digital Logic Sim foi desbloqueado no repositório existente. `buildCustomChipDefinition()` agora aceita instâncias de chips locais já validadas, percorre a cadeia de dependências, rejeita referências recursivas e aplica limite seguro de profundidade. O storage IndexedDB e o hook `useCustomChips()` passam a fornecer a biblioteca ao validar criação e atualização; o editor não bloqueia mais o salvamento de um circuito composto.

O elaborador hierárquico transforma instâncias em namespaces determinísticos e converte entradas internas em fronteiras dirigíveis pelo netlist expandido. Isso permite que o mesmo documento seja usado no runtime temporal, no testbench sequencial, na comparação temporal e nos exportadores sem duplicar a engine. A biblioteca é sempre explícita; nenhuma definição ausente é inferida ou executada silenciosamente.

`createDocumentRuntime()` recebeu `customChips` e expande a hierarquia antes de instanciar o `Simulator`. O painel temporal do editor encaminha a biblioteca local, e o testbench passou a executar casos sequenciais com chips em vez de recusar o documento. Checkpoints, reset, períodos de clock e aplicação de estado remoto continuam usando o mesmo contrato `SimulatorState`.

O catálogo DLS ganhou um adaptador que converte chips escalares com expressões completas em `CircuitDocument`. O botão “Adicionar ao editor” salva uma cópia na biblioteca local e o editor recebe a mudança por evento local, sem autenticação ou rede. O catálogo completo continua disponível para consulta; chips multi-bit, sequenciais ou com alguma expressão ausente permanecem explicitamente não executáveis nesta fatia, evitando uma falsa promessa de comportamento.

Critérios verificados nesta fatia: composição, avaliação, expansão, ciclo, profundidade, runtime temporal e testbench sequencial cobertos por regressões; typecheck e lint limpos. A validação completa de release ainda será executada antes de abrir a próxima etapa da V1.


## Release 0.10.1 — barramentos visuais particionáveis — 2026-08-25

A fundação multi-bit existente agora atravessa a construção visual com dois componentes explícitos: `splitter` e `combiner`. O Splitter recebe um barramento, aplica partições declaradas em `options.widths` na ordem MSB → LSB e expõe uma saída por parte. O Combiner recebe essas partes, valida a soma das larguras e expõe um barramento recombinado. Ambos reutilizam `splitBus` e `combineBus`, sem duplicar a álgebra de `BitVector`.

A validação do documento verifica larguras inteiras entre 1 e 64 bits, soma exata das partições, cardinalidade das portas e compatibilidade de cada conexão. O fluxo escalar permanece protegido: Splitter e Combiner só são aceitos pela avaliação vetorial. O runtime temporal continua explicitamente escalar nesta release, preservando a fronteira documentada para uma futura extensão sequencial multi-bit.

No editor, os componentes aparecem na paleta, criam handles dinâmicos, podem ter suas partições editadas no painel lateral e preservam `width`/`widths` ao salvar e reabrir projetos `.veritas`. A avaliação vetorial mantém `values` compatível com consumidores existentes e expõe `ports` para que o canvas e integrações possam observar todas as saídas de um Splitter.

Critérios verificados nesta fatia: round-trip 8 bits com partição `3 + 5`, preservação MSB → LSB, rejeição de partições que não fecham a largura, typecheck, lint e regressões focadas. A validação completa de release e o smoke visual serão executados antes da consolidação do próximo marco.


## Release 0.10.2 — chips multi-bit combinacionais importados — 2026-08-25

A Release 0.10.2 fecha a primeira ponte controlada entre o catálogo real do DLS e o Digital Logic Sim próprio do Veritas. O importador não envia os JSONs de origem para o navegador, não executa código ou dados como programa e não tenta inferir dependências ausentes. Em vez disso, mantém uma allowlist explícita de perfis combinacionais que possuem uma materialização canônica conhecida.

| Perfil DLS suportado | Materialização Veritas | Portas preservadas |
| --- | --- | --- |
| `4-ADD` | Ripple-carry estrutural com `1-ADD`, dois Splitters e um Combiner | Entrada `4 + 4 + 1` bits; saída `4 + 1` bits |
| `AND-8 Bits`, `8x2-AND` | Splitter → oito portas AND → Combiner | Duas entradas de 8 bits; uma saída de 8 bits |
| `NAND-8Bits` | Splitter → oito portas NAND → Combiner | Duas entradas de 8 bits; uma saída de 8 bits |
| `OR-8 Bits`, `8x2-OR` | Splitter → oito portas OR → Combiner | Duas entradas de 8 bits; uma saída de 8 bits |
| `XOR - 8 BIT`, `8x2-XOR` | Splitter → oito portas XOR → Combiner | Duas entradas de 8 bits; uma saída de 8 bits |

O adaptador `src/chips/catalogVector.ts` valida nomes, portas, larguras, tipos e componentes conhecidos antes de construir um `CircuitDocument`. Para `4-ADD`, a avaliação foi conferida em todas as 512 combinações de dois operandos de 4 bits e carry de entrada; a soma baixa e o carry de saída coincidem com a aritmética ripple-carry. O chip resultante passa pelo mesmo caminho de `buildCustomChipDefinition()`, pode ser salvo na biblioteca local IndexedDB, instanciado em outro documento e exportado para Verilog/VHDL.

A biblioteca visual distingue o modelo escalar do modelo multi-bit pronto para o canvas. Após a importação, o card local de `4-ADD` fica disponível sem conta ou rede, e o nó mostra `IN 4 + 4 + 1 · OUT 4 + 1 bits`. As alças anunciam individualmente 4, 4, 1, 4 e 1 bits, enquanto chips sequenciais, memória, tri-state, conversores e dependências fora da allowlist permanecem bloqueados.

Critérios verificados nesta release: 70 arquivos e 489 testes Vitest; typecheck, lint, build do frontend/lib/MCP stdio/MCP HTTP/plugin; MCP 16 PASS, MCP HTTP 18 PASS, acessibilidade 5 PASS, WASM isolation 5 PASS, Rust 2 PASS e HDL 3 PASS.
 O smoke local confirmou catálogo → biblioteca local → peça `4-ADD` no canvas, com portas heterogêneas e sem erro de largura. O beta readiness continua bloqueado por credenciais/evidências Supabase externas, e `validate:plugin` não pôde rodar porque o executável `claude` não está instalado no sandbox; nenhum bloqueio altera o modo local-first.

A próxima fatia deve ampliar o contrato de importação apenas para novos perfis combinacionais que possam ser validados por fixtures reais e, em separado, definir o runtime temporal vetorial antes de considerar chips DLS como `8-DELAY`, registradores ou memória. A `main` permanece sem alterações; o trabalho está na branch `feature/chip-hierarchy-v1`, com o incremento funcional no commit `d5b86ae`.


## Release 0.10.3 — comparador multi-bit EQUAL-4 — 2026-08-25

A Release 0.10.3 amplia a allowlist estrutural do catálogo DLS com o perfil real `EQUAL-4`. O chip possui dois pinos de entrada de 4 bits, uma saída escalar e nove subcomponentes: dois conversores `4-1BIT`, quatro `XNOR` e três `AND`. O adaptador não executa o JSON de origem; valida a assinatura, mapeia a estrutura para o `CircuitDocument` canônico e mantém o circuito inteiramente local.

| Parte do fixture | Materialização Veritas |
| --- | --- |
| Dois `4-1BIT` | Dois Splitters de 4 bits, na ordem MSB → LSB |
| Quatro `XNOR` | Uma comparação bit a bit por posição |
| Três `AND` | Redução das quatro comparações para uma saída |
| `OUT` escalar | `1` somente quando os dois barramentos são iguais |

O DLS usa `IN` nos dois pinos de entrada. Ao construir o chip customizado, `buildCustomChipDefinition()` preserva a ordem por ID e aplica a reserva determinística `IN`/`IN_2`, ambas com largura 4, evitando colisão silenciosa de portas. A biblioteca local e o canvas mostram `IN 4 + 4 · OUT 1 bit`; o modelo pode ser reutilizado e exportado para Verilog/VHDL.

Critérios verificados: fixture real e entrada do catálogo gerado, quatro casos de igualdade/diferença, validação com `allowBuses`, portas duplicadas normalizadas, exportação HDL, integração catálogo → IndexedDB → canvas e zero alertas de interface. A suíte completa passou com 70 arquivos e 497 testes; typecheck, lint, builds e gates permanecem parte da validação final da release.

O próximo incremento deve seguir a mesma regra: novos comparadores ou operadores multi-bit somente com fixture real e semântica verificável. Perfis sequenciais, memória, tri-state e `8-DELAY` continuam fora até a existência de runtime temporal vetorial; a fronteira entre combinacional e temporal não será atravessada por inferência.


## Release 0.10.4 — somador multi-bit 8-ADD — 2026-08-25

A Release 0.10.4 amplia a allowlist estrutural do catálogo DLS com o perfil real `8-ADD`. O fixture possui três entradas na ordem pública `CARRY` (1 bit), `IN` (8 bits), `IN` (8 bits), duas saídas `OUT` (8 bits) e `CARRY` (1 bit), além de oito subchips `1-ADD`, dois `8-1BIT` e um `1-8BIT`.

| Parte do fixture | Materialização Veritas |
| --- | --- |
| Dois `8-1BIT` | Dois Splitters de 8 bits, preservando a ordem MSB → LSB |
| Oito `1-ADD` | Oito estágios ripple-carry com XOR, AND e OR escalares |
| Um `1-8BIT` | Um Combiner para o resultado de 8 bits |
| `CARRY` inicial/final | Entrada e saída escalares mantidas em portas próprias |

O adaptador usa IDs públicos `input-0-carry`, `input-1-a` e `input-2-b` para que a ordem do DLS não seja perdida durante a construção do chip customizado. Quando os dois pinos de origem chamados `IN` são convertidos em uma definição local, a regra determinística de nomes gera `IN` e `IN_2`, ambas com largura 8. A avaliação cobre limites sem carry, overflow, carry de entrada e soma entre metades do barramento.

Critérios verificados: fixture real e entrada do catálogo gerado, validação com `allowBuses`, 16 XOR, 16 AND, 8 OR, dois Splitters, um Combiner, cinco casos aritméticos, normalização de portas, integração catálogo → IndexedDB → canvas e cinco alças dimensionadas no DOM. A suíte completa passou com 70 arquivos e 505 testes; os gates MCP, HTTP, acessibilidade, WASM, Rust e HDL também passaram.

O próximo incremento permanece restrito a perfis combinacionais reais. O runtime temporal vetorial continua sendo uma frente separada antes de considerar `8-DELAY`, registradores, contadores ou memória.


## Release 0.10.5 — máscara multi-bit 8-1AND — 2026-08-25

A Release 0.10.5 adiciona à allowlist o fixture real `8-1AND` do DLS. Sua assinatura possui duas entradas chamadas `IN`: a primeira é uma máscara escalar de 1 bit e a segunda é um barramento de 8 bits. A saída `OUT` é um barramento de 8 bits. A estrutura de origem contém um `8-1BIT`, oito portas `AND` e um `1-8BIT`.

| Parte do fixture | Materialização Veritas |
| --- | --- |
| `8-1BIT` | Um Splitter de 8 bits, em MSB → LSB |
| Oito `AND` | Uma porta AND escalar por bit, compartilhando a máscara |
| `1-8BIT` | Um Combiner de 8 bits |
| Entradas duplicadas `IN` | `IN` de 1 bit e `IN_2` de 8 bits na definição local |

O adaptador só aceita a assinatura conhecida (`2` entradas, `1` saída, `8` AND, `1` Splitter e `1` Combiner). A avaliação exaustiva cobre os 256 valores do barramento em dois estados da máscara: com `0`, a saída é sempre zero; com `1`, a saída é idêntica à entrada. O circuito passa por `validateCircuit(..., { allowBuses: true })` e permanece compatível com a persistência local e as exportações HDL.

Critérios verificados: card publicado na biblioteca, importação para IndexedDB, peça no canvas, três alças com larguras 1/8/8 bits, zero alertas no DOM, 31 testes focados e suíte completa com 70 arquivos e 510 testes. O próximo passo continua sendo outro perfil combinacional real; chips temporais e memória aguardam um runtime vetorial temporal específico.


## Release 0.10.6 — operadores binários de barramento 8x2 — 2026-08-25

A Release 0.10.6 adiciona três fixtures combinacionais reais do DLS: `8x2-AND`, `8x2-OR` e `8x2-XOR`. Cada um recebe dois barramentos de 8 bits chamados `IN` e produz um barramento `OUT` de 8 bits. As portas duplicadas são preservadas na origem e normalizadas para `IN` e `IN_2` somente na definição de chip customizado local.

| Estrutura do fixture | Materialização Veritas |
| --- | --- |
| Dois `8-1BIT` | Dois Splitters, um por entrada de 8 bits |
| Oito operadores escalares | Oito AND, OR ou XOR, conforme o fixture real |
| Um `1-8BIT` | Um Combiner de 8 bits |

O adaptador só materializa os nomes e as assinaturas conhecidas. Para prova de semântica, as entradas `0xAA` e `0xCC` produzem `0x88` no AND, `0xEE` no OR e `0x66` no XOR. Cada documento passa por `validateCircuit(..., { allowBuses: true })`, pode ser convertido em chip customizado local e permanece exportável para Verilog/VHDL.

Os critérios de aceite foram atendidos com 34 testes focados, suíte completa, builds, gates MCP/HTTP, acessibilidade, isolamento WASM, Rust, HDL e smoke no navegador. O smoke confirmou `8x2-AND` na biblioteca local e no canvas com três alças de 8 bits e zero alertas inesperados. A expansão não inclui tri-state, memória, conversores ou chips temporais; `8-DELAY` continua bloqueado até o runtime temporal vetorial existir.


## Release 0.10.7 — AND-3 vetorial DLS — 2026-08-25

A Release 0.10.7 adiciona à allowlist o fixture combinacional real `AND-3 8 bits`. A interface publicada pelo catálogo possui três entradas `IN` de 8 bits e uma saída `OUT` de 8 bits. O circuito de origem contém três `8-1BIT`, dezesseis `AND` escalares e um `1-8BIT`.

| Estrutura do fixture | Materialização Veritas |
| --- | --- |
| Três `8-1BIT` | Três Splitters de 8 bits, em MSB → LSB |
| Dezesseis `AND` | Dois estágios de redução por bit: `IN_1 AND IN_2`, seguido de `resultado AND IN_3` |
| Um `1-8BIT` | Um Combiner de 8 bits |
| Entradas duplicadas `IN` | `IN`, `IN_2` e `IN_3`, todas com 8 bits na definição local |

A assinatura só é aceita quando coincide com o fixture conhecido: três entradas, uma saída, largura vetorial 8, três `8-1BIT`, dezesseis `AND` e um `1-8BIT`. O documento resultante passa por `validateCircuit(..., { allowBuses: true })`, pode ser salvo no IndexedDB, reutilizado como chip customizado e exportado para Verilog/VHDL.

Os critérios de aceite foram atendidos com 41 testes focados e 520 testes na suíte completa, além de typecheck, lint, builds e gates MCP/HTTP, acessibilidade, WASM, Rust e HDL. O smoke visual confirmou o card, a persistência local, a instância no canvas, o resumo `IN 8 + 8 + 8 bits · OUT 8 bits` e quatro alças de 8 bits. A instância isolada exibiu três erros de entradas desconectadas, como esperado; não houve alertas inesperados no DOM.

Esta release não transforma o importador em um executor genérico de N entradas. A generalização do construtor foi limitada à redução estrutural comprovada por este fixture. Chips temporais, memória, tri-state, dependências não mapeadas e outros bancos de portas continuam bloqueados até possuírem contrato e provas próprios.


## Release 0.10.8 — Full Adder vetorial DLS — 2026-08-25

A Release 0.10.8 adiciona à allowlist o fixture combinacional real `Full Adder - 8 Bits`. Sua interface publicada possui três entradas vetoriais de 8 bits — `Carry IN`, `IN A` e `IN B` — e duas saídas vetoriais de 8 bits — `BIT-8 Bits` e `Carry Out-8Bits`. A estrutura do fixture contém dois `AND-8 Bits`, dois `XOR - 8 BIT` e um `OR-8 Bits`, combinados para operar oito posições em paralelo.

| Estrutura do fixture | Materialização Veritas |
| --- | --- |
| `Carry IN`, `IN A`, `IN B` | Três Splitters de 8 bits, preservando a ordem MSB → LSB |
| Dois `XOR - 8 BIT` | XOR de `A` com `B`, seguido de XOR com o carry, para a saída de soma |
| Dois `AND-8 Bits` e um `OR-8 Bits` | `(A AND B) OR ((A XOR B) AND Carry)`, para a saída de carry |
| `BIT-8 Bits` e `Carry Out-8Bits` | Dois Combiners de 8 bits e duas saídas vetoriais |

O adaptador só aceita a assinatura conhecida: três entradas, duas saídas, largura 8 em todos os pinos, dois `AND-8 Bits`, dois `XOR - 8 BIT` e um `OR-8 Bits`. O documento passa por `validateCircuit(..., { allowBuses: true })`, pode ser salvo no IndexedDB, reutilizado como chip customizado e exportado para Verilog/VHDL.

Os critérios de aceite foram atendidos com 49 testes focados e 528 testes na suíte completa, além de typecheck, lint, builds e gates MCP/HTTP, acessibilidade, WASM, Rust e HDL. O smoke visual confirmou o card, a persistência local, a instância no canvas, o resumo `IN 8 + 8 + 8 bits · OUT 8 + 8 bits` e cinco alças de 8 bits. A instância isolada exibiu três erros de entradas desconectadas, como esperado; não houve alertas inesperados no DOM.

Esta release trata o full adder como composição combinacional paralela por bit. Ela não adiciona carry ripple entre posições nem transforma o importador em executor genérico de subchips DLS. Perfis temporais, memória, tri-state e dependências não mapeadas continuam bloqueados até possuírem contratos e provas próprios.


## Release 0.10.9 — alias ripple-carry `(8 Bits) 8-bit Adder` — 2026-08-25

A Release 0.10.9 adiciona à allowlist o alias combinacional real `(8 Bits) 8-bit Adder`. Sua interface publicada possui duas entradas de 8 bits (`IN A 1-8` e `IN B 1-8`), uma entrada escalar de carry (`Carry IN`), uma saída de soma de 8 bits (`OUT`) e uma saída escalar de carry (`Carry OUT`). O fixture contém dois `8-1BIT`, um subchip `8-bit Adder` e um `1-8BIT`.

| Estrutura do fixture | Materialização Veritas |
| --- | --- |
| `IN A 1-8` e `IN B 1-8` | Dois Splitters de 8 bits, em MSB → LSB |
| `8-bit Adder` | Oito estágios ripple-carry com 16 XOR, 16 AND e 8 OR |
| `1-8BIT` | Um Combiner para a saída `OUT` de 8 bits |
| `Carry IN` e `Carry OUT` | Entrada e saída escalares preservadas na definição local |

O adaptador só aceita a assinatura conhecida: três entradas, duas saídas, larguras `[1, 8]`, dois `8-1BIT`, um `8-bit Adder` e um `1-8BIT`. O documento passa por `validateCircuit(..., { allowBuses: true })`, pode ser salvo no IndexedDB, reutilizado como chip customizado e exportado para Verilog/VHDL.

Os critérios de aceite foram atendidos com 57 testes focados e 536 testes na suíte completa, além de typecheck, lint, builds e gates MCP/HTTP, acessibilidade, WASM, Rust e HDL. O smoke visual confirmou o card, a persistência local, a instância no canvas, o resumo `IN 8 + 8 + 1 bits · OUT 8 + 1 bits` e cinco alças com larguras 8/8/1 → 8/1. A instância isolada exibiu três erros de entradas desconectadas, como esperado; não houve alertas inesperados no DOM.

Esta release confirma um alias de somador já compatível com a topologia ripple-carry do `8-ADD`; não importa o `8-bit Adder` escalar de 17 entradas, não adiciona um novo runtime temporal e não libera memória, tri-state ou dependências não mapeadas por inferência.


## Release 0.11.0 — bancos base reais de barramento de 8 bits — 2026-08-25

A Release 0.11.0 fecha a prova de quatro fixtures combinacionais reais do catálogo DLS que já compõem a família vetorial inicial: `AND-8 Bits`, `NAND-8Bits`, `OR-8 Bits` e `XOR - 8 BIT`. Todos possuem duas entradas `IN` de 8 bits, uma saída `OUT` de 8 bits, largura `[8]` e decomposição verificável.

| Fixture real | Assinatura estrutural observada | Materialização local |
| --- | --- | --- |
| `AND-8 Bits` | 2× `8-1BIT`, 8× `AND`, 1× `1-8BIT` | 2 Splitters, 8 AND e 1 Combiner |
| `NAND-8Bits` | 2× `8-1BIT`, 8× `AND`, 8× `NOT`, 1× `1-8BIT` | 2 Splitters, 8 NAND equivalentes e 1 Combiner |
| `OR-8 Bits` | 1× `NAND-8Bits`, 2× `NOT-8 Bits` | 2 Splitters, 8 OR equivalentes e 1 Combiner |
| `XOR - 8 BIT` | 3× `NAND-8Bits`, 2× `NOT-8 Bits` | 2 Splitters, 8 XOR equivalentes e 1 Combiner |

O adaptador valida a assinatura exata na allowlist. Para OR e XOR, a estrutura publicada é hierárquica; o Veritas reconhece os subchips e materializa a função booleana equivalente em componentes locais, sem executar o JSON DLS nem inferir dependências ausentes. A prova usa `0xAA` e `0xCC`: AND produz `0x88`, NAND produz `0x77`, OR produz `0xEE` e XOR produz `0x66`.

Os critérios de aceite foram atendidos com 62 testes focados e 541 testes na suíte completa, além de typecheck, lint, builds e gates MCP/HTTP, acessibilidade, WASM, Rust e HDL. O smoke visual confirmou `XOR - 8 BIT` como representante dos aliases hierárquicos: o card foi persistido localmente como ID 10 e inserido no canvas com `IN 8 + 8 bits · OUT 8 bits`, três alças de 8 bits e dois avisos esperados de entradas desconectadas.

A release confirma contratos de operadores combinacionais de 8 bits; não amplia o catálogo para chips temporais, memória, tri-state ou dependências não mapeadas. O restante do catálogo continua disponível para consulta, mas não é executado automaticamente.


## Release 0.11.1 — multiplexador vetorial real `1-8MUX` — 2026-08-25

A Release 0.11.1 adiciona à allowlist o fixture combinacional real `1-8MUX`. Sua interface publicada possui três entradas na ordem DLS: uma seleção escalar de 1 bit e duas entradas `IN` de 8 bits, além de uma saída `OUT` de 8 bits. A estrutura observada contém duas instâncias `8-1AND`, uma `NOT` e uma `8x2-OR`.

| Estrutura do fixture | Materialização Veritas |
| --- | --- |
| Entrada 1 de 1 bit | Seleção `select`, com fan-out para a NOT e as oito máscaras AND |
| Entradas 2 e 3 de 8 bits | Dois Splitters, preservando a ordem MSB → LSB |
| 2× `8-1AND` + `NOT` | `(select AND A)` e `((NOT select) AND B)` por posição |
| `8x2-OR` | Oito OR escalares para combinar as duas máscaras |
| `OUT` de 8 bits | Um Combiner e uma saída vetorial |

O adaptador só aceita a assinatura conhecida: três entradas, uma saída, larguras `[1, 8]`, duas dependências `8-1AND`, uma `8x2-OR` e uma `NOT`. O documento passa por `validateCircuit(..., { allowBuses: true })`, pode ser salvo no IndexedDB, reutilizado como chip customizado e exportado para Verilog/VHDL.

Os critérios de aceite foram atendidos com 70 testes focados e 549 testes na suíte completa, além de typecheck, lint, builds e gates MCP/HTTP, acessibilidade, WASM, Rust e HDL. O smoke visual confirmou o card, a persistência local, a instância no canvas, o resumo `IN 1 + 8 + 8 bits · OUT 8 bits` e quatro alças com larguras `1/8/8 → 8`. A instância isolada exibiu três erros de entradas desconectadas, como esperado; não houve alertas inesperados no DOM.

Esta release não libera os muxes `2-8MUX` e `4-8MUX`, porque seus fixtures usam buffers tri-state. O escopo permanece combinacional, local-first e allowlist-only; chips temporais, memória, tri-state e dependências não mapeadas continuam bloqueados.


## Release 0.11.2 — inversor vetorial real `NOT-8 Bits` — 2026-08-25

A Release 0.11.2 adiciona à allowlist o fixture combinacional real `NOT-8 Bits`. Sua interface publicada possui uma entrada `IN` de 8 bits e uma saída `OUT` de 8 bits. A estrutura observada contém uma instância `NAND-8Bits`, com a mesma entrada conectada às suas duas entradas.

| Estrutura do fixture | Materialização Veritas |
| --- | --- |
| `IN` de 8 bits | Um input vetorial e um Splitter com oito partes escalares |
| `NAND-8Bits` hierárquico | Oito NOT escalares, representando `NOT(bit)` sem executar o JSON DLS |
| `OUT` de 8 bits | Um Combiner e uma saída vetorial |

O adaptador só aceita a assinatura conhecida: uma entrada, uma saída, largura `[8]` e exatamente uma dependência `NAND-8Bits`. O documento passa por `validateCircuit(..., { allowBuses: true })`, pode ser salvo no IndexedDB, reutilizado como chip customizado e exportado para Verilog/VHDL.

Os critérios de aceite foram atendidos com 78 testes focados e 557 testes na suíte completa, além de typecheck, lint, builds e gates MCP/HTTP, acessibilidade, WASM, Rust e HDL. O smoke visual confirmou o card, a persistência local como ID 12, a instância no canvas, o resumo `IN 8 bits · OUT 8 bits` e duas alças de 8 bits. A instância isolada exibiu um erro de entrada desconectada, como esperado; não houve alertas inesperados no DOM.

Esta release confirma um inversor vetorial hierárquico de 8 bits; não amplia o catálogo para `NEGATE-8`, chips temporais, memória, tri-state ou dependências não mapeadas. O próximo contrato deve continuar sendo escolhido por assinatura real e semântica testável.


## Release 0.11.3 — negação condicional vetorial real `NEGATE-8` — 2026-08-25

A Release 0.11.3 adiciona à allowlist o fixture combinacional real `NEGATE-8`. Sua interface pública possui duas entradas na ordem DLS — `IN` de 8 bits e um controle escalar de 1 bit — e uma saída `OUT` de 8 bits. A estrutura observada contém um `8-1BIT`, um `1-8BIT` e oito XOR.

| Estrutura do fixture | Materialização Veritas |
| --- | --- |
| `IN` de 8 bits | Um input vetorial e um Splitter com oito partes escalares |
| Controle de 1 bit | Um input escalar conectado ao segundo terminal de cada XOR |
| Oito XOR | Oito portas XOR independentes, uma por posição do barramento |
| `OUT` de 8 bits | Um Combiner e uma saída vetorial |

A semântica comprovada é `OUT = IN XOR CONTROL` por bit. Com controle `0`, o barramento passa sem alteração; com controle `1`, todos os bits são invertidos. O adaptador só aceita o nome, larguras, contagem e dependências reais conhecidas, passa por `validateCircuit(..., { allowBuses: true })` e pode ser salvo no IndexedDB, reutilizado como chip customizado e exportado para Verilog/VHDL.

Os critérios de aceite foram atendidos com 86 testes focados e 565 testes na suíte completa, além de typecheck, lint, builds e gates MCP/HTTP, acessibilidade, WASM, Rust e HDL. O smoke visual confirmou o card, a persistência local como ID 13, a instância no canvas, o resumo `IN 8 + 1 bits · OUT 8 bits` e três alças de largura 8/1/8. A instância isolada exibiu dois problemas de entradas desconectadas, como esperado; não houve alertas inesperados no DOM.

Esta release cobre somente a negação condicional combinacional `NEGATE-8`; não a interpreta como somador de complemento de dois. `NEGATE-8` é um contrato distinto de `NOT-8 Bits`, e chips temporais, memória, tri-state e dependências não mapeadas permanecem fora da allowlist.
