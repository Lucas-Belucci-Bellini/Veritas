# Fronteira de execução Worker/Desktop

**Status:** protocolo Worker, entrypoint, cliente hospedeiro, ponte documental, executor opt-in e supervisor bounded do host implementados; o painel temporal expõe `Preview Worker` sem substituir o runtime direto. Continuidade de estado para `Step`/`Run`, Worker no Tauri e simulação Rust ainda não implementados.

**Marco:** v2.7.0 — Execution Safety.

## Decisão

O `Simulator` TypeScript continua sendo a engine canônica. Uma futura fronteira Worker não deve criar uma segunda engine, alterar a semântica de tiques ou transformar um resultado de benchmark bruto em suporte editorial para circuitos grandes. O Worker será um transporte isolado para uma execução já validada, com protocolo versionado, budgets explícitos, cancelamento cooperativo e resultado determinístico.

A ponte Tauri 2/Rust permanece um shell técnico mínimo neste momento. `src-tauri/src/lib.rs` ainda não expõe comando de simulação, canal de progresso ou runtime nativo equivalente. O Worker web agora possui contrato e entrypoint testados, mas isso não é evidência de `RUNTIME VERIFIED` no desktop nem substitui um contrato de paridade para uma futura ponte Rust.

## Escopo do futuro Worker

O fluxo proposto é:

```text
UI / MCP host
  → validação do documento + preflight
  → requestId e budget declarativo
  → Worker
  → Netlist validado + Simulator canônico
  → snapshots/progresso bounded
  → resultado ou erro tipado
```

A mensagem inicial deverá carregar somente dados estruturais validados: `protocolVersion`, `requestId`, um `CircuitDocument` ou `Netlist` permitido, entradas declaradas, limite de tiques, limite de operações, limite de memória estimada, `yieldEvery` e timeout. O Worker não recebe JavaScript, `eval`, `Function`, comandos de shell, HDL para execução, credenciais, tokens ou conteúdo remoto.

As mensagens de saída serão separadas por tipo: `progress` para uma amostra bounded, `result` para o snapshot final, `error` para falha classificada e `cancelled` para cancelamento cooperativo confirmado. Cada mensagem deve repetir `requestId`; respostas de requests desconhecidos ou já encerrados devem ser ignoradas de forma determinística. Waveforms completos e dumps ilimitados não fazem parte do primeiro contrato.

## Cancelamento e encerramento

A UI deverá manter um `AbortController` por request. O cancelamento envia uma mensagem declarativa ao Worker, que aciona um `AbortController` local e deixa `Simulator.tickAsync()` concluir o rollback do lote atual. O Worker deve enviar `cancelled` somente depois de liberar o runtime e remover listeners/timers do request. Se o Worker não responder dentro de um timeout bounded, a camada hospedeira poderá usar `terminate()` como último recurso, mas esse caso deverá ser reportado como `forced-termination`, não como cancelamento limpo.

O mesmo princípio vale para a futura ponte Tauri: o comando deverá possuir identificador de operação, canal de cancelamento, timeout e encerramento idempotente. Um processo nativo encerrado à força não é evidência de cleanup normal, e o evento deve permanecer visível no relatório de QA.

## Budgets entre fronteiras

`SimulatorExecutionBudget` já fornece uma quota compartilhável entre runtimes no mesmo contexto JavaScript. Ela não é transferida automaticamente por structured clone para um Worker e não deve ser tratada como um contador global mágico. A fronteira futura deverá transportar um DTO imutável com os tetos declarados e manter a contabilidade agregada no proprietário do documento ou em um supervisor de execução.

O contrato mínimo do supervisor deverá distinguir:

| Recurso | Regra proposta | Evidência necessária |
| --- | --- | --- |
| Tiques | Soma cumulativa por documento/request; rollback não consome o lote que falhou | Teste com dois runtimes e abort tardio |
| Operações | Soma observável por execução; exceder encerra com `document-budget` | Golden de erro e contadores antes/depois |
| Memória | Reserva estimada antes de alocar; liberação após `shutdown()` ou encerramento confirmado | Dois runtimes, falha de reserva e cleanup |
| Tempo | Timeout monotônico bounded; ausência de resposta não é sucesso | Teste de timeout e classificação `forced-termination` |
| Progresso | Frequência limitada e payload bounded | Teste de backpressure e tamanho máximo |
| Host supervisor | Concorrência/fila bounded, requestId único e reserva declarativa liberada no lifecycle | Testes de fila cheia, cancelamento enfileirado/ativo, quota e dispose |

