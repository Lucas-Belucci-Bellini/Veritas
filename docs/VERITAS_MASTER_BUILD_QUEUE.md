# VERITAS — FILA MESTRE DE CONSTRUÇÃO ATÉ v5.0.0

## REPOSITÓRIO

`https://github.com/Lucas-Belucci-Bellini/Veritas`

Branch de referência:

`main`

---

# MISSÃO

Levar o Veritas do estado atual até uma possível `v5.0.0`, transformando-o progressivamente de uma ferramenta de lógica digital em uma **Digital Logic Platform** madura, modular, verificável, extensível, reproduzível e distribuível.

A V5 não deve ser tratada como uma simples coleção de funcionalidades.

A meta é chegar a uma plataforma em que:

```text
Editor
   ↓
Circuit Model
   ↓
Simulator
   ↓
Verification
   ↓
HDL
   ↓
Plugins
   ↓
AI
   ↓
Project Packages
   ↓
Desktop / Web / PWA
   ↓
Distribution
```

possam evoluir sem criar acoplamento destrutivo.

---

# REGRA ABSOLUTA PARA TODAS AS FASES

Antes de qualquer alteração:

1. Ler `README.md`.
2. Ler `docs/ROADMAP.md`.
3. Ler `docs/VERITAS_V3_V5_ROADMAP.md`.
4. Ler `issue.md`.
5. Ler documentação específica do domínio.
6. Verificar o HEAD atual da `main`.
7. Verificar commits recentes.
8. Verificar estado do CI.
9. Verificar testes existentes.
10. Verificar se o objetivo da fase já foi parcialmente implementado.

Nunca assumir que o documento está mais atualizado que o código.

---

# DEFINIÇÃO UNIVERSAL DE FASE CONCLUÍDA

Uma fase só termina quando possui:

```text
CÓDIGO
+
TESTE
+
INTEGRAÇÃO
+
DOCUMENTAÇÃO
+
VALIDAÇÃO
+
REGRESSÃO
+
COMMIT
+
TAG/MARCO
```

Código sem teste não é concluído.

Teste sem integração não é concluído.

Instalador sem runtime real não é plataforma validada.

CI verde sem validação funcional não significa release.

---

# REGRAS DE ARQUITETURA

Nunca:

* relaxar `strict`;
* mascarar erros;
* remover testes para obter verde;
* usar `eval` ou `Function` para executar lógica recebida;
* permitir mutação silenciosa por IA;
* executar código arbitrário importado;
* confiar em estado editável pelo cliente como autoridade;
* criar segunda engine paralela;
* duplicar lógica existente sem necessidade;
* criar dependência circular entre módulos;
* quebrar compatibilidade silenciosamente.

Sempre:

* reutilizar a engine canônica;
* preservar local-first;
* preservar offline-first;
* preservar privacy-first;
* manter operações determinísticas;
* aplicar budgets;
* validar entradas;
* usar fail-closed;
* versionar formatos;
* registrar decisões;
* permitir rollback.

---

# FASE 01 — v2.6.0

# VERIFICATION NO PRODUTO

## Objetivo

Transformar os diagnósticos atuais do simulator em um fluxo oficial de verificação.

O Veritas já possui testbench e diagnóstico bounded, e os commits recentes estão justamente endurecendo esse domínio.

Agora integrar isso ao fluxo real.

Implementar:

* `PASS`;
* `FAIL`;
* `INVALID`;
* `cycle-detected`;
* `budget-exhausted`;
* snapshots;
* contraexemplos;
* tick;
* sinal divergente;
* motivo de invalidação.

O relatório deve ser determinístico e serializável.

Cobrir:

* combinacional;
* sequencial;
* feedback;
* flip-flops;
* counters;
* chips customizados;
* multi-bit.

Criar fixtures de regressão.

Criar teste de integração completo:

```text
project
→ testbench
→ simulator
→ diagnostic
→ result
```

O resultado não pode depender da UI.

Atualizar documentação.

Preparar release `v2.6.0`.

---

# FASE 02 — v2.7.0

# EXECUTION SAFETY

## Objetivo

Garantir que nenhum circuito, documento ou chip consiga congelar ou consumir recursos indefinidamente.

Implementar e validar:

* classificação estática de ciclos;
* distinção entre ciclo combinacional e feedback temporal;
* budget de operações;
* budget por tick;
* budget total;
* limites de memória;
* limite de documento;
* cancelamento;
* shutdown idempotente;
* timeouts;
* cleanup.

Validar:

```text
document inválido
→ rejeição antes da execução
```

e:

```text
execução excedeu budget
→ parada segura
→ diagnóstico determinístico
```

