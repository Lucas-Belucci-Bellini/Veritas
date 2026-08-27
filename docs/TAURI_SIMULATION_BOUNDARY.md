# Fronteira futura de simulação Tauri/Rust

Este documento define a fronteira da integração nativa e classifica o que já foi implementado sem promover código compilado a runtime desktop verificado. O shell Tauri agora possui um primeiro comando escalar em `src-tauri/src/lib.rs`/`src-tauri/src/simulation.rs`; o Worker web continua não sendo runtime Tauri/Rust. A proposta preserva React → Vite → Tauri 2 → Rust, local-first/offline-first/privacy-first e a separação entre build, artefato, runtime e smoke.

## Escopo do primeiro canal nativo

O primeiro comando nativo implementado executa somente um netlist escalar previamente validado no lado Rust. O payload deve ser uma estrutura de dados versionada equivalente ao contrato Worker v1, com componentes escalares, conexões bounded, steps explícitos, watches, budgets de tiques/operações/memória e um `requestId` não vazio. O comando não deve aceitar JavaScript, expressões para avaliação arbitrária, caminhos de arquivo, plugins, HDL bruto, prompts de IA, URLs ou callbacks.

A validação deve ocorrer no host e ser repetida no lado Rust antes de criar o runtime. O lado Rust precisa rejeitar `custom-chip` não expandido, `splitter`, `combiner`, larguras vetoriais, ids duplicados, conexões inexistentes, payload acima dos limites oficiais de 256 nós, 512 conexões e 500.000 bytes, budgets inválidos e versões incompatíveis. Nenhuma entrada rejeitada pode iniciar execução parcial.

## Comando e cancelamento

O primeiro slice implementado expõe `simulate_circuit_native` como comando Tauri assíncrono com retorno final tipado e execução em `spawn_blocking`. O registro host-side associa um token cancelável a cada `requestId` e rejeita ids duplicados. O engine agora emite progresso no máximo 64 vezes por request, pelo evento `veritas://simulation-progress`, e o adapter frontend filtra `protocolVersion`/`requestId`; a UI ainda não liga esse caminho ao fluxo canônico e nenhum evento foi observado em runtime desktop.

O cancelamento implementado é uma operação explícita associada ao `requestId`, com estado idempotente. O lado Rust deve observar o cancelamento entre tiques e durante yields controlados, devolver uma classificação equivalente a `cancelled` e liberar o runtime em `Drop`/guarda equivalente. Timeout do host e fechamento da janela devem encerrar a operação sem deixar thread, canal ou reserva pendente. A UI não deve tratar o cancelamento cooperativo como prova de interrupção física instantânea da thread.

## Estado e checkpoint

A primeira integração nativa não deve habilitar resume. O canal deve executar uma sequência completa isolada, assim como o Worker v1. O contrato `SimulationWorkerCheckpointV1` é uma especificação futura de troca de estado, mas o parser Rust correspondente, a assinatura canônica e a paridade de restore ainda precisam existir antes de qualquer checkpoint atravessar a fronteira.

Se o resume for aprovado depois, o envelope deverá ser validado contra `netlistSignature`, `checkpointVersion`, `protocolVersion`, `tickCount`, `operationCount`, ids, saídas, filas, contadores e budgets. O restore deve ser transacional. O request descendente deverá possuir novo `requestId`, preservar a linhagem explicitamente e não permitir que orçamento ou estado sejam resetados por reconstrução silenciosa do runtime.

## Paridade e evidência obrigatórias

A implementação Rust só poderá ser considerada runtime quando houver comparação golden contra o `Simulator` TypeScript para fixtures DFF, TFF, JK, SR, delay e feedback, incluindo snapshots inicial/intermediários/final, erro de budget, timeout/cancelamento e rejeições fail-closed. As fixtures DFF, TFF e JK agora possuem parity Worker web real e golden compartilhada TypeScript/Rust; isso é cobertura incremental, não prova de runtime desktop completo.

| Camada | Evidência necessária | Estado atual |
|---|---|---|
| Contrato de dados TypeScript | Tipos, parser e serializer bounded | `PASSED` isolado para checkpoint Worker; não integrado |
| Comando Tauri | Comando async, resposta tipada, erro versionado, registro de cancelamento e cleanup RAII | `BUILD VERIFIED`/`PASSED` no crate Linux; cleanup em retorno antecipado/join failure coberto por guarda; UI ainda não integrada |
| Canal de progresso | Eventos bounded por `requestId`, filtragem host-side, teardown e cancelamento cooperativo por `yieldEvery` | `PASSED` em testes Rust/TypeScript, incluindo cancelamento observado por outra thread; emissão Tauri e teardown em runtime desktop `NOT VERIFIED` |
| Engine Rust | Execução determinística escalar, budgets e snapshots finais | `PASSED` em testes Rust Linux; runtime interativo não verificado |
| Paridade TypeScript/Rust | Golden fixtures e primeira divergência diagnóstica | `PASSED` para fixtures DFF, TFF e JK escalares compartilhadas em testes TypeScript/Rust; SR, delay, feedback, cobertura ampla e runtime interativo `NOT VERIFIED` |
| Windows/macOS/Linux | Build e smoke nativo proporcional por alvo | `BUILD VERIFIED` para Linux x86-64 com `deb`/`AppImage`; `SMOKE VERIFIED` limitado para instalar/iniciar/remover o `.deb` sob Xvfb. Windows/macOS têm artifacts `BUILD VERIFIED`; runtime/instalação nesses alvos permanecem `NOT VERIFIED` |
| Instalador Windows | `Veritas-Setup.exe` produzido e testado | Artifact produzido no runner Windows; instalação e startup neste smoke `NOT VERIFIED` |

## Gates de implementação

Antes de tocar a UI desktop, devem passar: contrato Rust/TypeScript versionado; testes de parser e rejeições; teste de cancelamento repetido; teste de ausência de respostas tardias; teste de teardown do canal; golden parity das fixtures; build Tauri nos três alvos; smoke de abrir projeto, editar, salvar localmente, executar, cancelar e fechar; e registro separado de artefatos, checksums e instalador. O registry nativo agora tem cleanup RAII, duplicidade e cancelamento idempotente cobertos no crate; a observação de cancelamento por outra thread também passou. Isso ainda não prova invoke/evento/cancelamento em uma janela Tauri real. CI verde do repositório não substitui a evidência de runtime de cada sistema.

A integração futura deve ser opt-in durante a fase experimental. O comando escalar atual ainda não está ligado à UI nem ao fluxo canônico; o runtime direto continuará sendo a referência canônica até que a paridade e a matriz nativa estejam verdes. Nenhum resultado deste documento autoriza afirmar produto desktop completo, suporte a 5k/25k chips, release estável ou venda/distribuição.
