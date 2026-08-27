# Fronteira futura de simulação Tauri/Rust

Este documento define a fronteira da integração nativa e classifica o que já foi implementado sem promover código compilado a runtime desktop verificado. O shell Tauri agora possui um primeiro comando escalar em `src-tauri/src/lib.rs`/`src-tauri/src/simulation.rs`; o Worker web continua não sendo runtime Tauri/Rust. A proposta preserva React → Vite → Tauri 2 → Rust, local-first/offline-first/privacy-first e a separação entre build, artefato, runtime e smoke.

## Escopo do primeiro canal nativo

O primeiro comando nativo implementado executa somente um netlist escalar previamente validado no lado Rust. O payload deve ser uma estrutura de dados versionada equivalente ao contrato Worker v1, com componentes escalares, conexões bounded, steps explícitos, watches, budgets de tiques/operações/memória e um `requestId` não vazio. O comando não deve aceitar JavaScript, expressões para avaliação arbitrária, caminhos de arquivo, plugins, HDL bruto, prompts de IA, URLs ou callbacks.

A validação deve ocorrer no host e ser repetida no lado Rust antes de criar o runtime. O lado Rust precisa rejeitar `custom-chip` não expandido, `splitter`, `combiner`, larguras vetoriais, ids duplicados, conexões inexistentes, payload acima dos limites oficiais de 256 nós, 512 conexões e 500.000 bytes, budgets inválidos e versões incompatíveis. Nenhuma entrada rejeitada pode iniciar execução parcial.

## Comando e cancelamento

O primeiro slice implementado expõe `simulate_circuit_native` como comando Tauri assíncrono com retorno final tipado e execução em `spawn_blocking`. O registro host-side associa um token cancelável a cada `requestId` e rejeita ids duplicados. O engine agora emite progresso no máximo 64 vezes por request, pelo evento `veritas://simulation-progress`, e o adapter frontend filtra `protocolVersion`/`requestId`; a UI ainda não liga esse caminho ao fluxo canônico. Um smoke Linux opt-in com `--native-smoke` observou invoke, dois eventos e três snapshots no binário empacotado sob Xvfb; isso não promove a UI canônica nem as outras plataformas.

O cancelamento implementado é uma operação explícita associada ao `requestId`, com estado idempotente. O lado Rust deve observar o cancelamento entre tiques e durante yields controlados, devolver uma classificação equivalente a `cancelled` e liberar o runtime em `Drop`/guarda equivalente. Timeout do host e fechamento da janela devem encerrar a operação sem deixar thread, canal ou reserva pendente. A UI não deve tratar o cancelamento cooperativo como prova de interrupção física instantânea da thread.

## Estado e checkpoint

A primeira integração nativa não deve habilitar resume. O canal deve executar uma sequência completa isolada, assim como o Worker v1. O contrato `SimulationWorkerCheckpointV1` é uma especificação futura de troca de estado, mas o parser Rust correspondente, a assinatura canônica e a paridade de restore ainda precisam existir antes de qualquer checkpoint atravessar a fronteira.

Se o resume for aprovado depois, o envelope deverá ser validado contra `netlistSignature`, `checkpointVersion`, `protocolVersion`, `tickCount`, `operationCount`, ids, saídas, filas, contadores e budgets. O restore deve ser transacional. O request descendente deverá possuir novo `requestId`, preservar a linhagem explicitamente e não permitir que orçamento ou estado sejam resetados por reconstrução silenciosa do runtime.

## Paridade e evidência obrigatórias

A implementação Rust só poderá ser considerada runtime quando houver comparação golden contra o `Simulator` TypeScript para fixtures DFF, TFF, JK, SR, delay e feedback, incluindo snapshots inicial/intermediários/final, erro de budget, timeout/cancelamento e rejeições fail-closed. As fixtures DFF, TFF, JK, SR, delay e feedback agora possuem parity Worker web real e golden compartilhada TypeScript/Rust; a fixture SR documenta S=R=1 como hold determinístico, a fixture delay cobre latência de três tiques e a fixture feedback valida o loop DFF/Q̄ por pulsos. O snapshot público observa a saída primária; Q̄ permanece estado interno do circuito. Isso é cobertura incremental, não prova de runtime desktop completo.

| Camada | Evidência necessária | Estado atual |
|---|---|---|
| Contrato de dados TypeScript | Tipos, parser e serializer bounded | `PASSED` isolado para checkpoint Worker; não integrado |
| Comando Tauri | Comando async, resposta tipada, erro versionado, registro de cancelamento e cleanup RAII | `PASSED` no crate Linux e em harness IPC `MockRuntime`: `invoke` de sucesso retornou snapshots/requestId e payload desconhecido foi rejeitado fail-closed; cleanup em retorno antecipado/join failure coberto por guarda; UI ainda não integrada |
| Canal de progresso | Eventos bounded por `requestId`, filtragem host-side, teardown e cancelamento cooperativo por `yieldEvery` | `PASSED` em testes Rust/TypeScript, no harness IPC `MockRuntime` e no smoke Linux empacotado, que recebeu dois eventos bounded com versão/requestId; cancelamento concorrente por invoke e outras plataformas `NOT VERIFIED` |
| Engine Rust | Execução determinística escalar, budgets e snapshots finais | `PASSED` em testes Rust Linux e no invoke do smoke Linux empacotado; não conectado ao runtime canônico da UI |
| Paridade TypeScript/Rust | Golden fixtures e primeira divergência diagnóstica | `PASSED` para fixtures DFF, TFF, JK, SR, delay e feedback escalares compartilhadas em testes TypeScript/Rust; cobertura ampla e runtime interativo `NOT VERIFIED` |
| Windows/macOS/Linux | Build e smoke nativo proporcional por alvo | Linux x86-64: `BUILD VERIFIED` para `deb`/`AppImage` e `SMOKE VERIFIED` limitado para instalar/iniciar/remover `.deb` sob Xvfb; adicionalmente `SMOKE VERIFIED` opt-in para invoke/progresso no binário empacotado. Windows/macOS têm artifacts `BUILD VERIFIED`; runtime/instalação nesses alvos permanecem `NOT VERIFIED` |
| Instalador Windows | `Veritas-Setup.exe` produzido e testado | Artifact produzido no runner Windows; instalação e startup neste smoke `NOT VERIFIED` |

## Gates de implementação

Antes de tocar a UI desktop, devem passar: contrato Rust/TypeScript versionado; testes de parser e rejeições; teste de cancelamento repetido; teste de ausência de respostas tardias; teste de teardown do canal; golden parity das fixtures; build Tauri nos três alvos; smoke de abrir projeto, editar, salvar localmente, executar, cancelar e fechar; e registro separado de artefatos, checksums e instalador. O registry nativo agora tem cleanup RAII, duplicidade e cancelamento idempotente cobertos no crate; a observação de cancelamento por outra thread também passou. O smoke Linux empacotado agora prova invoke/progresso reais apenas para o caso DFF opt-in; o cancelamento concorrente por invoke, o editor, Step/Run e demais plataformas seguem pendentes. CI verde do repositório não substitui a evidência de runtime de cada sistema.

A integração futura deve ser opt-in durante a fase experimental. O comando escalar atual ainda não está ligado à UI nem ao fluxo canônico; o runtime direto continuará sendo a referência canônica até que a paridade e a matriz nativa estejam verdes. Nenhum resultado deste documento autoriza afirmar produto desktop completo, suporte a 5k/25k chips, release estável ou venda/distribuição.
