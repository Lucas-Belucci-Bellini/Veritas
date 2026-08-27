# Hardening de feedback e orçamento de settle

## Decisão

O `Simulator` continua sendo um simulador por tiques e não tenta resolver feedback por recursão ou por uma execução sem limite. A API `settle()` permanece apropriada para circuitos combinacionais e para verificar se uma rede parou de mudar; circuitos com clock ou feedback oscilante devem retornar `false` quando atingem o orçamento.

O orçamento padrão de `settle()` continua em `200` tiques. Para impedir configurações acidentais que causem execução indefinida ou excessivamente longa, o limite configurável deve ser um inteiro finito entre `1` e `10.000`. O argumento explícito de `settle()` aceita também `0`, que representa uma janela vazia e retorna `false` sem executar tiques. O método `settle()` mantém a semântica compatível baseada nas saídas; o diagnóstico detalhado é opt-in por `diagnoseSettle()`.

Além disso, cada instância possui um orçamento total acumulado padrão de `100.000` tiques, configurável entre `1` e `1.000.000`. `tick(count)` rejeita contagens fracionárias, negativas ou não finitas e falha antes de ultrapassar o orçamento restante. `restoreState()` rejeita estados cujo `tickCount` exceda o orçamento da instância, sem mutar o runtime.

O primeiro slice de v2.7 adiciona um orçamento de operações de componentes por tique e acumulado por runtime. Os limites padrão são `1.000.000` operações por tique e `1.000.000.000` operações totais, com tetos configuráveis de `10.000.000` e `10.000.000.000`. Cada fase de avaliação e propagação contabiliza operações; ao exceder um limite, o tique inteiro sofre rollback e o erro é classificado como `operation-budget`.

O mesmo slice calcula uma estimativa determinística do estado do netlist antes de alocar filas de delay. O padrão é `64 MiB`, com configuração entre `1 KiB` e `512 MiB`; delays inválidos ou estimados acima do budget são rejeitados antes da construção do runtime. A estimativa é uma proteção de contrato, não uma medição exata do heap do JavaScript nem uma alegação de uso de memória desktop.

A execução também aceita `AbortSignal` e cancelamento explícito por `simulator.cancel()`. O cancelamento é cooperativo, verificável antes de cada tique e não transforma uma execução parcialmente mutada em estado aceito. `reset()` limpa o cancelamento e os contadores. `shutdown()` limpa nós e ordem interna de forma idempotente; chamadas posteriores falham de modo explícito, sem manter o runtime em memória.

`tickAsync(count, options?)` executa em lotes com `yieldEvery`, timeout bounded e `AbortSignal` específico da operação. Timeout, abort, cancelamento ou budget restauram o snapshot anterior ao lote assíncrono; o adaptador `tickDocumentRuntimeAsync()` devolve um `DocumentRuntimeSnapshot` somente após a conclusão. O yield é cooperativo e não promete preempção durante uma chamada síncrona individual de `tick()`.

`SimulatorExecutionBudget` oferece uma quota agregada explícita para runtimes que pertencem ao mesmo documento ou operação. Ela acumula tiques e operações entre instâncias, reserva memória estimada antes de criar nós/filas e libera essa reserva em `shutdown()`. Falhas de quota restauram a fotografia anterior da execução; `reset()` reinicia somente o runtime individual e não devolve consumo cumulativo de tiques/operações à quota compartilhada.

O protocolo Worker v1 (`workerProtocol.ts` + `simulation.worker.ts`) aceita somente netlists escalares dentro dos limites oficiais, valida o payload antes de criar o runtime, limita snapshots/progresso, propaga `requestId`, cancela cooperativamente, encerra por deadline, classifica budgets e ignora respostas após `dispose()`. O cliente hospedeiro (`workerClient.ts`) mantém uma execução ativa, encaminha `AbortSignal`, entrega progresso, classifica timeout do host como `forced-termination` e encerra o handle. `buildDocumentRuntimeNetlist()` e `buildDocumentWorkerRequest()` reaproveitam preflight, elaboração e conversão canônica, validando inputs/watches e rejeitando o contrato vetorial do Worker v1 sem mutar o documento. `DocumentWorkerExecutor` compõe essas duas camadas de modo opt-in, devolve preflight junto do resultado e assume o ownership do cliente até `dispose()`. O painel temporal expõe um `Preview Worker` explícito que usa esse executor sem substituir, persistir ou mutar o runtime ativo; cancelamento e cleanup acontecem na troca de documento, reset e desmontagem. O conjunto reutiliza o `Simulator` e não implementa ainda supervisor cross-worker, continuidade de estado do Worker para `Step`/`Run` canônicos ou ponte Tauri/Rust.

A ponte `documentRuntime` encaminha esses limites por `DocumentRuntimeOptions` e expõe `diagnoseDocumentRuntime(simulator, maxTicks?)` como um adaptador fino para o diagnóstico do mesmo `Simulator`. Essa função é explicitamente operacional: o diagnóstico avança o runtime recebido e, portanto, não deve ser tratado como uma inspeção pura ou conectado à UI ativa sem uma cópia/preview isolada.

