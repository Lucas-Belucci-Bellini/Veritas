# Veritas — Trajetória pós-v2.5.0 até v5.0.0

> Documento complementar e normativo do roadmap do Veritas. Ele amplia a trajetória definida em `docs/ROADMAP.md` e não transforma nenhum marco futuro em release existente.

## 1. Finalidade

A trajetória do Veritas continua além da primeira plataforma madura prevista para a v2.5.0. O objetivo deste documento é registrar, de forma executável, o que ainda precisa ser construído, endurecido, testado, documentado e publicado até a v5.0.0.

A v5.0.0 não representa uma promessa de data, uma autorização para pular releases ou uma declaração de que todas as ideias de longo prazo serão implementadas. Ela representa o ponto de maturidade em que o Veritas poderá ser tratado como uma **Digital Logic Platform** modular, verificável, distribuível e sustentável, mantendo a segurança local-first, offline-first e privacy-first.

Cada versão futura continua subordinada às seguintes regras:

1. nenhuma funcionalidade é considerada pronta apenas porque existe código;
2. nenhuma versão é considerada release apenas porque o CI ficou verde;
3. nenhuma plataforma é considerada validada apenas porque produziu um instalador;
4. nenhuma IA pode alterar um projeto sem proposta, validação, preview, confirmação e possibilidade de rollback;
5. toda alteração de formato precisa de versão, migração explícita ou rejeição clara;
6. toda versão major precisa de documentação arquitetural, compatibilidade e plano de migração;
7. todos os avanços permanecem em branch até os gates da respectiva release serem cumpridos.

## 2. Estado de partida confirmado

A auditoria da main em 26 de agosto de 2026 confirmou:

| Item | Estado confirmado |
|---|---|
| Repositório | `Lucas-Belucci-Bellini/Veritas` |
| Branch de trabalho atual | `main` |
| HEAD da main | `37d3c015efab184f0f8015fcd0c641fcd421fc84` |
| Branch experimental preservada | `feature/chip-hierarchy-v1` em `3755976aa9d9ef61200fec9e43ab3eb132b0841b` |
| Versão do pacote web/core | `0.9.0-rc.18` |
| Shell desktop | Tauri `0.1.0-alpha.1` |
| Release desktop pública | `desktop-v0.1.0-alpha.1`, histórica e pré-release |
| Plataformas obrigatórias | Windows, macOS e Linux |
| Instalador oficial Windows | `Veritas-Setup.exe` |
| Arquitetura preservada | React → Vite → Tauri 2 → Rust |
| Princípios | local-first, offline-first, privacy-first, seguro e determinístico |
| Próximo incremento técnico | Integrar diagnóstico bounded ao fluxo de testbench declarativo |

O estado acima deve ser revalidado pelo Git antes de cada nova sessão. Este documento não substitui a auditoria do HEAD atual.

## 3. O que já existe antes da trajetória pós-v2.5.0

O núcleo já possui motor combinacional, modelo de circuito, editor visual, persistência local, PWA, simulação sequencial, waveform, barramentos multi-bit, chips customizados hierárquicos, importação estrutural allowlist de chips DLS, testbench declarativo, comparação temporal, exportação HDL, servidor MCP, shell Tauri e workflows de qualidade/distribuição.

A existência dessas capacidades não implica estabilidade de produto. Os principais itens ainda precisam de integração, migração, cobertura multiplataforma, medição ou critérios de promoção.

| Área | Situação de partida | Não confundir com |
|---|---|---|
| Core e engine | Implementados e cobertos por regressões | prova de estabilidade v1/v2 |
| Simulator | Implementado com budgets e diagnóstico bounded | classificação estática completa de ciclos |
| documentRuntime | Possui preview isolada e ação visual | validação visual interativa |
| Testbench | Possui casos combinacionais/sequenciais declarativos | assertions completas e fluxo final de verificação |
| Custom chips | Hierarquia, runtime temporal e importação estrutural existem | suporte irrestrito a barramentos internos |
| Multi-bit | BitVector, Splitter/Combiner, HDL e catálogo DLS existem | suporte ilimitado a larguras e circuitos grandes |
| Desktop | Shell, builds e assets existem | runtime interativo validado nos três sistemas |
| CI/CD | Quality gates, manifestos e checksums existem | assinatura, notarização, atualização e release estável |
| IA/MCP | Contratos headless e caminhos de proposta existem | autorização para mutação silenciosa |

