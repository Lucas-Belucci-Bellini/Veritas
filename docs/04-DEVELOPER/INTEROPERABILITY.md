# Pontos de integração

> Todos os pontos de integração atuais e previstos, com protocolo, entrada, saída, autenticação,
> confiança, limites, versionamento e riscos. Legenda em [`../README.md`](../README.md).

## Resumo

| # | Integração | Estado |
| --- | --- | --- |
| I-01 | MCP stdio | `IMPLEMENTED` |
| I-02 | MCP Streamable HTTP | `EXPERIMENTAL` (local) |
| I-03 | Plugin Claude Code | `IMPLEMENTED` (desatualizado) |
| I-04 | Supabase Auth | `IMPLEMENTED` (opt-in) |
| I-05 | Supabase Postgres (RPC/RLS) | `PARTIAL` |
| I-06 | Supabase Realtime | `PARTIAL` |
| I-07 | Edge Function de IA + provedor LLM | `PARTIAL` |
| I-08 | Tauri IPC | `EXPERIMENTAL` |
| I-09 | Rust `engine-rs` (rlib) | `EXPERIMENTAL` |
| I-10 | WASM `VNET/VRES` | `EXPERIMENTAL` |
| I-11 | HDL (Verilog/VHDL) — saída | `PARTIAL` |
| I-12 | Arquivos `.veritas*` | `IMPLEMENTED` / `PARTIAL` |
| I-13 | Digital Logic Sim (DLS) | `IMPLEMENTED` (allowlist) |
| I-14 | Link compartilhável `?expr=` | `IMPLEMENTED` |
| I-15 | PWA / Service Worker | `IMPLEMENTED` |
| I-16 | Distribuição desktop (GitHub Release) | `EXPERIMENTAL` |
| I-17 | Agentes futuros | `RESEARCH` |

## Detalhe

### I-01 · MCP stdio
- **Protocolo:** JSON-RPC MCP sobre stdin/stdout. **Entrada:** argumentos Zod (expressões, documentos, netlists, algoritmos). **Saída:** texto JSON.
- **Auth:** nenhuma (processo local do usuário). **Confiança:** o host é confiável; o conteúdo dos argumentos não (revalidado).
- **Limites:** por ferramenta (ver [`MCP_ARCHITECTURE.md`](./MCP_ARCHITECTURE.md)). **Versão:** `VERITAS_MCP_VERSION` (defasada).
- **Riscos:** K-02, K-03; saída não estruturada induz parsing frágil no agente.

### I-02 · MCP Streamable HTTP
- **Protocolo:** HTTP POST `/mcp`, `MCP-Protocol-Version: 2025-11-25`, stateless. **Auth:** bearer estático + allowlist de `Origin`; metadata RFC 9728 opcional (sem validação de token).
- **Limites:** 1 MiB, 30 s, bind `127.0.0.1`. **Riscos:** exposição acidental com `VERITAS_MCP_HTTP_HOST=0.0.0.0` torna o bearer a única barreira; K-03 vira DoS remoto para quem tem o token.

### I-03 · Plugin Claude Code
- **Protocolo:** marketplace git → cópia de `plugins/veritas-logic/` → `.mcp.json` sobe `server.mjs`.
- **Confiança:** código versionado no repositório é executado na máquina de quem instala. **Versão:** três valores diferentes (G-04). **Riscos:** bundle diverge do código-fonte; skill orienta só 7 de 17 ferramentas.

### I-04 · Supabase Auth
- **Entrada:** e-mail/senha pelo SDK. **Config:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (públicas por design). Sessão persistida (`persistSession`, `autoRefreshToken`).
- **Riscos:** sessão em storage do navegador; não é licença (D-015).

### I-05 · Supabase Postgres
- **Protocolo:** PostgREST + RPC `veritas_sync_circuit_project` (`SECURITY INVOKER`, `p_base_version`), policies RLS por owner/colaborador, helpers `SECURITY DEFINER` em `private`.
- **Entrada:** `CircuitDocument` JSONB. **Validação:** `private.veritas_validate_circuit_document` (11 tipos). **Saída:** versões imutáveis, conflito → `CloudVersionConflictError`.
- **Versão:** migrations datadas; documento sempre v1. **Riscos:** G-02 (drift de tipos); aceitação RLS cross-user real pendente; estado do banco implantado `UNKNOWN`.

