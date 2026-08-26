# Hardening de feedback e orçamento de settle

## Decisão

O `Simulator` continua sendo um simulador por tiques e não tenta resolver feedback por recursão ou por uma execução sem limite. A API `settle()` permanece apropriada para circuitos combinacionais e para verificar se uma rede parou de mudar; circuitos com clock ou feedback oscilante devem retornar `false` quando atingem o orçamento.

O orçamento padrão continua em `200` tiques. Para impedir configurações acidentais que causem execução indefinida ou excessivamente longa, o limite configurável deve ser um inteiro finito entre `1` e `10.000`. O argumento explícito de `settle()` aceita também `0`, que representa uma janela vazia e retorna `false` sem executar tiques.

> Um `settle()` que retorna `false` é uma evidência de que o circuito não estabilizou dentro do orçamento observado; não é uma falha automática do circuito nem uma autorização para aumentar o limite sem diagnóstico.

## Comportamento coberto

| Situação | Resultado esperado |
|---|---|
| Circuito combinacional que estabiliza | `settle()` retorna `true` dentro do orçamento |
| Clock ou feedback oscilante | `settle()` retorna `false` após o orçamento, sem loop infinito |
| Budget zero explícito em `settle(0)` | retorna `false` e não altera `tickCount` |
| Budget negativo, fracionário, infinito ou acima de 10.000 | rejeição `RangeError` fail-closed |
| Opção de construtor inválida | rejeição antes de iniciar o runtime |
| Sequenciais com clock manual | usam `tick()`/pulsos controlados, não `settle()` como mecanismo de captura |

## Limites do marco

Este marco protege o custo da operação de acomodação, mas não resolve todos os problemas de circuitos grandes. Ainda são trabalhos futuros a detecção diagnóstica de ciclos, budgets de operações/memória por documento, avaliação incremental/compilada, renderização parcial e um contrato de waveform exportável. A validação visual e o smoke nativo permanecem dependentes de execução interativa em cada plataforma.
