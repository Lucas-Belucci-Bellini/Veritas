# Roadmap por fundamentos

> Ordem de construção baseada em fundamentos, não em funcionalidades de demonstração.
> **Status do documento: proposta.** Ele não substitui `docs/ROADMAP.md` (fonte de verdade das
> releases); a reconciliação é a decisão Q-004. Legenda em [`../README.md`](../README.md).

## Princípio de ordenação

```text
1 contratos → 2 modelos canônicos → 3 validação → 4 versionamento → 5 evidência
→ 6 interoperabilidade → 7 segurança → 8 execução → 9 colaboração → 10 IA → 11 avançado
```

Uma etapa só começa quando os critérios de saída das anteriores estão cumpridos **para a
superfície que ela toca**. Correções pequenas de defeitos confirmados podem ser feitas a qualquer
momento dentro da etapa a que pertencem.

## Relação com as fases já em andamento

| Fase no repositório | Etapas deste roadmap |
| --- | --- |
| "v2.6.0 — Verification no produto" (em desenvolvimento) | 5 (insumo de evidência) |
| "v2.7.0 — Execution Safety" (em desenvolvimento) | 8 |
| "v2.8.0 — Formatos e migrações" (em desenvolvimento) | 1, 4 |
| v3.0.0 modularidade | 2, 6 |
| v3.6.0 IA controlada | 10 |
| v4.3.0 provenance | 5 |

A leitura por fundamentos sugere que partes de v2.8 e de v4.3 são pré-requisito de v3.6 — o
roadmap atual as coloca em ordem compatível, mas trata provenance como tardia.

---

## Etapa 1 — Contratos

**Objetivo:** uma fonte única, executável e publicada para cada contrato.

| Item | Estado de partida | Saída |
| --- | --- | --- |
| Manifesto de tipos de componente (aridade, saídas, estado, larguras) | Espalhado em 7 lugares (DUP-01) | Um artefato de dados consumido pelo TS e testado contra SQL/Edge/Rust |
| Schema publicado de `veritas-circuit`, testbench, chip-library, algorithms | Inexistente | Schemas versionados no repositório |
| Vetores de conformidade (válidos/inválidos) | Parciais por módulo | Uma suíte executada contra cada réplica |
| Catálogo de códigos de erro | Por camada | Códigos estáveis compartilhados |

**Critério de saída:** um tipo novo não pode entrar no TS sem o teste de conformidade apontar
cada réplica desatualizada.

## Etapa 2 — Modelos canônicos

| Item | Saída |
| --- | --- |
| Separar "subconjunto intencional" de "atraso" em cada réplica | Documentado e testado |
| Identidade de porta e de chip | Decisões Q-008 registradas |
| Modelo de "projeto" (circuito + chips + testbenches) | Decidido se entra na v1 ou só num schema v2 (Q-007) |
| Documentar `DomainModel` como referência viva | [`DOMAIN_MODEL.md`](../02-ARCHITECTURE/DOMAIN_MODEL.md) mantido por PR |

## Etapa 3 — Validação

| Item | Estado | Saída |
| --- | --- | --- |
| Import `.veritas-circuits` vetorial (K-01) | Defeito | Round-trip de todos os documentos que o editor salva |
| Validação SQL e Edge alinhadas ao manifesto (G-02, G-03 parcial) | Drift | Mesmos vetores passam/falham em todas as camadas |
| Realtime: `allowBuses` e limites na recepção (G-05) | Drift | Idem |
| MCP `simulate_circuit` enum (G-11) | Drift | Idem |
| Save local sem validação | Por desenho | Decidir se o IndexedDB aceita documento inválido (rascunho) — Q-015 |

## Etapa 4 — Versionamento

| Item | Saída |
| --- | --- |
| Fonte única de versão para pacote, MCP, plugin, marketplace (G-04) | Gate de CI |
| Significado dos rótulos "v2.x" vs versão publicada (Q-005) | Decisão registrada |
| Infraestrutura de migração (`migrateCircuitDocument` e equivalentes) | Pronta antes da primeira mudança incompatível |
| Versão nos envelopes Realtime e Edge | Campo presente e verificado |
| Documentação de estado reconciliada (G-13) | README/AUDIT apontam para esta árvore |

## Etapa 5 — Evidência

Pré-requisito: etapas 1 e 4 (sem versão e contrato estáveis, evidência mente).

| Item | Saída |
| --- | --- |
| Canonicalização única + digest criptográfico (DUP-06, G-09) | Função compartilhada; FNV restrito a chaves locais |
| Tipo compartilhado de força da conclusão | Os três verificadores o emitem |
| Envelope de resultado reprodutível (entrada, engine, limites, relatório) | Decisão Q-013 e protótipo local |
| Integrar diagnóstico bounded ao testbench (fase v2.6 em curso) | Já planejado |

## Etapa 6 — Interoperabilidade

| Item | Saída |
| --- | --- |
| HDL recusa componentes com estado e escapa palavras reservadas (K-02) | Erro explícito |
| `debug_algorithm` valida documento e estado; limite independente do cliente; abort (K-03) | Limite garantido |
| `outputSchema` + `structuredContent` + anotações read-only | Contrato de saída MCP |
| Skill e marketplace atualizados (G-06) | Gate de artefato |
| CLI headless para CI (testbench/equivalência com exit code) | Decisão + protótipo |

## Etapa 7 — Segurança

| Item | Saída |
| --- | --- |
| CSP no Tauri (G-07) | Política explícita |
| `verify_jwt` versionado ou verificação no handler (G-08) | Autenticação independente de configuração manual |
| Tratamento de conteúdo do usuário no prompt (G-12) | Delimitação + testes de prompt injection |
| Aceitação real RLS/Realtime/Edge | Relatórios com proveniência `REAL` |
| Threat model do MCP HTTP antes de qualquer exposição | Documento |

## Etapa 8 — Execução

Worker e Tauri com paridade golden ampliada; decisão sobre convergência dos crates Rust (Q-010);
budgets por supervisor; resume com checkpoint só depois de linhagem e restore transacional.
Corresponde à fase "v2.7" existente.

## Etapa 9 — Colaboração

Aceitação cross-user real; conflito explícito preservado; versão em envelopes; colaboração
multi-bit (depende da etapa 3).

## Etapa 10 — IA

Pré-requisitos: 1–7. Itens: verificação comportamental obrigatória para propostas que alegam
preservar função (G-03); formato de proposta (Q-011); política de aplicação (Q-012); diff/preview/
rollback/auditoria (v3.6.0); decisão sobre o destino da tabela `veritas_circuit_context` (Q-014).

## Etapa 11 — Recursos avançados

Asserções/propriedades, equivalência sequencial provada, importação HDL, escala 5k/25k, plugins,
pacotes de projeto, novos domínios (só com regra de escopo), modelo comercial.

---

## Anti-padrões que este roadmap evita

- Adicionar ferramenta MCP de escrita antes das etapas 1–7.
- Promover Rust/WASM antes da etapa 8.
- Chamar resultado de "evidência" antes da etapa 5.
- Adicionar tipos de componente sem o manifesto da etapa 1.