### I-06 · Supabase Realtime
- **Protocolo:** canal privado por tópico de room; Broadcast (snapshot, runtime_config, runtime_state) + Presence.
- **Auth:** JWT + policies em `realtime.messages`; viewers não publicam. **Confiança:** mensagens de outros usuários são não confiáveis; guard de forma na recepção, validação semântica na aplicação, confirmação humana.
- **Limites:** ofertas temporais expiram em 30 s; histórico local de 12 eventos. **Riscos:** G-05; sem limite de tamanho na recepção.

### I-07 · Edge Function de IA + provedor
- **Protocolo:** POST `functions/v1/veritas-circuit-ai`; a função chama `AI_PROVIDER_URL` (formato chat-completions, `response_format: json_schema` estrito, `max_completion_tokens` 1200).
- **Entrada:** `{action, context, instruction?}`; contexto ≤200.000 caracteres; instrução ≤1200.
- **Auth:** handler exige prefixo `Bearer `; verificação de JWT depende de `verify_jwt=true` no deploy — configuração **não versionada** no repo (`UNKNOWN` além do observado em `docs/BETA-EDGE-ACCEPTANCE.md`).
- **Confiança:** a resposta do LLM é não confiável; revalidada no servidor e no cliente (estrutura). **Riscos:** G-03 (sem equivalência), DUP-01 (14 tipos), prompt injection via rótulos, dados do circuito enviados a terceiro (provedor).

### I-08 · Tauri IPC
- **Comandos:** `simulate_circuit_native`, `cancel_circuit_native`, comandos de smoke. **Evento:** `veritas://simulation-progress` (≤64 por request).
- **Entrada:** `NativeSimulationRequest` v1 (escalar, 18 tipos). **Capabilities:** apenas `core:event:default`. **CSP:** `null` (desativada) em `tauri.conf.json` (G-07).
- **Estado:** não ligado à UI. **Riscos:** paridade limitada; CSP aberta amplia impacto de XSS na WebView.

### I-09 / I-10 · Rust e WASM
- `engine-rs`: `evaluate(netlist)` e `topological_order` para 10 tipos, largura ≤64. WASM: ABI `veritas_wasm_*`, buffer 64 KiB, sem imports, códigos de erro estáveis.
- **Confiança:** entrada já normalizada pelo host TS; Rust revalida. **Versão:** `WASM_ABI_VERSION = 1`, bits de capability. **Estado:** fora dos bundles (gate de isolamento).

### I-11 · HDL
- **Saída:** Verilog-2001 / VHDL-2008 textual de documento elaborado. **Entrada inversa:** inexistente.
- **Riscos:** K-02 (sequencial), palavras reservadas não escapadas; compilação externa verificada no CI só para fixtures do gate.

### I-12 · Arquivos `.veritas*`
- Ver [`CONTRACTS.md`](../05-FOUNDATION/CONTRACTS.md). Arquivo é **dado não confiável**; parsers fail-closed, ≤5 MB, importação transacional. **Riscos:** K-01.

### I-13 · Digital Logic Sim
- **Entrada:** JSON de chips DLS (arquivos lidos no navegador ou pelo script). **Confiança:** externa; nunca executada; allowlist de perfis vetoriais; importação estrutural transcreve com NAND como folha.
- **Saída:** catálogo derivado (`src/chips/catalog.json`) e `CircuitDocument`. **Riscos:** catálogo é artefato gerado versionado (DUP-10).

### I-14 · `?expr=`
- Texto de expressão na URL, parseado pela engine. Sem execução; risco baixo (DoS por expressão enorme limitado pelo teto da tabela).

### I-15 · PWA
- Workbox pré-carrega o app; atualização exige confirmação. **Risco:** cache obsoleto (mitigado por `PwaStatus`, `WorkspaceBoundary`).

### I-16 · Distribuição desktop
- GitHub Release com `Veritas-Setup.exe`, `.dmg`/`.app.zip`, `.deb`/`.AppImage`, `SHA256SUMS`, `desktop-release-manifest.json`. **Sem assinatura** Authenticode/Apple (PLANNED). Runtime Win/macOS `NOT VERIFIED`.

### I-17 · Agentes futuros
- `RESEARCH`: CLI headless, leitura de projeto, propostas governadas, evidência anexável. Pré-requisitos em [`AGENT_MODEL.md`](../03-AI/AGENT_MODEL.md) §6.
