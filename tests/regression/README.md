# Regressão permanente do Veritas

Esta pasta contém regressões que devem continuar sendo executadas a cada release do núcleo e do desktop. O primeiro baseline é o teste cruzado `cross-runtime.test.ts`, que compara a intenção da expressão com o comportamento do circuito no runtime.

## Contrato do baseline

Para cada fixture, a expressão é processada por `parse()` e `buildTruthTable()` com todas as combinações possíveis dentro do limite seguro. O circuito correspondente é criado como `CircuitDocument`, executado por `createDocumentRuntime()`/`Simulator`, estabilizado com `settle()` e comparado linha a linha.

A regressão cobre as portas AND, NAND, OR, NOR, XOR, XNOR e NOT, além de saídas de meio somador, somador completo e multiplexador 2:1. Um caso só passa quando todas as linhas concordam e o circuito estabiliza. Qualquer divergência, circuito não estabilizado ou erro de contrato faz o teste falhar; como a suíte faz parte dos gates, isso bloqueia a release.

A suíte não executa JSON DLS, código importado ou expressões como programa. O teste `sequential-testbench.test.ts` cobre a ponte entre o modelo puro usado pela UI e o `runTestbench`: cria um roteiro para um registrador, converte-o para o contrato declarativo e verifica a execução no Simulator. Fixtures futuras devem reutilizar os módulos de domínio e testbench existentes, declarar limites explícitos e incluir contraexemplos quando a intenção for de divergência.

## Extensões planejadas

Os próximos incrementos são casos gerados a partir de tabelas verdade, circuitos vetoriais dentro dos limites documentados, regressões temporais por roteiro declarativo e assertions do testbench quando o contrato de sinais estiver fechado. A expansão não deve duplicar `evaluateCircuit`, `buildCircuitTruthTable`, `createDocumentRuntime` ou o runner declarativo existente.