## 4. Política de versões

As versões `2.x`, `3.x`, `4.x` e `5.x` são linhas de produto, não etiquetas para agrupar trabalho inacabado. Um marco só deve receber tag quando o critério de saída estiver comprovado.

| Tipo | Uso no Veritas |
|---|---|
| Patch | Correção sem mudança de contrato, migração ou comportamento público intencional |
| Minor | Capacidade nova compatível, com testes, documentação e evidência proporcional |
| Major | Mudança arquitetural, de formato, de extensibilidade ou de garantias públicas que exige plano de migração |
| RC | Candidato de release com bloqueios de validação explicitamente conhecidos e sem promoção silenciosa |
| Desktop release | Linha separada para o shell/empacotamento, sempre ligada a um commit e manifesto específicos |

Nenhum número major deve ser usado para mascarar pendências. Se os gates não fecharem, a versão permanece em RC ou Unreleased.

## 5. Trajetória completa de v2.6.0 a v5.0.0

| Marco | Foco | Entregas obrigatórias | Critério de saída |
|---|---|---|---|
| **v2.6.0** | Verificação no produto | Diagnóstico bounded no testbench, estados `PASS`/`FAIL`/`INVALID`, `cycle-detected`, `budget-exhausted`, snapshots e contraexemplos | Testbench reproduzível, sem mutação silenciosa, com relatório determinístico e regressão bloqueante |
| **v2.7.0** | Segurança da execução | Classificação estática de ciclos, budgets de operações/memória, limites por documento e cancelamento seguro | Documento inválido falha antes de executar; nenhuma entrada pode congelar a UI ou consumir recursos sem limite |
| **v2.8.0** | Portabilidade de projetos | Formato versionado, migrações, round-trip web/PWA/desktop, import/export fail-closed e recuperação | Projeto antigo migra ou é recusado com motivo; não há perda silenciosa em round-trip |
| **v2.9.0** | Pré-3.0 hardening | API pública inventariada, auditoria de dependências, compatibilidade, telemetria opt-in e release readiness | Decisão documentada de entrada em 3.0, sem P0/P1 conhecidos na superfície consolidada |
| **v3.0.0** | Arquitetura modular | Separação Core, Engine, Circuit, Simulator, Storage, Renderer, HDL, Verification, AI, Plugins e Desktop | Boundaries verificáveis, testes por módulo, dependências direcionais e migração sem quebra silenciosa |
| **v3.1.0** | Contratos de plugins | Manifesto, tipos de plugin, registro, ciclo de vida, compatibilidade e exemplos declarativos | Plugin inválido é recusado; plugin compatível pode ser descoberto e removido sem corromper projetos |
| **v3.2.0** | Plugins seguros | Capabilities, permissões, sandbox ou fronteira equivalente, limites de CPU/memória e ausência de execução arbitrária | Plugin só acessa o que declara; imports e assets não executam código sem política explícita |
| **v3.3.0** | Workspace profissional | Abas, project explorer, hierarchy, component browser, inspector, command palette, waveform e verification panels | Projetos médios/grandes são navegáveis, persistentes e reversíveis com desempenho medido |
| **v3.4.0** | Educação e acessibilidade | Tutoriais, exemplos, teclado, foco, mensagens, leitores, estados de erro e fluxos sem conta | Fluxos didáticos principais são usáveis por teclado e explicam limites sem depender de conhecimento interno |
| **v3.5.0** | Colaboração opt-in | Sessões, presença, papéis, conflitos explícitos, offline local-first e recuperação | Sincronização só acontece por ação explícita; conflitos não são resolvidos por LWW silencioso |
| **v3.6.0** | IA controlada | Intenções declarativas, diff, preview, confirmação, logs, rollback, limites e fallback local | A IA pode propor e explicar; nenhuma proposta inválida ou não confirmada altera o projeto |
| **v3.7.0** | Interoperabilidade HDL | Importação contratada, validação de entrada, golden files, divergências explicáveis e compatibilidade | Verilog/VHDL suportados têm round-trip ou diagnóstico claro de incompatibilidade |
| **v3.8.0** | Escala controlada | Renderização incremental, netlist compacta, benchmarks por tamanho, memória, startup e limites de documento | Escala suportada é declarada com números; circuitos fora do contrato falham cedo e sem travar |
| **v3.9.0** | Confiabilidade de manutenção | Deprecations, compatibilidade, recuperação, observabilidade opt-in, matriz de incidentes e inventário de dependências | A entrada em 4.0 tem decisão técnica, plano de migração e regressão completa reproduzível |
| **v4.0.0** | Plataforma extensível | Core modular consolidado, contratos de extensibilidade, project packages, verification pipeline e runtime multi-alvo | Extensões, projetos e ferramentas evoluem sem acoplamento circular ou quebra de dados |
| **v4.1.0** | Pacotes de projeto | Dependências declaradas, lockfile de projeto, assets locais, import/export assinado opcional e resolução de conflitos | Um projeto pode ser transportado como pacote reproduzível e validado antes de abrir |
| **v4.2.0** | Sincronização opcional | Replicação explícita, cache local, reconciliação, conflito visual e controles de privacidade | O modo offline continua completo; rede é opt-in, observável e reversível |
| **v4.3.0** | Reprodutibilidade e observabilidade | Build metadata, hashes, diagnósticos, logs estruturados locais, relatórios e provenance | Um resultado pode ser reproduzido a partir do projeto, versão, configuração e fixtures declarados |
| **v4.4.0** | Automação bounded | Jobs locais, filas, cancelamento, cron opt-in quando necessário e execução sem comandos arbitrários | Automatizações têm escopo, budget, estado, retry seguro e nenhuma operação destrutiva implícita |
| **v4.5.0** | Runtime multi-alvo | Contratos consistentes web, PWA, desktop e eventual WASM/Rust quando a evidência justificar | Os alvos suportados têm paridade golden e falhas de compatibilidade explicitamente classificadas |
| **v4.6.0** | Serviços opcionais | Integrações remotas desacopladas, autenticação, RLS, sincronização e migrações sem contaminar o modo local | O produto funciona sem conta; recursos remotos são removíveis, auditáveis e não vazam dados |
| **v4.7.0** | Ecossistema e documentação | Catálogo de componentes/plugins, documentação de API, exemplos, tutoriais, changelogs e suporte de migração | Um terceiro consegue instalar, validar e usar uma extensão documentada sem acesso interno ao código |
| **v4.8.0** | Segurança de distribuição | Assinatura, notarização, SBOM/inventário, atualização segura, rollback e análise de supply chain | Os três sistemas têm processo de instalação, atualização e reversão verificável |
| **v4.9.0** | Consolidação pré-5.0 | Freeze de contratos, compatibilidade, regressões, performance, acessibilidade, segurança e documentação final | Nenhum P0/P1 conhecido; todos os gates da v5.0.0 têm evidência ou bloqueio formal explícito |
| **v5.0.0** | Digital Logic Platform madura | Core/editor/simulator/verification/HDL/plugins/IA controlada/projetos/desktop e distribuição integrados | Produto estável, migrável, reproduzível e validado em Windows/macOS/Linux, com segurança e documentação completas |

