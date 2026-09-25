# Duplicações

> Lógica repetida entre TypeScript, Rust, SQL, Edge Functions, MCP, IA, import/export, UI e testes.
> **Nada aqui foi corrigido.** Cada item traz onde ocorre, por que provavelmente existe, risco e uma
> estratégia futura possível (não decidida). Legenda em [`../README.md`](../README.md).

Classificação de risco: **Alto** = já produziu divergência observável; **Médio** = pode divergir na
próxima mudança; **Baixo** = cópia intencional com controle.

## DUP-01 — Allowlist de tipos de componente · **Alto**

| Onde | Tipos aceitos |
| --- | --- |
| `src/circuit/editorModel.ts` (`EDITOR_COMPONENT_TYPES`) | 21 |
| `src/simulation/components.ts` (`ComponentType`) | 21 |
| `supabase/migrations/20260821043000_…sql` | 11 |
| `supabase/functions/veritas-circuit-ai/index.ts` (`COMPONENT_TYPES`) | 14 |
| `mcp/src/server.ts` (`COMPONENT`, `simulate_circuit`) | 17 |
| `src-tauri/src/simulation.rs` (`is_supported_type`) | 18 |
| `engine-rs/src/lib.rs` (`NodeKind`) | 10 |

- **Por que existe:** runtimes diferentes (Postgres, Deno, Rust) não importam TS; cada tipo novo foi
  adicionado no TS sem atualizar as réplicas. Parte é intencional (Tauri/WASM são subconjuntos).
- **Risco:** sync em nuvem e IA recusam circuitos válidos no editor (G-02, G-03); o MCP recusa JK/SR em
  `simulate_circuit` embora a descrição fale em flip-flops.
- **Estratégia futura:** manifesto único de tipos (dados, não código) com, por tipo, aridade, saídas,
  estado e larguras permitidas; SQL/Edge/Rust gerados ou testados contra ele com vetores compartilhados.
  Diferenciar explicitamente "subconjunto intencional" de "atraso".

## DUP-02 — Guards estruturais de `CircuitDocument` · **Alto**

Pelo menos seis variantes: `isCircuitDocumentShape` (`documentContract.ts`), `isNodeLike`/chaves
permitidas (`storage/circuits.ts`), `isDocument` (Edge), `private.veritas_validate_circuit_document`
(SQL), `isCircuitDocument`/`isValidRemoteNode` (`realtime/roomCollaboration.ts`), parser do
protocolo Worker, parser Rust do Tauri.

- **Por que:** cada fronteira foi endurecida isoladamente; FOUNDATION-001 criou o guard comum, mas nem
  todos migraram (Realtime não usa, arquivo usa chaves fechadas, Edge/SQL não podem importar).
- **Risco:** a mesma entrada é aceita em uma fronteira e recusada em outra; limites (nós, bytes) não são
  checados na recepção Realtime.
- **Estratégia:** um schema declarativo (ex.: JSON Schema) publicado + guards gerados, e uma suíte de
  vetores válidos/inválidos executada contra TS, SQL, Edge e Rust.

## DUP-03 — Validação semântica · **Alto**

`validateCircuit` (TS) × validação SQL (aridade, ciclo, porta duplicada) × validação Rust
(Tauri, engine-rs). Regras de aridade no SQL são escritas à mão (`case when target_type in …`).
- **Risco / estratégia:** como DUP-01; o `docs/BETA-SUPABASE-STRUCTURAL-AUDIT.md` já reconhece o drift.

## DUP-04 — Limites de documento e execução · **Médio**

256 nós / 512 conexões / 200 / 120 / 500.000 bytes / 64 bits / 1000 tiques aparecem em
`documentLimits.ts`, Edge Function (constantes próprias), SQL, `workerProtocol.ts` (importa do TS —
bom), `simulation.rs` (constantes Rust), `mcp/src/tools.ts` (`MAX_SIMULATION_*`), `testbench.ts`,
`differential.ts`. Edge limita contexto a 200.000 **caracteres** enquanto o documento aceita 500.000 **bytes**.
- **Estratégia:** mesmo manifesto de DUP-01, com teste de igualdade em cada runtime.

## DUP-05 — Implementações de simulador · **Médio (controlado)**

`Simulator` TS (canônico) × simulador escalar sequencial em `src-tauri/src/simulation.rs` × avaliador
combinacional em `engine-rs`. Topological sort também em `circuit/topology.ts`, DFS de ciclo em
`validateCircuit`, `engine-rs::topological_order`, CTE recursiva no SQL.
- **Por que:** decisão de preparar Rust para escala mantendo TS como referência (D-004).
- **Controle existente:** fixtures golden compartilhadas (`tests/fixtures/rust-engine`, `worker-sequential-*.json`,
  `tests/fixtures/wasm`), `tests/rustEngineParity.test.ts`, `beta:wasm:parity`.
- **Risco:** cobertura golden ainda estreita (DFF/TFF/JK/SR/delay/feedback); dois crates Rust com modelos
  diferentes entre si.
