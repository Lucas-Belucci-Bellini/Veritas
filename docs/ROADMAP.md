# Veritas — Plano executável do produto

> Este documento é a fonte de verdade do roadmap do Veritas. O arquivo [`issue.md`](../issue.md) continua preservado como registro de descoberta e ideias, mas não deve ser interpretado como uma fila linear de implementação.

## 1. Estado atual

A versão de referência do repositório é a **v0.8.0-rc.1**. O projeto já possui um motor lógico reutilizável, interface React, tabela verdade virtualizada, visualização de circuito derivada da expressão, projetos locais, PWA, simplificação, mapas de Karnaugh, formas normais, simulação sequencial básica e servidor MCP.

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
| Barramentos multi-bit | Backlog priorizado | Ainda não existe no modelo de dados |
| Chips customizados hierárquicos | Backlog posterior | Depende do editor e do modelo de subcircuitos |
| Aplicativo desktop Tauri/Rust | Investigar depois | Depende de métricas de performance e escopo estabilizado |
| 3D, PCB, impressão e 250 subagentes | Visão de longo prazo | Não fazem parte do próximo ciclo |

## 2. Decisões de produto

O Veritas será construído primeiro como uma ferramenta **local-first, client-side e offline-first** para estudar, projetar e validar circuitos digitais. A mesma engine TypeScript continuará sendo usada pela interface web, pelo importador de chips e pelo servidor MCP, evitando implementações paralelas que possam divergir.

A calculadora de expressões continua sendo uma experiência de entrada rápida. O próximo salto do produto não é adicionar mais painéis à tela atual, mas permitir que o usuário **edite o circuito visualmente**, simule esse circuito e converta o resultado para uma expressão ou tabela verdade quando isso for matematicamente possível.

Recursos de nuvem, colaboração, agentes em larga escala, desktop nativo, renderização 3D e fabricação física serão tratados como linhas de produto posteriores. Eles só entram após existir uma base estável de projeto, eventos, validação, versionamento e limites de execução.

## 3. Roadmap por releases

| Release | Objetivo | Entregas incluídas | Critério de saída |
| --- | --- | --- | --- |
| **v0.7.0** | Editor visual mínimo viável | Canvas editável; entradas, constantes, saídas e portas AND/OR/NOT/XOR; criação e remoção de conexões; avaliação combinacional; mensagens de erro; exportação/importação de circuito | Um usuário consegue criar um circuito simples sem digitar uma expressão e validar sua tabela verdade |
| **v0.7.1** | Usabilidade e confiabilidade do editor | Seleção, exclusão, atalhos, desfazer/refazer, layout inicial, validação de ciclos combinacionais, testes de interação e persistência do novo formato | O editor é utilizável em projetos pequenos e não perde dados em operações comuns |
| **v0.7.2** | Integrações colaborativas e industriais | Colaboração Realtime privada com Presence/Broadcast, convite editor/visualizador, histórico remoto, exportação Verilog/VHDL, Edge Function autenticada e painel de métricas de IA | Usuários autenticados compartilham um circuito com papéis explícitos, exportam um netlist válido e acompanham telemetria sem expor dados de terceiros |
| **v0.8.0** | Barramentos multi-bit | Largura explícita de sinal; operações bitwise; displays binário/hexadecimal; splitter/combiner; limites de largura e testes de compatibilidade | Um circuito de 8 bits consegue ser criado, simulado, salvo e reaberto com resultado determinístico |
| **v0.9.0** | Workspace sequencial | Edição visual de clock, DFF/TFF, delay, contadores e observação de ticks; pausa, avanço manual e reset | Um contador e um circuito com feedback podem ser simulados sem congelar a interface |
| **v0.10.0** | Abstração e chips customizados | Pinos de entrada/saída; criação de subcircuito; biblioteca local de chips; execução hierárquica com limites de profundidade | Um subcircuito salvo pode ser reutilizado como componente em outro projeto |
| **v1.0.0** | Plataforma estável para pessoas e IAs | API de contexto do canvas; operações MCP de leitura e simulação; plano de mudanças; dry-run; logs; documentação de integração | Uma IA consegue consultar e propor alterações sem editar silenciosamente o projeto |
| **v1.x** | Expansão controlada | Barramentos, chips customizados, desktop Tauri/Rust, agentes de fundo e recursos 3D | Cada iniciativa tem caso de uso validado, orçamento técnico e modelo de segurança definido |

## 4. Próximo ciclo: v0.7.1

A primeira implementação organizada foi o **editor visual combinacional** e está disponível em prévia. O próximo ciclo concentra-se em usabilidade e confiabilidade: desfazer/refazer, atalhos, seleção consistente, layout inicial e testes de interação. A calculadora de expressões continua funcionando de forma independente do editor.

O editor terá um modelo de dados próprio, independente dos objetos internos do React Flow. A interface converterá esse modelo para nós e arestas visuais; a engine receberá um netlist normalizado. Essa separação permite salvar arquivos estáveis, testar o cálculo sem DOM e futuramente trocar a biblioteca de canvas sem reescrever o domínio.

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
| Migração prematura para desktop atrasar o produto web | Medir performance primeiro e só então decidir a fronteira Rust/Tauri |

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
