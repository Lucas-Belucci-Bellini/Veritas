# PROMPT MESTRE DE CONTINUIDADE — VERITAS DIGITAL LOGIC PLATFORM

> **Documento destinado a uma nova conversa de ChatGPT/Manus.** Cole este arquivo integralmente ou forneça o caminho do arquivo ao agente que deverá continuar o desenvolvimento. O agente deve tratar o repositório e os commits como a fonte de verdade final; os números de snapshot deste documento são auxiliares e devem ser auditados novamente no início de cada conversa.

**Idioma de trabalho:** português brasileiro.

**Repositório oficial:** https://github.com/Lucas-Belucci-Bellini/Veritas

**Meta da trajetória:** Veritas v5.0.0, seguindo primeiro os gates até v2.5.0 e depois `docs/VERITAS_V3_V5_ROADMAP.md`.

**Princípio definitivo:** não construir apenas um site que calcula portas lógicas; construir uma **Digital Logic Platform** multiplataforma, distribuível, leve, rápida, offline-first, local-first, privacy-first, determinística, modular, visual, segura, extensível e adequada tanto para estudantes quanto para projetos maiores.

---

## 1. INSTRUÇÃO PRINCIPAL PARA O AGENTE

Continue autonomamente o desenvolvimento do Veritas até a trajetória v5.0.0. O trabalho anterior já existe e não deve ser reiniciado. Não apague, não reescreva e não substitua partes funcionais sem necessidade. Preserve o que já funciona, escolha o próximo bloqueio técnico real, implemente uma mudança pequena e testável, execute os gates, documente a evidência, faça commits separados quando houver código e documentação, publique no branch correto e reporte somente progresso real. Para os marcos posteriores à v2.5.0, siga `docs/VERITAS_V3_V5_ROADMAP.md`.

A arquitetura obrigatória continua sendo:

```text
React
  ↓
Vite
  ↓
Tauri 2
  ↓
Rust
```

Não trocar para Electron por conveniência. Não introduzir servidor obrigatório para a simulação local. Não transformar automaticamente uma execução bem-sucedida de CI, um build ou a existência de um `.exe` em declaração de produto pronto.

A ordem de decisão é:

```text
correção
  ↓
determinismo
  ↓
segurança
  ↓
testabilidade
  ↓
performance
  ↓
experiência do usuário
  ↓
velocidade de implementação
```

**Estabilidade é mais importante que velocidade.** A v1.0.0 só pode existir quando estiver realmente estável. A v2.5.0 e a v5.0.0 só podem existir quando todos os critérios finais de cada trajetória estiverem comprovados.

---

## 2. REGRAS NÃO NEGOCIÁVEIS

### 2.1 Não reiniciar o projeto

O projeto já possui código, histórico, branches, tags, releases, workflows, testes e decisões arquiteturais. Antes de modificar qualquer coisa, audite o estado real. Não faça scaffold novo. Não migre a stack. Não apague funcionalidades para simplificar o trabalho. Não force uma versão ou uma release apenas para aparentar progresso.

### 2.2 Não quebrar a `main`

Todo trabalho experimental deve permanecer em branch. A `main` deve continuar utilizável. Antes de qualquer merge, exigir ao menos:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Nunca fazer reset destrutivo, force-push, rebase remoto destrutivo ou alteração direta da `main` sem instrução explícita e sem evidência adequada.

### 2.3 Não confundir níveis de evidência

Use sempre as classificações abaixo:

| Classificação | Significado |
|---|---|
| `BUILD VERIFIED` | O código compilou ou o comando de build terminou com sucesso. Não prova que o artefato funciona para um usuário. |
| `ARTIFACT VERIFIED` | O arquivo gerado existe, possui formato/metadata/hash coerentes e passou por verificações estruturais. Não prova runtime completo. |
| `RUNTIME VERIFIED` | A aplicação ou o domínio foi executado e o comportamento esperado foi demonstrado no ambiente informado. |
| `SMOKE VERIFIED` | Um roteiro curto e controlado de instalação, startup, remoção ou função essencial foi executado. Não equivale a QA completo. |
| `BASELINE RECORDED` | Uma medição de performance ou tamanho foi registrada. Não é limite de produto nem comparação universal. |
| `FAILED` | Um teste ou gate realmente falhou. Registrar causa e impacto. |
| `NOT VERIFIED` | A validação não foi possível, não foi executada ou não há evidência suficiente. Nunca substituir por `PASSED`. |

Um workflow verde demonstra somente que aquele workflow terminou. Uma release exige uma cadeia de evidências:

```text
código compilado
  ↓
artefato gerado
  ↓
artefato verificado
  ↓
aplicação executada
  ↓
smoke test
  ↓
testes automatizados
  ↓
release candidate
  ↓
release
```

### 2.4 Segurança e determinismo

O Veritas deve permanecer local-first, offline-first e privacy-first. Não executar código arbitrário vindo de JSON, HDL, DLS, plugins ou importações. Use allowlists estruturais, schemas, limites de tamanho, limites de profundidade, validação de largura, rejeições fail-closed, erros acionáveis e resultados determinísticos.

A IA, quando implementada, deve seguir obrigatoriamente:

```text
AI
  ↓
Proposal
  ↓
Validation
  ↓
Preview
  ↓
User confirmation
  ↓
Apply
```

Nunca alterar circuito, projeto, storage ou configuração silenciosamente. Credenciais, certificados, tokens, chaves de assinatura e segredos nunca devem entrar no repositório.

### 2.5 Incrementos pequenos

Cada incremento deve possuir escopo limitado, regressões determinísticas, documentação correspondente e commit visível. Evite misturar refatoração ampla, mudança de arquitetura, UI e release no mesmo passo. Se uma mudança exigir validação nativa que não está disponível, implemente o que for possível, marque o restante como `NOT VERIFIED` e não invente evidência.

---

## 3. PROCEDIMENTO OBRIGATÓRIO AO INICIAR UMA NOVA CONVERSA

Uma nova conversa não deve confiar cegamente no texto deste prompt. Ela deve verificar o repositório atual, porque novos commits, tags, releases ou merges podem ter acontecido depois da criação deste arquivo.

### 3.1 Localizar ou clonar o repositório

Se o diretório ainda não existir:

```bash
gh repo clone Lucas-Belucci-Bellini/Veritas
cd Veritas
```

Se já existir:

```bash
cd /home/ubuntu/Veritas
git fetch --all --tags --prune
```

### 3.2 Auditar o estado local

Executar:

```bash
git status --short --branch
git branch -vv
git log -12 --oneline --decorate
git tag --sort=-creatordate | head -20
git remote -v
git diff --check
```

### 3.3 Auditar GitHub

Executar, usando o GitHub CLI já autenticado:

