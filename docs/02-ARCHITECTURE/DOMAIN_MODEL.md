# Modelo de domínio

> Cada estrutura que representa o domínio: origem, finalidade, produtores, consumidores,
> invariantes, validação, serialização, versionamento e limitações.
> O `CircuitDocument` tem documento próprio: [`CANONICAL_DOCUMENT.md`](./CANONICAL_DOCUMENT.md).
> Legenda em [`../README.md`](../README.md).

## 0. Mapa dos modelos

```text
Texto de expressão ──parse──► AST ──► TruthTable / NormalForms / Karnaugh / Simplify
                                  └─► (fromAst) CircuitDocument derivado
CircuitDocument ──validate──► Netlist(ComponentSpec[]) ──► Simulator ──► SimulatorState / snapshots
      │                         │                                   └─► DocumentRuntimeState ─► RuntimeCheckpoint
      │                         ├─► Worker request v1 ─► Worker ─► result / WorkerCheckpointV1
      │                         ├─► NativeSimulationRequest v1 (Tauri Rust)
      │                         └─► VNET (WASM, engine-rs)
      ├─► CustomChipDefinition ─► (elaboração) CircuitDocument plano
      ├─► Equivalence / Differential / Testbench report
      ├─► CircuitContextRecord ─► Edge Function ─► CircuitAiResult
      ├─► HDL (Verilog / VHDL)
      ├─► Cloud rows (projects, versions) · Realtime envelopes
      └─► Envelopes de arquivo (.veritas-circuits, chip-library)
AlgorithmDocument ──► ExecutionState (trace, watch, branches)
ChipCatalog (gerado de DLS) · DlsChip (entrada externa)
```

## 1. Expressão e AST

| Campo | Valor |
| --- | --- |
| Origem | `src/engine/ast.ts`, `lexer.ts`, `parser.ts`, `tokens.ts` |
| Finalidade | Representar fórmulas proposicionais independentemente da notação |
| Produtores | `parse(text)` |
| Consumidores | avaliador, tabela verdade, minimização, formas normais, Karnaugh, `simulation/fromAst.ts`, `algorithms/logicCases.ts`, MCP |
| Invariantes | Variáveis = 1 letra + dígitos opcionais; `V`/`F` são variáveis; constantes `0`/`1`; justaposição = AND; letras coladas rejeitadas |
| Validação | Parser com `VeritasError` posicional em PT-BR |
| Serialização | Nenhuma própria: persiste-se o **texto** + `notation` (projeto `.veritas`) |
| Versionamento | Implícito na gramática; sem versão |
| Limitações | Sem quantificadores, sem lógica de primeira ordem; tabela com teto de linhas |

## 2. TruthTable / NormalForms / KarnaughMap

| Campo | Valor |
| --- | --- |
| Origem | `src/engine/truthTable.ts`, `normalForms.ts`, `karnaugh.ts`, `minimize.ts` |
| Finalidade | Resultados derivados, não persistidos |
| Consumidores | UI, MCP (serializados em JSON-texto), importador de chips |
| Invariantes | Enumeração canônica das atribuições; subexpressões idênticas compartilham coluna; Karnaugh ≤4 variáveis |
| Limitações | Crescimento 2ⁿ; `max_rows` no MCP ≤4096 |

## 3. Netlist / ComponentSpec / PortRef

| Campo | Valor |
| --- | --- |
| Origem | `src/simulation/components.ts` |
| Finalidade | Forma executável mínima do circuito (sem posição) |
| Produtores | `toNetlist(document)`, `buildDocumentRuntimeNetlist`, **o próprio cliente MCP** em `simulate_circuit` |
| Consumidores | `Simulator`, `evaluateNetlist`, Worker, Tauri, adaptador WASM |
| Invariantes | `inputs[i]` = `PortRef{node, port?}`; `outputCount` 2 para dff/tff/jk/sr, `widths.length` para splitter |
| Validação | Via `validateCircuit` quando vem de documento; **quando vem do MCP, validação do `Simulator` e dos adaptadores** [código] |
| Serialização | JSON (Worker/Tauri/MCP), binário `VNET` (WASM) |
| Versionamento | Sem versão própria; transportado dentro de protocolos versionados |
| Limitações | Dois modelos de entrada no MCP: documento (`circuit_*`) e netlist (`simulate_circuit`) |

