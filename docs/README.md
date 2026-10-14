# Documentação canônica do Veritas

> **Leia isto antes de alterar o Veritas.** Esta árvore (`docs/00-VISION` … `docs/07-DECISIONS`)
> descreve o que o Veritas **é hoje**, o que ele **pretende ser** e o que **ainda não foi decidido**.
> Ela foi produzida por investigação do código, não pela leitura do README.

## Por que esta documentação existe

O Veritas nasceu como calculadora de tabelas verdade e hoje contém engine booleana, editor e
simulador de circuitos, verificação comportamental, servidor MCP, plugin do Claude Code, nuvem
Supabase opcional, IA via Edge Function, dois núcleos Rust experimentais e um shell Tauri. A
direção de longo prazo proposta pelo operador é mais ampla: uma infraestrutura de **modelagem,
execução, verificação e evidência** consumível por pessoas e por agentes de IA.

Sem um mapa comum, cada nova sessão (humana ou de IA) redescobre o sistema e tende a tratar
intenções como funcionalidades. Esta documentação é o mapa.

## Legenda obrigatória de estado

Toda afirmação sobre capacidade usa um destes rótulos. Nunca promova um rótulo sem evidência.

| Rótulo | Significado |
| --- | --- |
| `IMPLEMENTED` | Código existe, está alcançável por uma superfície do produto (UI, MCP, API) e tem teste automatizado no repositório. |
| `PARTIAL` | Existe, mas não cobre todo o escopo declarado (camadas que não aceitam, UI ausente, caso conhecido que falha). |
| `EXPERIMENTAL` | Existe fora do caminho canônico: opt-in, feature flag, harness ou prova de paridade (ex.: Rust/WASM, comando Tauri, MCP HTTP local). |
| `PLANNED` | Descrito como intenção em documentos do repositório; sem código. |
| `RESEARCH` | Hipótese ainda não decidida (inclui boa parte da visão Veritas + IA). |
| `UNKNOWN` | Não determinável a partir do repositório (ex.: configuração de deploy não versionada). |

Eixo separado — **origem da afirmação**:

| Marcador | Significado |
| --- | --- |
| **[verificado]** | Reproduzido nesta investigação (teste, sonda ou comando executado). |
| **[código]** | Derivado da leitura do código, sem execução. |
| **[doc]** | Afirmado apenas por documento do repositório; não conferido no código. |

O projeto já usa, na engenharia de release, a escala `BUILD VERIFIED` / `RUNTIME VERIFIED` /
`SMOKE VERIFIED` / `NOT VERIFIED` (ver [`../plano.md`](../plano.md)). Essa escala mede **evidência
de QA de plataforma**; a legenda acima mede **estado da capacidade**. Não misture as duas.

## Linha de base desta investigação

| Item | Valor |
| --- | --- |
| Data | 2026-09-25 |
| Commit investigado | `4ab8f59` (`main`, idêntico a `claude/sweet-planck-bsv9j9`) |
| Versão do pacote | `0.9.0-rc.18` (última tag `v0.9.0-rc.18`; desktop `desktop-v0.1.0-alpha.1`) |
| `npx vitest run` | **92 arquivos aprovados + 1 skipped; 814 testes aprovados + 1 skipped** [verificado] |
| `npx oxlint` / `npm run typecheck` | sem erros [verificado] |
| Tamanho de `src/` | ~38 mil linhas TS/TSX, incluindo testes |

Revalide esta tabela antes de confiar nela; ela é uma fotografia, não um contrato.

## Índice