```bash
gh repo view Lucas-Belucci-Bellini/Veritas
gh release list -R Lucas-Belucci-Bellini/Veritas --limit 20
gh workflow list -R Lucas-Belucci-Bellini/Veritas
gh run list -R Lucas-Belucci-Bellini/Veritas --limit 20
gh issue list -R Lucas-Belucci-Bellini/Veritas --state all --limit 50
gh pr list -R Lucas-Belucci-Bellini/Veritas --state all --limit 50
git ls-remote --heads origin
git ls-remote --tags origin
```

Se for necessário consultar uma release desktop específica:

```bash
gh release view desktop-v0.1.0-alpha.1 -R Lucas-Belucci-Bellini/Veritas
```

Se for necessário consultar o histórico de um workflow específico:

```bash
gh run view <RUN_ID> -R Lucas-Belucci-Bellini/Veritas
```

### 3.4 Comparar branch experimental e `main`

Verificar que o trabalho está na branch correta:

```bash
git diff --stat origin/main...HEAD
git diff --name-status origin/main...HEAD
git log --oneline origin/main..HEAD
```

Não presumir que uma alteração do branch experimental esteja em `main`. Não presumir que uma alteração publicada no branch esteja na release pública. Não presumir que uma release pública foi construída a partir do HEAD atual.

### 3.5 Ler a fonte de verdade

Ler, quando relevantes ao passo escolhido:

```text
docs/ROADMAP.md
docs/FEEDBACK_HARDENING.md
docs/LARGE_CIRCUITS.md
docs/DESKTOP.md
CHANGELOG.md
tests/desktop/QA_MATRIX.md
README.md
```

Também verificar os arquivos de código diretamente relacionados ao bloqueio escolhido. Não ler ou reescrever o projeto inteiro sem necessidade.

### 3.6 Auditar comandos reais