Criar testes adversariais.

Provar que:

* UI não congela;
* worker termina;
* MCP termina;
* desktop termina;
* runtime não fica preso.

Publicar `v2.7.0`.

---

# FASE 03 — v2.8.0

# PROJECT FORMAT & MIGRATIONS

## Objetivo

Transformar `.veritas`, testbenches, chips e projetos em formatos realmente versionados.

Auditar todos os formatos.

Definir:

```text
format
version
schema
migration
compatibility
```

Implementar:

* migração determinística;
* rejeição de versão futura;
* rejeição de conteúdo inválido;
* recuperação;
* round-trip;
* fixtures antigas;
* fixtures inválidas.

Testar:

```text
Web
↔
PWA
↔
Desktop
```

com os mesmos arquivos.

Garantir que nenhum update destrua projetos antigos.

Criar recovery guide.

Publicar `v2.8.0`.

---

# FASE 04 — v2.9.0

# PRE-3.0 HARDENING

## Objetivo

Preparar a entrada da arquitetura modular.

Inventariar:

* APIs;
* dependências;
* módulos;
* storage;
* engine;
* simulator;
* verification;
* AI;
* HDL;
* MCP;
* desktop.

Encontrar:

* dependências circulares;
* APIs acopladas à UI;
* imports indevidos;
* duplicação;
* contratos implícitos;
* funções sem testes;
* dependências sem dono.

Criar:

* API inventory;
* dependency graph;
* public/private boundary;
* deprecation policy;
* compatibility policy;
* telemetry opt-in.

Executar auditoria completa.

Produzir decisão formal de entrada em 3.0.

Não avançar para `3.0.0` enquanto houver P0/P1 conhecido na superfície crítica.

---

# FASE 05 — v3.0.0

# CORE MODULAR

## Objetivo

Transformar o Veritas em uma arquitetura modular verificável.

Separar claramente:

```text
Core
Engine
Circuit
Simulator
Storage
Renderer
HDL
Verification
AI
Plugins
Desktop
```

Cada domínio deve possuir fronteira clara.

Definir dependências direcionais.

Exemplo:

```text
UI
 ↓
Application
 ↓
Domain
 ↓
Engine
```

e nunca:

```text
Engine → React
Engine → DOM
Domain → UI
```

Criar testes de boundary.

Criar arquitetura documentada.

Provar que um módulo pode ser alterado sem quebrar outros.

Publicar `v3.0.0`.

---

# FASE 06 — v3.1.0

# PLUGIN CONTRACTS

## Objetivo

Criar o sistema oficial de plugins.

Definir:

* plugin manifest;
* id;
* version;
* compatibility;
* capabilities;
* dependencies;
* lifecycle;
* assets;
* APIs.

Criar:

```text
discover
validate
register
load
use
disable
remove
```

Um plugin inválido deve ser recusado.

Um plugin incompatível não pode corromper o projeto.

Criar pelo menos dois plugins de exemplo.

Publicar `v3.1.0`.

---

# FASE 07 — v3.2.0

# SECURE PLUGINS

## Objetivo

Transformar plugins em extensões realmente seguras.

Definir capabilities:

```text
READ_PROJECT
WRITE_PROJECT
READ_FILES
NETWORK
AI
HDL
STORAGE
```

Cada plugin declara o necessário.

O runtime verifica.

Implementar:

* permission boundary;
* sandbox ou fronteira equivalente;
* CPU budget;
* memory budget;
* cancellation;
* asset validation;
* import validation.

Nunca permitir execução arbitrária silenciosa.

Criar testes de abuso.

Publicar `v3.2.0`.

---

# FASE 08 — v3.3.0

# PROFESSIONAL WORKSPACE

## Objetivo

Transformar o editor em um workspace profissional.

Criar:

* abas;
* project explorer;
* hierarchy;
* component browser;
* inspector;
* command palette;
* waveform panel;
* verification panel;
* layout persistente;
* workspaces.

O workspace precisa suportar projetos médios e grandes.

Medir performance.

Nenhuma operação comum deve causar perda silenciosa de estado.

Publicar `v3.3.0`.

---

# FASE 09 — v3.4.0

# EDUCATION + ACCESSIBILITY

## Objetivo

Transformar o Veritas em uma ferramenta também adequada para estudo.

Criar:

* tutoriais;
* exemplos;
* guided flows;
* explicações de erro;
* keyboard navigation;
* focus management;
* accessible labels;
* screen-reader semantics;
* high contrast quando necessário;
* fluxos principais sem login.

Nenhuma operação pedagógica deve depender de conhecimento interno do sistema.

Publicar `v3.4.0`.

