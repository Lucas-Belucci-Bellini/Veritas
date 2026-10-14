# Modelo de produto — inventário

> O que o Veritas faz hoje, por estado. Legenda em [`../README.md`](../README.md).
> Linha de base: commit `4ab8f59`, pacote `0.9.0-rc.18`.

## 1. Identidade de versão (atenção)

O repositório tem **várias identidades de versão simultâneas**, e nenhuma é a "do produto":

| Onde | Valor |
| --- | --- |
| `package.json` / última tag git | `0.9.0-rc.18` |
| README/CHANGELOG (entregas) | releases `0.10.1` … `0.12.0` (sem tag git correspondente) |
| `mcp/src/server.ts` (`VERITAS_MCP_VERSION`), `mcp/package.json`, `plugin.json` | `0.9.0-rc.13` |
| `.claude-plugin/marketplace.json` | `0.8.0-rc.1` |
| Desktop (`src-tauri/tauri.conf.json`) | `0.1.0-alpha.1` |
| Fases de trabalho no CHANGELOG/docs | "v2.6.0", "v2.7.0", "v2.8.0 em desenvolvimento" |

Os rótulos "v2.x" são nomes de **fase do roadmap**, não versões publicadas. Ver Q-005 no
[`DECISION_LOG.md`](../07-DECISIONS/DECISION_LOG.md) e G-04 em [`KNOWN_GAPS.md`](../05-FOUNDATION/KNOWN_GAPS.md).

## 2. Funcionalidades existentes (`IMPLEMENTED`)

| Área | Capacidade | Onde |
| --- | --- | --- |
| Expressões | 4 notações (texto, matemática, programação, engenharia `A'`/justaposição); NOT/AND/NAND/OR/NOR/XOR/XNOR/→/↔; erros posicionais em PT-BR | `src/engine/lexer.ts`, `parser.ts`, `errors.ts` |
| | Tabela verdade com passos intermediários, classificação tautologia/contradição/contingência, virtualização | `src/engine/truthTable.ts`, `src/components/TruthTableView.tsx` |
| | Simplificação Quine-McCluskey, SOP/POS canônicas e mínimas, classificador de forma, Karnaugh 1–4 variáveis | `src/engine/minimize.ts`, `normalForms.ts`, `karnaugh.ts` |
| | Circuito derivado da expressão (React Flow + Dagre), caminho destacado por linha | `src/circuit/graph.ts`, `layout.ts`, `CircuitView.tsx` |
| | Exportação CSV/PNG e link `?expr=` | `src/lib/export.ts`, `src/lib/url.ts` |
| Editor de circuitos | 21 tipos de componente, conexões, validação com feedback acionável, undo/redo por snapshot, largura 1–64 bits, Splitter/Combiner, wireless transmitter/receiver | `src/components/CircuitEditor.tsx`, `src/circuit/editorModel.ts`, `history.ts` |
| | Tabela verdade escalar e vetorial (≤12 bits de entrada por padrão) | `src/circuit/truthTable.ts` |
| Sequencial | `Simulator` de duas fases: clock, DFF, TFF, JK, SR, delay; Step/Run/Reset; timeline 32 estados; checkpoint em `localStorage`; budgets de tiques/operações/memória; cancelamento cooperativo | `src/simulation/simulator.ts`, `SequentialCircuitPanel.tsx`, `runtimeCheckpoint.ts` |
| Chips | Chips customizados hierárquicos por referência (profundidade ≤8, sem ciclos, só combinacionais internamente); biblioteca local; chips usados dentro de circuitos sequenciais | `src/circuit/customChip*.ts`, `src/storage/customChips.ts` |
| | Catálogo de 1121 chips do Digital Logic Sim (consulta), allowlist multi-bit materializável, importação estrutural (775/1121) | `src/chips/`, `src/circuit/dlsImport.ts`, `scripts/import-dls-chips.mjs` |
| Verificação | Equivalência exaustiva combinacional com contraexemplo | `src/circuit/equivalence.ts`, `EquivalencePanel.tsx` |
| | Comparação temporal (primeiro tique divergente) | `src/circuit/differential.ts`, `TimelineComparisonPanel.tsx` |
| | Testbench declarativo (escalar, vetorial, sequencial) com snapshots, primeira divergência e diagnóstico bounded | `src/circuit/testbench.ts`, `TestbenchPanel.tsx` |
| HDL | Exportação Verilog-2001/VHDL-2008 de circuitos **combinacionais** (inclui buses e chips elaborados) | `src/circuit/export.ts` |
| Persistência | IndexedDB (Dexie v5: projetos, circuitos, algoritmos, chips, testbenches); arquivos `veritas`, `veritas-circuits`, `veritas-testbenches`, `veritas-chip-library` com importação transacional | `src/storage/` |
| PWA | Instalável, offline, atualização com confirmação | `vite.config.ts`, `PwaStatus.tsx` |
| Algoritmos | `AlgorithmDocument` com start/end/declare/assign/if/while/input/output; Step/Run/Continue, breakpoints, Watch, BranchTrace; casos didáticos | `src/algorithms/`, `AlgorithmWorkspace.tsx`, `LogicCaseLab.tsx` |
| MCP | 17 ferramentas determinísticas por stdio | `mcp/src/` |
| Plugin | Marketplace + plugin `veritas-logic` com servidor empacotado e skill | `.claude-plugin/`, `plugins/veritas-logic/` |
| Release eng. | CI de qualidade, gates de aceitação, manifesto de evidências com proveniência, guard de promoção SemVer | `.github/workflows/`, `scripts/` |