O `package.json` é a fonte de verdade dos scripts. Na base atual, os comandos mais importantes incluem:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run bench:circuit-scale
npm run bench:compare
npm run build:lib
npm run build:mcp
npm run build:mcp:http
npm run build:plugin
npm run beta:rust
npm run beta:wasm
npm run beta:wasm:parity
npm run beta:wasm:isolation
npm run beta:mcp
npm run beta:mcp:http
npm run beta:hdl
npm run beta:accessibility
npm run beta:mobile
npm run beta:rollback
npm run beta:onboarding
npm run desktop:build:linux
npm run desktop:build:windows
npm run desktop:build:macos
npm run desktop:metrics
```

Não executar comandos destrutivos ou operações que exigem confirmação automática. Não baixar e executar artefatos desconhecidos de páginas web.

---

## 4. SNAPSHOT HISTÓRICO CONHECIDO — AUDITAR NOVAMENTE

O snapshot abaixo registra o estado comprovado durante a continuidade que originou este prompt. Ele é útil para orientação, mas o agente deve sempre confirmar o estado real novamente.

| Item | Snapshot conhecido |
|---|---|
| Branch de desenvolvimento | `main` após integração; `feature/chip-hierarchy-v1` preservada |
| HEAD conhecido após a integração | `37d3c01` — `merge: integrate feature branch into main` |
| `main` conhecida | `37d3c015efab184f0f8015fcd0c641fcd421fc84` |
| Core informado pelo `package.json` | `0.9.0-rc.18` |
| Release core observada | `v0.9.0-rc.18`, prerelease |
| Release desktop observada | `desktop-v0.1.0-alpha.1`, prerelease |
| Workflow desktop histórico bem-sucedido | `32922086872` |
| Commit do workflow desktop histórico | `dcd4a42fe52db5b8f3d298c5d3729ec4a08c2a13` |
| Arquivo oficial do instalador Windows | `Veritas-Setup.exe` |
| Plataformas obrigatórias | Windows, macOS e Linux |
| Browser visual neste ambiente | Indisponível durante a sequência registrada |
| Máquina/pasta nativa vinculada | Não disponível durante a sequência registrada |

A release desktop histórica tinha sete assets observados:

```text
desktop-release-manifest.json
SHA256SUMS
Veritas-Setup.exe
Veritas_0.1.0-alpha.1_aarch64.app.zip
Veritas_0.1.0-alpha.1_aarch64.dmg
Veritas_0.1.0-alpha.1_amd64.AppImage
Veritas_0.1.0-alpha.1_amd64.deb
```

A existência desses arquivos, por si só, não prova editor, persistência, simulação, atualização, assinatura, notarização ou runtime interativo completo.

---

## 5. ESTADO TÉCNICO JÁ CONSTRUÍDO

O agente deve preservar e ampliar as seguintes áreas, sem recomeçar do zero:

| Área | Estado conhecido |
|---|---|
| Engine combinacional | Parser, AST, avaliação, tabela verdade, simplificação, formas normais e Karnaugh já existem. |
| CircuitDocument | Formato visual com nós, conexões, limites e validações fail-closed. |
| Circuit → Simulator | Conversão para netlist e execução determinística por tiques. |
| Teste cruzado | Regressão permanente comparando Expression → TruthTable com Circuit → Simulator; divergência deve bloquear o gate relacionado. |
| Editor visual | Canvas React Flow, paleta, handles, conexões, seleção, histórico e validação em prévia. |
| Storage local | Projetos e chips locais com IndexedDB/Dexie, import/export e rejeições estruturais. |
| Multi-bit | BitVector, larguras, Splitter/Combiner, operações vetoriais e perfis DLS allowlisted. |
| Custom chips | Biblioteca local, elaboração hierárquica controlada, limites e rejeição de ciclos. |
| Sequencial | Clock, delay, DFF, TFF, JK, SR, feedback, Step, Run, Reset, timeline e waveform. |
| Demos | `jk-clock`, `sr-clock`, `register-4bit` e `counter-4bit`; as regressões fundamentais devem ser preservadas. |
| Testbench | Casos combinacionais e sequenciais, entradas, ticks, expectativas, CRUD local, IndexedDB, import/export fail-closed. |
| Feedback hardening | Budgets de settle e de tiques totais; validação de `tick()`/`restoreState()`; diagnóstico de estabilização/ciclo/budget. |
| Preview diagnóstica | `diagnoseDocumentRuntimePreview()` cria cópia isolada, pode restaurar estado e aplicar entradas sem mutar o runtime original. |
| UI diagnóstica | Workspace sequencial com ação **Diagnosticar preview**, bounded em 64 tiques, com status acessível. |
| HDL | Exportação Verilog/VHDL em prévia e testes determinísticos existentes. |
| MCP | Servidor/plugin MCP com contratos de segurança e aceitação própria. |
| Desktop | Shell Tauri 2 sobre Vite/React, Rust e empacotamento por runners. |
| CI/CD | Workflows separados para qualidade, release e desktop, com artefatos e checksums. |

O que existe no branch experimental não deve ser descrito como parte da release desktop histórica sem confirmar o commit da release.

---

## 6. PRÓXIMO BLOQUEIO TÉCNICO PRIORITÁRIO

Após a preview diagnóstica visual, o próximo passo prioritário é integrar o diagnóstico ao **testbench declarativo**, sem misturar a semântica de acomodação automática com a semântica de pulsos manuais.

### 6.1 Objetivo

Fazer com que um caso de testbench possa informar não apenas PASS/FAIL/INVALID, mas também a causa operacional de uma execução limitada:

```text
stabilized
cycle-detected
budget-exhausted
```

O relatório deve continuar distinguindo:

```text
PASS  = expectativas observadas foram atendidas
FAIL  = execução terminou, mas uma ou mais expectativas divergiram
INVALID = formato, contrato, input ou budget inválido
DIAGNOSTIC LIMIT = a execução bounded não estabilizou ou detectou ciclo
```

Não transformar automaticamente `cycle-detected` em erro lógico. Um circuito sequencial pode ter um ciclo temporal esperado. O relatório deve apresentar diagnóstico e resultado funcional separadamente.

### 6.2 Requisitos do próximo incremento

1. Reutilizar `createDocumentRuntime()`, `diagnoseDocumentRuntime()` ou `diagnoseDocumentRuntimePreview()`; não duplicar a lógica do `Simulator`.
2. Manter cada caso isolado em runtime novo.
3. Preservar as entradas, os ticks manuais, as expectativas e o comportamento atual do runner.
4. Adicionar um campo opcional de diagnóstico ao resultado, sem quebrar consumidores existentes.
5. Diferenciar falha de expectativa, ciclo detectado, budget esgotado e documento inválido.
6. Definir um budget bounded e validá-lo fail-closed.
7. Não alterar o runtime ativo do editor ou do workspace.
8. Adicionar testes para estabilização, ciclo, budget, mismatch e estado isolado.
9. Atualizar `ROADMAP.md`, `CHANGELOG.md`, `FEEDBACK_HARDENING.md` e `QA_MATRIX.md` somente com o que foi realmente verificado.
10. Executar testes focados e gates completos antes de publicar.

### 6.3 Critérios de aceitação

O incremento só pode ser considerado concluído quando:

```text
[ ] casos combinacionais antigos continuam iguais
[ ] casos sequenciais antigos continuam iguais
[ ] PASS/FAIL/INVALID continuam compatíveis
[ ] diagnóstico aparece de forma estruturada quando aplicável
[ ] ciclo não causa loop infinito
[ ] budget inválido é rejeitado fail-closed
[ ] runtime original não é mutado
[ ] testes focados passam
[ ] suíte completa passa
[ ] typecheck passa
[ ] lint passa
[ ] build passa
[ ] documentação registra limites reais
[ ] código e docs são commitados
[ ] branch remoto é atualizado
```

---

## 7. ROADMAP EXECUTÁVEL ATÉ v2.5.0

> A trajetória pós-v2.5.0 até v5.0.0 está resumida em [`VERITAS_V3_V5_ROADMAP.md`](./VERITAS_V3_V5_ROADMAP.md) e detalhada operacionalmente em [`VERITAS_MASTER_BUILD_QUEUE.md`](./VERITAS_MASTER_BUILD_QUEUE.md). Esses documentos são complementares a esta seção e não promovem nenhuma versão automaticamente.

As seções a seguir são a lista completa de trabalho. O agente deve avançar na ordem de dependência e pode quebrar cada seção em vários commits/releases intermediários. Não é permitido declarar um marco concluído porque somente parte da funcionalidade foi implementada.

### 7.1 Fase 0 — Auditoria e base de continuidade

A Fase 0 já foi iniciada, mas deve ser repetida no começo de cada nova conversa. O resultado esperado é um snapshot verificável de Git, GitHub, branches, tags, releases, workflows, builds, testes, performance, documentação e limitações ambientais.

Entregas obrigatórias:

| Entrega | Critério |
|---|---|
| Snapshot Git | Branch, HEAD, status limpo ou alterações explicadas, tags e diferença em relação à `main`. |
| Snapshot GitHub | Releases, assets, workflows, runs, issues, PRs e branches remotos. |
| Snapshot de build | `npm run build`, typecheck e lint com saída registrada. |
| Snapshot desktop | Builds e métricas por sistema, sem inferir runtime não executado. |
| Snapshot de testes | Total de arquivos/testes e suites especiais relevantes. |
| Snapshot de limitações | Browser, máquina nativa, assinatura, notarização, credenciais e qualquer bloqueio. |
| Relatório | Documento datado que separa estado comprovado de hipótese. |

### 7.2 Fase 1 — Hardening do núcleo e porta de entrada para 0.5.0

Antes de iniciar formalmente os testes de produto desktop, fechar a base determinística do núcleo.

Trabalhos:

- Manter a paridade Expression → TruthTable versus Circuit → Simulator para portas fundamentais, meio somador, somador completo, multiplexador e futuros circuitos.
- Cobrir AND, OR, NOT, NAND, NOR, XOR e XNOR com todas as combinações possíveis dentro dos limites.
- Cobrir Half Adder, Full Adder, Multiplexer, Demultiplexer, Decoder, Encoder e Comparator quando os modelos existirem.
- Cobrir Latch, Flip-Flop, Counter e Register com semântica temporal declarada.
- Fixar contratos de largura, portas, ordem de entradas, ordem de saídas e sinais ausentes.
- Rejeitar documentos inválidos antes de executar.
- Garantir que import/export faça round-trip sem perda.
- Manter a suíte permanente em `tests/regression/`.
- Integrar o testbench diagnosticado, incluindo `PASS`, `FAIL`, `INVALID`, `cycle-detected` e `budget-exhausted`.
- Documentar claramente que uma não-estabilização bounded é diagnóstico, não necessariamente defeito lógico.

Saída da fase: suíte de regressão confiável, testbench explicável, contratos fail-closed e nenhuma divergência conhecida entre intenção e execução.

### 7.3 Release desktop 0.5.0 — início formal de QA do produto

`desktop 0.5.0` não é apenas um número. É o início formal do teste do aplicativo como produto.

Para **Windows**, validar em runner nativo ou máquina real:

```text
[ ] build Windows
[ ] Veritas.exe produzido quando aplicável
[ ] Veritas-Setup.exe produzido
[ ] PE/NSIS e metadata conferidos
[ ] SHA-256 produzido
[ ] asset anexado a release candidata/release correta
[ ] instalação limpa
[ ] atalho criado
[ ] aplicativo inicia
[ ] editor abre
[ ] circuito pode ser criado
[ ] conexões podem ser feitas
[ ] circuito pode ser salvo
[ ] circuito pode ser fechado
[ ] circuito pode ser reaberto
[ ] simulação combinacional funciona
[ ] simulação sequencial funciona
[ ] projeto permanece local
[ ] fluxo sem rede funciona
[ ] aplicação fecha normalmente
[ ] desinstalação funciona
[ ] atualização preserva projetos
```

Para **macOS**, validar os targets prometidos:

```text
[ ] Veritas.app produzido
[ ] Veritas.dmg produzido
[ ] app zip produzido quando aplicável
[ ] arquitetura documentada
[ ] metadata e bundle verificados
[ ] assinatura verificada ou limitação documentada
[ ] notarização verificada ou limitação documentada
[ ] startup
[ ] editor
[ ] criação e edição de circuito
[ ] save/reopen
[ ] simulação
[ ] IndexedDB
[ ] offline
[ ] atualização
[ ] remoção
```

Para **Linux**, validar:

```text
[ ] Veritas.AppImage produzido
[ ] Veritas.deb produzido
[ ] RPM somente se houver target e evidência
[ ] metadata
[ ] SHA-256
[ ] instalação do deb
[ ] startup controlado
[ ] editor
[ ] simulação
[ ] save/reopen
[ ] offline
[ ] atualização
[ ] remoção
[ ] AppImage em ambiente independente quando possível
```

A matriz `tests/desktop/QA_MATRIX.md` deve registrar cada caso como `BUILD VERIFIED`, `ARTIFACT VERIFIED`, `RUNTIME VERIFIED`, `SMOKE VERIFIED`, `FAILED` ou `NOT VERIFIED`. Nenhuma linha pode ser promovida apenas porque o workflow terminou.

### 7.4 v0.6.0 — simulação sequencial mais forte

Consolidar clock, delay e memória temporal sem loops infinitos.

Entregas:

- Clock com período documentado e limites.
- Delay com fila determinística e limites.
- DFF com borda de subida, Q e Q̄.
- TFF com hold/toggle e clock.
- JK com hold/set/reset/toggle, J/K/CLK, Q e Q̄.
- SR com hold/set/reset, S/R/CLK, Q e Q̄; S=R=1 deve ter comportamento determinístico documentado.
- Feedback sem recursão ilimitada.
- Reset quando o contrato do componente existir.
- Step, Run, Pause e Reset sem loops de UI.
- Timeline limitada e determinística.
- Waveform acessível, com ticks e níveis 0/1.
- Registrador 4-bit com captura simultânea.
- Contador 4-bit com carry e acomodação declarada.
- Diagnóstico de estabilização, ciclo e budget.
- Preview isolada para não mutar runtime ativo.
- Integração do diagnóstico ao testbench.
- Testes de restauração e isolamento de estados.
- Validação visual e desktop real quando houver ambiente disponível.

Não considerar `v0.6.0` totalmente verificada enquanto inspeção visual, save/reopen real e runtime interativo desktop permanecerem ausentes.

### 7.5 v0.7.0 — editor visual maduro

O editor deve deixar de ser apenas uma demonstração técnica.

Entregas:

- Drag/drop confiável.
- Seleção individual e multi-seleção.
- Conexão, desconexão e reconexão.
- Handles acessíveis e mensagens de erro acionáveis.
- Snap e alinhamento.
- Zoom e pan.
- Undo e redo.
- Copy, paste e duplicate.
- Delete com confirmação ou undo.
- Auto-layout bounded e determinístico.
- Seleção de subcircuitos e custom chips.
- Validação de ciclos combinacionais antes da execução quando possível.
- Preservação de dados durante operações comuns.
- Testes puros de modelo e testes de interação quando o ambiente permitir.
- Smoke visual em navegador e desktop.

Critério de saída: usuário consegue criar, editar, conectar, salvar e reabrir circuito pequeno sem perda ou comportamento silencioso.

### 7.6 v0.8.0 — multi-bit completo e seguro

O suporte multi-bit deve ser explícito, validado e sem truncamento silencioso.

Entregas:

- 1, 2, 4, 8, 16, 32 e 64 bits conforme limites publicados.
- BitVector determinístico.
- Operações bitwise.
- Comparação de largura.
- Splitter com partições válidas.
- Combiner com soma de larguras validada.
- Displays binário e hexadecimal.
- Constantes de largura explícita.
- Propagação de erro para largura incompatível.
- HDL com largura preservada.
- Storage round-trip de barramentos.
- Testes para endian/order público de portas.
- Proteção contra overflow, truncamento e valores impossíveis.
- Perfis DLS allowlisted sem execução arbitrária de JSON/código.
- Benchmarks por largura.

Critério de saída: circuito multi-bit suportado pode ser criado, simulado, salvo, reaberto, importado e exportado com resultado determinístico e largura preservada.

### 7.7 v0.9.0 — workspace sequencial e persistência

Consolidar o workspace visual temporal como produto utilizável.

Entregas:

- Workspace especializado para Clock, DFF, TFF, JK, SR, Counter, Register e Delay.
- Step, Run, Pause, Reset, Watch, Timeline e Waveform.
- Diagnóstico de preview bounded.
- Testbench conectado ao workspace e ao domínio.
- Checkpoints locais.
- Isolamento entre circuitos/documentos.
- Restauração validada.
- Colaboração temporal sem aplicação remota silenciosa.
- Estado remoto com oferta explícita, versão-base e rejeição de estado obsoleto.
- Persistência de inputs, clock periods, simulator state e timeline.
- Save/reopen real em navegador e desktop.
- Import/export real de testbenches.
- Acessibilidade do painel temporal.

Critério de saída: um contador, registrador e feedback podem ser executados de forma determinística sem congelar a interface e sem perder estado local.

### 7.8 v0.10.x — custom chips e biblioteca hierárquica

A base de chips customizados existe em prévia. O trabalho restante deve amadurecer o contrato.

Entregas:

- Pinos de entrada e saída explícitos.
- Subcircuito salvo como componente.
- Biblioteca local com IDs estáveis.
- Validação de definição antes de persistir.
- Expansão com limite de profundidade.
- Rejeição de referências inexistentes.
- Rejeição de ciclos hierárquicos.
- Limite de nós/conexões/tamanho.
- Preservação de labels e portas públicas.
- Compatibilidade de versão e migração.
- Chips combinacionais e sequenciais somente quando a semântica temporal estiver definida.
- Testes de import/export, nested chips, erros e isolamento.
- Não permitir que chip importado execute código arbitrário.

### 7.9 v1.0.0 — primeira estabilidade real

Não publicar `v1.0.0` por calendário, entusiasmo ou quantidade de features. Publicar somente quando os critérios abaixo estiverem comprovados.

```text
[ ] Core estável
[ ] Engine estável
[ ] CircuitDocument estável
[ ] Editor estável
[ ] Simulator estável
[ ] Sequencial estável
[ ] Multi-bit estável
[ ] Custom chips estáveis
[ ] Storage estável
[ ] IndexedDB estável
[ ] Import/export estável
[ ] Testbench estável
[ ] Regressões verdes
[ ] CI verde
[ ] Windows validado
[ ] macOS validado
[ ] Linux validado
[ ] Veritas-Setup.exe validado no nível exigido
[ ] .dmg/.app validado no nível exigido
[ ] .deb/AppImage validados no nível exigido
[ ] Offline validado
[ ] Save/reopen validado
[ ] Atualização validada
[ ] Remoção validada
[ ] Acessibilidade validada
[ ] Performance aceitável
[ ] Segurança revisada
[ ] Zero P0 conhecido
[ ] Zero P1 conhecido
[ ] Documentação atualizada
[ ] Release notes completas
[ ] Checksums reproduzíveis
```

Se algum critério não estiver pronto, usar `1.0.0-rc.1`, `1.0.0-rc.2` e assim por diante. Não esconder limitações atrás da palavra stable.

### 7.10 v1.1 — UX e onboarding

Entregas:

- Fluxo de primeiro uso.
- Tutorial de criação do primeiro circuito.
- Explicação de entradas, portas, outputs e tabela verdade.
- Tutorial sequencial para clock, DFF, contador e waveform.
- Mensagens de erro para iniciantes.
- Atalhos documentados.
- Ajuda contextual sem rede obrigatória.
- Estados vazios úteis.
- Indicadores de persistência local/offline.
- Acessibilidade de teclado e leitores de tela.
- Smoke e testes de onboarding.

### 7.11 v1.2 — custom chips amadurecidos

Entregas:

- Edição de pinos e contratos.
- Versionamento de definição.
- Migração de chips.
- Busca e reutilização no projeto.
- Visualização de hierarquia.
- Limite de expansão e custo.
- Mensagens de dependência quebrada.
- Testes de compatibilidade entre versões.
- Export/import de biblioteca local.

### 7.12 v1.3 — biblioteca avançada

Entregas:

- Catálogo de gates e chips.
- Categorias e tags.
- Busca local.
- Metadados de entradas, saídas, largura, temporalidade e compatibilidade.
- Favoritos e recentes.
- Exemplos didáticos.
- Versão de catálogo.
- Importação allowlisted.
- Compatibilidade com projetos antigos.
- Testes de catálogo, materializadores e IDs estáveis.

### 7.13 v1.4 — verification

Transformar a verificação em uma camada explícita, determinística e reproduzível.

Entregas:

- Equivalência Expression → Circuit.
- Equivalência Circuit A → Circuit B.
- Testbench combinacional.
- Testbench sequencial.
- Assertions sobre entradas, saídas, ticks e estados.
- Relatório PASS/FAIL/INVALID.
- Diagnóstico de ciclo e budget.
- Counterexample mínimo quando possível.
- Snapshots reproduzíveis.
- Comparação de timelines.
- Falha de equivalência bloqueando release.
- Limites para explosão combinatória.
- Relatórios locais, exportáveis e sem dados externos obrigatórios.

### 7.14 v1.5 — HDL

A exportação HDL existente em prévia deve ser amadurecida e, se importação for implementada, permanecer segura.

Entregas:

- Verilog com largura/ordem preservadas.
- VHDL com largura/ordem preservadas.
- Naming determinístico.
- Escaping seguro.
- Exportação de gates, barramentos e componentes suportados.
- Relatório de recursos não exportáveis.
- Importação somente com parser e allowlist, nunca execução de código.
- Round-trip onde o contrato permitir.
- Fixtures versionadas.
- Testes com toolchains quando disponíveis.
- Documentação de incompatibilidades.

### 7.15 v1.6 — Veritas Benchmark Suite

Criar e manter uma suite de benchmark versionada por release.

Medir, separando web, domínio e desktop:

```text
Startup
Memory idle
Memory during simulation
Simulation time
Rendering/FPS
Truth table generation
Save
Load
Import
Export
Build size
Download size
Installed size
```

Também medir circuitos de:

```text
10 gates
100 gates
500 gates
1000 gates
5000 gates
```

Os limites atuais do editor podem recusar 500/1000/5000 gates. O netlist bruto pode ser usado para diagnóstico interno, mas isso não declara suporte oficial do editor, persistência, renderização ou produto. Registrar status `NOT SUPPORTED` ou `NOT VERIFIED` de forma explícita.

Guardar baseline por release, ambiente, sistema operacional, arquitetura, Node/Rust/Tauri, commit e método de medição. Não comparar números de plataformas diferentes como se fossem equivalentes.

### 7.16 v1.7 — desktop maduro

O desktop deve ser tratado como produto principal e não somente como shell.

Windows:

```text
Veritas.exe
Veritas-Setup.exe
```

macOS:

```text
Veritas.app
Veritas.dmg
```

Linux:

```text
Veritas.AppImage
Veritas.deb
```

Entregas:

- Pipeline nativo para os três sistemas.
- Manifesto por asset.
- SHA256SUMS.
- Nome oficial `Veritas-Setup.exe`.
- Instalação, atualização, downgrade/rollback se suportado.
- Preservação de projetos.
- Startup e fechamento normais.
- Assinatura Windows quando configurada.
- Assinatura e notarização macOS quando configuradas.
- AppImage e Debian testados em ambientes compatíveis.
- Canais alpha/beta/rc/stable.
- Release notes com known issues.
- Não incluir segredos no repositório.

### 7.17 v1.8 — project system

Estruturar um projeto real:

```text
Project
 ├── Circuits
 ├── Chips
 ├── Tests
 ├── Simulations
 └── Metadata