---

# FASE 10 — v3.5.0

# COLLABORATION OPT-IN

## Objetivo

Criar colaboração sem destruir o princípio local-first.

Implementar:

* sessões;
* presença;
* papéis;
* convites;
* recuperação;
* conflitos explícitos;
* sincronização opt-in.

Nunca usar LWW silencioso para destruir mudanças concorrentes.

O modo offline deve continuar completo.

Testar:

```text
offline
→ edit
→ reconnect
→ conflict
→ resolve
```

Publicar `v3.5.0`.

---

# FASE 11 — v3.6.0

# AI CONTROLLED

## Objetivo

Criar a camada oficial de IA do Veritas.

A IA deve funcionar como:

```text
Prompt
→ Intent
→ Proposal
→ Validation
→ Diff
→ Preview
→ Confirmation
→ Apply
→ Audit
```

Nunca:

```text
Prompt
→ mutate database
```

Implementar:

* intenção declarativa;
* diff;
* preview;
* validação;
* confirmação;
* rollback;
* logs;
* budget;
* fallback local.

Integrar com MCP.

A IA deve poder:

* explicar;
* diagnosticar;
* sugerir;
* propor alterações.

Sem confirmação, não altera o projeto.

Publicar `v3.6.0`.

---

# FASE 12 — v3.7.0

# HDL INTEROPERABILITY

## Objetivo

Transformar Verilog/VHDL em interoperabilidade formal.

Implementar:

* importação contratada;
* validação;
* golden files;
* divergência explícita;
* round-trip quando suportado;
* diagnóstico de incompatibilidade.

O sistema deve explicar quando não consegue representar algo.

Nunca converter silenciosamente para outra coisa.

Publicar `v3.7.0`.

---

# FASE 13 — v3.8.0

# SCALE

## Objetivo

Preparar o Veritas para circuitos maiores.

Implementar:

* renderização incremental;
* netlist compacta;
* atualização parcial;
* benchmarks;
* memory budgets;
* document limits;
* startup benchmark.

Medir:

```text
100 nodes
500 nodes
1k nodes
5k nodes
10k nodes
```

ou os limites tecnicamente suportados.

Publicar números reais.

Circuitos acima do limite devem falhar cedo.

Nunca travar a aplicação.

Publicar `v3.8.0`.

---

# FASE 14 — v3.9.0

# MAINTENANCE RELIABILITY

## Objetivo

Preparar entrada na plataforma 4.x.

Criar:

* deprecations;
* compatibility;
* migration tooling;
* recovery;
* incident matrix;
* dependency inventory;
* observability opt-in.

Criar um processo formal para mudanças quebradoras.

Executar regressão completa.

Produzir decisão de entrada em 4.0.

Publicar `v3.9.0`.

---

# FASE 15 — v4.0.0

# EXTENSIBLE PLATFORM

## Objetivo

Consolidar:

```text
Core
+
Plugins
+
Projects
+
Verification
+
Runtime
+
Distribution
```

Criar contratos sólidos para extensibilidade.

Projetos e plugins devem evoluir sem acoplamento circular.

Implementar pipeline de verification.

Publicar `v4.0.0`.

---

# FASE 16 — v4.1.0

# PROJECT PACKAGES

## Objetivo

Transformar projeto Veritas em pacote transportável.

Um pacote deve poder conter:

* circuitos;
* testbenches;
* chips;
* assets;
* configurações;
* dependências;
* metadata;
* lockfile.

Validar antes de abrir.

Criar conflito de dependência explícito.

Criar import/export verificável.

Publicar `v4.1.0`.

---

# FASE 17 — v4.2.0

# OPTIONAL SYNCHRONIZATION

## Objetivo

Adicionar sincronização opcional sem contaminar o local-first.

Implementar:

* replication;
* cache;
* reconciliation;
* conflict UI;
* privacy controls;
* opt-in network.

Sem internet:

Veritas continua plenamente utilizável.

Publicar `v4.2.0`.

---

# FASE 18 — v4.3.0

# REPRODUCIBILITY

## Objetivo

Tornar um resultado reproduzível.

Registrar:

* projeto;
* versão;
* engine;
* simulator;
* configuration;
* fixtures;
* hashes;
* build metadata.

Criar relatório de provenance.

Dois ambientes suportados devem conseguir reproduzir o mesmo resultado.

Publicar `v4.3.0`.

---

# FASE 19 — v4.4.0

# BOUNDED AUTOMATION

## Objetivo

Criar automação controlada.

Implementar:

* jobs;
* queues;
* cancellation;
* retry;
* budget;
* status;
* logs.

