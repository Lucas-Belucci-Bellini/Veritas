# Documento canônico: `CircuitDocument`

> O modelo central do Veritas. Fonte: `src/circuit/editorModel.ts`, `documentContract.ts`,
> `documentLimits.ts`, `portIdentity.ts`, `src/simulation/components.ts`.
> Legenda em [`../README.md`](../README.md).

## 1. Schema v1

```ts
interface CircuitDocument {
  format: 'veritas-circuit'
  version: 1
  name: string                       // 1–200 caracteres após trim
  nodes: CircuitNode[]               // ≤ 256
  connections: CircuitConnection[]   // ≤ 512
}
interface CircuitNode {
  id: string                         // único, não vazio após trim
  type: EditorComponentType          // 21 tipos
  position: { x: number; y: number } // finitos; só visual
  label?: string                     // ≤ 120; é a IDENTIDADE PÚBLICA da porta
  options?: ComponentOptions
}
interface CircuitConnection {
  source: { node: string; port?: number }  // port = índice de saída (0 por padrão)
  target: { node: string; port: number }   // índice de entrada
}
interface ComponentOptions {
  period?: number; ticks?: number; value?: boolean; initial?: boolean
  width?: number        // 1–64; ausente = 1
  channel?: string      // wireless, ≤ 64 após normalização
  widths?: number[]     // splitter (saídas) / combiner (entradas)
  customChipId?: number // id LOCAL (Dexie) da definição
  customChipBoundary?: 'internal' // transitório, usado na elaboração
}
```

Tamanho serializado ≤ 500.000 bytes UTF-8. Não há campos de metadados, autoria, criação, nem
extensões livres.

## 2. Tipos de componente

| Tipo | Entradas | Saídas | Estado | Largura > 1 |
| --- | --- | --- | --- | --- |
| `input` | 0 (1 se `customChipBoundary: internal`) | 1 | não | sim (com `allowBuses`) |
| `output` | 1 | 1 | não | sim |
| `constant` | 0 | 1 | não | sim |
| `and`, `or`, `xor`, `nand`, `nor`, `xnor` | 2 no editor (simulador aceita N) | 1 | não | sim |
| `not` | 1 | 1 | não | sim |
| `clock` | 0 | 1 | **sim** | não |
| `dff`, `tff` | 2 (`D/T`, `CLK`) | 2 (`Q`, `Q̄`) | **sim** | não |
| `jk`, `sr` | 3 (`J/S`, `K/R`, `CLK`) | 2 | **sim** | não |
| `delay` | 1 | 1 | **sim** | não |
| `transmitter` | 1 | 1 | não | sim |
| `receiver` | 0 (recebe pelo `channel`) | 1 | não | sim |
| `splitter` | 1 | `widths.length` | não | só vetorial |
| `combiner` | `widths.length` | 1 | não | só vetorial |
| `custom-chip` | da definição | da definição | não (chips são combinacionais) | conforme portas |

## 3. Invariantes (códigos de `CircuitIssue`)

Normalização (`normalizeCircuitDocument`) só apara texto e canal; **nunca corrige semântica**.
Validação (`validateCircuit`) reporta:

| Grupo | Códigos |
| --- | --- |
| Limites | `invalid-document-name`, `document-too-many-nodes`, `document-too-many-connections`, `node-label-too-long`, `document-too-large`, `wireless-channel-too-long` |
| Nós | `duplicate-node`, `invalid-node`, `custom-chip-missing-definition` |
| Larguras | `invalid-width`, `unsupported-width`, `width-mismatch` |
| Conexões | `missing-node`, `invalid-source-port`, `invalid-target-port`, `duplicate-target-port`, `self-connection`, `missing-input` |
| Topologia | `cycle` (ciclo sem componente com estado) |
| Wireless | `wireless-empty-channel`, `wireless-duplicate-transmitter`, `wireless-missing-transmitter` |

Modos de validação:

| Opção | Efeito |
| --- | --- |
| padrão | apenas 1 bit; Splitter/Combiner recusados |
| `allowBuses: true` | larguras 1–64 em componentes sem estado; Splitter/Combiner permitidos |
| `customChips` | resolve `customChipId`; sem ela, toda instância é `custom-chip-missing-definition` |

## 4. Identidades

O documento tem **três** noções de identidade, e confundi-las gera defeitos:

| Identidade | Escopo | Usada por |
| --- | --- | --- |
| `node.id` | Dentro do documento | Conexões, netlist, snapshots, simulação |
| `label` (ou `id`) de `input`/`output` | **Interface pública** | Verificação, testbench, HDL, contexto de IA (`collectCircuitPorts`, ordem alfabética) |
| `customChipId` | **Banco local** (Dexie) | Instâncias de chip — não portátil entre máquinas; portabilidade só via `customChipRef` do envelope `veritas-chip-library` |

