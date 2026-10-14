# Decision Log

> Decisões já tomadas (identificadas no código ou em documentos) e perguntas abertas.
> **Regra:** perguntas abertas são decididas pelo operador, não por preferência de quem estiver
> implementando. Ao decidir, mova a pergunta para a seção de decisões com data e fonte.

## Parte A — Decisões existentes

| ID | Decisão | Motivo | Alternativas descartadas | Estado | Impacto | Fonte |
| --- | --- | --- | --- | --- | --- | --- |
| D-001 | Local-first, offline-first, privacy-first; sem conta no caminho principal | Custo zero de servidor, privacidade, uso educacional | Cloud-first | Vigente | Nuvem/IA sempre opt-in | `plano.md`, `docs/ROADMAP.md` §2 |
| D-002 | Domínio sem React/DOM | Reuso por UI, MCP, Worker, importador | Lógica no componente | Vigente, cumprida | Permite MCP e Worker sem duplicação | `README.md`, código |
| D-003 | Manter React → Vite → Tauri 2 → Rust | Evitar reescrita; Rust para escala | Trocar framework | Vigente | NG-10 | `docs/VERITAS_25K_SCALABLE_ARCHITECTURE.md` §1 |
| D-004 | `Simulator` TypeScript é a engine canônica; Rust/WASM só com paridade golden e opt-in | Evitar duas engines divergentes | Migrar para Rust já | Vigente | Rust `EXPERIMENTAL` | `docs/EXECUTION_WORKER_BOUNDARY.md`, `docs/RUST-ENGINE.md` |
| D-005 | Simulação em duas fases por tique; feedback só via componente com estado | Determinismo, sem laço infinito | Avaliação assíncrona por evento | Vigente | Base de toda a semântica temporal | README §Lógica sequencial |
| D-006 | Limites oficiais: 256 nós, 512 conexões, 500 kB, 64 bits | Orçamento de UI, payload, SQL, IA | Sem limite | Vigente | NG-16 | `docs/FOUNDATION-001.md`, `docs/LARGE_CIRCUITS.md` |
| D-007 | Normalização altera só representação; semântica inválida é rejeitada | Não mascarar erro | Autocorreção | Vigente | Idem | `docs/FOUNDATION-001.md` |
| D-008 | Importação fail-closed: versão futura/antiga sem migrador/campo desconhecido/coleção parcial → rejeitar; transacional | Não corromper dados locais | Importação tolerante | Vigente | Parsers fechados | `docs/V2_FORMAT_MIGRATION.md` |
| D-009 | DLS: allowlist explícita, sem executar JSON, NAND como única folha na importação estrutural, sem afirmar equivalência | Não prometer comportamento não provado | Executor genérico de DLS | Vigente | Catálogo parcialmente materializável | README, `src/circuit/dlsImport.ts` |
| D-010 | Chips customizados são combinacionais; hierarquia por referência; profundidade ≤8; sem ciclos | Previsibilidade de simulação/HDL | Chips com estado interno | Vigente | Limita chips sequenciais | `src/circuit/customChip.ts` |
| D-011 | Identidade de porta pública = rótulo (ou id), ordem alfabética | Comparar circuitos desenhados separadamente; simetria | Pareamento por id/ordem | Vigente | Rótulos únicos obrigatórios | `docs/VERIFICATION.md` |
| D-012 | Colaboração com conflito explícito por `baseVersion`; nada remoto aplicado sem confirmação; sem LWW silencioso | Não perder trabalho local | CRDT, LWW | Vigente | Fluxo de oferta/aplicação | README, `src/realtime/` |
| D-013 | Força da conclusão explícita: exaustivo ou recusa; `identical` ≠ `equivalent`; `passed` = só casos escritos | Nenhum consumidor deve ler mais força do que existe | Prova amostrada | Vigente | Base do modelo de evidência | `docs/VERIFICATION.md` |
| D-014 | IA só propõe; aplicação exige validação, preview, confirmação (e, planejado, rollback/auditoria) | Segurança e confiança | Mutação direta | Vigente (parcialmente aplicada) | AI-P1 | `docs/VERITAS_V3_V5_ROADMAP.md` §1, master queue v3.6.0 |
| D-015 | Conta/licença/entitlement fora do domínio; Supabase Auth não é licença | Não espalhar regra comercial | Checagem de licença no simulador | Vigente (planejamento) | NG-17 | `docs/PRODUCT_AUTH_LICENSE_BOUNDARY.md` |
| D-016 | Modelo comercial demo gratuita + edição final paga + DLC + cloud paga opcional | Estratégia do proprietário | Gratuito total, SaaS | Planejado | Não implementado | `docs/COMMERCIAL_MODEL_STEAM.md` |
| D-017 | Separar `BUILD`/`RUNTIME`/`SMOKE VERIFIED`/release ready; CI verde não promove versão | Honestidade de release | Promoção por CI | Vigente | Processo de release | `plano.md` |
| D-018 | MCP: domínio separado de transporte; ferramentas sem efeito colateral; mesmas ferramentas em stdio e HTTP | Testabilidade, risco baixo | Ferramentas de escrita | Vigente | NG-20 | `docs/MCP-INTEROPERABILITY.md` |
| D-019 | MCP HTTP local: stateless, localhost, bearer + Origin; sem OAuth público até etapa própria | Evitar exposição prematura | Deploy público | Vigente | NG-25 | `docs/ROADMAP.md` MCP-011/013 |
| D-020 | Plugin distribui bundle versionado no git | Plugin funciona sem build | Build na instalação | Vigente | DUP-10 | README §Plugin |
| D-021 | Validação server-side do documento no Postgres antes de persistir | Última barreira | Confiar no cliente | Vigente | Réplica SQL (DUP-03) | migration `20260821043000` |
| D-022 | Helpers de autorização em schema `private` `SECURITY DEFINER`; RPCs públicas `SECURITY INVOKER` | Superfície mínima | Tudo público | Vigente | — | `docs/BETA-SUPABASE-HARDENING.md` |
| D-023 | Testes ancorados em algo verificável, não em números de memória | Evitar falsa confiança | — | Vigente | Cultura de teste | Regras do repositório |
| D-024 | `issue.md` é registro de ideias, não fila | Evitar backlog sem direção | — | Vigente | NG-18 | `docs/ROADMAP.md` |