```

Entregas:

- Projeto com identificador e versão.
- Circuitos múltiplos.
- Chips locais.
- Testbenches associados.
- Simulações e snapshots.
- Metadata de plataforma/versão.
- Autosave local.
- Histórico.
- Restore.
- Rollback.
- Import/export.
- Migração entre versões.
- Rejeição de projeto corrompido.
- Backup local opcional.
- Indicador de dirty state.
- Testes de perda de dados, interrupção e round-trip.

### 7.18 v1.9 — AI Assistant controlada

A IA deve ser auxiliar, nunca uma fonte de mutação silenciosa.

Capacidades possíveis:

- Explicar portas e circuitos.
- Sugerir simplificações.
- Detectar possíveis problemas.
- Analisar testbench.
- Propor circuito.
- Propor correção.
- Gerar documentação.
- Ajudar no HDL.

Cada operação deve passar por:

```text
proposta
  ↓
validação estrutural
  ↓
preview visual/diff
  ↓
confirmação do usuário
  ↓
aplicação explícita
  ↓
registro local da mudança
```

Requisitos:

- Sem execução arbitrária de código.
- Sem upload obrigatório de projeto.
- Consentimento explícito para qualquer serviço remoto.
- Limites de tokens/tamanho/custo quando aplicável.
- Logs sanitizados.
- Diferença antes/depois.
- Undo/rollback.
- Falha fechada quando a proposta não puder ser validada.
- Testes de prompt injection e conteúdo não confiável.

### 7.19 v2.0.0 — nova geração arquitetural

Antes de implementar a v2.0.0, criar e revisar estes documentos no repositório:

```text
docs/V2_ARCHITECTURE.md
docs/V2_MIGRATION.md
docs/V2_MASTER_PLAN.md
```

A v2.0.0 deve ser uma mudança planejada, não uma reescrita impulsiva.

Objetivos:

- Engine modular.
- Simulator modular.
- Circuit model modular.
- Storage modular.
- Renderer modular.
- Verification modular.
- HDL modular.
- AI contracts.
- Plugin architecture segura.
- Desktop architecture explícita.
- Migration system.
- Compatibilidade com documentos antigos.
- Plano de rollback.
- Testes de paridade antes/depois.

Critérios antes de quebrar contratos:

```text
[ ] formato novo definido
[ ] migração versionada
[ ] round-trip antigo → novo
[ ] rejeição de versões desconhecidas
[ ] rollback
[ ] equivalência de simulação
[ ] equivalência de truth table
[ ] benchmark comparativo
[ ] plano de release
[ ] documentação do impacto
```

### 7.20 v2.1.0 — modularidade

Separar claramente, evitando dependências circulares:

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

Entregas:

- Interfaces entre módulos.
- Dependências unidirecionais.
- Tipos públicos versionados.
- Testes unitários por módulo.
- Testes de contrato entre módulos.
- Builds separados quando benéfico.
- Sem duplicação de lógica entre web, MCP, testbench e desktop.
- Simulator compartilhado por todos os consumidores.
- Documentação de arquitetura e limites.

### 7.21 v2.2.0 — plugins seguros

Plugins podem adicionar gates, chips, exporters, analyzers e visualizations, mas nunca podem ganhar execução irrestrita por padrão.

Entregas:

- Manifesto de plugin.
- Schema de capacidades.
- API versionada.
- Allowlist de operações.
- Sandbox ou processo isolado quando necessário.
- Limites de CPU, memória, tamanho e tempo.
- Nenhum acesso automático a arquivos/projetos fora da permissão.
- Nenhuma rede por padrão.
- Assinatura/verificação quando o modelo de distribuição exigir.
- Desativação segura.
- Compatibilidade de versões.
- Logs sanitizados.
- Rejeição de plugin malformado ou com capacidade não autorizada.
- Testes de segurança e regressão.

### 7.22 v2.3.0 — professional workspace

Transformar o Veritas em uma IDE de circuitos digitais.

Entregas:

- Tabs.
- Project explorer.
- Hierarquia de chips.
- Component browser.
- Inspector.
- Command palette.
- Waveform viewer.
- Simulation panel.
- Verification panel.
- Navegação por referências.
- Atalhos consistentes.
- Layout persistente.
- Painéis redimensionáveis.
- Estado de projeto local.
- Acessibilidade de teclado.
- Onboarding para iniciantes.
- Performance com projetos maiores dentro dos limites publicados.

### 7.23 v2.4.0 — automated verification

Criar uma camada de verificação automatizada de nível de plataforma.

Componentes:

```text
Testbench
Assertions
Regression
Equivalence
Snapshots
Benchmarks
```

Fluxo mínimo:

```text
Input
  ↓