## 4. BitVector

`src/bus/bitVector.ts`. Largura 1–64 (`MAX_BUS_WIDTH`), valores em `bigint`, texto canônico
binário **MSB → LSB**. Usado por avaliação vetorial, tabela vetorial, testbench vetorial e
equivalência. Não há `X`/`Z` (decisão pendente, Q-009).

## 5. CustomChipDefinition / CustomChipLibraryEntry

| Campo | Valor |
| --- | --- |
| Origem | `src/circuit/customChip.ts` (`veritas-custom-chip` v1) |
| Finalidade | Encapsular um circuito combinacional como componente reutilizável |
| Produtores | `buildCustomChipDefinition` (UI "salvar como chip"), importador DLS estrutural, allowlist `catalogVector.ts` |
| Consumidores | `validateCircuit({customChips})`, avaliação, elaboração HDL, contexto de IA, verificadores, MCP (`custom_chips`) |
| Invariantes | ≥1 entrada e ≥1 saída; sem componentes com estado; hierarquia por **referência** (`customChipId`), profundidade ≤8, sem ciclo; nome ≤200 |
| Identidade | `CustomChipLibraryEntry.id` = **id numérico autoincremento do Dexie** (local à máquina) |
| Serialização | Interno no Dexie; portátil via `veritas-chip-library` v1 com `customChipRef` string remapeado na importação |
| Limitações | Identidade não portátil no documento de circuito; MCP recebe `{id, definition}` a cada chamada (≤128) |

## 6. TestbenchDocument / TestbenchReport

| Campo | Valor |
| --- | --- |
| Origem | `src/circuit/testbench.ts` (`veritas-testbench` v1) |
| Finalidade | Intenção do autor como **dados**: entradas + saídas esperadas |
| Produtores | UI (`TestbenchPanel`, `testbenchDraft.ts`), arquivo `veritas-testbenches`, cliente MCP |
| Consumidores | `runTestbench`, MCP `run_testbench`, Dexie `testbenchProjects` (associado a `circuitId`) |
| Invariantes | Caso é escalar **ou** vetorial **ou** sequencial (misturar = `mixed-case-mode`); caso sem `expect` é inválido; ≤512 casos; ≤1000 tiques totais; diagnóstico ≤64 tiques |
| Relatório | `passed`/`failed`/`invalid`; todos os casos rodam; `TestbenchSnapshot`, `TestbenchFirstDivergence`, `TestbenchCounterexample`; diagnóstico `stabilized`/`cycle-detected`/`budget-exhausted` separado do veredito |
| Limitações | Portas pareadas por rótulo; sem asserções temporais (`ALWAYS`/`NEVER`) |

## 7. CircuitEquivalenceReport

`src/circuit/equivalence.ts`. `status: equivalent | divergent | incomparable`, `exhaustive`,
`totalRows`, `comparedRows`, `counterexample` (primeira linha em ordem canônica alfabética),
`issues`. Recusa circuitos com estado e espaços >16 bits (padrão 12). Identidade de porta por
rótulo; rótulos duplicados → `incomparable`. Simétrico: `compare(a,b)` e `compare(b,a)` acham
a mesma linha (testado).

## 8. CircuitDifferentialReport

`src/circuit/differential.ts`. `status: identical | divergent | incomparable`; primeiro tique
divergente; ≤1000 tiques. O nome `identical` (não `equivalent`) é deliberado: concordar num
roteiro não prova equivalência.

## 9. SimulatorState / snapshots / DocumentRuntimeState