| Pasta | Documento | Pergunta que responde |
| --- | --- | --- |
| `00-VISION` | [`VERITAS_VISION.md`](./00-VISION/VERITAS_VISION.md) | O que é o Veritas e para onde a evolução aponta — com o que já tem fundamento no código |
| | [`VERITAS_SCOPE.md`](./00-VISION/VERITAS_SCOPE.md) | Que domínios e superfícies estão dentro do escopo, agora e depois |
| | [`VERITAS_NON_GOALS.md`](./00-VISION/VERITAS_NON_GOALS.md) | O que o Veritas não pretende ser |
| `01-PRODUCT` | [`PRODUCT_MODEL.md`](./01-PRODUCT/PRODUCT_MODEL.md) | Inventário de funcionalidades por estado (inclui parciais, experimentais e abandonadas) |
| | [`USE_CASES.md`](./01-PRODUCT/USE_CASES.md) | Atores, casos de uso e superfícies |
| `02-ARCHITECTURE` | [`SYSTEM_ARCHITECTURE.md`](./02-ARCHITECTURE/SYSTEM_ARCHITECTURE.md) | Componentes, dependências, fluxos e distribuição |
| | [`DOMAIN_MODEL.md`](./02-ARCHITECTURE/DOMAIN_MODEL.md) | Cada modelo de dados: origem, produtores, consumidores, invariantes, versão |
| | [`CANONICAL_DOCUMENT.md`](./02-ARCHITECTURE/CANONICAL_DOCUMENT.md) | O `CircuitDocument` em profundidade e quem aceita o quê |
| | [`DUPLICATIONS.md`](./02-ARCHITECTURE/DUPLICATIONS.md) | Lógica duplicada entre TS, Rust, SQL, Edge, MCP — risco e estratégia futura |
| `03-AI` | [`AI_STRATEGY.md`](./03-AI/AI_STRATEGY.md) | Papel do Veritas diante de IAs; princípios de autoridade |
| | [`AI_INTEGRATION.md`](./03-AI/AI_INTEGRATION.md) | O pipeline Intent → … → Evidence, etapa por etapa, contra o código |
| | [`AGENT_MODEL.md`](./03-AI/AGENT_MODEL.md) | Papéis, níveis de autoridade e estado de agentes |
| `04-DEVELOPER` | [`DEVELOPER_TOOLING.md`](./04-DEVELOPER/DEVELOPER_TOOLING.md) | Build, testes, scripts de aceitação, CI |
| | [`MCP_ARCHITECTURE.md`](./04-DEVELOPER/MCP_ARCHITECTURE.md) | Servidor MCP, ferramentas, transportes, plugin |
| | [`INTEROPERABILITY.md`](./04-DEVELOPER/INTEROPERABILITY.md) | Cada ponto de integração: protocolo, entrada, saída, auth, limites, riscos |
| `05-FOUNDATION` | [`CONTRACTS.md`](./05-FOUNDATION/CONTRACTS.md) | Inventário de contratos versionados e regras |
| | [`EVIDENCE_MODEL.md`](./05-FOUNDATION/EVIDENCE_MODEL.md) | "Evidência" como possível abstração central — o que existe e o que é hipótese |
| | [`FOUNDATION_ROADMAP.md`](./05-FOUNDATION/FOUNDATION_ROADMAP.md) | Roadmap ordenado por fundamentos |
| | [`KNOWN_GAPS.md`](./05-FOUNDATION/KNOWN_GAPS.md) | Defeitos e lacunas encontrados nesta investigação, com reprodução |
| `06-SECURITY` | [`TRUST_BOUNDARIES.md`](./06-SECURITY/TRUST_BOUNDARIES.md) | Fronteiras de confiança e onde a IA não tem autoridade |
| `07-DECISIONS` | [`DECISION_LOG.md`](./07-DECISIONS/DECISION_LOG.md) | Decisões existentes e perguntas abertas |

## Relação com os documentos anteriores

| Documento | Papel a partir de agora |
| --- | --- |
| [`ROADMAP.md`](./ROADMAP.md) | Continua sendo a fonte de verdade da **sequência de releases**. O [`FOUNDATION_ROADMAP.md`](./05-FOUNDATION/FOUNDATION_ROADMAP.md) é uma lente por fundamentos que precisa ser reconciliada com ele por decisão do operador (ver Q-004 no Decision Log). |
| [`../README.md`](../README.md) | Documento de produto/usuário. Não é especificação: contém afirmações desatualizadas (ex.: MCP HTTP "próxima camada", que já existe localmente). |
| [`../VERITAS_AUDIT.md`](../VERITAS_AUDIT.md) | **Histórico** (22/08/2026, `0.9.0-rc.1`). Várias lacunas que ele lista já foram fechadas (wireless integrado, JK/SR, 17 ferramentas MCP). Use-o como contexto, não como estado atual. |
| [`../issue.md`](../issue.md) | Registro de descoberta e ideias. Matéria-prima, não requisito. |
| [`../plano.md`](../plano.md), `VERITAS_V3_V5_ROADMAP.md`, `VERITAS_MASTER_BUILD_QUEUE.md` | Trajetória planejada até v5.0.0. Tudo ali é `PLANNED` até prova em contrário. |
| Documentos temáticos (`VERIFICATION.md`, `V2_FORMAT_MIGRATION.md`, `EXECUTION_WORKER_BOUNDARY.md`, …) | Especificações detalhadas de cada fatia. Esta árvore os referencia em vez de duplicá-los. |

## Regras para quem vier depois

1. Antes de mudar código, localize o modelo afetado em [`DOMAIN_MODEL.md`](./02-ARCHITECTURE/DOMAIN_MODEL.md)
   e todas as cópias da regra em [`DUPLICATIONS.md`](./02-ARCHITECTURE/DUPLICATIONS.md).
2. Uma capacidade nova só ganha `IMPLEMENTED` com código alcançável **e** teste.
3. Não resolva perguntas abertas do [`DECISION_LOG.md`](./07-DECISIONS/DECISION_LOG.md) por preferência;
   registre a decisão do operador.
4. Ao alterar o estado real, atualize o documento correspondente nesta árvore no mesmo PR.