## 6. Plano detalhado por fases

### 6.1 Fase A — v2.6.0: verificação como fluxo de produto

O primeiro passo após a v2.5.0 é transformar a preview diagnóstica em um resultado útil para testbench. O domínio deve continuar separado da UI: o runner recebe dados declarativos, usa o runtime correto e produz um relatório serializável.

Entregas:

- integrar `diagnoseDocumentRuntimePreview()` ao caminho sequencial do testbench;
- conservar `PASS`, `FAIL` e `INVALID` como estados de caso/testbench;
- anexar `stabilized`, `cycle-detected` ou `budget-exhausted` sem confundi-los com falha lógica;
- cobrir `register-4bit`, `counter-4bit`, JK, SR, feedback e chips customizados;
- preservar snapshots, tick, passo, sinal divergente e causa de invalidação;
- manter o limite de execução bounded e testar que o runtime ativo não muda;
- adicionar fixtures de regressão para cada desfecho.

Não fazer nesta fase: assertions livres, DSL executável, `eval`, `Function`, geração arbitrária de código ou execução remota.

### 6.2 Fase B — v2.7.0: segurança antes da escala

A simulação deve distinguir um circuito que possui ciclo combinacional de um circuito sequencial legítimo e de um runtime que apenas excedeu seu orçamento. A classificação estática deve ocorrer antes da execução sempre que o grafo permitir.

Entregas:

- classificar ciclos combinacionais, caminhos temporais e feedback permitido;
- definir orçamento de operações por tick e por execução;
- definir orçamento de memória por documento/runtime quando tecnicamente mensurável;
- rejeitar números não finitos, inteiros inválidos, larguras impossíveis e documentos acima dos limites;
- tornar cancelamento e encerramento idempotentes;
- garantir que worker, UI, MCP e desktop não mantenham loop após cancelamento;
- registrar diagnóstico acionável sem expor segredos ou dados remotos.

**Estado de implementação atual:** classificação estática, budgets locais, quota agregada por documento/operação, cancelamento cooperativo do runtime, adapter MCP assíncrono, cleanup, o protocolo Worker web v1, o cliente hospedeiro, a ponte documental, o `DocumentWorkerExecutor` opt-in, o `Preview Worker` explícito do painel temporal e o `SimulationWorkerSupervisor` bounded do host possuem código e regressões automatizadas. Smokes reais no Chromium confirmaram fixture direta, ponte documental, preview acionado pela UI, múltiplos Workers, fila bounded, rejeição explícita do excesso e cancelamento ativo/enfileirado, todos em circuitos escalares pequenos, sem substituir o runtime ativo. Uma baseline fixa registrou latências de 128,5–382,3 ms para cinco requests aceitos em uma rajada de oito. Depois, seis rodadas sustentadas repetíveis com 48 requests totais registraram 36 aceitos, 12 rejeições bounded, throughput descritivo de 68,926 outcomes/s, latência média de 57,944 ms e p95 de 89,000 ms, sempre com `active <= 2`, `queued <= 4` e cleanup zerado. A regressão e o smoke de parity da fixture `dff-clock` também produziram snapshots idênticos nos tiques 0–4 entre o Worker e o `Simulator` canônico dentro de um único request. O ensaio também observou `performance.memory.usedJSHeapSize` da página entre 47.001.860 e 48.326.352 bytes, sem tratar isso como heap isolado de Workers. `docs/EXECUTION_WORKER_BOUNDARY.md` e `docs/TAURI_SIMULATION_BOUNDARY.md` registram a fronteira web e a proposta nativa; o contrato/parser de checkpoint existe isoladamente e o primeiro comando Rust escalar já compila e passa nos testes Linux, mas ainda não há resume entre requests, parity TypeScript/Rust, canal nativo de progresso ou integração de UI. O fechamento da fase ainda depende de integração de resume, medição efetiva isolada de heap/CPU, inspeção visual multiplataforma e evidência nativa. Portanto, v2.7.0 continua `Unreleased`.

### 6.3 Fase C — v2.8.0: compatibilidade e migrações

A portabilidade precisa ser tratada como contrato, não como cópia de JSON. Cada formato deve ter versão, parser fail-closed, migração explícita, round-trip e fixture de rejeição.

Entregas:

- inventariar todos os formatos `.veritas`, testbench, chips, projetos e configurações;
- definir `format`/`version` e política de compatibilidade;
- criar migrações determinísticas e reversíveis quando possível;
- separar importação confiável de conteúdo que precisa de confirmação;
- testar web, PWA e Tauri com os mesmos fixtures;
- preservar dados locais durante atualização e desinstalação;
- documentar rollback e recuperação de arquivos inválidos.

### 6.4 Fase D — v2.9.0: preparação arquitetural

Antes da v3.0.0, devem existir e estar aprovados no repositório `docs/V3_ARCHITECTURE.md`, `docs/V3_MIGRATION.md` e `docs/V3_MASTER_PLAN.md`. Esses documentos devem declarar boundaries, dependências permitidas, contratos de plugin, compatibilidade e estratégia de rollout.

A fase também deve congelar temporariamente contratos frágeis, remover duplicações conhecidas, fechar auditoria de dependências e publicar a decisão de entrada ou permanência em RC.

### 6.5 Fase E — v3.0.0 a v3.9.0: modularidade e produto profissional

A série 3.x organiza o sistema para crescer sem transformar o editor, o simulator e a IA em um único módulo inseparável.

A ordem recomendada é:

1. separar contratos e boundaries sem reescrever o runtime por conveniência;
2. criar plugins declarativos com capability boundary;
3. desenvolver o workspace profissional sobre APIs de domínio estáveis;
4. ampliar acessibilidade e educação sem exigir conta;
5. consolidar colaboração opt-in e conflitos explícitos;
6. uniformizar IA com proposta, validação, preview, confirmação e rollback;
7. fechar HDL e interoperabilidade com golden files;
8. medir escala real antes de ampliar limites;
9. fazer freeze de contratos e preparar a v4.