| Modelo | Origem | Conteúdo | Uso |
| --- | --- | --- | --- |
| `SimulatorState` | `simulator.ts:63` | estado por nó (`SimulatorNodeState`), contadores | `exportState`/`restoreState`, checkpoints |
| `SettleDiagnostic` | `simulator.ts:70` | estabilização/ciclo/budget | testbench, preview |
| `DocumentRuntimeState` | `documentRuntime.ts:49` | `inputs`, `clockPeriods`, `simulator`, `snapshot`, `timeline` | painel temporal, oferta Realtime |
| `RuntimeCheckpoint` v1 | `runtimeCheckpoint.ts` | + `documentKey` (hash FNV-1a 32 do documento), `savedAt`, timeline ≤32 | `localStorage` por documento |

Invariantes: duas fases por tique; feedback só através de componente com estado; budgets com
rollback atômico do lote. Limitação: a chave de checkpoint usa hash não criptográfico (colisão
possível, impacto local).

## 10. Protocolos de execução isolada

| Modelo | Versão | Origem | Limites | Estado |
| --- | --- | --- | --- | --- |
| `SimulationWorkerRequest/Response` | `protocolVersion: 1` | `workerProtocol.ts` | 256 nós, 512 conexões, 500 kB, ≤1000 tiques, ≤256 steps, ≤128 watches, ≤64 progressos | `EXPERIMENTAL` |
| `SimulationWorkerCheckpointV1` | `checkpointVersion: 1` | `workerCheckpoint.ts` | 500 kB; `netlistSignature` = `fnv1a64:` | `EXPERIMENTAL`, resume desabilitado |
| `NativeSimulationRequest` | `NATIVE_PROTOCOL_VERSION = 1` | `src-tauri/src/simulation.rs` | mesmos limites; ops ≤10¹⁰; memória ≤512 MiB; timeout ≤300 s | `EXPERIMENTAL`, fora da UI |
| `VNET` / `VRES` | `1` | `engine-rs/src/wasm_netlist.rs`, `src/wasm/netlistAbi.ts` | buffer 64 KiB, ≤4096 nós, largura uniforme | `EXPERIMENTAL`, fora dos bundles |

## 11. AlgorithmDocument / ExecutionState

| Campo | Valor |
| --- | --- |
| Origem | `src/algorithms/model.ts` (`veritas-algorithm` v1) |
| Finalidade | Fluxogramas didáticos executáveis |
| Nós | `start`, `end`, `declare`, `assign`, `if`, `while`, `input`, `output` |
| Expressões | Linguagem **própria e restrita** (`src/algorithms/expressions.ts`), boolean/number/string — não é a engine booleana |
| Validação | `validateAlgorithmDocument` (alvos, variáveis, tipos); arquivo `veritas-algorithms` v1 fechado, ≤256 projetos, ≤1024 nós |
| `ExecutionState` | `status`, `activeNodeId`, `variables`, `inputQueues`, `output`, `trace`, `watch`, `branches`, `debug`, `stepIndex`, `error` |
| Limitações | O estado é **confiado** quando vem de fora: o MCP aceita `state` sem validação e o limite de passos depende de `stepIndex` (K-03) |

## 12. CircuitContextRecord (contexto de IA)

| Campo | Valor |
| --- | --- |
| Origem | `src/circuit/context.ts` (`payload.format = 'veritas-circuit-context'`, v1) |
| Finalidade | Pacote determinístico e sem segredos para análise por IA |
| Conteúdo | `sourceRef`, `summary`, `tags`, `contentHash` (**FNV-1a 32**, `stableStringify`), `payload.document`, entradas/saídas, tabela verdade ≤256 linhas, `elaboratedDocument` e metadados de chips quando houver |
| Produtores | `buildCircuitContext` (exige circuito escalar válido) |
| Consumidores | `requestCircuitAi` → Edge Function; tabela `veritas_circuit_context` foi criada para ele mas **não é usada** |
| Limitações | Só combinacional escalar; hash serve para deduplicação, não para integridade |

## 13. CircuitAiResult

`src/ai/circuitAi.ts`: `action` (`analyze`/`optimize`), `provider` (`llm`/`heuristic`),
`summary`, `suggestions[]` (≤8 no servidor), `optimizedDocument | null`, `confidence` (0–1).
O cliente valida forma + `validateCircuit`. **Não** valida equivalência com o original.
`confidence` da heurística é constante `0.72`; do LLM é autodeclarada — não é evidência.