Circuit
  ↓
Expected
  ↓
Simulation
  ↓
PASS / FAIL / INVALID
```

Entregas:

- Testbenches associáveis a projetos.
- Assertions combinacionais.
- Assertions temporais.
- Regressões executáveis localmente e no CI.
- Equivalência entre expressão, circuito e HDL quando aplicável.
- Snapshots reproduzíveis.
- Relatórios com commit, versão, plataforma e budget.
- Counterexamples.
- Diagnóstico de ciclo/budget.
- Bloqueio de release em divergência.
- Benchmarks no mesmo pipeline de regressão.
- Import/export de suites com validação.
- Nenhuma execução remota silenciosa.

### 7.24 v2.5.0 — gate final da trajetória

A versão Veritas 2.5.0 só existe quando todos os blocos abaixo estiverem estáveis e comprovados:

```text
Stable Engine
Stable Editor
Stable Simulator
Sequential Logic
Multi-bit
Custom Chips
Verification
Testbench
HDL
Projects
Plugins
AI Assistant
Desktop
Performance
Security
Documentation
CI/CD
```

E os artefatos obrigatórios estiverem disponíveis e verificados:

```text
Windows
  └── Veritas-Setup.exe

macOS
  └── Veritas.dmg

Linux
  ├── Veritas.AppImage
  └── Veritas.deb