## Parte B — Perguntas abertas

| ID | Pergunta | Contexto | Opções possíveis | Informação necessária para decidir |
| --- | --- | --- | --- | --- |
| Q-001 | **Qual é a identidade do Veritas?** | Docs dizem "Digital Logic Platform"; direção nova fala em infraestrutura de verificação para IA | A) DLP com IA como consumidor · B) infraestrutura de verificação com lógica digital como 1º domínio · C) verificação genérica de código de agentes | Público-alvo prioritário; modelo comercial (Steam vs dev tool); disposição para modelar novos domínios |
| Q-002 | Estratégia de IA | Edge Function embutida vs MCP para agentes externos | S1 verificador externo · S2 IA embutida · S3 ambos com contrato comum · S4 IA local | Custo de provedor; privacidade; público; resposta a Q-001 |
| Q-003 | O que conta como "evidência" no domínio e onde vive | Hoje só relatórios efêmeros e evidência de release | Arquivo local · IndexedDB · nuvem · anexo a PR/CI · nenhum | Casos de uso UC-A4/A5 confirmados; requisitos de reprodutibilidade |
| Q-004 | Como reconciliar `FOUNDATION_ROADMAP.md` com `docs/ROADMAP.md` | Dois ordenamentos (fundamentos × releases) | Adotar como lente · fundir · descartar | Prioridades do operador para as fases v2.6–v2.8 |
| Q-005 | Significado de versão | `0.9.0-rc.18` (pacote), `0.12.0` (README/CHANGELOG sem tag), "v2.6–2.8" (fases), `desktop 0.1.0-alpha.1` | Fases viram codinomes · renumerar · versões separadas por superfície | Política de SemVer por superfície (web, MCP, desktop, formatos) |
| Q-006 | Fonte única das invariantes do documento | DUP-01…04 | TS gera SQL/Edge · schema declarativo compartilhado · réplicas manuais + vetores de conformidade | Custo de geração para PL/pgSQL e Deno; tolerância a drift |
| Q-007 | Quando abrir `veritas-circuit` v2 e o que entra | Portas formais, metadados, projeto, identidade de chip | Agora (antes de mais tipos) · na v2.0.0 planejada · nunca (evoluir v1) | Lista de mudanças incompatíveis desejadas; custo de migração |
| Q-008 | Identidade portátil de chips | `customChipId` é id Dexie local | Ref estável por conteúdo (digest) · UUID · nome+versão · manter local + envelope | Requisitos de compartilhamento (GitHub, bibliotecas, MCP) |
| Q-009 | Modelo de sinal | Só booleano/`BitVector`; sem X/Z/tri-state | Manter binário · adicionar X/Z · 4-state completo | Quais chips DLS/uso educacional exigem; impacto em HDL e verificação |
| Q-010 | Os dois crates Rust convergem? | `engine-rs` (combinacional/WASM) e `src-tauri/simulation.rs` (sequencial) | Convergir num core · manter separados · abandonar um | Resultado de benchmarks e necessidade real de escala (25k) |
| Q-011 | Formato de proposta de mudança (IA/agentes) | Hoje: documento completo | Documento completo · patch estrutural · intenção declarativa · comandos | Modelo de comandos do editor (inexistente); necessidades de diff/rollback |
| Q-012 | Verificação obrigatória antes de "Aplicar" | G-03 | Obrigatória (bloqueia) · informativa · opcional por configuração | Custo em circuitos grandes; casos em que equivalência não se aplica (sequencial, intenção de mudar função) |
| Q-013 | Onde e como evidência é armazenada/transportada | Depende de Q-003 | Ver Q-003 | Idem |
| Q-014 | Destino da tabela `veritas_circuit_context` | Dormente, com RLS | Usar como memória de IA · remover · manter | Estratégia de IA (Q-002); política de privacidade |
| Q-015 | IndexedDB pode guardar documento inválido (rascunho)? | Save local só normaliza | Sim, rascunho explícito · não, validar sempre | UX do editor; consistência com import/export |
| Q-016 | Expor MCP remoto público? | HTTP local existe; OAuth não | Nunca · após OAuth + hardening · só self-hosted | Demanda de hosts remotos; custo operacional; modelo comercial |
| Q-017 | Ferramentas MCP de leitura de projeto/arquivos `.veritas` do workspace | Ideia do `issue.md` | Ler arquivos do diretório · recursos MCP · nada | Modelo de autoridade L1 ([`AGENT_MODEL.md`](../03-AI/AGENT_MODEL.md)) |
| Q-018 | CLI headless oficial para CI | Hoje só MCP e scripts internos | Criar · reutilizar MCP · não criar | Caso de uso UC-A5 confirmado |

## Parte C — Como registrar uma nova decisão

```text
D-0XX | decisão | motivo | alternativas | estado (vigente/planejado/revogado) | impacto | fonte (PR, doc, data)
```

Ao revogar, não apague: marque `revogada por D-0YY`.