Nenhum item da série 3.x deve permitir que um plugin ou agente execute código arbitrário, leia credenciais ou publique dados sem uma capability explicitamente concedida.

### 6.6 Fase F — v4.0.0 a v4.9.0: plataforma extensível e distribuível

A série 4.x transforma os módulos em uma plataforma de projetos e extensões. O foco é reprodutibilidade, pacotes, serviços remotos opcionais, automação bounded, múltiplos alvos e distribuição segura.

A sequência deve priorizar o transporte reprodutível de projetos antes da sincronização remota. O modo sem rede deve continuar sendo uma experiência completa. Recursos de nuvem só entram quando os contratos locais, migrações, conflitos e privacidade estiverem fechados.

A distribuição 4.8.0 deve incluir, quando os ambientes estiverem disponíveis:

- assinatura Authenticode e validação do `Veritas-Setup.exe` no Windows;
- assinatura e notarização Apple no macOS;
- assinatura/hash e instalação verificável no Linux;
- atualização com preservação de projetos;
- rollback de atualização interrompida;
- SBOM ou inventário de dependências;
- credenciais e certificados fora do repositório;
- manifesto e checksums ligados ao commit/tag corretos.

### 6.7 Fase G — v5.0.0: maturidade final desta trajetória

A v5.0.0 só pode ser criada quando o produto funcionar como uma plataforma integrada e não apenas como um conjunto de features. Ela exige estabilidade do núcleo, interoperabilidade, extensibilidade segura, experiência profissional, distribuição multiplataforma e capacidade de manutenção.

O gate da v5.0.0 exige:

- core combinacional e sequencial determinístico;
- editor visual com persistência, undo/redo, migração e limites claros;
- multi-bit com larguras suportadas formalmente declaradas;
- chips customizados com ciclo, profundidade e capabilities validados;
- testbench, assertions e verification com contraexemplos reproduzíveis;
- HDL suportado com golden files e rejeições explicáveis;
- plugins versionados e limitados por capabilities;
- IA somente em fluxo controlado e auditável;
- projetos portáveis, recuperáveis e compatíveis;
- Windows, macOS e Linux com runtime interativo validado;
- `Veritas-Setup.exe` instalado, executado, atualizado, desinstalado e verificado no Windows;
- assinatura/notarização e checksums conforme o alvo;
- métricas de startup, memória, simulação, renderização e tamanho acompanhadas;
- zero P0/P1 conhecido no momento da promoção;
- documentação de usuário, desenvolvedor, segurança, migração e release;
- CI bloqueante e artefatos ligados à tag correta;
- relatório final com evidência por plataforma.

## 7. Workstreams permanentes

As releases devem ser planejadas por workstream para impedir que uma feature seja declarada concluída por olhar apenas para o frontend.

| Workstream | Responsabilidade | Evidência obrigatória |
|---|---|---|
| Core/Engine | Parser, expressões, vetores, determinismo e limites | Testes de domínio, cross-runtime e fixtures |
| Circuit | Documento, netlist, portas, conexões, chips e migrações | Schema, validação, round-trip e rejeições |
| Simulator | Ticks, clocks, feedback, snapshots, budgets e cancelamento | Regressões temporais e diagnósticos bounded |
| Editor | Canvas, interação, acessibilidade e reversibilidade | Testes de interação e smoke visual |
| Storage | IndexedDB, arquivos, export/import, recovery e migrações | CRUD, upgrade, backup, restore e corrupção |
| Verification | Testbench, assertions, equivalence, differential e benchmark | PASS/FAIL/INVALID, contraexemplo e bloqueio de release |
| HDL | Verilog/VHDL, importação contratada e golden files | Saída determinística e divergência explicável |
| Plugins | Manifesto, capabilities, sandbox e versionamento | Plugin seguro, inválido e incompatível |
| AI/MCP | Propostas, schemas, preview, confirmação e logs | Nenhuma mutação silenciosa e testes headless |
| Desktop | Tauri, Rust, empacotamento, instalação e atualização | Evidência nativa Windows/macOS/Linux |
| Security | Secrets, permissões, supply chain e conteúdo não confiável | Auditoria, fail-closed e ausência de execução arbitrária |
| Documentation | Roadmap, changelog, migrações, manuais e retomada | Documentos reproduzíveis e sincronizados com o HEAD |

## 8. Gates comuns a todas as releases

