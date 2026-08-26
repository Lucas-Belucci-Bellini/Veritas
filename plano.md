# Veritas — Plano executivo

> **Objetivo:** construir o Veritas como uma Digital Logic Platform leve, determinística, local-first, offline-first, privacy-first e distribuível em Windows, macOS e Linux. A meta de longo prazo desta fase é `v2.5.0`; a velocidade nunca supera a estabilidade comprovada.

## Fonte de verdade

O roadmap detalhado, o backlog priorizado, os critérios de aceite e os limites de escopo estão em [`docs/ROADMAP.md`](./docs/ROADMAP.md). O [`issue.md`](./issue.md) permanece como histórico de descoberta e visão de longo prazo, não como uma fila linear de tarefas.

## Estado real atual

A referência funcional do núcleo é a **Release 0.12.0**, na branch `feature/chip-hierarchy-v1`. O shell desktop é a prévia independente `desktop-v0.1.0-alpha.1`, publicada como pré-release. O núcleo web não foi promovido a `1.0.0` e o produto completo não é `2.x`.

| Área | Estado | Evidência e limite |
| --- | --- | --- |
| Core, engine combinacional e tabela verdade | Concluído em prévia | Lexer, parser, AST, avaliação, passos intermediários e limites determinísticos |
| Circuito derivado e editor visual | Concluído em prévia | React Flow/Dagre, netlist, persistência e operações editoriais; maturidade de produto continua em QA |
| Storage e projetos | Concluído em prévia | IndexedDB local, arquivos `.veritas`, validação defensiva e import/export |
| Simulação sequencial | Base funcional | Clock, delay, DFF/TFF, reset, Step/Run, timeline e workspace; JK/SR, waveform e hardening continuam planejados |
| Multi-bit e chips customizados | Allowlist ativa | BitVector, Splitter/Combiner, HDL e fixtures DLS combinacionais verificados; nenhum JSON/código DLS é executado |
| Verification/testbench | Fundação existente | Equivalência, comparação temporal e testbench declarativo existem; regressão permanente cruzada e assertions são próximos gates |
| PWA e modo local | Concluído em prévia | Fluxo principal sem conta e sem rede obrigatória |
| Nuvem, Realtime e IA | Opt-in | Não fazem parte do caminho offline; IA deve seguir proposta → validação → preview → confirmação → aplicação |
| Desktop Tauri 2/Rust | `0.1.0-alpha.1` técnico | Builds nativos Windows/macOS/Linux publicados; Linux tem build e inicialização controlada local, runtime interativo Windows/macOS é `NOT VERIFIED` |
| Distribuição | Parcialmente verificada | Release pública contém `Veritas-Setup.exe`, bundles macOS, pacotes Linux, `SHA256SUMS` e `desktop-release-manifest.json`; instalação, atualização, remoção e assinaturas ainda não são estáveis |

## Marco atual e próximo bloqueio real

O marco corrente é **consolidar a infraestrutura de QA e a rastreabilidade da distribuição**, não saltar para `1.0.0`. O pipeline desktop agora constrói em runners nativos, normaliza o requisito oficial `Veritas-Setup.exe`, publica hashes e registra para cada asset o nome, plataforma, arquitetura, tamanho, SHA-256, versão e commit.

O próximo bloqueio técnico é transformar a intenção de regressão em uma suíte permanente em `tests/regression/`, começando por testes cruzados **Expression → TruthTable** versus **Circuit → Simulator** para portas fundamentais e circuitos já suportados. Qualquer divergência deve bloquear a release; a implementação deve reutilizar engine, `CircuitDocument`, `evaluateCircuit`, `buildCircuitTruthTable` e testbench existentes, sem reconstruir módulos funcionais.

## Trajetória de releases