## 3. Funcionalidades parciais (`PARTIAL`)

| Capacidade | O que existe | O que falta / falha |
| --- | --- | --- |
| Arquivo `.veritas-circuits` | Export/import v1 fail-closed | **Round-trip de circuito vetorial falha** [verificado]; circuitos com `custom-chip` não são importáveis sem a biblioteca (K-01) |
| Exportação HDL | Combinacional correta | **Sequencial gera Verilog inválido sem erro**, inclusive via MCP [verificado] (K-02) |
| Sync em nuvem | Projetos, versões imutáveis, conflito otimista, RLS | Validador SQL aceita só 11 tipos de componente → circuitos com NAND/JK/buses/chips são rejeitados no servidor [código] (G-02) |
| Análise/otimização por IA | Edge Function + fallback heurístico, resposta validada estruturalmente | Edge aceita 14 tipos; só circuitos escalares; **proposta aplicada sem checagem de equivalência** (G-03) |
| Colaboração Realtime | Rooms, papéis, Presence/Broadcast, ordenação determinística, ofertas temporais com confirmação | Aceitação cross-user real pendente; snapshots vetoriais são descartados na aplicação [código] (G-05) |
| Métricas de IA | Tabela `veritas_ai_metrics`, painel em tempo real | Depende de Supabase; best-effort |
| Testbench na UI | Modo combinacional no painel | Casos sequenciais só no domínio e no MCP |
| Algoritmos | Domínio, executor, arquivo portátil | Biblioteca persistente sem UI de arquivo |
| Plugin | Servidor com 17 ferramentas | Skill descreve 7; versões divergentes (G-04, G-06) |

## 4. Funcionalidades experimentais (`EXPERIMENTAL`)

| Capacidade | Estado real |
| --- | --- |
| MCP Streamable HTTP local | Bind em `127.0.0.1`, bearer estático de ambiente, allowlist de Origin, stateless, só POST, protocolo `2025-11-25`, metadata RFC 9728 opt-in. **Sem OAuth**. |
| Worker de simulação | Protocolo v1, cliente, supervisor com fila; exposto só como `Preview Worker` opt-in; não substitui o runtime direto. |
| Shell desktop Tauri | Builds Win/macOS/Linux; runtime interativo Win/macOS `NOT VERIFIED`. |
| Comando nativo `simulate_circuit_native` | Simulador Rust escalar sequencial com cancelamento e progresso; paridade golden com fixtures; **não ligado à UI**. |
| `engine-rs` | Avaliador combinacional Rust (≤64 bits) + ABI WASM `VNET/VRES`; fora de todos os bundles (gate `beta:wasm:isolation`). |
| Checkpoint Worker v1 | Parser/serializer/assinatura; resume desabilitado. |
| Análise de segurança de execução | `analyzeCircuitExecutionSafety` classifica ciclos; uso como preflight. |

## 5. Planejadas (`PLANNED`) — somente documentos

Asserções e propriedades; migradores de formato; IA controlada com intenção/diff/rollback/auditoria;
plugins declarativos com permissões; workspace profissional; importação HDL; escala 5k/25k chips
(compilador de IR, runtime event-driven, viewport WebGL); pacotes de projeto; provenance;
modelo comercial demo/final/DLC com login e licença; assinatura/notarização. Fontes: `plano.md`,
`docs/ROADMAP.md`, `docs/VERITAS_V3_V5_ROADMAP.md`, `docs/VERITAS_25K_SCALABLE_ARCHITECTURE.md`,
`docs/COMMERCIAL_MODEL_STEAM.md`.

## 6. Abandonadas, dormentes ou superadas

| Item | Situação | Evidência |
| --- | --- | --- |
| LLM local no navegador ("Hermes" via WebLLM/Ollama) | Ideia não perseguida; o caminho real de IA virou Edge Function com provedor remoto configurável | `issue.md` §Hermes; `supabase/functions/veritas-circuit-ai/` |
| Tabela `veritas_circuit_context` ("contexto para consumo futuro por IA", tipos `simulation`/`feedback`/`preference`) | **Dormente**: criada com RLS, exercitada só pelo script de aceitação RLS; nenhum código de produto lê ou escreve | `supabase/migrations/20260814181753_…`, `scripts/rls-acceptance.mjs` |
| Importação de chip por expressão destilada | Não abandonada, mas superada em cobertura pela importação estrutural (388 vs 775 chips) | README §Biblioteca de chips |
| `VERITAS_AUDIT.md` como estado atual | Superado (retrato de `0.9.0-rc.1`) | Ver [`../README.md`](../README.md) |
| Branch `feature/chip-hierarchy-v1` | Já contida na `main` (ancestral de `HEAD`) [verificado] | `git merge-base` |

## 7. Superfície comercial

`PLANNED / NOT IMPLEMENTED`. O `AuthProvider` Supabase é infraestrutura técnica opcional, não
licença. Ver `docs/PRODUCT_AUTH_LICENSE_BOUNDARY.md`.
