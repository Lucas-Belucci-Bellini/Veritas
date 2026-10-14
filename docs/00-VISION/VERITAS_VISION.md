# Visão do Veritas

> Estado: documento de visão. Separa o que **tem fundamento no código** do que é **hipótese**.
> Legenda em [`../README.md`](../README.md).

## 1. O que é o Veritas hoje

Uma frase que o código sustenta:

> **O Veritas é um motor determinístico que transforma descrições lógicas (expressões, circuitos,
> fluxogramas) em resultados calculados — tabelas, simulações, comparações e relatórios de teste —
> declarando explicitamente a força de cada conclusão.**

Ele é entregue por quatro superfícies que compartilham o mesmo domínio TypeScript:

| Superfície | Estado | Onde |
| --- | --- | --- |
| Aplicação web/PWA local-first | `IMPLEMENTED` | `src/App.tsx`, `src/components/` |
| Servidor MCP (stdio) + plugin do Claude Code | `IMPLEMENTED` | `mcp/src/`, `plugins/veritas-logic/` |
| Servidor MCP HTTP local autenticado | `EXPERIMENTAL` | `mcp/src/http-server.ts` |
| Shell desktop Tauri 2 | `EXPERIMENTAL` (`0.1.0-alpha.1`) | `src-tauri/` |

"Calculadora de tabelas verdade" descreve só a porta de entrada. O núcleo real está em
`src/engine/` (lógica proposicional), `src/circuit/` + `src/simulation/` (circuitos digitais
combinacionais e sequenciais) e `src/algorithms/` (fluxogramas com linguagem de expressão restrita).

## 2. Princípios que já estão no código

Estes princípios não são aspiração: aparecem repetidamente em implementação e testes.
Eles são a base mais sólida para qualquer visão futura.

| Princípio | Evidência no código |
| --- | --- |
| **Calcular em vez de adivinhar** | Descrição do servidor MCP: "Use estas ferramentas em vez de calcular … de cabeça" (`mcp/src/server.ts:78`); skill do plugin repete a regra. |
| **A força da conclusão faz parte da conclusão** | `equivalent` (prova exaustiva) vs `identical` (concordou **neste roteiro**) vs `passed` (só os casos escritos) — `src/circuit/equivalence.ts`, `differential.ts`, `testbench.ts`; `docs/VERIFICATION.md`. |
| **Prova parcial não é prova** | Equivalência acima de 16 bits é recusada, não truncada (`MAX_EQUIVALENCE_INPUT_BITS`). |
| **Contraexemplo determinístico** | Relatórios devolvem a primeira linha/tique divergente em ordem canônica. |
| **Dados, não código** | Testbench, arquivos `.veritas`, catálogo DLS e payloads Worker/Tauri nunca são avaliados como código; sem `eval`/`Function`. |
| **Fail-closed** | Importadores rejeitam versão futura, campo desconhecido, coleção parcialmente inválida; allowlist DLS explícita. |
| **Transcrição ≠ equivalência** | O importador DLS declara que transcreve a netlist e **não** afirma equivalência (`src/circuit/dlsImport.ts`). |
| **Limites explícitos** | 256 nós, 512 conexões, 500 kB, 64 bits, 1000 tiques, budgets de operações/memória. |
| **Local-first; nuvem e IA opt-in** | Tudo funciona sem conta; sync só por ação explícita. |
| **Proposta ≠ aplicação** | Otimização por IA e snapshots remotos só entram após clique do usuário (`CircuitEditor.tsx`). |

## 3. A cadeia de evolução — hipótese analisada

O operador propôs a cadeia abaixo **como hipótese**. A análise etapa por etapa:

```text
Logic Calculator → Logic Simulator → Circuit Modeling → Verification Engine
→ Developer Tool → AI Tooling → Agent Infrastructure
```