Nunca permitir automação destrutiva implícita.

Criar:

```text
queued
running
cancelled
failed
completed
```

Publicar `v4.4.0`.

---

# FASE 20 — v4.5.0

# MULTI-TARGET RUNTIME

## Objetivo

Estabelecer paridade real entre:

```text
Web
PWA
Desktop
```

e somente introduzir:

```text
WASM / Rust
```

quando houver evidência técnica de necessidade.

Criar golden tests compartilhados.

Validar:

* serialization;
* simulator;
* projects;
* verification;
* imports;
* exports.

Diferenças devem ser classificadas explicitamente.

Publicar `v4.5.0`.

---

# FASE 21 — v4.6.0

# OPTIONAL SERVICES

## Objetivo

Criar integração remota sem transformar a nuvem em requisito.

Implementar:

* auth;
* RLS;
* remote services;
* sync;
* migration.

Tudo remoto deve ser:

* opt-in;
* auditável;
* removível;
* documentado.

Nenhum dado deve escapar silenciosamente do local.

Publicar `v4.6.0`.

---

# FASE 22 — v4.7.0

# ECOSYSTEM

## Objetivo

Criar o ecossistema oficial.

Entregar:

* plugin catalog;
* examples;
* API docs;
* tutorials;
* migration docs;
* extension guide;
* component docs.

Um terceiro deve conseguir criar uma extensão sem conhecer internals.

Publicar `v4.7.0`.

---

# FASE 23 — v4.8.0

# DISTRIBUTION SECURITY

## Objetivo

Tratar distribuição como cadeia de segurança.

Implementar:

* assinatura;
* notarização quando aplicável;
* SBOM;
* dependency inventory;
* secure update;
* rollback;
* supply-chain checks.

Garantir processo verificável para:

```text
install
→ update
→ rollback
```

em Windows, macOS e Linux.

Publicar `v4.8.0`.

---

# FASE 24 — v4.9.0

# PRE-5.0 FREEZE

## OBJETIVO CRÍTICO

Esta fase é um freeze.

Não começar features novas grandes.

Auditar:

* Core;
* Engine;
* Circuit;
* Simulator;
* Verification;
* HDL;
* Plugins;
* AI;
* Workspace;
* Collaboration;
* Packages;
* Sync;
* Runtime;
* Desktop;
* PWA;
* Security;
* Distribution.

Corrigir P0/P1.

Congelar contratos.

Congelar formatos.

Congelar APIs públicas.

Congelar arquitetura.

Produzir:

```text
V5_READINESS_MATRIX.md
V5_RISK_REGISTER.md
V5_COMPATIBILITY_REPORT.md
V5_SECURITY_REVIEW.md
V5_PERFORMANCE_REPORT.md
V5_PLATFORM_MATRIX.md
```

Nenhuma pendência crítica escondida.

Publicar `v4.9.0`.

---

# FASE 25 — v5.0.0-rc.1

# DIGITAL LOGIC PLATFORM CANDIDATE

## Objetivo

Construir a candidata final.

Validar:

### Core

* modular;
* estável;
* testável.

### Editor

* profissional;
* acessível;
* escalável.

### Simulator

* deterministic;
* bounded;
* cancellable.

### Verification

* testbench;
* diagnostics;
* snapshots;
* counterexamples.

### HDL

* import;
* export;
* validation;
* golden files.

### Plugins

* manifest;
* capabilities;
* sandbox;
* lifecycle.

### AI

* proposal;
* validation;
* diff;
* confirmation;
* rollback.

### Collaboration

* opt-in;
* conflict-aware;
* recoverable.

### Projects

* package;
* migration;
* reproducibility.

### Distribution

* Windows;
* macOS;
* Linux.

Executar:

* unit;
* integration;
* contract;
* browser;
* desktop;
* smoke;
* security;
* accessibility;
* performance;
* migration;
* reproducibility.

Criar RC.

---

# FASE 26 — v5.0.0

# DIGITAL LOGIC PLATFORM MADURA

## Objetivo

Esta é a última fase.

Não implementar recursos novos.

Somente validar.

A 5.0.0 só pode ser publicada quando:

```text
Core estável
+
Editor estável
+
Simulator bounded
+
Verification determinístico
+
HDL interoperável
+
Plugins seguros
+
IA controlada
+
Projetos migráveis
+
Reprodutibilidade
+
Desktop validado
+
Web validada
+
PWA validada
+
Windows validado
+
macOS validado
+
Linux validado
+
Security validada
+
Accessibility validada
+
Performance documentada
+
Distribution segura
+
Documentation completa
```

Criar:

* release notes;
* migration guide;
* architecture guide;
* plugin guide;
* AI safety guide;
* security guide;
* compatibility matrix;
* platform matrix;
* known limitations;
* rollback procedure.

Criar tag:

`v5.0.0`

Criar release oficial.

---

# MATRIZ FINAL DE RELEASES

```text
v2.6.0 → Verification
v2.7.0 → Execution Safety
v2.8.0 → Project Portability
v2.9.0 → Hardening

v3.0.0 → Modular Architecture
v3.1.0 → Plugin Contracts
v3.2.0 → Secure Plugins
v3.3.0 → Professional Workspace
v3.4.0 → Education + Accessibility
v3.5.0 → Collaboration
v3.6.0 → Controlled AI
v3.7.0 → HDL Interoperability
v3.8.0 → Scale
v3.9.0 → Reliability

v4.0.0 → Extensible Platform
v4.1.0 → Project Packages
v4.2.0 → Optional Sync
v4.3.0 → Reproducibility
v4.4.0 → Bounded Automation
v4.5.0 → Multi-Target Runtime
v4.6.0 → Optional Services
v4.7.0 → Ecosystem
v4.8.0 → Distribution Security
v4.9.0 → Pre-5.0 Freeze

v5.0.0-rc.1 → Release Candidate
v5.0.0 → Digital Logic Platform
```

---

# PROTOCOLO PARA O MANUS CONTINUAR SOZINHO

Ao iniciar cada prompt:

1. Verificar o HEAD atual.
2. Verificar o resultado da fase anterior.
3. Verificar se parte do objetivo já foi implementada.
4. Não repetir trabalho.
5. Fazer somente a fase atual.
6. Criar testes.
7. Executar os gates.
8. Atualizar documentação.
9. Criar commit.
10. Atualizar a `main` somente quando validado.
11. Registrar o SHA.
12. Registrar:

* completed;
* partial;
* blocked;
* unknown/external.

13. Deixar o repositório em estado limpo.
14. Encerrar a fase somente quando o critério estiver comprovado.

---

# PROTOCOLO DE ERRO

Se encontrar bug de fase anterior:

```text
PARAR
↓
IDENTIFICAR CAUSA
↓
CORRIGIR
↓
TESTAR REGRESSÃO
↓
RETOMAR FASE
```

Não acumular dívida para “depois”.

---

# PROTOCOLO DE DEPENDÊNCIA EXTERNA

Se GitHub, Supabase, Rust, Tauri, notarização, serviço remoto ou outra dependência não puder ser validada:

Nunca inventar PASS.

Usar:

```text
UNKNOWN
EXTERNAL BLOCK
NOT EXECUTED
```

e registrar exatamente o motivo.

---

# DEFINIÇÃO FINAL DA v5.0.0

O Veritas não deverá ser considerado uma plataforma 5.0 porque possui muitas funcionalidades.

Ele será considerado uma plataforma 5.0 quando:

> adicionar uma nova capacidade puder acontecer por meio de contratos, módulos, plugins ou extensões bem definidos, sem exigir uma reescrita arbitrária do Core ou comprometer a segurança, determinismo, compatibilidade e reprodutibilidade do sistema.

Esse é o verdadeiro gate da V5.


---

# POLÍTICA COMERCIAL TRANSVERSAL — STEAM, DLC E CLOUD

O Veritas poderá ser distribuído futuramente na Steam como Free-to-Play com um núcleo local gratuito. A base deve permitir criar, editar, simular, testar, salvar e reabrir circuitos localmente sem conta obrigatória, sem nuvem obrigatória e sem conexão permanente.

Módulos avançados locais poderão ser comercializados como DLCs ou expansões opcionais, incluindo HDL, instrumentos, verification avançada, workspace de escala, conteúdos educacionais e backends controlados. Backup, sincronização, histórico remoto, colaboração hospedada e compute remoto poderão ser serviços cloud opt-in pagos para cobrir armazenamento, segurança, operação e manutenção.

O modo local não pode virar paywall. O usuário não deve perder projetos locais quando um serviço expirar e não deve pagar para abrir, exportar ou continuar usando a simulação básica. Correções de segurança, compatibilidade e integridade do formato pertencem ao núcleo gratuito.

Antes de uma etapa comercial, ler `docs/COMMERCIAL_MODEL_STEAM.md`. Steamworks, ownership, DLC App IDs, Steam Wallet, backend de entitlements, cloud comercial, pricing e suporte permanecem `PLANNED / NOT IMPLEMENTED` até cumprir gates de segurança, privacidade, formatos, QA, plataforma e distribuição. A política comercial não altera a ordem técnica das fases e não promove nenhuma release automaticamente.