| Marco | Objetivo | Estado e critério de saída |
| --- | --- | --- |
| **desktop 0.5.0** | Início formal dos testes do aplicativo | Matriz Windows/macOS/Linux com instalação limpa, startup offline, editor, IndexedDB, simulação, import/export, acessibilidade, atualização, encerramento e remoção; cada resultado classificado como `BUILD VERIFIED`, `RUNTIME VERIFIED`, `SMOKE VERIFIED` ou `NOT VERIFIED` |
| **v0.6.0** | Simulação sequencial mais forte | Fortalecer clock, delay, DFF/TFF, JK/SR, registradores, contadores, feedback, reset, Step/Run/Pause, timeline e waveform com regressão determinística |
| **v0.7.0** | Editor maduro | Fechar drag/drop, seleção/multi-seleção, conexão/desconexão, snap, zoom/pan, undo/redo, copy/paste, duplicate, delete, alinhamento, auto-layout e smoke visual |
| **v0.8.0** | Multi-bit seguro e completo | Cobrir 1/2/4/8/16/32/64 bits, buses, Splitter/Combiner, operações bitwise, binário/hexadecimal, validação de largura e compatibilidade de documentos |
| **v0.9.0** | Workspace sequencial | Consolidar Clock, DFF, TFF, JK, SR, Counter, Register, Delay, Step, Run, Pause, Reset, Watch, Timeline e Waveform com persistência e feedback seguros |
| **v1.0.0** | Primeira estabilidade | Só criar quando core, engine, editor, simulator, storage, import/export, Windows, macOS, Linux, testes, CI, performance e documentação estiverem estáveis, sem P0/P1 conhecidos, com atualização, remoção, offline e assinaturas verificadas; caso contrário, usar RCs |
| **v1.1.0–v1.3.0** | Portabilidade, HDL e testbench | Versionar migrações `.veritas`, golden files HDL, interoperabilidade controlada, assertions declarativas e contraexemplos sem `eval`/`Function` |
| **v1.4.0–v1.6.0** | Performance, acessibilidade e distribuição | Medir tamanho, RSS, startup, simulação e renderização por plataforma; ampliar acessibilidade; validar atualização/rollback/remoção; configurar Authenticode e assinatura/notarização Apple fora do repositório |
| **v1.7.0–v1.9.0** | Colaboração, IA e hardening | Manter sincronização opt-in e conflitos explícitos; uniformizar contratos de IA controlada; fechar APIs, formatos, dependências e regressão antes de 2.0 |
| **v2.0.0** | Nova arquitetura planejada | Antes da implementação devem existir `docs/V2_ARCHITECTURE.md`, `docs/V2_MIGRATION.md` e `docs/V2_MASTER_PLAN.md`; engine, simulator, storage, plugins, verification, AI contracts, desktop e migração devem ter contratos claros |
| **v2.1.0** | Modularidade | Separar Core, Engine, Circuit, Simulator, Storage, Renderer, HDL, Verification, AI, Plugins e Desktop, evitando dependências circulares |
| **v2.2.0** | Plugins seguros | Permitir gates, chips, exporters, analyzers e visualizations apenas por manifestos, permissões, validação e limites; nunca execução arbitrária sem controle |
| **v2.3.0** | Workspace profissional | Tabs, project explorer, hierarchy, component browser, inspector, command palette, waveform, simulation e verification panels para projetos maiores |
| **v2.4.0** | Verificação automatizada | Testbench, assertions, regression, equivalence, snapshots e benchmarks como fluxo de produto; divergências bloqueiam a release |
| **v2.5.0** | Objetivo final desta fase | Produto leve e multiplataforma com engine/editor/simulator estáveis, lógica combinacional e sequencial, multi-bit, chips customizados, verification, testbench, HDL, projetos, plugins seguros, IA controlada, desktop, performance, segurança, documentação, CI/CD e releases reais |

## Protocolo de cada release

Uma release só é fechada quando houver uma mudança intencional, commits, gates (`npm test`, typecheck, lint e build, além dos testes específicos), tag, GitHub Release, changelog, artefatos e relatório. A sequência pode usar alpha, beta e RC; uma execução verde de CI não promove automaticamente a versão.

O pipeline deve separar quatro evidências. **Build/artifact verified** confirma que o runner produziu um arquivo válido. **Runtime verified** exige executar o programa no sistema correspondente. **Smoke verified** exige concluir o roteiro funcional. **Release ready** exige também estabilidade, segurança, atualização, documentação e ausência dos bloqueios definidos. Um build Windows ou macOS feito no runner não será descrito como runtime validado no Linux.

## Princípios permanentes

O caminho principal permanece local, determinístico e sem conta. O núcleo de domínio não depende de React ou DOM. Arquivos importados são dados validados, não programas. A allowlist DLS é explícita e fail-closed: não executa JSON, não avalia código e não infere dependências ausentes. Mudanças de formato têm versão, migração ou rejeição clara.

A `main` deve permanecer utilizável; desenvolvimento experimental fica na branch `feature/chip-hierarchy-v1` até haver decisão de merge. Antes de qualquer merge, devem passar lint, typecheck, testes e build. Se surgir bloqueio, o registro deve informar causa, impacto, tentativa, resultado e próxima ação tecnicamente válida, sem repetir tentativas idênticas.