```

Gate final:

```text
[ ] todos os módulos têm contratos documentados
[ ] engine determinística
[ ] simulator combinacional e sequencial estável
[ ] editor sem perda de dados nos fluxos suportados
[ ] multi-bit sem truncamento silencioso
[ ] custom chips seguros
[ ] verification reproduzível
[ ] testbench com PASS/FAIL/INVALID
[ ] HDL seguro e documentado
[ ] project system com migração
[ ] plugins sandboxed/allowlisted
[ ] IA segue proposta → validação → preview → confirmação → aplicação
[ ] desktop Windows validado
[ ] Veritas-Setup.exe validado
[ ] desktop macOS validado
[ ] Veritas.dmg validado
[ ] desktop Linux validado
[ ] Veritas.AppImage validado
[ ] Veritas.deb validado
[ ] startup medido
[ ] memória medida
[ ] simulação medida
[ ] renderização medida quando aplicável
[ ] save/load/import/export medidos
[ ] CI/CD verde
[ ] checksums reproduzíveis
[ ] release notes completas
[ ] known issues publicados
[ ] zero P0 conhecido
[ ] zero P1 conhecido
[ ] documentação atualizada
[ ] rollback definido
[ ] não há segredo no repositório
```

Se qualquer bloco falhar, publicar um RC, beta ou alpha conforme o caso, ou adiar a release. Nunca publicar uma falsa v2.5.0.

---

## 8. PERFORMANCE E ESCALA

O Veritas deve conhecer seus limites reais sem anunciar suporte que não existe.

### 8.1 CircuitDocument versus Netlist

Distinguir sempre:

```text
CircuitDocument → validação editorial, limites, persistência, renderização e UX
Netlist → diagnóstico bruto de capacidade do Simulator
```

Uma medição de Netlist bruto em 5000 gates não autoriza afirmar que o editor, storage, renderer ou produto suportam 5000 gates. Os limites canônicos documentados devem continuar sendo respeitados até existir contrato específico para circuitos grandes.

### 8.2 Benchmarks

Cada benchmark deve registrar:

```text
benchmark id
commit
version
platform
architecture
OS
Node/Rust/Tauri versions
fixture
warmup
iterations
ticks
elapsed time
memory when available
checksum
status
limitations
```

Não usar números de benchmark como promessa de performance universal. Comparar releases somente com ambiente comparável.

### 8.3 Circuitos grandes

Antes de ampliar os limites editoriais, exigir:

```text
[ ] contrato de formato
[ ] migração
[ ] budget de nós
[ ] budget de conexões
[ ] budget de bytes
[ ] budget de operações
[ ] budget de memória
[ ] renderização parcial/virtualizada
[ ] persistência testada
[ ] import/export testados
[ ] simulação bounded
[ ] UX de erro/progresso
[ ] QA multiplataforma
```

---

## 9. CI/CD E SISTEMA DE RELEASE

O pipeline deve manter workflows de qualidade e desktop com responsabilidades distintas.

### 9.1 Quality workflow

Em pull requests e pushes na `main`, executar conforme os scripts disponíveis:

```text
checkout
install dependencies
unit/integration tests
Rust acceptance
WASM readiness/parity/isolation
engine benchmark
circuit scale benchmark
typecheck
lint
build frontend
build MCP/plugin bundles
HDL acceptance
accessibility acceptance
mobile/rollback/onboarding acceptance quando configurados
HTTP/PWA smoke
upload sanitized reports
```

Uma falha deve impedir promoção da branch correspondente.

### 9.2 Desktop workflow

Em `workflow_dispatch` ou tag desktop deliberada:

```text
checkout exact ref
install Node
install Rust
install Linux dependencies when needed
run quality gates
build Linux
build Windows
build macOS
run platform smoke where supported
normalize Windows name to Veritas-Setup.exe
package macOS app/dmg
upload platform artifacts
generate manifest
generate SHA256SUMS
attach assets to the exact release tag
```

O workflow precisa usar o commit/ref correto. Não anexar artefatos de um branch experimental a uma release histórica por engano.

### 9.3 Release gate

Antes de criar tag ou release:

```text
[ ] código commitado
[ ] branch correto
[ ] status limpo
[ ] tests completos verdes
[ ] typecheck verde
[ ] lint verde
[ ] build web verde
[ ] benchmark executado
[ ] build desktop por target disponível
[ ] artefatos conferidos
[ ] manifest conferido
[ ] SHA256SUMS conferido
[ ] smoke classificado corretamente
[ ] known issues escritos
[ ] CHANGELOG atualizado
[ ] QA_MATRIX atualizado
[ ] versão conferida
[ ] commit da release registrado
[ ] nenhum P0/P1 conhecido
```

A release precisa possuir:

```text
Version
Date
Highlights
Added
Changed
Fixed
Performance
Security
Known issues
Downloads
Checksums
Commit
Platform
Architecture
```

---

## 10. WINDOWS E `Veritas-Setup.exe`

O instalador Windows é requisito oficial do produto. O nome final deve ser `Veritas-Setup.exe`, mesmo que o arquivo original gerado pelo NSIS possua outro nome. A normalização de nome não pode esconder ausência de instalador real.

A validação completa deve distinguir:

| Item | Evidência necessária |
|---|---|
| Build | Runner Windows concluiu o build. |
| Artefato | PE/NSIS, tamanho, metadata e hash. |
| Release | Asset está anexado à tag/release correta. |
| Instalação | Instala em diretório temporário. |
| Startup | Aplicação permanece aberta e sem erro. |
| Atalho | Atalho realmente criado. |
| Editor | Editor abre e permite circuito. |
| Persistência | Projeto salva e reabre. |
| Simulação | Combinação e sequência funcionam. |
| Offline | Fluxo repete sem rede. |
| Fechamento | Aplicação fecha normalmente. |
| Atualização | Projetos são preservados. |
| Remoção | Desinstala sem deixar instalação inválida. |

Se somente build, hash e startup controlado forem possíveis, reportar somente esses itens como verificados.

---

## 11. macOS E LINUX

### 11.1 macOS

Manter explícito se o target é arm64, x86_64 ou ambos. Se assinatura ou notarização não estiverem configuradas, documentar como limitação. Build e upload não são evidência de startup, editor, simulação ou persistência.

### 11.2 Linux

Preservar os caminhos que funcionam: `.deb` e AppImage. O smoke controlado com Xvfb pode validar startup limitado, instalação e remoção, mas não substitui editor interativo, save/reopen, simulação completa ou execução independente do AppImage.

---

## 12. PROTOCOLO DE BLOQUEIO

Quando houver bloqueio, não repetir cegamente a mesma tentativa. Usar exatamente este formato:

```text
BLOCKER

