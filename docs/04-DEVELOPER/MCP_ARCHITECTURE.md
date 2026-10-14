# Arquitetura MCP

> Servidor MCP, ferramentas, transportes e plugin. Complementa `docs/MCP-INTEROPERABILITY.md`
> (configuração por cliente) e `mcp/README.md`. Legenda em [`../README.md`](../README.md).

## 1. Estrutura

```text
mcp/src/tools.ts      funções puras → ToolResult { text, isError? }   (testáveis sem MCP)
mcp/src/server.ts     createVeritasServer(): McpServer + registerVeritasTools (Zod)
mcp/src/stdio.ts      entrypoint stdio
mcp/src/http-server.ts / http-entry.ts   Streamable HTTP local (stateless)
mcp/src/protectedResourceMetadata.ts     RFC 9728 (opt-in)
```

O domínio é importado de `../../src/*`; o bundle (`vite.mcp*.config.ts`) embute engine, circuito,
simulação e algoritmos. O catálogo de chips é lido do disco sob demanda.

## 2. Ferramentas (17)

| Ferramenta | Entrada principal | Limites | Força do resultado |
| --- | --- | --- | --- |
| `truth_table` | expressão | `max_rows` ≤4096 | exato |
| `evaluate_expression` | expressão + atribuição | — | exato |
| `simplify_expression` | expressão | — | exato (Q-M) |
| `normal_forms` | expressão | — | exato |
| `karnaugh_map` | expressão | ≤4 variáveis | exato |
| `logic_case` | id de caso didático | catálogo fixo | exato |
| `propositional_truth_table` | expressão | `max_rows` | exato |
| `circuit_truth_table` | `CircuitDocument` (+ `custom_chips`) | ≤4096 linhas, ≤128 chips | exato, combinacional |
| `circuit_vector_truth_table` | `CircuitDocument` | ≤12 bits de entrada | exato |
| `circuit_equivalence` | 2 documentos | ≤16 bits (padrão 12) | **prova exaustiva** ou recusa |
| `circuit_differential` | 2 documentos + roteiro | ≤1000 tiques | observação **neste roteiro** |
| `run_testbench` | documento + `veritas-testbench` | ≤512 casos, ≤1000 tiques | **só os casos escritos** |
| `export_circuit_hdl` | documento | — | ⚠ correto só para combinacional (K-02) |
| `simulate_circuit` | **netlist** `components[]` + `steps` | ≤1000 tiques, budgets, `timeout_ms` ≤300 s, abort | observação temporal |
| `debug_algorithm` | `AlgorithmDocument` + `state?` | `max_steps` ≤100.000 (contornável — K-03) | execução |
| `list_chips` / `get_chip` | filtro / nome | paginação | consulta de catálogo derivado |

Todas são **sem efeito colateral**: não gravam em disco, IndexedDB ou Supabase.

## 3. Contrato de entrada e saída

- Entrada: Zod por ferramenta; documentos chegam como `z.unknown()` e são revalidados em `tools.ts`
  por `isCircuitDocumentShape` + validação de domínio. **Exceção:** `debug_algorithm` faz cast direto
  (`document as AlgorithmDocument`, `state as ExecutionState`).
- Saída: sempre `content: [{ type: 'text', text }]`; JSON serializado ou mensagem em PT-BR;
  `isError: true` em falha. Erros viram resposta, não queda do servidor (`guard`/`guardAsync`).
- Ausente: `outputSchema`, `structuredContent`, anotações (`readOnlyHint`, `idempotentHint`,
  `openWorldHint`), resources, prompts, versão da engine no resultado.

## 4. Transportes

| Perfil | Estado | Detalhes |
| --- | --- | --- |
| stdio | `IMPLEMENTED` | Local, sem autenticação (processo do usuário) |
| Streamable HTTP | `EXPERIMENTAL` | `127.0.0.1:8787/mcp` por padrão; só POST; `MCP-Protocol-Version: 2025-11-25` obrigatório; `Accept` JSON+SSE; `Content-Type` JSON; body ≤1 MiB; timeout 30 s; **bearer estático** `VERITAS_MCP_HTTP_BEARER_TOKEN`; allowlist `VERITAS_MCP_HTTP_ALLOWED_ORIGINS` obrigatória (requisição sem `Origin` é recusada); stateless; metadata `/.well-known/oauth-protected-resource` opt-in |

O bearer é comparado por igualdade de string; não há validação de token contra servidor de
autorização, escopos por ferramenta, rate limit ou auditoria. É adequado para uso local, não para
exposição pública (NG-25).

## 5. Plugin do Claude Code

| Item | Estado |
| --- | --- |
| `.claude-plugin/marketplace.json` | versão `0.8.0-rc.1` (defasada) |
| `plugins/veritas-logic/.claude-plugin/plugin.json` | `0.9.0-rc.13` |
| `.mcp.json` | `node ${CLAUDE_PLUGIN_ROOT}/server.mjs` |
| `server.mjs` | bundle versionado com as 17 ferramentas e `VERITAS_MCP_VERSION = 0.9.0-rc.13` |
| `skills/veritas/SKILL.md` | orienta 7 ferramentas; não menciona `circuit_*`, `run_testbench`, `export_circuit_hdl`, `debug_algorithm`, `logic_case`, `propositional_truth_table` (G-06) |

## 6. Defeitos e riscos que afetam agentes

| ID | Descrição | Origem |
| --- | --- | --- |
| K-02 | HDL sequencial inválido sem erro | [verificado] |
| K-03 | `debug_algorithm` ignora `max_steps` com `state` forjado; sem validação do documento nesse caminho; sem abort/timeout | [verificado] |
| G-04 | Versão reportada ao host desatualizada | [código] |
| G-06 | Skill incompleta | [código] |
| — | `simulate_circuit` não aceita JK/SR/Splitter/Combiner no enum, embora o domínio aceite | [código] |
| — | Dois modelos de entrada (documento × netlist) | [código] |

## 7. Evolução possível (não decidida)

Em ordem de dependência, sem compromisso: (1) corrigir K-02/K-03; (2) versão única; (3)
`outputSchema` + `structuredContent` com códigos de erro estáveis; (4) anotações read-only;
(5) resultado de verificação com envelope de evidência; (6) recursos MCP para bibliotecas de chips;
(7) só então discutir leitura de projeto (L1) e OAuth para HTTP remoto.