## 14. Modelos de nuvem

| Tabela | Conteúdo | Invariantes principais |
| --- | --- | --- |
| `veritas_circuit_projects` | `user_id`, `name` (≤200), `document jsonb`, `content_hash` | único `(user_id, content_hash)`; RLS owner/collaborator |
| `veritas_circuit_versions` | `project_id`, `version_number`, `document`, `content_hash`, `change_summary` | imutável; único `(project_id, version_number)` |
| `veritas_circuit_collaborators` | papel editor/viewer | RLS; helpers em schema `private` |
| `veritas_circuit_rooms` | salas por projeto | owner cria; membros leem |
| `veritas_ai_metrics` | latência, sucesso, provedor, confiança, hash, erro genérico | RLS por usuário |
| `veritas_circuit_context` | contexto para IA futura | **sem consumidor** |

Escrita versionada pela RPC `veritas_sync_circuit_project` (`SECURITY INVOKER`, `p_base_version`,
validação `private.veritas_validate_circuit_document`). Ver G-02 sobre tipos aceitos.

## 15. Envelopes Realtime

`src/realtime/roomCollaboration.ts`, `eventOrdering.ts`:
`RoomSnapshot` (documento + `contentHash`), `RoomRuntimeConfig` (`clockPeriods`, `configHash`),
`RoomRuntimeState` (`DocumentRuntimeState`, `stateHash`); todos com `baseVersion`, `clientId`,
`sentAt`. Ordenação determinística por versão → timestamp → desempate; ofertas temporais expiram
em 30 s. Recepção valida só **forma**; aplicação revalida semântica (sem `allowBuses` — G-05).

## 16. Envelopes de arquivo

Ver [`CONTRACTS.md`](../05-FOUNDATION/CONTRACTS.md): `veritas` v1, `veritas-circuits` v1,
`veritas-testbenches` v1, `veritas-chip-library` v1, `veritas-algorithms` v1.

## 17. ChipCatalog e DlsChip

| Modelo | Origem | Notas |
| --- | --- | --- |
| `ChipCatalog` / `ChipEntry` | `src/chips/types.ts`, gerado por `scripts/import-dls-chips.mjs` | 1121 entradas; `derivedOutputs` com expressão mínima (quando cabe) — **artefato derivado**, não fonte de verdade; copiado em `plugins/veritas-logic/catalog.json` |
| `DlsChip` | `src/circuit/dlsImport.ts` | Entrada **externa não confiável**; transcrita para `CircuitDocument` com NAND como única folha; não afirma equivalência |

## 18. Modelos MCP (entrada/saída)

Entradas são Zod (`mcp/src/server.ts`) com documentos como `z.unknown()` revalidados em
`tools.ts`. Saída é sempre `content: [{type:'text', text}]` com JSON serializado ou mensagem;
`isError` em falhas. Sem `outputSchema`/`structuredContent`. Detalhes em
[`MCP_ARCHITECTURE.md`](../04-DEVELOPER/MCP_ARCHITECTURE.md).

## 19. HDL

Saída textual Verilog-2001/VHDL-2008 gerada de documento elaborado. Não há representação
intermediária HDL nem importação. Identificadores sanitizados, mas **palavras reservadas não são
escapadas** (ex.: módulo `reg`) e componentes com estado não são recusados (K-02).

## 20. Modelos ausentes (relevantes para a visão)

| Modelo | Estado |
| --- | --- |
| Intenção/proposta de mudança (patch declarativo sobre documento) | `PLANNED` (v3.6.0), sem código |
| Comando/evento de edição | `PLANNED`; hoje undo/redo é por snapshot |
| Registro de evidência persistente | `RESEARCH` ([`EVIDENCE_MODEL.md`](../05-FOUNDATION/EVIDENCE_MODEL.md)) |
| Identidade de agente / sessão | `RESEARCH` ([`AGENT_MODEL.md`](../03-AI/AGENT_MODEL.md)) |
| Projeto (agregado de circuitos + chips + testbenches) | `PLANNED` (pacotes v4.1); hoje são stores separados ligados por ids locais |