O preflight `preflightDocumentRuntime(document, options?)` usa `analyzeCircuitExecutionSafety()` antes de criar o runtime. A análise iterativa de componentes fortemente conectados classifica ciclos como `combinational-cycle`, `temporal-feedback` ou `unclassified-cycle`; erros adicionais mantêm o status `invalid`. A ordem dos IDs e dos componentes é normalizada para que o relatório seja determinístico, inclusive em grafos que futuramente excedam a profundidade segura de recursão.

Para esse uso seguro existe `diagnoseDocumentRuntimePreview(document, options?)`. O helper cria um runtime novo com o mesmo caminho de elaboração/netlist, restaura opcionalmente um `SimulatorState`, aplica as entradas fornecidas apenas na cópia, executa o diagnóstico limitado e devolve diagnóstico, snapshot e estado final. Assim, o chamador pode apresentar uma prévia sem alterar o runtime ativo.

> Um `settle()` que retorna `false` é uma evidência de que o circuito não estabilizou dentro do orçamento observado; não é uma falha automática do circuito nem uma autorização para aumentar o limite sem diagnóstico.

## Comportamento coberto

| Situação | Resultado esperado |
|---|---|
| Circuito combinacional que estabiliza | `settle()` retorna `true` dentro do orçamento |
| Clock ou feedback oscilante | `settle()` retorna `false` após o orçamento, sem loop infinito |
| Budget zero explícito em `settle(0)` | retorna `false` e não altera `tickCount` |
| Budget de `settle()` negativo, fracionário, infinito ou acima de 10.000 | rejeição `RangeError` fail-closed |
| Budget total zero, fracionário, infinito ou acima de 1.000.000 | rejeição `RangeError` fail-closed |
| `tick(count)` que excede o orçamento restante | rejeição antes de executar parcialmente |
| `restoreState()` acima do orçamento da instância | rejeição antes de mutar nós |
| Budget de operações por tique ou total inválido | rejeição `RangeError` fail-closed |
| Budget de operações excedido | rollback do tique, sem incrementar `tickCount` ou manter operações cobradas |
| Budget de memória inválido ou netlist acima do limite | rejeição antes de alocar o estado do runtime |
| Quota agregada de documento excedida | rejeição `document-budget`, rollback do runtime e dos contadores agregados |
| Quota agregada de memória excedida | rejeição antes de alocar nós/filas; reservas anteriores permanecem íntegras |
| `shutdown()` de runtime compartilhado | libera somente a memória estimada daquele runtime; a quota continua com tiques/operações cumulativos |
| Delay com quantidade inválida de tiques | rejeição `RangeError` fail-closed |
| `AbortSignal` abortado ou `cancel()` chamado | rejeição cooperativa antes de executar |
| `tickAsync()` excede timeout ou é abortado entre lotes | rollback do snapshot anterior e erro explícito `timeout`/`aborted` |
| `shutdown()` repetido | operação idempotente; nós são limpos uma única vez |
| Opção de construtor inválida | rejeição antes de iniciar o runtime |
| Sequenciais com clock manual | usam `tick()`/pulsos controlados, não `settle()` como mecanismo de captura |
| `diagnoseSettle()` em circuito combinacional | retorna `stabilized` e quantidade de tiques executados |
| `diagnoseSettle()` em clock/feedback oscilante | retorna `cycle-detected`, período e início do ciclo quando observado |
| `diagnoseSettle()` sem concluir no budget | retorna `budget-exhausted` sem permitir execução ilimitada |
| Documento usando `diagnoseDocumentRuntime()` | usa o mesmo `Simulator`, encaminha budgets configurados e deixa explícito que a chamada avança o runtime recebido |
| Preview de diagnóstico de documento | cria uma cópia via `createDocumentRuntime()`, aceita estado/entradas, retorna diagnóstico e preserva o runtime original |

## Limites do marco

Este marco protege o custo da operação de acomodação, o total de tiques de uma instância, os custos estimados de memória e operações do runtime, quota agregada por documento, cancelamento cooperativo, limpeza explícita, classificação estática de ciclos no domínio e um protocolo Worker isolado bounded, além de oferecer diagnóstico básico de repetição de estado. O adapter headless `simulateCircuitAsync()` e o handler MCP `simulate_circuit` agora encaminham o `RequestHandlerExtra.signal`, com timeout/yield validados e `shutdown()` em `finally`; isso foi coberto por regressões de adapter, não por um teste de cancelamento de cliente externo. Ainda são trabalhos futuros o supervisor cross-worker, a continuidade de estado do Worker para o runtime temporal canônico, avaliação incremental/compilada, validação desktop da preview, backpressure sob carga, inspeção visual multiplataforma e um contrato de waveform exportável. O preview Worker da UI foi observado em Chromium local somente para uma fixture escalar pequena; isso não é `RUNTIME VERIFIED` do produto nem substitui `Step`/`Run` diretos. A validação visual, o smoke nativo, a medição real de heap, a paridade em navegador real e o cancelamento observado em hosts MCP reais permanecem dependentes de execução interativa em cada plataforma.