Antes de qualquer tag, o agente deve selecionar os gates proporcionais ao escopo e registrar o resultado sem transformar ausência de evidência em sucesso.

### 8.1 Gate de código

Typecheck, lint, testes focados, suíte completa, benchmark quando aplicável, build web, build Tauri quando houver impacto desktop e `git diff --check` devem passar. Testes skipped precisam ter justificativa explícita.

### 8.2 Gate de contrato

Formatos, limites, APIs públicas, mensagens de erro, migrações e compatibilidade precisam estar documentados e cobertos por testes de aceitação e rejeição.

### 8.3 Gate de segurança

Não pode existir execução arbitrária de JSON, HDL, código importado, plugin ou comando de IA. Inputs são dados, schemas são validados, permissões são mínimas e segredos ficam fora do repositório.

### 8.4 Gate de plataforma

Cada plataforma deve ser classificada individualmente como `BUILD VERIFIED`, `ARTIFACT VERIFIED`, `RUNTIME VERIFIED`, `SMOKE VERIFIED` ou `NOT VERIFIED`. A classificação mais fraca necessária permanece válida quando um fluxo não foi observado.

### 8.5 Gate de release

Uma release precisa de commit, tag, changelog, GitHub Release, assets, manifest, checksums, relatório, workflow verde e evidência de que os assets vieram do commit/tag correto. CI verde sozinho não cria promoção.

## 9. Ordem de execução recomendada a partir da main

A ordem abaixo é o plano operacional padrão. Uma auditoria pode alterar a ordem somente se explicar causa, impacto, tentativa e resultado.

1. Integrar diagnóstico bounded ao testbench declarativo.
2. Produzir relatório estruturado de `PASS`/`FAIL`/`INVALID` e diagnóstico.
3. Cobrir integralmente `register-4bit`, `counter-4bit`, JK, SR e chips customizados.
4. Implementar classificação estática de ciclos.
5. Definir budgets de operações e memória.
6. Fazer smoke real de save/reopen/import/export.
7. Validar a ação de preview no navegador quando o ambiente estiver disponível.
8. Executar QA nativo interativo Windows/macOS/Linux.
9. Fechar o critério de desktop 0.5.0.
10. Fechar migrações e compatibilidade de projetos.
11. Criar `docs/V2_ARCHITECTURE.md`, `docs/V2_MIGRATION.md` e `docs/V2_MASTER_PLAN.md` antes de v2.0.0, caso ainda não existam.
12. Fechar v2.6.0–v2.9.0.
13. Criar `docs/V3_ARCHITECTURE.md`, `docs/V3_MIGRATION.md` e `docs/V3_MASTER_PLAN.md` antes de v3.0.0.
14. Executar modularidade, plugins, workspace e verification da série 3.x.
15. Executar pacotes, reprodutibilidade, automação bounded e distribuição da série 4.x.
16. Fazer freeze de contratos e auditoria final v4.9.0.
17. Só então preparar RC, tag e release v5.0.0.

## 10. Bloqueios que não podem ser escondidos

| Bloqueio | Efeito | Condição para fechar |
|---|---|---|
| Runtime nativo interativo não observado | Não permite promover desktop estável | Teste nativo repetível por sistema |
| macOS sem smoke interativo | Não permite declarar macOS validado | Runner ou máquina macOS com evidência |
| Windows com smoke limitado | Não permite declarar produto Windows completo | Editor, persistência, simulação, atualização e remoção |
| Métricas de simulação ausentes | Não permite prometer performance | Baselines bounded e sustentada registradas no browser; medição isolada efetiva de heap/CPU e extrapolação de produção ainda pendentes |
| Metadata de versão divergente | Pode gerar release incorreta | Alinhar package/core/shell/manifest/tag |
| Assertions ainda sem contrato final | Limita verification | Parser/semântica/limites/documentação/testes |
| Limites de circuitos grandes | Impede anunciar suporte grande | Contrato, renderer, storage, budgets e QA |
| Serviços remotos opcionais | Risco de quebrar local-first | Opt-in, RLS, conflito, privacy e offline |
| Certificados ausentes | Impede distribuição estável | Segredos fora do repo e validação nativa |

## 11. Definição de pronto até v5.0.0

Uma tarefa está pronta quando o código está na camada correta, os testes cobrem o comportamento, os gates apropriados passam, os limites e contratos estão documentados, o diff está limpo, o commit está publicado e as classificações de evidência são honestas.