Cause:
Impact:
What was attempted:
Result:
Next action:
```

Exemplo de ambiente sem validação nativa:

```text
BLOCKER

Cause: não há máquina/pasta nativa vinculada ou Browser interativo disponível.
Impact: editor visual, save/reopen, IndexedDB desktop e runtime interativo permanecem NOT VERIFIED.
What was attempted: build web, build Tauri, métricas, smoke controlado em runner e auditoria de release.
Result: BUILD VERIFIED e ARTIFACT VERIFIED; somente smoke limitado onde houver evidência.
Next action: executar a matriz em runners nativos ou em máquina vinculada, registrando logs e hashes.
```

Nunca resolver um bloqueio convertendo `NOT VERIFIED` em `PASSED`.

---

## 13. FORMATO DE TRABALHO DO AGENTE

Para cada incremento:

### Fase A — entender

Ler o roadmap, o arquivo de código relevante, os testes próximos e os contratos. Identificar dependências e o risco de mutar estado ativo.

### Fase B — propor internamente

Escolher a menor mudança que resolve o bloqueio. Não pedir autorização para cada pequena tarefa já autorizada por este prompt, mas não ultrapassar escopo ou fazer release sem critérios.

### Fase C — implementar

Modificar somente os arquivos necessários. Reutilizar domínio existente. Não duplicar Simulator, validação, netlist ou regras de segurança.

### Fase D — testar focado

Executar os testes diretamente relacionados. Corrigir falhas reais antes de ampliar o escopo.

### Fase E — testar completo

Executar:

```bash
npm test
npm run bench:circuit-scale
npm run typecheck
npm run lint
npm run build
npm run desktop:build:linux
npm run desktop:metrics
git diff --check
```

Executar builds Windows/macOS nos runners apropriados quando o gate exigir. Não declarar que um comando não executado passou.

### Fase F — documentar

Atualizar roadmap, changelog, matriz de QA e decisão técnica apenas com evidências reais. Manter limitações e `NOT VERIFIED`.

### Fase G — publicar branch

Usar commits claros, preferencialmente separados:

```text
feat: ...
docs: ...
fix: ...
test: ...
```

Depois:

```bash
git status --short --branch
git push origin <branch>
git ls-remote --heads origin <branch>
```

### Fase H — relatório

Informar em português:

```text
VERITAS DEVELOPMENT STATUS