A quota atual por documento é uma API do mesmo processo e os budgets declarativos são transportados pelo protocolo Worker v1. `SimulationWorkerSupervisor` mantém no host reservas agregadas conservadoras, concorrência e fila bounded; essa contabilidade não mede consumo efetivo dentro de cada Worker e não substitui backpressure sob carga ou medição de heap real.

## Paridade e segurança

Antes de introduzir Worker ou Rust, cada fixture deverá produzir o mesmo snapshot, tick final, diagnóstico e erro tipado no caminho direto e no caminho isolado. O preflight continuará sendo uma classificação defensiva; não será uma autorização para executar um documento inválido. Componentes customizados deverão chegar já expandidos por allowlist validada, ou ser rejeitados. Importações HDL, plugins e sugestões de IA continuam sujeitas a validação, preview e confirmação explícita.

O caminho de circuitos grandes permanece fora do contrato editorial atual. O documento [`LARGE_CIRCUITS.md`](./LARGE_CIRCUITS.md) mantém `256` nós, `512` conexões e `500.000` bytes como limites oficiais. Um Worker futuro poderá ser parte da arquitetura de escala, mas não autoriza elevar esses limites antes de haver formato escalável, renderização medida, persistência, cancelamento, benchmarks e smoke Windows/macOS/Linux.

## Gates para integração de produto

O slice implementado prova por testes que uma execução normal devolve snapshots determinísticos, um abort antes do primeiro tique e um abort entre yields devolvem `cancelled`, timeout e budget devolvem erro controlado, mensagens tardias são ignoradas e dois requests não misturam `requestId`. O painel temporal também expõe um preview opt-in que usa a ponte documental e preserva o runtime direto; o supervisor bounded limita concorrência/fila e reservas declarativas no host. A integração ainda não fornece continuidade de estado para `Step`/`Run` nem medição efetiva de consumo entre múltiplos Workers.

O caminho web já passou por build explícito do Worker, smoke local em Chromium, paridade de uma fixture direta versus Worker real, cancelamento real via cliente Worker, um preview documental acionado pela UI, testes determinísticos do supervisor e um smoke real do supervisor com múltiplos Workers. O próximo passo é repetir isso em preview de produção e sob carga medida, incluindo backpressure sustentado, medição efetiva de heap/CPU e comportamento com circuitos sequenciais. A ponte Tauri só poderá ser iniciada com comando Rust equivalente, teste de contrato, build nos três alvos e evidência separada de `BUILD VERIFIED`, `ARTIFACT VERIFIED`, `RUNTIME VERIFIED` e `SMOKE VERIFIED`. CI verde continuará sendo apenas evidência do workflow executado.

## Estado atual e próximos passos

Neste slice, o repositório possui `workerProtocol.ts`, `simulation.worker.ts`, `workerClient.ts`, `documentWorker.ts`, `documentWorkerExecutor.ts` e `workerSupervisor.ts`, além da factory `createSimulationWorker()`, testes de endpoint fake e o `Preview Worker` opt-in no painel temporal. Smokes adicionais executaram o Worker, o cliente, a ponte documental e o supervisor reais no Chromium local, incluindo paridade do snapshot final, cancelamento após progresso, preflight `acyclic`, imutabilidade do documento, preview isolado da UI, cinco requests independentes, concorrência máxima 2, cancelamento ativo/enfileirado e reservas zeradas após cleanup. O supervisor tem cobertura determinística para concorrência, fila, backpressure, reservas declarativas, cancelamento e dispose, mas ainda não há medição efetiva de consumo entre Workers nem carga sustentada. Essa evidência é limitada a fixtures pequenas; `Step`/`Run` continuam diretos, não há canais Tauri nem simulação Tauri/Rust, e a memória real continua não medida sob carga. Execução desktop interativa e suporte oficial a 5k/25k chips permanecem `NOT VERIFIED` ou `NOT SUPPORTED`, conforme o contrato aplicável.

## Referências

[1]: ../src/simulation/simulator.ts "Simulator canônico e budgets de execução"

[2]: ../src/simulation/documentRuntime.ts "Ponte CircuitDocument → Simulator"

[3]: ../mcp/src/server.ts "Handler MCP e RequestHandlerExtra.signal"

[4]: ./LARGE_CIRCUITS.md "Limites oficiais e decisão de capacidade"

[5]: ../src-tauri/src/lib.rs "Shell atual Tauri 2/Rust"

[6]: ../tests/desktop/QA_MATRIX.md "Classificação de evidências desktop"

[7]: ./FEEDBACK_HARDENING.md "Contrato de hardening e limites de execução"
