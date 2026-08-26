# Hardening de feedback e orçamento de settle

## Decisão

O `Simulator` continua sendo um simulador por tiques e não tenta resolver feedback por recursão ou por uma execução sem limite. A API `settle()` permanece apropriada para circuitos combinacionais e para verificar se uma rede parou de mudar; circuitos com clock ou feedback oscilante devem retornar `false` quando atingem o orçamento.

O orçamento padrão de `settle()` continua em `200` tiques. Para impedir configurações acidentais que causem execução indefinida ou excessivamente longa, o limite configurável deve ser um inteiro finito entre `1` e `10.000`. O argumento explícito de `settle()` aceita também `0`, que representa uma janela vazia e retorna `false` sem executar tiques. O método `settle()` mantém a semântica compatível baseada nas saídas; o diagnóstico detalhado é opt-in por `diagnoseSettle()`.

Além disso, cada instância possui um orçamento total acumulado padrão de `100.000` tiques, configurável entre `1` e `1.000.000`. `tick(count)` rejeita contagens fracionárias, negativas ou não finitas e falha antes de ultrapassar o orçamento restante. `restoreState()` rejeita estados cujo `tickCount` exceda o orçamento da instância, sem mutar o runtime.

A ponte `documentRuntime` encaminha esses limites por `DocumentRuntimeOptions` e expõe `diagnoseDocumentRuntime(simulator, maxTicks?)` como um adaptador fino para o diagnóstico do mesmo `Simulator`. Essa função é explicitamente operacional: o diagnóstico avança o runtime recebido e, portanto, não deve ser tratado como uma inspeção pura ou conectado à UI ativa sem uma cópia/preview isolada.

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
| Opção de construtor inválida | rejeição antes de iniciar o runtime |
| Sequenciais com clock manual | usam `tick()`/pulsos controlados, não `settle()` como mecanismo de captura |
| `diagnoseSettle()` em circuito combinacional | retorna `stabilized` e quantidade de tiques executados |
| `diagnoseSettle()` em clock/feedback oscilante | retorna `cycle-detected`, período e início do ciclo quando observado |
| `diagnoseSettle()` sem concluir no budget | retorna `budget-exhausted` sem permitir execução ilimitada |
| Documento usando `diagnoseDocumentRuntime()` | usa o mesmo `Simulator`, encaminha budgets configurados e deixa explícito que a chamada avança o runtime recebido |
| Preview de diagnóstico de documento | cria uma cópia via `createDocumentRuntime()`, aceita estado/entradas, retorna diagnóstico e preserva o runtime original |

## Limites do marco

Este marco protege o custo da operação de acomodação, o total de tiques de uma instância e oferece diagnóstico básico de repetição de estado. Ainda são trabalhos futuros a classificação de ciclos no grafo antes da execução, budgets de operações/memória por documento, avaliação incremental/compilada, integração visual da preview e um contrato de waveform exportável. A validação visual e o smoke nativo permanecem dependentes de execução interativa em cada plataforma.
