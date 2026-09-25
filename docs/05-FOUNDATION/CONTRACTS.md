# Contratos

> Inventário de todos os contratos versionados e das regras que os governam.
> Política detalhada de migração: `docs/V2_FORMAT_MIGRATION.md`. Legenda em [`../README.md`](../README.md).

## 1. Inventário

### 1.1 Documentos de domínio

| Identificador | Versão | Definição | Validador | Limites |
| --- | --- | --- | --- | --- |
| `veritas-circuit` | 1 | `src/circuit/editorModel.ts` | `validateCircuit` (+ réplicas SQL/Edge) | 256 nós, 512 conexões, 500 kB, 64 bits |
| `veritas-custom-chip` | 1 | `src/circuit/customChip.ts` | `buildCustomChipDefinition` | profundidade 8, combinacional |
| `veritas-testbench` | 1 | `src/circuit/testbench.ts` | `runTestbench` (issues `invalid`) | 512 casos, 1000 tiques |
| `veritas-algorithm` | 1 | `src/algorithms/model.ts` | `validateAlgorithmDocument` | 1024 nós (arquivo), 10.000 passos padrão |
| `veritas-circuit-context` | 1 | `src/circuit/context.ts` | Edge `isContext` | 256 linhas de tabela; 200.000 caracteres na Edge |

### 1.2 Envelopes de arquivo

| Identificador | Versão | Serializer / parser | Regras |
| --- | --- | --- | --- |
| `veritas` (expressões) | 1 | `src/storage/projects.ts` | chaves fechadas, expressão reparseada, ≤5 MB |
| `veritas-circuits` | 1 | `src/storage/circuits.ts` | chaves fechadas, ≤5 MB, validação escalar (K-01) |
| `veritas-testbenches` | 1 | `src/storage/testbenches.ts` | ≤256 docs, nomes únicos, vínculo a `circuitId`+nome verificado |
| `veritas-chip-library` | 1 | `src/storage/customChips.ts` | ≤256 chips, `customChipRef` remapeado, ordenação de dependências, atômico |
| `veritas-algorithms` | 1 | `src/storage/algorithms.ts` | ≤256 projetos, schema fechado, atômico; sem UI |

Comum a todos: JSON inválido, formato desconhecido, versão futura e versão antiga (sem migrador)
são rejeitados; coleção com item inválido é rejeitada inteira; falha não altera o banco.

### 1.3 Protocolos de execução

| Identificador | Versão | Onde |
| --- | --- | --- |
| Worker request/response | `protocolVersion: 1` | `src/simulation/workerProtocol.ts` |
| `veritas.worker-checkpoint` | 1 | `src/simulation/workerCheckpoint.ts` |
| Runtime checkpoint (`localStorage`) | 1 | `src/simulation/runtimeCheckpoint.ts` |
| Native simulation (Tauri) | `NATIVE_PROTOCOL_VERSION = 1` | `src-tauri/src/simulation.rs` |
| WASM ABI / `VNET`/`VRES` | 1 | `engine-rs`, `docs/WASM-NETLIST-ABI.md` |

### 1.4 Interfaces externas

| Contrato | Versão | Onde |
| --- | --- | --- |
| Ferramentas MCP | versão do servidor `0.9.0-rc.13` (sem versionamento por ferramenta) | `mcp/src/server.ts` |
| MCP HTTP | protocolo `2025-11-25`; metadata `2025-06-18` | `mcp/src/http-server.ts` |
| Edge Function IA | sem versão no payload | `supabase/functions/veritas-circuit-ai`, `docs/EDGE-FUNCTION-API.md` |
| RPC/Tabelas Supabase | migrations datadas | `supabase/migrations/` |
| Realtime envelopes | sem versão no envelope (usa `baseVersion` do documento) | `src/realtime/` |
| Banco local | Dexie v5 | `src/storage/db.ts` |
| Manifesto de evidência beta | `version` = versão esperada do pacote | `scripts/betaEvidence*.mjs` |
| Manifesto de release desktop | por release | `scripts/generate-desktop-manifest.mjs` |

## 2. Regras vigentes (extraídas do código e dos docs)

1. Todo formato persistente tem identificador estável + versão inteira.
2. Versão desconhecida → rejeitar; antiga → só com migrador explícito, determinístico e testado.
3. Normalizar representação não corrige semântica.
4. Importação é transacional; nunca parcial silenciosa.
5. Arquivo não carrega definição por caminho, URL ou script.
6. Nenhuma migração executa código importado, avalia expressão arbitrária ou acessa rede.
7. Protocolos de execução não são formato de usuário.

## 3. Lacunas de contrato

| Lacuna | Consequência |
| --- | --- |
| Nenhum schema publicado (JSON Schema ou equivalente) | Agentes e terceiros inferem o formato de exemplos |
| Nenhuma fonte única executável das invariantes | DUP-01…04 |
| Tipos novos entraram sem subir `version` e sem atualizar leitores | Matriz de aceitação divergente |
| Nenhum migrador implementado | Primeira mudança incompatível exigirá criar toda a infraestrutura |
| Códigos de erro diferentes por camada (`CircuitIssue.code`, códigos SQL, textos da Edge, JSON-RPC HTTP, texto livre no MCP) | Consumidor automatizado não consegue tratar erro de forma estável |
| Ferramentas MCP sem `outputSchema` | Saída sem contrato |
| Versões de interface acopladas à versão do pacote (e defasadas) | Não há como um cliente negociar compatibilidade |
| Envelopes Realtime e Edge sem versão | Mudança futura quebra clientes antigos em silêncio |

## 4. Princípios propostos para novos contratos (`PLANNED` como proposta desta documentação)

Estes princípios **não foram decididos**; estão aqui para orientar a decisão Q-006.

- Um contrato = um identificador + versão + schema + vetores de teste válidos/inválidos + lista
  de consumidores.
- Réplicas em outros runtimes (SQL, Deno, Rust) são aceitáveis desde que testadas contra os mesmos
  vetores, e registradas como "subconjunto intencional" quando for o caso.
- Todo resultado exposto a agentes declara a versão do contrato e da engine que o produziu.
- Códigos de erro estáveis e documentados; mensagem em PT-BR continua sendo apresentação.
