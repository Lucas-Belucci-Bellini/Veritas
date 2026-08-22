# Veritas Next — Auditoria do repositório

**Data da auditoria:** 22 de agosto de 2026  
**Branch auditada:** `main`  
**Commit-base:** [`eab7b65`](https://github.com/Lucas-Belucci-Bellini/Veritas/commit/eab7b65) — `feat: add wireless channel contract`  
**Versão declarada no `package.json`:** `0.9.0-rc.1`  
**Responsável pelo registro:** Manus AI

> Esta auditoria descreve o estado real encontrado no código. A existência de uma ideia no `issue.md`, no prompt mestre ou no roadmap não é tratada como evidência de implementação.

## 1. Resumo executivo

O Veritas já é uma aplicação funcional de lógica booleana e circuitos digitais, não um projeto vazio. A base atual combina uma engine TypeScript sem React, um editor visual baseado em React Flow, persistência local via Dexie/IndexedDB, autenticação e sincronização Supabase, colaboração Realtime, exportação Verilog/VHDL, workspaces de algoritmos, um servidor MCP stdio e uma biblioteca importada de chips. O README confirma o caminho de uso local-first e a disponibilidade progressiva desses módulos [1].

A arquitetura tem uma decisão correta e importante: o cálculo central fica fora do React. O parser, avaliador, tabelas verdade, minimização, modelo de circuito, simulador temporal e ferramentas MCP podem ser exercitados sem DOM. O formato do circuito é serializável, versionado como `veritas-circuit` versão 1 e usado por IndexedDB, nuvem, colaboração e exportadores [2] [3].

A principal fragilidade não é ausência de funcionalidades, mas **duplicação de contratos de validação e concentração de responsabilidades**. O modelo semântico do circuito é validado no `editorModel.ts`, rechecado de formas diferentes no importador local, nos clientes cloud/IA, no SQL do Supabase e na Edge Function. A duplicação protege fronteiras individuais, mas cria risco de divergência: uma regra adicionada em um ponto pode não ser reconhecida por outro.

O próximo passo correto não é adicionar mais um grande componente. É executar a primeira fatia de **Foundation Hardening**: consolidar um contrato runtime de documento, normalização defensiva, limites explícitos, versionamento/migração e testes de equivalência entre os consumidores. Depois dessa base, o editor poderá evoluir para comandos, portas formais, barramentos, hierarquia e novos componentes sem multiplicar inconsistências.

## 2. Escopo e método

A auditoria examinou o README, o plano executivo, o roadmap, o registro histórico de ideias, `package.json`, a estrutura de `src/`, `mcp/`, `plugins/`, `scripts/`, testes, migrations Supabase, Edge Function, histórico Git e o estado da árvore de trabalho. A estrutura encontrada contém 18 arquivos na engine, 26 no domínio de circuitos, 11 no simulador, 23 componentes React, 14 módulos Realtime, 50 scripts operacionais, 14 migrations SQL e 54 arquivos de teste.

Os números operacionais usados neste documento vêm da última validação registrada para o commit-base: **335 testes aprovados em 54 arquivos**, typecheck aprovado, lint sem warnings/erros, build frontend/PWA aprovado, build MCP aprovado e smoke PWA aprovado. Esta auditoria não transforma esses gates locais em evidência de isolamento cross-user real; RLS, Realtime e Edge Function autenticados continuam exigindo sessões descartáveis e aceitação externa conforme os documentos de beta [4] [5].

## 3. Estado do produto

| Área | Estado real | Evidência principal | Auditoria |
| --- | --- | --- | --- |
| Engine booleana | Entregue e reutilizável | `src/engine/` | Forte separação de React/DOM |
| Circuito canônico | Entregue em versão 1 | `src/circuit/editorModel.ts` | Válido para o escopo atual, ainda sem hierarquia/ports formais |
| Editor visual | Prévia funcional | `src/components/CircuitEditor.tsx` | Alto acoplamento e arquivo monolítico |
| Simulação temporal | Entregue em domínio e workspace | `src/simulation/`, `SequentialWorkspace` | Limites e checkpoints presentes |
| Multi-bit | Entregue em avaliação/tabela/HDL | `src/bus/`, `vectorEvaluation.ts` | Ainda não é um sistema completo de portas, slicing e sinais X/Z |
| Persistência local | Entregue | `src/storage/`, Dexie v1–v3 | Caminho offline preservado |
| Nuvem e histórico | Implementados | `src/cloud/`, migrations Supabase | Guards de cliente cloud são mais rasos que o import local |
| Auth Supabase | Implementada | `src/auth/`, `src/lib/supabase.ts` | Usa cliente público e sessão persistente |
| Realtime | Prévia implementada | `src/realtime/`, hooks e policies | Aceitação cross-user real ainda pendente |
| IA | Implementada com LLM/fallback | `src/ai/`, Edge Function | Autenticação explícita da função precisa ser confirmada por gate real |
| HDL | Verilog-2001/VHDL-2008 em prévia | `src/circuit/export.ts` | Só cobre subconjunto combinacional/vetorial atual |
| ALGO-001/002/003 | Implementados | `src/algorithms/`, workspaces | Executor restrito, Step/Run/Continue e breakpoints |
| MCP | 11 ferramentas em stdio | `mcp/src/tools.ts`, `server.ts` | Boa separação de domínio e transporte; HTTP remoto ainda é roadmap |
| Plugin Claude Code | Empacotado e versionado | `plugins/veritas-logic/` | Manifesto declara `0.6.2`, defasado em relação ao pacote |
| Release gates | Ampla infraestrutura | `scripts/`, `.github/workflows/` | Não equivale a beta aprovado enquanto faltam provas reais |
| Canais wireless | Contrato de domínio somente | `src/circuit/wirelessChannels.ts` | Não integrado ao documento/editor/engine |

## 4. Arquitetura

### 4.1 Pontos fortes

A engine booleana exporta funções puras por `src/engine/index.ts`. O lexer transforma texto em tokens com posições; o parser descendente aplica precedência e associatividade; o avaliador resolve ASTs e pode registrar valores intermediários. O mesmo núcleo alimenta a tabela verdade, simplificação, formas normais, mapa de Karnaugh, materiais didáticos e MCP [6] [7].

O domínio de circuito também possui uma fronteira razoável. `CircuitDocument` é independente do React Flow; `validateCircuit()` trata IDs, tipos, larguras, portas, entradas faltantes e ciclos; `toNetlist()` transforma o documento em componentes do simulador. O editor serializa seu estado visual para esse modelo em vez de persistir diretamente objetos da biblioteca de canvas [8].

A aplicação principal usa `lazy()` para CircuitView, CircuitEditor, workspaces, projetos e biblioteca de chips. `WorkspaceLoading` e `WorkspaceBoundary` tratam carregamento e falha de chunks sem derrubar a calculadora principal. Essa estratégia reduz o risco de o catálogo ou um workspace pesado bloquear o caminho básico [9].

O servidor MCP separa semântica e transporte. `mcp/src/tools.ts` reutiliza a engine, o simulador e os algoritmos; `mcp/src/server.ts` cuida de Zod, registro de ferramentas e stdio. Essa fronteira permite testar ferramentas sem iniciar processo MCP e é uma boa base para um transporte HTTP autenticado futuro [10] [11].

### 4.2 Pontos fracos e acoplamentos

`src/components/CircuitEditor.tsx` possui **1.377 linhas** e concentra estado React, adaptação React Flow, criação de nós, serialização, colaboração, persistência, histórico, runtime temporal, métricas, IA, feedback e renderização. O arquivo funciona, mas é o maior hotspot de manutenção. A próxima evolução deve extrair adaptadores puros e hooks por responsabilidade antes de adicionar mais categorias de componentes.

A lógica de ordenação topológica é repetida nas avaliações escalar e vetorial de `src/circuit/evaluate.ts`. A repetição torna possível que limites, ordenação ou mensagens de erro evoluam de modo diferente entre os dois caminhos. Um helper comum de normalização/ordenação deve ser introduzido com testes de equivalência.

A validação estrutural aparece em múltiplas fronteiras: `editorModel.ts`, importação local, clientes `cloud`, cliente de IA, Edge Function e migrations SQL. Essa defesa em profundidade é necessária, mas hoje não existe um contrato compartilhado de runtime para todas as fronteiras. A consequência observável é que o import local executa `validateCircuit`, enquanto alguns guards cloud/IA aceitam qualquer `type` string e não validam toda a semântica antes de converter o payload.

Há também contratos de versão duplicados. O pacote declara `0.9.0-rc.1`; o servidor MCP fixa `0.9.0-rc.1`; o manifesto do plugin ainda declara `0.6.2`; documentos e mensagens carregam referências de versões anteriores. Isso não quebra o cálculo local, mas pode produzir artefatos distribuídos com identidade de versão incorreta.

### 4.3 Dependências de risco

| Dependência/superfície | Função | Risco operacional | Controle existente |
| --- | --- | --- | --- |
| React Flow + Dagre | Canvas e layout | Bundle grande e acoplamento visual | Lazy loading e smoke PWA |
| Dexie/IndexedDB | Persistência local | Quota, modo privado e corrupção | Fallback `storageAvailable()` e testes fake IndexedDB |
| Supabase Auth/Realtime | Sessão, cloud e colaboração | Rede, JWT, policies e conflitos | Sessão explícita, RLS, rooms e conflito por versão |
| Supabase SQL | Validação e autorização server-side | Drift entre SQL e TypeScript | Migrations versionadas e auditoria estrutural |
| Provedor LLM | Análise/otimização | Respostas inválidas, indisponibilidade e prompt não confiável | Schema JSON, truncamento, fallback heurístico e métricas best-effort |
| MCP SDK | Interoperabilidade | Divergência de schemas/hosts | Ferramentas puras, Zod e testes de protocolo |
| Vite PWA/Workbox | Instalação/offline | Cache obsoleto ou chunk ausente | `PwaStatus`, reload explícito, smoke e `WorkspaceBoundary` |

## 5. Engine e modelo de circuito

### 5.1 Parser, avaliador e análise

O lexer aceita notações textual, matemática, programação e engenharia, com variáveis de uma letra opcionalmente acompanhada de dígitos. O parser possui mensagens posicionais para parênteses, operandos ausentes, operadores consecutivos, caracteres desconhecidos e justaposição. A AST alimenta avaliação booleana, passos intermediários, tabela verdade, classificação, minimização, SOP/POS e Karnaugh.

A engine principal é uma das partes mais maduras do projeto: não depende de React, não executa código dinâmico e possui regressões didáticas. O risco atual está mais nos limites e na multiplicação de adaptadores do que na semântica booleana central.

### 5.2 Circuito canônico e validação

O formato atual é:

```ts
interface CircuitDocument {
  format: 'veritas-circuit'
  version: 1
  name: string
  nodes: CircuitNode[]
  connections: CircuitConnection[]
}
```

O modelo cobre `input`, `output`, `constant`, `and`, `or`, `not`, `xor`, `clock`, `dff`, `tff` e `delay`. A simulação interna também conhece `nand`, `nor` e `xnor`, mas eles não fazem parte do conjunto `EditorComponentType` atual. Essa diferença entre o catálogo de componentes simuláveis e a paleta/modelo visual deve ser resolvida explicitamente, não por inclusão parcial.

`validateCircuit()` detecta IDs vazios/duplicados, tipos inválidos, larguras inválidas ou incompatíveis, portas inexistentes, entradas duplicadas, entradas faltantes, auto-conexões e ciclos combinacionais. Feedback acionável em português é produzido por `validationFeedback.ts`. A detecção de ciclos usa DFS com conjuntos de visita e permite feedback através de componentes sequenciais.

Faltam ao modelo canônico, em comparação com o prompt mestre, subcircuitos, portas formais com identidade/direção/capacidade, domínios de clock, parâmetros tipados, anotações, componentes customizados e um modelo declarativo de comandos/eventos. Essas ausências não são defeitos da versão atual por si só; são lacunas de evolução que exigem schema versioning e migração antes de serem adicionadas.

### 5.3 Simulação

`Simulator` é puro e executa cada tique em duas fases: cálculo de próximos valores e publicação simultânea. Isso permite feedback sequencial sem laço síncrono no navegador. O simulador possui `tick`, `settle`, `reset`, `snapshot`, `exportState` e `restoreState`, com `DEFAULT_MAX_SETTLE_TICKS = 200`. O MCP ainda impõe `MAX_SIMULATION_TICKS = 1000` por chamada.

A fronteira temporal é boa, mas a avaliação combinacional escalar e vetorial mantém implementações paralelas de topological sort. O próximo hardening deve extrair a ordenação e normalização comuns. Também é necessário definir, antes de ampliar componentes, se o futuro sinal digital suportará apenas `boolean`/`BitVector` ou estados `X` e `Z`.

## 6. Interface e workspaces

`App.tsx` compõe a calculadora, tabela verdade, circuito equivalente, formas normais, mapa de Karnaugh, onboarding, autenticação, editor visual, projetos, biblioteca de chips, ALGO-002 e workspace sequencial. O fluxo básico funciona sem conta: expressão, cálculo, análise e armazenamento local não dependem do Supabase.

Há bons controles de UX e acessibilidade: skip link, mensagens `role="status"`/`aria-live`, `WorkspaceBoundary`, fallback de carregamento, tooltips e mensagens de conflito. O editor suporta criação/remoção de componentes, conexões, seleção de linhas, largura de barramento, histórico local, sincronização cloud, colaboração, runtime temporal e análise de IA.

O ponto de atenção é que o editor visual é uma grande unidade de orquestração. As regras de domínio não devem continuar crescendo dentro dele. A divisão recomendada é: adaptador React Flow puro, hook de documento, hook de colaboração, hook de runtime e painéis independentes; a criação de comandos deve acontecer antes de suporte a edição colaborativa de maior escala.

Os workspaces ALGO-001/002/003 estão separados do circuito combinacional. O executor usa `ExecutionState`, parser restrito, limites de passos, entradas enfileiradas, Watch, BranchTrace, While e breakpoints. Essa separação está alinhada com o princípio de não misturar algoritmo/fluxograma ao netlist.

## 7. Storage e serialização

### 7.1 IndexedDB e `.veritas`

Dexie mantém três stores versionadas: `projects` na versão 1, `circuitProjects` na versão 2 e `algorithmProjects` na versão 3. O documento inteiro fica armazenado dentro do registro do projeto, sem schema por nó no banco. Isso mantém migrações simples e preserva o caminho offline.

O arquivo de exportação local usa `format: 'veritas-circuits'` e versão 1. O importador rejeita JSON inválido, formato desconhecido, versão futura, coleções vazias, nós malformados, larguras inválidas e circuitos que falham em `validateCircuit()`. Este é o caminho de ingestão mais rigoroso do frontend.

A lacuna é a ausência de uma camada formal de migração de `CircuitDocument` além da rejeição de versões futuras. Antes de adicionar campos obrigatórios, subcircuitos ou portas formais, deverá existir `migrateCircuitDocument()` com testes de documentos v1, rejeição segura e preservação de dados desconhecidos quando aplicável.

### 7.2 Supabase e histórico

O cliente cloud exige sessão autenticada para salvar, calcula `content_hash` via `buildCircuitContext()` e usa tabelas próprias para projetos, versões, colaboradores, rooms e métricas. O histórico usa RPC com `p_base_version` e converte conflito otimista em `CloudVersionConflictError`.

A migration server-side de 21 de agosto replica as invariantes centrais no PostgreSQL e a RPC `veritas_sync_circuit_project` verifica `auth.uid()`, versão-base e validação do documento antes de persistir. A migration de autorização move helpers para `private`, mantém as RPCs públicas como `SECURITY INVOKER` e reata policies por projeto, papel e tópico Realtime [12] [13].

Há, entretanto, uma diferença de profundidade entre o cliente cloud e o importador local: os guards em `src/cloud/circuitProjects.ts` e `circuitVersions.ts` verificam principalmente forma, IDs, posições e conexões, sem reexecutar toda a validação semântica. O banco é a última barreira correta, mas o cliente deveria rejeitar cedo para evitar carregar documentos remotos que a UI não consegue usar.

## 8. IA, MCP e plugins

### 8.1 IA e Edge Function

`requestCircuitAi()` monta o contexto determinístico do circuito, limita a instrução a 1.200 caracteres, invoca `veritas-circuit-ai` e registra apenas métricas resumidas de latência, sucesso, provedor, confiança, hash e erro genérico. Falhas de telemetria são best-effort.

A Edge Function aceita somente `POST`, limita o contexto a 200 kB, restringe ações a `analyze`/`optimize`, solicita JSON estruturado ao provedor e usa fallback heurístico quando o provedor não está configurado ou falha. O fallback identifica nós inalcançáveis a partir das saídas. A otimização não é aplicada silenciosamente pelo cliente.

O risco prioritário é de fronteira de confiança. O código da função valida método e payload, mas não mostra uma verificação explícita de JWT/sessão antes de processar a requisição; a proteção pode estar na configuração da plataforma, mas precisa ser comprovada pelos cenários autenticados e anônimos de `beta:edge`. Além disso, os guards de resposta do cliente são estruturais; qualquer documento otimizado deve passar pelo validador semântico antes de ser aplicado ou persistido.

### 8.2 MCP

O servidor expõe 11 ferramentas read-only/determinísticas: tabela verdade, avaliação, simplificação, formas normais, mapa de Karnaugh, caso lógico, tabela proposicional, debug de algoritmo, simulação de circuito e consulta de chips. O limite de catálogo, linhas e tiques evita respostas sem controle de tamanho.

A separação `tools.ts`/`server.ts` é adequada para Claude Code, Codex CLI, Claude Desktop e outros hosts que iniciem um processo stdio. O próprio README informa que clientes remotos como Claude API e ChatGPT web exigirão transporte Streamable HTTP HTTPS autenticado; o transporte remoto ainda não existe no código atual [10]. Não se deve prometer o mesmo arquivo de configuração para OpenClaw, Hermes, Antigravity, Manus ou outros hosts sem verificar a documentação de cada cliente.

### 8.3 Plugin

O plugin Claude Code inclui manifesto, `.mcp.json`, skill e servidor empacotado. A distribuição local é um bom caminho de interoperabilidade porque o cliente recebe o servidor sem precisar compilar o projeto. Contudo, `plugins/veritas-logic/.claude-plugin/plugin.json` declara `0.6.2`, enquanto o pacote e o servidor estão em `0.9.0-rc.1`. A sincronização de versão do plugin deve ser incluída no próximo release hardening.

## 9. Testes e gates

A suíte atual possui 54 arquivos de teste cobrindo engine, materiais didáticos, circuito, tabela escalar/vetorial, exportação, histórico, conflitos, barramentos, simulador, workspaces, IndexedDB, cloud com mocks, métricas, Realtime, release contracts e ferramentas MCP. A última execução registrada aprovou 335 testes.

Os scripts incluem preflight de evidências, gates HDL, acessibilidade, mobile manual, rollback, onboarding, MCP, readiness, release guard e agregação de evidências. O workflow de release também valida SemVer, versão declarada, origem da tag, testes, typecheck, lint, build, build MCP e smoke PWA antes de criar uma release.

| Cobertura | Estado |
| --- | --- |
| Regras puras de engine e circuito | Forte, com regressões determinísticas |
| Persistência local | Boa, incluindo fake IndexedDB e reabertura |
| Cloud/Reatime com mocks | Presente |
| RLS com duas ou mais contas reais | Pendente |
| Realtime cross-user real | Pendente |
| Edge Function com JWT real | Pendente/precisa ser exercitado |
| Mobile manual | Pendente sem checklist humano |
| E2E real no navegador | Não identificado como suíte automatizada principal |
| Threshold de cobertura | Não há script/threshold de coverage no `package.json` |
| Compilação HDL externa | Gate contratual presente; compiladores externos ainda dependem do ambiente |
| Interoperabilidade por host MCP | Testes de domínio/protocolo presentes; validação de cada host ainda separada |

A maior lacuna de evidência é operacional, não unitária: os testes locais não provam isolamento entre usuários Supabase, autorização de Edge Function ou comportamento de duas sessões Realtime. O beta deve continuar bloqueado enquanto RLS-001 a RLS-022, RT-001 a RT-005 e os cenários de Edge não tiverem evidência real e não simulada [4] [5].

## 10. Performance

O build recente produziu chunk inicial de aproximadamente **457 kB**, abaixo do limite operacional de 500 kB definido no histórico do projeto, com CircuitEditor, CircuitView, workspaces e catálogo em chunks separados. O `WorkspaceBoundary` reduz o impacto de falha de carregamento de um chunk, mas não substitui monitoramento de tamanho por release.

A tabela verdade escalar possui teto de variáveis/linhas e a vetorial limita o total a 12 bits. O simulador possui teto de settle e o MCP possui teto de 1.000 tiques. Esses limites são controles corretos contra explosão combinatória e loops acidentais.

Os riscos restantes são a proximidade do chunk inicial ao limite, o custo de React Flow/Dagre quando o editor é aberto, a renderização de tabelas com muitas colunas intermediárias e a duplicação de ordenação scalar/vector. Cada build deve preservar um orçamento explícito de bundle; a próxima camada de análise deve medir tempo de parse, avaliação, montagem do canvas e carregamento dos chunks em circuitos pequenos, médios e grandes.

## 11. Segurança e privacidade

O frontend usa somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; não há service key no código de cliente. O AuthProvider degrada sem Supabase, restaura sessão quando configurado e oferece login, cadastro e logout. O local-first não exige conta para calcular, estudar ou salvar localmente.

As migrations de autorização ativam uma superfície de helpers privados, fixam `search_path`, restringem grants e usam `auth.uid()` em policies de projetos, colaboradores, versões, rooms e mensagens Realtime. A RPC de sincronização é `SECURITY INVOKER` e a validação server-side antecede a persistência. Essas são boas medidas estruturais, mas não substituem testes cross-user.

Os riscos prioritários são:

| Prioridade | Risco | Impacto | Controle necessário |
| --- | --- | --- | --- |
| P0 de promoção | Evidência RLS/Realtime/Edge real ausente | Exposição ou falsa confiança em isolamento | Executar matriz com contas descartáveis e anexar evidências reais |
| P1 técnico | Guards cloud/IA mais rasos que o validador | Documento remoto inválido alcança a UI | Reutilizar contrato runtime semântico e validar antes de aplicar |
| P1 técnico | JWT da Edge Function não explícito no handler | Endpoint pode processar chamada anônima se configuração divergir | Testes anônimo/autenticado e verificação de configuração de função |
| P1 técnico | Drift entre TypeScript e SQL | Diferentes camadas aceitam documentos diferentes | Vetores compartilhados e contrato de invariantes versionado |
| P1 de distribuição | Plugin em `0.6.2` contra pacote `0.9.0-rc.1` | Cliente instala artefato com identidade errada | Gerar/validar versão a partir de uma fonte única |
| P2 de manutenção | CircuitEditor monolítico | Alterações aumentam regressão e dificultam revisão | Extrair adaptadores, hooks e comandos |
| P2 de produto | Sinais X/Z, hierarquia e portas formais ausentes | Limita a evolução para laboratório completo | Planejar schema v2 antes de adicionar comportamento |

## 12. Matriz de lacunas inicial

| Capacidade do prompt mestre | Estado atual | Gap | Prioridade | Dependências |
| --- | --- | --- | --- | --- |
| Modelo canônico | `CircuitDocument` v1 existe | Faltam portas formais, subcircuitos, parâmetros e metadados ricos | P0 | Contrato runtime e migração |
| Schema versioning | Campo `version: 1` existe | Falta pipeline de migração explícito | P0 | Testes de v1 e v2 |
| Validator | Validador robusto no frontend e SQL | Guards duplicados e parcialmente rasos | P0 | Contrato compartilhado |
| Normalizer | Há normalizações locais de nomes/widths | Não há normalizador único do documento | P0 | Modelo canônico |
| IDs | IDs estáveis nos nós | Limites e política de normalização ainda dispersos | P0 | Validator/normalizer |
| Erros | Erros ricos na engine e feedback do circuito | Códigos não unificados entre TypeScript, SQL e Edge | P1 | Catálogo de erros |
| Limits | Limites em tabela, simulator, MCP e payloads | Falta um orçamento central de documento | P1 | Contrato de limites |
| Command model | Undo/redo por snapshots | Não há comandos declarativos | P1 | Editor adapter |
| Event model | Realtime envelopes e runtime events | Não há event log canônico de edição | P1 | Command model e conflitos |
| Serialization | `.veritas` v1 e IndexedDB | Migração formal e compatibilidade futura | P0 | Schema versioning |
| Multi-bit | BitVector, avaliação, tabela e HDL | Sem splitter/merger visual completo e sem X/Z | P1 | Port system |
| Sequential | Simulator, workspace e runtime do canvas | Cobertura temporal externa ainda limitada | P1 | Testes reais Realtime |
| Hierarchy/custom chips | Catálogo importado | Não há subcircuitos editáveis | P2 | Schema v2 e portas formais |
| Verification | Truth tables, checks e release contracts | Falta verificação diferencial ampla entre camadas | P1 | Golden vectors |
| HDL | Verilog/VHDL atuais | Subconjunto e ausência de componentes futuros | P1 | Port model e validator |
| AI | Análise/otimização com fallback | Autenticação explícita e validação semântica de saída a reforçar | P1 | Edge acceptance |
| Collaboration | Rooms, roles, Presence/Broadcast, conflitos | Prova cross-user ainda pendente | P0 de beta | Contas descartáveis |
| MCP remoto | Stdio completo | Streamable HTTP autenticado não implementado | P2 | Auth/Origin/session model |

## 13. Decisão de próximo incremento

A próxima etapa de código deve ser **FOUNDATION-001 — contrato canônico de documento e normalização defensiva**, não a expansão imediata para wireless, hierarquia ou dezenas de novos componentes.

### Objetivo

Garantir que todos os consumidores reconheçam o mesmo `CircuitDocument` válido antes de salvar, transmitir, avaliar, otimizar ou exportar.

### Entregas propostas

1. Criar um módulo puro de contrato/runtime guard para `CircuitDocument`, nós, opções, conexões, limites e versão.
2. Criar normalização explícita e imutável para IDs, labels, widths e conexões, sem aceitar silenciosamente referências inválidas.
3. Fazer import local, cloud, cliente de IA e Edge Function consumir as mesmas invariantes possíveis; manter a réplica SQL documentada e coberta pelos mesmos vetores.
4. Extrair o topo sort comum da avaliação escalar/vetorial e adicionar teste de equivalência de ordem e de ciclo.
5. Definir limites centrais para quantidade de nós, conexões, tamanho de nome/label e tamanho serializado, com mensagens em português.
6. Definir uma política de migração de documento v1 e rejeição segura de versões futuras.
7. Corrigir o drift de versão do plugin e incluir `build:plugin`/`validate:plugin` nos gates de distribuição.

### Critérios de saída

A etapa só deverá ser considerada pronta quando o mesmo conjunto de casos válidos e inválidos passar por import local, cloud mock, cliente de IA, Edge contract, `toNetlist`, avaliação escalar/vetorial e exportadores; quando documentos v1 continuarem abrindo; quando versões futuras forem rejeitadas sem mutar o estado; quando os limites forem testados; e quando testes, typecheck, lint, build frontend, build MCP, build/validação do plugin e smoke PWA passarem.

### Fora desta etapa

Não adicionar ainda subcircuitos, HTTP remoto do MCP, novos tipos de memória, sinais analógicos, X/Z, colaboração CRDT ou uma reescrita do `CircuitEditor`. O contrato wireless já criado permanece como fundação isolada até que `transmitter`/`receiver` possam atravessar domínio, validação, engine, UI, persistência e HDL de forma completa.

## 14. Checklist da auditoria

| Item exigido | Resultado |
| --- | --- |
| Arquitetura existente | Registrada |
| Pontos fortes | Registrados |
| Pontos fracos | Registrados |
| Lógica duplicada | Identificada |
| Dependências de risco | Identificadas |
| Parser/evaluator/simulation/circuit model | Auditados |
| Editor/workspaces/state | Auditados |
| IndexedDB/`.veritas`/Supabase | Auditados |
| MCP/plugin/Edge Function | Auditados |
| Cobertura atual e testes faltantes | Registrados |
| Gargalos óbvios | Registrados |
| Import/IA/network security | Registrados |
| Lacunas por prioridade | Registradas |
| Próximo incremento | Definido como FOUNDATION-001 |

## Referências

[1]: ./README.md "README do Veritas"
[2]: ./docs/ROADMAP.md "Roadmap executável do Veritas"
[3]: ./plano.md "Plano executivo do Veritas"
[4]: ./docs/BETA-RLS-ACCEPTANCE.md "Matriz de aceitação RLS"
[5]: ./docs/BETA-REALTIME-ACCEPTANCE.md "Aceitação Realtime"
[6]: ./src/engine/index.ts "Barrel da engine booleana"
[7]: ./src/engine/parser.ts "Parser e precedência"
[8]: ./src/circuit/editorModel.ts "Modelo, validação e netlist do circuito"
[9]: ./src/App.tsx "Composição da aplicação e boundaries"
[10]: ./mcp/README.md "Documentação do servidor MCP"
[11]: ./mcp/src/server.ts "Servidor MCP e schemas"
[12]: ./supabase/migrations/20260821033000_harden_veritas_authorization_surface.sql "Hardening da autorização Supabase"
[13]: ./supabase/migrations/20260821043000_validate_circuit_document_server_side.sql "Validação server-side do documento"