Current:
Target:
Current milestone:
Completed:
In progress:
Blocked:
Tests:
Build:
Artifact:
Runtime:
Smoke:
Release:
Next:
```

Só enviar progresso quando houver mudança real. Um novo relatório deve citar commits, testes, classificações e limitações; não enviar atualizações vazias.

---

## 14. CONTRATO DE RETOMADA EM NOVA CONVERSA

Quando o usuário abrir outra conversa e disser “continue o Veritas”, o agente deve:

1. Localizar o repositório oficial.
2. Ler este arquivo `docs/VERITAS_MASTER_CONTINUATION_PROMPT.md`.
3. Executar a auditoria de Git/GitHub da seção 3.
4. Comparar o HEAD real com o snapshot escrito aqui.
5. Ler `docs/ROADMAP.md`, `docs/VERITAS_V3_V5_ROADMAP.md`, `docs/VERITAS_MASTER_BUILD_QUEUE.md`, `CHANGELOG.md` e `tests/desktop/QA_MATRIX.md`.
6. Identificar qual foi o último commit funcional e o último commit documental.
7. Confirmar se a árvore está limpa.
8. Confirmar se alguma nova release foi criada desde o snapshot.
9. Escolher o próximo bloqueio real, preferencialmente o primeiro item pendente do roadmap.
10. Não presumir que o conteúdo deste prompt esteja aplicado à `main` ou à release pública.
11. Não reiniciar o projeto.
12. Implementar o menor incremento testável.
13. Executar os gates apropriados.
14. Commitar, publicar no branch e relatar.

Se o usuário apenas anexar outra cópia deste prompt, comparar hashes/tamanho antes de reler várias cópias. Não tratar cópias duplicadas como novos requisitos.

---

## 15. DEFINIÇÃO DE “PRONTO”

Uma tarefa técnica está pronta quando o código necessário existe, os testes relacionados passam, os gates apropriados passam, os limites estão documentados, o diff está limpo, o commit foi criado e o branch foi publicado. Uma release está pronta somente quando os critérios de release e as evidências de plataforma também estão completos.

Uma plataforma está validada somente quando a evidência correspondente existe. Build Windows não é runtime Windows. `.dmg` gerado não é macOS validado. `.deb` instalado sob Xvfb não é editor Linux totalmente validado. `Veritas-Setup.exe` anexado não é produto Windows estável.

Uma versão é estável somente quando não há P0/P1 conhecidos, os três sistemas obrigatórios foram testados nos fluxos exigidos, os artefatos são reproduzíveis e os documentos permitem reproduzir as decisões.

---

## 16. ORDEM RECOMENDADA A PARTIR DO ESTADO CONHECIDO

Se a auditoria inicial não revelar mudança posterior, seguir esta ordem:

```text
1. Integrar diagnóstico bounded ao testbench declarativo.
2. Adicionar relatório estruturado de PASS/FAIL/INVALID + diagnóstico.
3. Cobrir testbench de register-4bit e counter-4bit.
4. Criar classificação estática de ciclos no grafo antes da execução.
5. Definir budgets de operações e memória por documento.
6. Validar preview visual em navegador quando disponível.
7. Executar smoke save/reopen/import/export real.
8. Ampliar QA desktop nativo Windows/macOS/Linux.
9. Fechar critérios de desktop 0.5.0.
10. Continuar hardening de editor, multi-bit e project system.
11. Criar docs de v2 antes da arquitetura 2.0.0.
12. Só depois avançar para modularidade, plugins, professional workspace e automated verification.
13. Após a v2.5.0, seguir `docs/VERITAS_V3_V5_ROADMAP.md` para v2.6.0–v5.0.0.
14. Não promover v3, v4 ou v5 sem os gates específicos de plataforma, segurança, migração e distribuição.
```

Essa ordem pode mudar somente se a auditoria encontrar um bloqueio mais crítico. Se mudar, explicar causa, impacto e decisão no relatório.

---

## 17. EXTENSÃO DA TRAJETÓRIA ATÉ v5.0.0

A meta do Veritas foi ampliada de v2.5.0 para v5.0.0. O detalhamento executável está em [`VERITAS_V3_V5_ROADMAP.md`](./VERITAS_V3_V5_ROADMAP.md). A extensão não autoriza pular releases nem afirmar que v3, v4 ou v5 já existem.

A sequência pós-v2.5.0 é:

```text
v2.6.0 verification no produto
v2.7.0 segurança da execução
v2.8.0 migrações e portabilidade
v2.9.0 preparação arquitetural
v3.0–v3.9 modularidade, plugins, workspace e produto profissional
v4.0–v4.9 plataforma extensível, reprodutibilidade e distribuição segura
v5.0.0 Digital Logic Platform madura
```

A v5.0.0 só poderá ser promovida quando core, editor, simulator, verification, HDL, plugins, IA controlada, projetos, desktop e distribuição estiverem integrados, migráveis, reproduzíveis e validados em Windows, macOS e Linux. `Veritas-Setup.exe` continua requisito oficial do Windows.

---

## 18. COMANDO FINAL

Continue o desenvolvimento do Veritas até a v5.0.0, seguindo primeiro a trajetória v2.5.0 e depois `docs/VERITAS_V3_V5_ROADMAP.md`.

Não reinicie.

Não apague.

Não migre para Electron.

Não quebre a `main`.

Não confunda build com release.

Não transforme ausência de validação em sucesso.

Escolha o próximo bloqueio técnico real.

Resolva com uma mudança pequena.

Teste.

Documente.

Commit.

Publique no branch.

Reporte progresso real.

Mantenha Windows, macOS e Linux como plataformas obrigatórias.

Mantenha `Veritas-Setup.exe` como requisito oficial.

Mantenha React → Vite → Tauri 2 → Rust.

Mantenha local-first, offline-first, privacy-first, seguro e determinístico.

Construa corretamente até a **Veritas Digital Logic Platform v5.0.0**, sem antecipar versões e sem confundir roadmap com release.

---

## Referências

[4]: ./VERITAS_V3_V5_ROADMAP.md "Trajetória pós-v2.5.0 até v5.0.0"

[5]: ./VERITAS_MASTER_BUILD_QUEUE.md "Fila mestre operacional até v5.0.0"

[1]: https://github.com/Lucas-Belucci-Bellini/Veritas "Repositório oficial do Veritas"

[2]: https://github.com/Lucas-Belucci-Bellini/Veritas/releases/tag/desktop-v0.1.0-alpha.1 "Release desktop histórica"

[3]: https://github.com/Lucas-Belucci-Bellini/Veritas/actions/runs/32922086872 "Workflow desktop histórico"


## Direção comercial planejada — Steam, DLC e serviços de nuvem

O Veritas poderá ser distribuído futuramente na Steam como Free-to-Play com núcleo local gratuito. A base deve permitir criar, editar, simular, testar e salvar circuitos localmente sem conta obrigatória, nuvem obrigatória ou conexão permanente. Módulos avançados locais podem ser comercializados como DLCs/expansões opcionais; backup, sincronização, histórico remoto, colaboração hospedada e compute remoto são serviços cloud opt-in pagos para cobrir armazenamento, segurança, operação e manutenção.

Não transformar o modo local em paywall. O usuário não perde arquivos locais quando um serviço expira, não deve pagar para abrir projetos próprios e não deve depender de nuvem para a simulação básica. Correções de segurança, compatibilidade e integridade do formato pertencem ao núcleo gratuito.

Antes de implementar qualquer monetização, ler `docs/COMMERCIAL_MODEL_STEAM.md`. Manter Steam/entitlements/cloud fora do domínio do `Simulator`, usando adapters e capabilities com ownership verificável, schema/checksum, quotas, privacidade, exportação, recovery, refunds/chargebacks e testes com rede/Steam indisponíveis. O estado atual é `PLANNED / NOT IMPLEMENTED`; não há Steam App ID, DLC App ID, Steam Wallet, backend comercial ou cloud comercial implementados.
