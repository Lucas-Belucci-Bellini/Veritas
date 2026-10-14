# Integração com IA — arquitetura conceitual

> O pipeline proposto pelo operador, confrontado etapa por etapa com o código.
> Nada aqui foi implementado nesta fase. Legenda em [`../README.md`](../README.md).

## 1. Pipeline de referência

```text
AI
 ↓  (1) Intent / Proposal
Veritas Model            (2)
 ↓
Validation               (3)
 ↓
Execution                (4)
 ↓
Verification             (5)
 ↓
Evidence                 (6)
 ↓
AI / Developer           (7)   ──► (8) Apply — só com autoridade humana/política
```

## 2. Etapa por etapa

| # | Etapa | O que existe | Estado | Lacuna concreta |
| --- | --- | --- | --- | --- |
| 1 | **Intent / Proposal** | O agente envia um documento inteiro (`CircuitDocument`, `AlgorithmDocument`, testbench) por MCP; a Edge devolve `optimizedDocument` inteiro | `PARTIAL` | Não há **intenção declarativa** (ex.: "trocar porta X por Y") nem patch; toda proposta é substituição completa |
| 2 | **Veritas Model** | `CircuitDocument` v1, `AlgorithmDocument` v1, `TestbenchDocument` v1, netlist | `IMPLEMENTED` | Aceitação diverge entre camadas ([`CANONICAL_DOCUMENT.md`](../02-ARCHITECTURE/CANONICAL_DOCUMENT.md) §5) |
| 3 | **Validation** | `isCircuitDocumentShape` + `validateCircuit` no MCP e no cliente de IA; parsers fail-closed | `IMPLEMENTED` com exceções | `debug_algorithm` não valida quando recebe `state` (K-03); Edge usa regras próprias |
| 4 | **Execution** | Avaliação combinacional, `Simulator` com budgets/abort, executor de algoritmos | `IMPLEMENTED` | Worker/Tauri experimentais; MCP roda no processo |
| 5 | **Verification** | Equivalência, comparação temporal, testbench — com força explícita e contraexemplo | `IMPLEMENTED` | Sem asserções/propriedades; não é acionada automaticamente sobre propostas da IA (G-03) |
| 6 | **Evidence** | Relatórios JSON efêmeros; hash FNV no contexto; evidência de release (outra camada) | `RESEARCH` | Sem registro persistente, digest criptográfico, versão de engine ou reprodutibilidade declarada ([`EVIDENCE_MODEL.md`](../05-FOUNDATION/EVIDENCE_MODEL.md)) |
| 7 | **Retorno** | MCP devolve texto JSON; UI mostra resumo | `PARTIAL` | Sem `outputSchema`/`structuredContent`; códigos de erro não unificados |
| 8 | **Apply** | UI: botão após validação estrutural; MCP: inexistente | `PARTIAL` / ausente | Sem diff visual dedicado, sem rollback específico, sem auditoria |

## 3. Onde o pipeline já funciona ponta a ponta

Por MCP, sem mudar código, um agente consegue:

```text
proposta (CircuitDocument) ─► circuit_truth_table        (valida + executa)
                           ─► circuit_equivalence(ref)  (verifica, exaustivo ≤16 bits)
                           ─► run_testbench(casos)      (verifica por casos, inclusive sequencial)
                           ─► export_circuit_hdl        (⚠ só combinacional é confiável — K-02)
```

Isso cobre as etapas 2–5 e parte da 7. O que falta é o que transforma "chamadas úteis" em
infraestrutura: 6 (evidência), 7 estruturado, 1 declarativo e 8 governado.

## 4. Onde o pipeline quebra hoje

| Caminho | Problema |
| --- | --- |
| UI → IA "optimize" → Aplicar | A proposta alega preservar função; o cliente só valida estrutura. `compareCircuitEquivalence` existe e não é chamado (`CircuitEditor.tsx:775`). |
| Edge Function | Recusa NAND/NOR/XNOR/JK/SR/Splitter/Combiner (DUP-01); um documento otimizado com NAND vira `null` silenciosamente. |
| MCP HDL | Circuito sequencial gera Verilog inválido sem `isError` (K-02) — um agente pode anexar isso a um PR acreditando que está correto. |
| MCP algoritmo | `state` forjado ignora `max_steps` (K-03). |

## 5. Integração por tipo de consumidor

| Consumidor | Caminho hoje | Estado | Caminho possível (RESEARCH) |
| --- | --- | --- | --- |
| **Claude Code** | Plugin `veritas-logic` (stdio) ou `claude mcp add` | `IMPLEMENTED` | Skill atualizada com os 17 tools; ferramentas que leem `.veritas` do workspace; evidência anexável a commits |
| **Codex CLI/IDE** | `codex mcp add` / `config.toml` com `enabled_tools` e aprovação | `IMPLEMENTED` (documentado em `docs/MCP-INTEROPERABILITY.md`) | Igual |
| **Claude Desktop / hosts stdio** | `mcpServers` | `IMPLEMENTED` | Igual |
| **Hosts remotos** (API Messages, ChatGPT dev mode) | Exigem HTTPS público + OAuth | Não suportado (HTTP local só) | OAuth real, deploy, rate limit, auditoria (NG-25) |
| **IDEs** | Via host MCP da IDE | Indireto | Language-server de `.veritas`? (sem decisão) |
| **Agentes autônomos / CI** | Nenhum caminho oficial além de MCP | — | CLI headless que roda testbench/equivalência e emite evidência com exit code |
| **LLM embutido** | Edge Function | `PARTIAL` | Pipeline completo com verificação automática da proposta |

## 6. Compatibilidade com o código atual

| Aspecto da arquitetura conceitual | Compatível? | Por quê |
| --- | --- | --- |
| Domínio independente de UI | Sim | Regra estrutural já cumprida |
| Verificação determinística reutilizável | Sim | Funções puras em `src/circuit/` |
| Contratos de entrada por fronteira | Parcial | Guards existem, mas divergem |
| Estado de sessão para agentes | Não | MCP é stateless; chips reenviados a cada chamada |
| Aplicação governada | Não | Não há modelo de mudança nem auditoria |
| Evidência persistente | Não | Nenhum modelo |

## 7. Pesquisa futura (explicitamente não decidida)

- Formato de **proposta**: documento completo vs patch/intenção (Q-011).
- Verificação automática obrigatória antes de exibir "Aplicar" (política, não código) (Q-012).
- Onde a evidência vive: arquivo local, IndexedDB, nuvem, anexo a PR (Q-013).
- Se o LLM embutido continua na Edge Function ou vira apenas mais um cliente MCP (Q-002).