Uma release está pronta quando, além disso, a tag aponta para o commit correto, os artefatos são reproduzíveis, o changelog e o GitHub Release estão completos, os checksums estão verificados e cada plataforma obrigatória possui evidência suficiente para a promessa feita.

A v5.0.0 está pronta somente quando o Veritas puder ser atualizado, instalado, utilizado, verificado, migrado, estendido e removido sem perda silenciosa de projetos, sem execução arbitrária e sem depender de uma sessão específica do agente.

## 12. Contrato de retomada em novas conversas

Ao receber este documento em uma conversa nova, o agente deve:

1. abrir o repositório correto;
2. ler `docs/ROADMAP.md`, este arquivo e `docs/VERITAS_MASTER_CONTINUATION_PROMPT.md`;
3. executar `git fetch origin --prune --tags`;
4. confirmar branch, HEAD, status, tags, releases e workflows;
5. comparar o snapshot do documento com o estado real;
6. não assumir que uma tarefa descrita como pronta continua presente na branch atual;
7. escolher o primeiro bloqueio real da ordem recomendada;
8. implementar o menor incremento testável;
9. executar os gates proporcionais;
10. atualizar documentação e changelog;
11. publicar no branch apropriado;
12. só criar tag/release quando os critérios estiverem cumpridos;
13. enviar relatório com `Cause / Impact / What was attempted / Result / Next action` para bloqueios.

Uma nova conversa nunca deve trabalhar diretamente a partir de uma cópia antiga sem confirmar o GitHub.

## 13. Fora de escopo automático

A existência deste roadmap não autoriza iniciar automaticamente 3D, PCB, G-code, impressão, execução arbitrária de scripts, 250 subagentes, cloud obrigatória, CRDT sem contrato, migração para Electron ou reescrita do núcleo em Rust por conveniência.

Esses itens só podem entrar mediante proposta específica, caso de uso verificável, contrato de segurança, orçamento, compatibilidade e alteração explícita do roadmap.

## 14. Referências internas

- `docs/ROADMAP.md` — fonte histórica e roadmap geral do Veritas.
- `docs/VERITAS_MASTER_CONTINUATION_PROMPT.md` — contrato operacional de retomada.
- `docs/FEEDBACK_HARDENING.md` — budgets, ciclos e diagnóstico bounded.
- `docs/LARGE_CIRCUITS.md` — limites e decisão sobre circuitos grandes.
- `tests/desktop/QA_MATRIX.md` — evidência por plataforma.
- `CHANGELOG.md` — histórico de mudanças e releases.


## Política comercial transversal — Steam, DLC e serviços cloud

A distribuição futura do Veritas poderá usar a Steam em duas edições: uma **demo/teste gratuita**, para avaliação controlada, e uma **versão final paga**, que será a edição completa e oficial do produto. Demo e edição final terão login planejado; a edição final exigirá licença/entitlement válido. O escopo e os limites da demo devem ser publicados antes do uso, e a versão final não será gratuita como regra de produto.

Login/licença servem para sessão e direito de uso, mas não autorizam upload automático nem tornam a nuvem obrigatória. Projetos locais compatíveis e a simulação devem continuar disponíveis conforme a licença e a política de grace period offline. Módulos avançados locais poderão ser DLCs ou expansões pagos, incluindo HDL, instrumentos, verification profissional, workspace de escala, conteúdos educacionais e backends controlados. Backup, sincronização, histórico remoto, colaboração hospedada e compute remoto poderão ser serviços cloud opt-in pagos para cobrir armazenamento, segurança, operação e manutenção.

O usuário não deve perder arquivos locais quando um serviço expirar ou estiver indisponível, e não deve pagar por uma contratação de nuvem para simular localmente dentro da licença válida. Esta política é um plano de produto, não uma integração Steamworks implementada. Steam ownership, DLC App IDs, Steam Wallet, backend de entitlements, cobrança, refunds, cloud comercial, pricing e suporte permanecem `PLANNED / NOT IMPLEMENTED` até os gates de segurança, privacidade, formatos, plataforma e distribuição. A especificação normativa está em [`COMMERCIAL_MODEL_STEAM.md`](./COMMERCIAL_MODEL_STEAM.md), com boundaries reutilizáveis em [`PRODUCT_AUTH_LICENSE_BOUNDARY.md`](./PRODUCT_AUTH_LICENSE_BOUNDARY.md).
