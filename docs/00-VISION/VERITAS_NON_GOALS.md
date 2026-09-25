# Non-goals do Veritas

> Lista obrigatória do que o Veritas **não** pretende ser. Cada item tem motivo e fonte.
> Mudar um item desta lista é uma decisão arquitetural: registre no
> [`DECISION_LOG.md`](../07-DECISIONS/DECISION_LOG.md) antes de escrever código.

## 1. Non-goals de identidade

| # | O Veritas não é… | Motivo | Fonte |
| --- | --- | --- | --- |
| NG-01 | **Outra IA de programação** / um gerador de código | O valor proposto é verificar, não gerar. Um gerador competiria com os agentes que o Veritas pretende servir. | Direção do operador; `issue.md` (MCP para "não alucinar") |
| NG-02 | **Um executor de código arbitrário** | Todo o domínio é "dados, não código"; sem `eval`/`Function`; Worker/Tauri recusam JS, shell, URLs. | `docs/EXECUTION_WORKER_BOUNDARY.md`, `docs/TAURI_SIMULATION_BOUNDARY.md` |
| NG-03 | **Um oráculo de verdade genérica** | Só há modelos para lógica booleana, circuitos e fluxogramas. Afirmar verificação fora deles seria inventar força. | Código de `src/` |
| NG-04 | **Uma plataforma que aplica mudanças por conta própria** | Nenhuma IA altera projeto sem proposta, validação, preview, confirmação e rollback. | `docs/VERITAS_V3_V5_ROADMAP.md` §1 regra 4 |
| NG-05 | **Um produto cloud-first** | Local-first/offline-first; nuvem é camada opcional e removível. | `plano.md`, `docs/PRODUCT_AUTH_LICENSE_BOUNDARY.md` |
| NG-06 | **Um coletor de dados de uso** | Métricas locais não enviam documento, inputs ou timeline; telemetria de IA é resumida e best-effort. | README (runtime temporal), `src/metrics/aiMetrics.ts` |
| NG-07 | **Um simulador analógico/elétrico (SPICE), PCB ou fabricação** | Fora do modelo digital; "3D, PCB, impressão" são visão de longo prazo explicitamente fora do ciclo. | `docs/ROADMAP.md` §1 |
| NG-08 | **Um substituto de ferramentas EDA industriais** (síntese, timing, place & route) | HDL é exportação de subconjunto; ferramentas externas seriam opt-in. | `docs/VERITAS_25K_SCALABLE_ARCHITECTURE.md` §5.4 |

## 2. Non-goals técnicos (enquanto não houver decisão contrária)

| # | Não fazer | Motivo |
| --- | --- | --- |
| NG-10 | Reescrever o Veritas em outro framework ou linguagem "por elegância" | Decisão registrada: manter React → Vite → Tauri 2 → Rust; TS é a engine canônica (D-003, D-004). |
| NG-11 | Promover Rust/WASM a engine de produção sem paridade golden | TS é referência; Rust/WASM é `EXPERIMENTAL` (D-004). |
| NG-12 | Aceitar HDL, scripts, URLs ou caminhos dentro de arquivos importados | Fail-closed de importação (D-008). |
| NG-13 | Executar JSON do Digital Logic Sim ou inferir dependências ausentes | Allowlist DLS (D-009). |
| NG-14 | Filtrar silenciosamente itens inválidos de uma importação | Coleção inválida é rejeitada inteira (D-008). |
| NG-15 | Resolver conflitos de colaboração por last-write-wins silencioso | Conflito explícito com versão-base (D-012). |
| NG-16 | Elevar os limites de documento (256/512/500 kB) sem formato escalável medido | `docs/LARGE_CIRCUITS.md`. |
| NG-17 | Chamar provedores de pagamento, Steam ou Supabase de dentro do `Simulator`/`CircuitDocument` | Fronteira de licença separada do domínio (D-015). |
| NG-18 | Transformar ideia do `issue.md` em backlog por existir | `issue.md` é registro de descoberta. |
| NG-19 | Descrever build de runner como runtime verificado | Escala de evidência de plataforma (D-017). |

## 3. Non-goals da visão IA/agentes (fase atual)

Estes itens protegem a visão ampliada de virar "coleção sem direção":

| # | Não fazer agora | Motivo |
| --- | --- | --- |
| NG-20 | Expor ferramentas MCP de **escrita** (salvar, sincronizar, apagar) | Não há modelo de autoridade, auditoria nem rollback para agentes ([`AGENT_MODEL.md`](../03-AI/AGENT_MODEL.md)). |
| NG-21 | Embutir um LLM como parte obrigatória de qualquer fluxo | IA é opcional; fallback local existe e deve continuar. |
| NG-22 | Chamar "evidência" o que é apenas saída de LLM | LLM produz proposta ou explicação; evidência exige execução determinística ([`EVIDENCE_MODEL.md`](../05-FOUNDATION/EVIDENCE_MODEL.md)). |
| NG-23 | Construir orquestração multi-agente ("250 subagentes") | Visão de longo prazo sem caso de uso validado (`docs/ROADMAP.md` §1). |
| NG-24 | Adicionar domínios novos (ex.: verificação de código de aplicação) sem modelo canônico próprio | Regra de escopo em [`VERITAS_SCOPE.md`](./VERITAS_SCOPE.md) §4. |
| NG-25 | Publicar endpoint MCP remoto público antes de OAuth real e hardening | MCP HTTP atual é local, bearer estático (MCP-011/013). |
