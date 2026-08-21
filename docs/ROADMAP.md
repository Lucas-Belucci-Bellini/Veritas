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
