# Fronteira futura de simulação Tauri/Rust

Este documento define a proposta de integração nativa do simulador sem afirmar que ela já existe. O shell Tauri atual continua mínimo em `src-tauri/src/lib.rs`; o Worker web não é runtime Tauri/Rust. A proposta preserva React → Vite → Tauri 2 → Rust, local-first/offline-first/privacy-first e a separação entre build, artefato, runtime e smoke.

## Escopo do primeiro canal nativo

O primeiro comando nativo deve executar somente um netlist escalar previamente validado pelo host. O payload deve ser uma estrutura de dados versionada equivalente ao contrato Worker v1, com componentes escalares, conexões bounded, steps explícitos, watches, budgets de tiques/operações/memória e um `requestId` não vazio. O comando não deve aceitar JavaScript, expressões para avaliação arbitrária, caminhos de arquivo, plugins, HDL bruto, prompts de IA, URLs ou callbacks.

A validação deve ocorrer no host e ser repetida no lado Rust antes de criar o runtime. O lado Rust precisa rejeitar `custom-chip` não expandido, `splitter`, `combiner`, larguras vetoriais, ids duplicados, conexões inexistentes, payload acima dos limites oficiais de 256 nós, 512 conexões e 500.000 bytes, budgets inválidos e versões incompatíveis. Nenhuma entrada rejeitada pode iniciar execução parcial.

## Comando e cancelamento

A forma inicial proposta é um comando Tauri assíncrono com retorno final tipado e um canal de eventos bounded para progresso. O evento deve carregar `protocolVersion`, `requestId`, tique e snapshot observado; o host deve descartar eventos com versão ou id inesperados. O canal não pode acumular mensagens sem limite nem manter uma thread após término, cancelamento, erro ou fechamento da janela.

O cancelamento deve ser uma operação explícita associada ao `requestId`, com estado idempotente. O lado Rust deve observar o cancelamento entre tiques e durante yields controlados, devolver uma classificação equivalente a `cancelled` e liberar o runtime em `Drop`/guarda equivalente. Timeout do host e fechamento da janela devem encerrar a operação sem deixar thread, canal ou reserva pendente. A UI não deve tratar o cancelamento cooperativo como prova de interrupção física instantânea da thread.

## Estado e checkpoint

A primeira integração nativa não deve habilitar resume. O canal deve executar uma sequência completa isolada, assim como o Worker v1. O contrato `SimulationWorkerCheckpointV1` é uma especificação futura de troca de estado, mas o parser Rust correspondente, a assinatura canônica e a paridade de restore ainda precisam existir antes de qualquer checkpoint atravessar a fronteira.

Se o resume for aprovado depois, o envelope deverá ser validado contra `netlistSignature`, `checkpointVersion`, `protocolVersion`, `tickCount`, `operationCount`, ids, saídas, filas, contadores e budgets. O restore deve ser transacional. O request descendente deverá possuir novo `requestId`, preservar a linhagem explicitamente e não permitir que orçamento ou estado sejam resetados por reconstrução silenciosa do runtime.

## Paridade e evidência obrigatórias

A implementação Rust só poderá ser considerada runtime quando houver comparação golden contra o `Simulator` TypeScript para fixtures DFF, TFF, JK, SR, delay e feedback, incluindo snapshots inicial/intermediários/final, erro de budget, timeout/cancelamento e rejeições fail-closed. A fixture DFF já possui parity Worker web real; isso é oráculo inicial, não prova de Rust.

| Camada | Evidência necessária | Estado atual |
|---|---|---|
| Contrato de dados TypeScript | Tipos, parser e serializer bounded | `PASSED` isolado para checkpoint Worker; não integrado |
| Comando Tauri | Comando async, resposta tipada e erro versionado | `NOT IMPLEMENTED` |
| Canal de progresso | Eventos bounded por `requestId`, teardown e cancelamento | `NOT IMPLEMENTED` |
| Engine Rust | Execução determinística e budgets equivalentes | `NOT IMPLEMENTED` |
| Paridade TypeScript/Rust | Golden fixtures e primeira divergência diagnóstica | `NOT VERIFIED` |
| Windows/macOS/Linux | Build e smoke nativo proporcional por alvo | `NOT VERIFIED` |
| Instalador Windows | `Veritas-Setup.exe` produzido e testado | `NOT VERIFIED` |

## Gates de implementação

Antes de tocar a UI desktop, devem passar: contrato Rust/TypeScript versionado; testes de parser e rejeições; teste de cancelamento repetido; teste de ausência de respostas tardias; teste de teardown do canal; golden parity das fixtures; build Tauri nos três alvos; smoke de abrir projeto, editar, salvar localmente, executar, cancelar e fechar; e registro separado de artefatos, checksums e instalador. CI verde do repositório não substitui a evidência de runtime de cada sistema.

A integração futura deve ser opt-in durante a fase experimental. O runtime direto continuará sendo a referência canônica até que a paridade e a matriz nativa estejam verdes. Nenhum resultado deste documento autoriza afirmar produto desktop completo, suporte a 5k/25k chips, release estável ou venda/distribuição.