- **Estratégia:** decidir se os dois crates convergem (Q-010); ampliar golden antes de qualquer promoção.

## DUP-06 — Hashes não criptográficos · **Médio**

FNV-1a 32 em `circuit/context.ts` (`contentHash`) e `runtimeCheckpoint.ts`; FNV-1a 64 em
`workerCheckpoint.ts` (`netlistSignature`); hash de cor em `roomCollaboration.ts`. Cada um com sua
própria canonicalização (`stableStringify` só em `context.ts`).
- **Risco:** colisões possíveis; impossível usar como integridade/evidência; `content_hash` é chave única
  no banco `(user_id, content_hash)`.
- **Estratégia:** uma função de canonicalização + um digest criptográfico (SHA-256 via WebCrypto/Node/Rust)
  para qualquer uso de identidade; FNV só para chaves locais descartáveis.

## DUP-07 — Otimização "remover inalcançáveis" · **Baixo**

`optimizeCircuitDocument` (`src/circuit/optimize.ts`) × `heuristic()` na Edge Function.
- **Estratégia:** a heurística poderia rodar no cliente (é determinística) e a Edge só chamar o LLM.

## DUP-08 — Linguagens de expressão · **Baixo (intencional)**

Engine booleana (`src/engine/lexer.ts`/`parser.ts`) × linguagem tipada de algoritmos
(`src/algorithms/expressions.ts`, com números e strings). Nome `evaluateExpression` também existe em
`mcp/src/tools.ts` com outro significado.
- **Risco:** asserções futuras sobre sinais podem ganhar um terceiro parser; `docs/VERIFICATION.md` já
  exige reusar o da engine.

## DUP-09 — Identidades de versão · **Alto (distribuição)**

`package.json` 0.9.0-rc.18; `VERITAS_MCP_VERSION`, `mcp/package.json`, `plugin.json` 0.9.0-rc.13;
`marketplace.json` 0.8.0-rc.1; desktop 0.1.0-alpha.1; README/CHANGELOG 0.12.0; fases "v2.x".
- **Risco:** hosts MCP e usuários do plugin veem versão errada; evidência futura não consegue citar a
  versão exata da engine.
- **Estratégia:** fonte única de versão injetada no build; gate de CI que compara.

## DUP-10 — Artefatos gerados versionados · **Médio**

`plugins/veritas-logic/server.mjs` (bundle ~864 kB) e `plugins/veritas-logic/catalog.json` (cópia de
`src/chips/catalog.json`).
- **Por que:** o plugin precisa funcionar sem build no cliente.
- **Risco:** o bundle diverge do código fonte (hoje embute 0.9.0-rc.13). O CI roda `build:plugin`, mas
  não há checagem de "working tree limpa" após o build [código].
- **Estratégia:** gate que regenera e falha se houver diff; ou publicação por release.

## DUP-11 — Schemas MCP × tipos de domínio · **Médio**

Zod em `mcp/src/server.ts` repete, à mão, parte dos tipos TS (steps, componentes, limites). Documentos
são `z.unknown()` e revalidados — bom —, mas netlist, steps e testbench têm forma duplicada.
- **Estratégia:** derivar schema de entrada/saída a partir do mesmo manifesto; publicar `outputSchema`.

## DUP-12 — Contratos de aceitação em `.mjs` + `.d.mts` · **Baixo**

Cada gate em `scripts/` tem implementação `.mjs`, declaração `.d.mts` e teste em `src/release/`.
Intencional (scripts Node sem build), mas triplica a superfície.

## DUP-13 — Documentação de estado · **Médio**

O estado do produto é narrado em README (tabela de releases), `plano.md`, `docs/ROADMAP.md` (§1 e
dezenas de "Atualização da implementação"), CHANGELOG, `VERITAS_AUDIT.md`,
`VERITAS_MASTER_CONTINUATION_PROMPT.md`, `VERITAS_V3_V5_ROADMAP.md` §2–3 — com divergências
(ex.: README chama MCP HTTP de "próxima camada"; auditoria diz que wireless não está integrado).
- **Estratégia:** esta árvore `docs/0x-*` passa a ser o lugar do estado arquitetural; os demais citam-na.

## DUP-14 — Validação da resposta de IA · **Médio**

Edge valida `optimizedDocument` com seu `isDocument`; cliente valida de novo com
`isCircuitDocumentShape` + `validateCircuit`. Nenhum dos dois checa equivalência — a duplicação protege
forma, não comportamento.

## Resumo para priorização

| Risco | Itens |
| --- | --- |
| Alto | DUP-01, DUP-02, DUP-03, DUP-09 |
| Médio | DUP-04, DUP-05, DUP-06, DUP-10, DUP-11, DUP-13, DUP-14 |
| Baixo | DUP-07, DUP-08, DUP-12 |

A raiz comum de DUP-01…04 é a **ausência de uma fonte única de verdade executável para o contrato
do documento**. É o primeiro item do [`FOUNDATION_ROADMAP.md`](../05-FOUNDATION/FOUNDATION_ROADMAP.md).