## 5. Quem aceita o quê (matriz de aceitação)

Esta é a tabela mais importante para quem mexe no modelo. Cada linha é uma fronteira que recebe
`CircuitDocument` ou netlist derivada. ✅ aceita · ❌ recusa · — não se aplica.

| Fronteira | Básicos¹ | NAND/NOR/XNOR | clock/DFF/TFF/delay | JK/SR | wireless | Splitter/Combiner | custom-chip | largura > 1 | Fonte |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `validateCircuit` padrão | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | com `customChips` | ❌ | `editorModel.ts` |
| `validateCircuit` `allowBuses` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | com `customChips` | ✅ | `editorModel.ts` |
| Salvar no IndexedDB | sem validação (só normaliza) | | | | | | | | `storage/circuits.ts:25` |
| Importar `.veritas-circuits` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ **[verificado]** | `storage/circuits.ts:170` |
| Cliente cloud (guard) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | com chips | ✅ | `cloud/circuitProjects.ts:99` |
| **SQL server-side** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ (1–64) | migration `20260821043000` |
| Aplicar snapshot Realtime | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | com chips | ❌ | `CircuitEditor.tsx:220` |
| Contexto de IA (cliente) | ✅ | ✅ | ✅² | ✅² | ✅ | ❌ | com chips | ❌ | `circuit/context.ts` |
| **Edge Function IA** | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | `functions/veritas-circuit-ai` |
| Equivalência | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | com chips | ✅ (≤16 bits totais) | `equivalence.ts` |
| HDL | ✅ | ✅ | ⚠️ aceita e gera saída errada | ⚠️ | ✅ | ✅ | com chips | ✅ | `export.ts` (K-02) |
| MCP `simulate_circuit` (netlist) | ✅ | ✅ | ✅ | ❌ (enum Zod) | ✅ | ❌ | ✅ | — | `mcp/src/server.ts:451` |
| Worker v1 | escalar | ✅ | ✅ | ✅ | ✅ | ❌ | elaborado | ❌ | `docs/EXECUTION_WORKER_BOUNDARY.md` |
| Tauri nativo | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | `simulation.rs:482` |
| WASM `VNET` | ✅ (sem output de estado) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | uniforme | `WASM-NETLIST-ABI.md` |

¹ `input`, `output`, `constant`, `and`, `or`, `not`, `xor`.
² O contexto é construído a partir de tabela verdade combinacional; a UI bloqueia IA em sequenciais.

Consequências diretas documentadas em [`KNOWN_GAPS.md`](../05-FOUNDATION/KNOWN_GAPS.md):
round-trip vetorial quebrado (K-01), sync de circuitos com NAND/JK/buses/chips recusada no
servidor (G-02), snapshots vetoriais descartados (G-05), HDL sequencial incorreto (K-02).

## 6. Versionamento e migração

- `version: 1` é a única versão. Não existe `migrateCircuitDocument`.
- Política escrita (`docs/FOUNDATION-001.md`, `docs/V2_FORMAT_MIGRATION.md`): versão futura é
  rejeitada; antiga só com migrador explícito e testado; migração antes de validar/persistir/
  transmitir/exportar.
- Todo tipo novo adicionado desde a v1 (NAND/NOR/XNOR, JK/SR, wireless, Splitter/Combiner,
  custom-chip, `width`) entrou **sem subir a versão** — tecnicamente compatível para leitores
  novos, mas leitores antigos (SQL, Edge) não foram atualizados em conjunto. Isso é a origem
  da matriz acima.

## 7. Limitações conhecidas do modelo

| Limitação | Impacto | Estado |
| --- | --- | --- |
| Sem portas formais (nome, direção, largura como entidade) — interface inferida de `input`/`output` + label | Verificação depende de rótulos únicos | `PLANNED` (schema v2) |
| Identidade de chip local | Documento com chip não é portátil sozinho | `PARTIAL` (envelope de biblioteca) |
| Sem `X`/`Z`, tri-state, memória | Limita chips DLS importáveis | Q-009 |
| Sem metadados (autor, origem, proveniência) | Impede evidência atrelada ao documento | `RESEARCH` |
| Posição obrigatória | Mistura layout e semântica; hash muda quando nó é movido | Observação |
| Estado de chips só combinacional | Sequencial dentro de chip bloqueado | Decisão D-010 |

## 8. Perguntas abertas sobre o documento

Registradas no [`DECISION_LOG.md`](../07-DECISIONS/DECISION_LOG.md): Q-006 (fonte única das
invariantes: TS gera SQL/Edge? schema compartilhado?), Q-007 (quando e como abrir a v2),
Q-008 (identidade portátil de chips), Q-009 (modelo de sinal).