| Etapa | Fundamento técnico hoje | Estado | O que falta para a etapa ser verdadeira |
| --- | --- | --- | --- |
| **Logic Calculator** | Lexer/parser/AST com 4 notações, tabela verdade, classificação, Quine-McCluskey, SOP/POS, Karnaugh (`src/engine/`) | `IMPLEMENTED` | — |
| **Logic Simulator** | `Simulator` de duas fases com clock, DFF/TFF/JK/SR, delay, budgets, cancelamento (`src/simulation/simulator.ts`) | `IMPLEMENTED` | Sinais `X`/`Z`, memória, tri-state (fora de escopo atual) |
| **Circuit Modeling** | `CircuitDocument` v1 versionado, validação semântica, multi-bit, chips hierárquicos, wireless, editor visual | `IMPLEMENTED` com lacunas | Portas formais, identidade portátil de chips, migração v1→v2, aceitação uniforme entre camadas (ver [`CANONICAL_DOCUMENT.md`](../02-ARCHITECTURE/CANONICAL_DOCUMENT.md)) |
| **Verification Engine** | Equivalência exaustiva, comparação temporal, testbench declarativo com snapshots e contraexemplos | `IMPLEMENTED` (três modos) | Asserções/propriedades, equivalência sequencial provada, registro persistente de resultados |
| **Developer Tool** | MCP stdio, plugin, HDL Verilog/VHDL, arquivos portáteis, CI com gates de aceitação | `PARTIAL` | Contratos publicados (JSON Schema), CLI própria, HDL sequencial correto, saída estruturada no MCP |
| **AI Tooling** | 17 ferramentas MCP determinísticas; análise/otimização por LLM via Edge Function com fallback heurístico | `PARTIAL` | A saída da IA não passa por verificação comportamental antes de ser aplicada; sem outputSchema; sem intenção declarativa |
| **Agent Infrastructure** | Não há ferramentas de escrita, sessão, identidade de agente, auditoria ou evidência persistida | `RESEARCH` | Quase tudo — ver [`../03-AI/AGENT_MODEL.md`](../03-AI/AGENT_MODEL.md) |

**Conclusão da análise:** as quatro primeiras etapas estão sustentadas pelo código. As duas
seguintes estão parcialmente sustentadas e têm lacunas concretas. A última é pesquisa. A cadeia é
coerente com o código porque o ativo que se acumula em cada etapa é o mesmo: **modelos
determinísticos com relatórios que dizem quão forte é a conclusão**.

## 4. A visão proposta (não decidida)

A formulação abaixo organiza a direção do operador sem inventar decisões. Ela é `RESEARCH`.

> O Veritas separa **geração** de **verificação**. Uma pessoa ou uma IA propõe; o Veritas
> representa a proposta num modelo canônico, valida, executa quando aplicável, verifica
> propriedades, e devolve um resultado estruturado cuja força é explícita — a **evidência**.
> A autoridade para aplicar a mudança continua com o humano ou com uma política declarada.

O que torna essa visão plausível **neste** repositório (e não só uma ideia genérica):

1. o domínio já é determinístico e sem DOM (roda no navegador, no Node/MCP e em Worker);
2. os relatórios de verificação já distinguem prova, observação e caso;
3. o MCP já expõe verificação para agentes;
4. a política "IA propõe → valida → preview → confirma → aplica → audita" já está escrita no
   roadmap (`VERITAS_MASTER_BUILD_QUEUE.md`, fase v3.6.0) e parcialmente praticada na UI.

O que a torna arriscada:

1. o único domínio modelado é lógica digital/proposicional e fluxogramas pequenos — "raciocínio
   genérico" não tem modelo no código;
2. "evidência" hoje existe só como relatório efêmero e como manifesto de release — não há registro
   persistente, hash criptográfico nem identidade de engine (ver [`EVIDENCE_MODEL.md`](../05-FOUNDATION/EVIDENCE_MODEL.md));
3. os contratos divergem entre camadas (ver [`DUPLICATIONS.md`](../02-ARCHITECTURE/DUPLICATIONS.md)).

## 5. Identidade: a pergunta aberta mais importante

Os documentos existentes (`plano.md`, `VERITAS_V3_V5_ROADMAP.md`) definem o Veritas como
**Digital Logic Platform**. A nova direção fala em **infraestrutura de raciocínio e verificação**.
As duas não são excludentes, mas levam a prioridades diferentes. Três leituras possíveis, nenhuma
escolhida:

| Leitura | Consequência |
| --- | --- |
| A. Digital Logic Platform; IA é um consumidor entre outros | Roadmap atual segue; a camada de IA é v3.6.0. |
| B. Infraestrutura de verificação cujo **primeiro domínio** é lógica digital | Contratos, evidência e MCP sobem de prioridade; novos domínios exigem modelo próprio. |
| C. Infraestrutura de verificação genérica para código de agentes | Exige modelar domínios que não existem; conflita com os non-goals atuais. |

Registrada como **Q-001** em [`DECISION_LOG.md`](../07-DECISIONS/DECISION_LOG.md). Esta
documentação foi escrita para ser válida em A e em B; C não tem fundamento técnico hoje.

## 6. Onde continuar

- Escopo concreto: [`VERITAS_SCOPE.md`](./VERITAS_SCOPE.md)
- O que não fazer: [`VERITAS_NON_GOALS.md`](./VERITAS_NON_GOALS.md)
- Ordem de construção: [`FOUNDATION_ROADMAP.md`](../05-FOUNDATION/FOUNDATION_ROADMAP.md)
