# Lacunas e defeitos conhecidos

> Encontrados na investigação de 2026-09-25 sobre o commit `4ab8f59`. **Nenhum foi corrigido**
> nesta fase (documentação primeiro). `K-*` = reproduzido; `G-*` = derivado de leitura de código
> ou documentação. Legenda em [`../README.md`](../README.md).

## Defeitos reproduzidos

### K-01 · Round-trip `.veritas-circuits` de circuito vetorial falha — [verificado]

- **Reprodução:** `serializeCircuitProjects([{…, document: <input 8 bits → output 8 bits>}])` e
  depois `parseCircuitFile(texto)` → `Error: O projeto 1 do arquivo de circuitos é inválido.`
  Um circuito escalar com NAND importa normalmente.
- **Causa:** `src/storage/circuits.ts:170` chama `validateCircuit(document)` sem `{ allowBuses: true }`.
  O editor salva o mesmo documento no IndexedDB sem problema (o save local só normaliza).
- **Impacto:** exportação de circuitos multi-bit produz arquivo que o próprio Veritas não reabre.
  Circuitos com `custom-chip` também não importam (sem biblioteca no envelope) — este caso é
  limitação conhecida, não regressão.

### K-02 · HDL de circuito sequencial é gerado incorreto e sem erro — [verificado]

- **Reprodução:** `exportVerilog` (e a ferramenta MCP `export_circuit_hdl`) sobre
  `input d → dff(D) ; clock → dff(CLK) ; dff.Q → output q` devolve, com `isError` ausente:
  ```verilog
  module reg (
    input d,
    output q
  );
    wire clk;
    wire ff;
    assign clk = ;
    assign ff = d ^ clk;
    assign q = ff;
  endmodule
  ```
- **Causas:** `assertValid` (`src/circuit/export.ts:91`) valida com `allowBuses` mas não recusa
  componentes com estado; `verilogExpression`/`vhdlExpression` caem no operador XOR por padrão
  (`export.ts:153`/`165`). Adicionalmente, `sanitizeIdentifier` não escapa palavras reservadas
  (`reg` virou nome de módulo).
- **Impacto:** Verilog sintaticamente inválido e semanticamente errado, apresentado como sucesso a
  humanos (se a UI não bloquear) e a agentes via MCP. A UI bloqueia HDL em sequenciais [doc], o
  MCP e a API não.

### K-03 · `debug_algorithm` ignora `max_steps` quando o cliente envia `state` — [verificado]

- **Reprodução:** documento com `while (true)`; `state = createExecutionState(doc)` com
  `stepIndex: -20000`; `debug_algorithm(mode='run', max_steps=10)` executou **20.010 passos**
  (~12 s, crescimento superlinear pelo clone do trace). Sem `state`, para em 10.
- **Causas:** `mcp/src/server.ts:430` faz cast de `state`/`document` sem validar; o limite em
  `src/algorithms/executor.ts:278` compara `state.stepIndex >= maxSteps`; a validação do documento
  só ocorre em `createExecutionState` (`executor.ts:192`). Não há abort/timeout nessa ferramenta.
- **Impacto:** stdio — o usuário consegue travar o próprio processo; HTTP — DoS por quem tiver o
  bearer. Também permite executar documento não validado.

## Lacunas derivadas do código

| ID | Lacuna | Onde | Impacto |
| --- | --- | --- | --- |
| G-02 | Validador SQL aceita 11 tipos (sem NAND/NOR/XNOR/JK/SR/wireless/Splitter/Combiner/custom-chip) | `supabase/migrations/20260821043000_…sql:77` | Sync de circuitos válidos recusada no servidor (estado do banco implantado `UNKNOWN`) |
| G-03 | Otimização por IA aplicada sem checagem de equivalência; Edge aceita só 14 tipos | `CircuitEditor.tsx:775`, `functions/veritas-circuit-ai/index.ts:41` | Proposta que muda comportamento pode ser aplicada; documento com NAND vira `null` |
| G-04 | Versões divergentes (0.9.0-rc.18 / rc.13 / 0.8.0-rc.1 / 0.12.0 / "v2.x") | `package.json`, `mcp/src/server.ts:77`, `plugin.json`, `marketplace.json` | Identidade errada para hosts e para evidência |
| G-05 | Snapshot Realtime vetorial descartado (validação sem `allowBuses`) | `CircuitEditor.tsx:220` | Colaboração em circuitos multi-bit não aplica mudanças |
| G-06 | Skill do plugin descreve 7 de 17 ferramentas | `plugins/veritas-logic/skills/veritas/SKILL.md` | Agentes não descobrem verificação |
| G-07 | CSP desativada no Tauri (`"csp": null`) | `src-tauri/tauri.conf.json:27` | XSS na WebView teria acesso ao IPC permitido |
| G-08 | Edge Function confere só o prefixo `Bearer `; `verify_jwt` é configuração de deploy não versionada | `functions/veritas-circuit-ai/index.ts:77` | Um redeploy com configuração diferente abriria o endpoint |
| G-09 | Hashes FNV como identidade (`content_hash` é chave única no banco) | DUP-06 | Colisão improvável mas possível; inutilizável como evidência |
| G-10 | Tabela `veritas_circuit_context` sem consumidor | migration `20260814181753` | Superfície de dados sem dono |
| G-11 | MCP `simulate_circuit` sem JK/SR/Splitter/Combiner no enum | `mcp/src/server.ts:451` | Divergência com domínio e com a própria descrição |
| G-12 | Rótulos do circuito entram no prompt do LLM sem tratamento | Edge `tryLlm` | Prompt injection; mitigado por validação e clique, não por verificação |
| G-13 | Documentação de estado divergente (README: MCP HTTP "próxima camada"; `VERITAS_AUDIT.md` desatualizado) | README, `VERITAS_AUDIT.md` | Agentes partem de premissas falsas |
| G-14 | Testes do crate `src-tauri` fora do CI de qualidade; sem gate de artefato do plugin atualizado | `.github/workflows/quality.yml` | Regressões Rust/plugin passam despercebidas |

## Onde cada item entra no roadmap

Ver [`FOUNDATION_ROADMAP.md`](./FOUNDATION_ROADMAP.md): K-01, G-02, G-05, G-11 → etapas 1–3
(contrato/validação); G-04, G-13 → etapa 4 (versionamento); G-09 → etapa 5 (evidência); K-02,
K-03, G-06 → etapa 6 (interoperabilidade); G-07, G-08, G-12 → etapa 7 (segurança); G-03 → etapa
10 (IA); G-10 → decisão Q-014.
