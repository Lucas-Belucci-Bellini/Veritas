# Changelog do Veritas

As mudanças relevantes do Veritas são registradas neste arquivo. As versões `0.y.z` continuam sendo candidatas de evolução da API e do formato de circuito.

## [0.9.0-rc.4] — 2026-08-22

### Adicionado

- Primeira camada do MCP-011: fábrica comum de ferramentas, entrypoint stdio preservado e transporte HTTP local stateless baseado na SDK oficial.
- Build separado `build:mcp:http`, comando `mcp:http` e binário `veritas-mcp-http-server` para execução controlada em localhost.
- Aceitação HTTP com Bearer obrigatório, allowlist de Origin, headers de protocolo, HeaderMismatch, limite de payload, rejeição de GET e equivalência com os goldens stdio.

### Segurança e documentação

- O transporte HTTP exige configuração por ambiente, faz bind em `127.0.0.1` por padrão e não publica HTTPS, não acessa Supabase e não coloca tokens no frontend.
- Quality e release workflows agora executam o build/acceptance HTTP além da matriz MCP stdio MCP-001…MCP-010.
- O transporte remoto OAuth continua fora desta RC até haver provedor aprovado, metadata de recurso, audience/resource, PKCE, HTTPS, rate limiting, threat model e smoke externo.

## [0.9.0-rc.3] — 2026-08-22

### Corrigido

- Quality workflow agora baixa o histórico completo e as tags Git necessárias para validar rollback de forma determinística.
- O baseline do rollback foi atualizado para a última RC publicada, evitando comparar uma candidata com uma tag futura.

### Validação

- Quality workflow da main aprovado após a correção: testes, typecheck, lint, build frontend, build MCP, MCP-001…MCP-010, HDL, acessibilidade, rollback, onboarding e smoke PWA local.
- A RC-2 permanece imutável e continua disponível para reprodução; esta versão é uma nova candidata de correção, não uma reescrita.
- RLS-001…RLS-022 e RT-001…RT-005 reais continuam pendentes e bloqueiam o beta público.

## [0.9.0-rc.2] — 2026-08-22

### Adicionado

- Ferramenta MCP local `circuit_vector_truth_table` para tabelas verdade determinísticas de circuitos com barramentos.
- Limite explícito de até 12 bits de entrada e até 4096 linhas geradas, com suporte a truncamento controlado, `output_id` e definições portáteis de `custom_chips`.
- Golden MCP-010 integrado ao gate stdio, elevando a superfície validada para 14 ferramentas e MCP-001…MCP-010.

### Documentação e validação

- README do MCP, roadmap e runbook de aceitação atualizados com payload vetorial e limites operacionais.
- 382 testes aprovados em 59 arquivos; typecheck, lint, build frontend/PWA, build MCP, build do plugin, verificações de sintaxe e smoke PWA local aprovados.
- A candidata continua sendo uma RC: RLS-001…RLS-022 e RT-001…RT-005 reais permanecem pendentes e bloqueiam o beta público.

## [0.9.0-rc.1] — 2026-08-21

### Adicionado

- Workspace sequencial observável com `Step`, `Run`/`Continue`, `Reset`, Watch e timeline limitada para documentos de algoritmo e circuitos.
- Componentes sequenciais visuais `clock`, `dff`, `tff` e `delay`, com feedback permitido quando atravessa estado e rejeição de ciclos combinacionais puros.
- Adaptador `CircuitDocument` → `Simulator` para simular documentos sequenciais arbitrários desenhados no canvas.
- Checkpoint local-first do runtime temporal em `localStorage`, com restauração defensiva e degradação automática para memória quando o storage não está disponível.
- Configuração editável de período de clock entre 1 e 64 tiques, persistida junto do checkpoint e sincronizada opcionalmente por Realtime.
- Broadcast privado de `runtime_state` com estado do simulador, entradas, períodos, snapshot, timeline, hash, `baseVersion`, autor e timestamp.
- Política de frescor para ofertas temporais: expiração após 30 segundos, tolerância de até 5 segundos no futuro e rejeição de timestamps inválidos.
- Presence temporal, métricas locais de colaboração e histórico em memória dos últimos 12 eventos genéricos.
- Revalidação da versão-base no momento da aplicação manual, bloqueio visual de ofertas obsoletas e confirmação de sucesso/falha sem substituição silenciosa do runtime local.

### Alterado

- O editor temporal mantém documento estrutural, configuração de clock e estado de execução como fontes de verdade separadas.
- A aplicação de um estado remoto agora exige confirmação explícita e uma `baseVersion` ainda compatível com o documento atual.
- Falhas de observabilidade e de colaboração continuam best-effort; o runtime local segue executável sem Supabase ou Realtime.
- O pipeline de qualidade valida a suíte, typecheck, lint, build frontend, build MCP e smoke PWA antes da promoção da candidata.

### Limitações conhecidas

- A colaboração temporal usa Broadcast/Presence transitórios; o histórico remoto versionado continua sendo a fonte de verdade do documento.
- O runtime temporal ainda é escalar e não oferece simulação sequencial vetorial, memória ou merge CRDT.
- O MCP remoto por HTTP autenticado permanece no roadmap; o perfil publicado continua baseado em stdio local.
- Tabela verdade, análise de IA e exportação HDL continuam bloqueadas para documentos com estado sequencial.
- A candidata ainda requer validação operacional real de dois usuários, toolchains HDL, acessibilidade/mobile e rollback antes do beta definitivo.

### Validação

- 256 testes aprovados em 31 arquivos.
- Typecheck frontend e MCP sem erros.
- Lint sem warnings ou erros.
- Build frontend/PWA e build MCP aprovados.
- Smoke PWA remoto aprovado em `https://veritas-opal-seven.vercel.app`.
- `git diff --check` aprovado.

### Próximos passos

- Executar os gates RC no workflow do GitHub e publicar a release `v0.9.0-rc.1`.
- Validar RLS, isolamento Realtime, toolchains HDL, acessibilidade/mobile e rollback em ambiente controlado.
- Continuar o ciclo v0.9.0 com os próximos requisitos sequenciais antes de promover uma versão estável.

## [0.8.0-rc.1] — 2026-08-15

### Adicionado

- Fundação imutável `BitVector` para sinais de 1 a 64 bits, com literais binários e hexadecimais, conversão para `bigint`, operações AND/OR/XOR/NOT e splitter/combiner.
- Campo opcional `options.width` no modelo de componentes, preservado no editor, IndexedDB e snapshots Realtime.
- Validação defensiva de largura, incluindo rejeição de overflow, largura inválida, conexão entre larguras incompatíveis e payload remoto malformado.
- API `evaluateCircuitVectors()` para avaliação combinacional bitwise com entradas `BitVector`, `bigint`, número ou literal binário/hexadecimal.
- Tabela verdade vetorial limitada por número total de bits, com colunas dimensionadas, truncamento determinístico e bloqueio acima de 12 bits de entrada por padrão.
- Seletor visual de largura para novos componentes, preview binário em entradas/saídas e seleção acessível de linhas da tabela vetorial para iluminar o canvas.
- Exportação vetorial Verilog e VHDL com portas, wires/sinais dimensionados e constantes vetoriais seguras.
- Histórico local de undo/redo no editor, atalhos `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` e `Ctrl/Cmd+Y`.
- Colaboração ROOM-001 com salas nomeadas, `baseVersion`, conflitos explícitos e isolamento multi-room.

### Alterado

- A API booleana `evaluateCircuit()` e a tabela verdade clássica permanecem estritamente escalares para preservar compatibilidade com documentos existentes.
- A análise de IA continua desabilitada para circuitos multi-bit até que o contexto vetorial e o contrato de otimização sejam finalizados.
- O smoke test de release valida homepage, manifesto PWA e service worker em Preview ou Production.
- O pipeline GitHub Actions executa 226 testes, typecheck, lint, build frontend, build MCP e smoke PWA antes de cada promoção.

### Limitações conhecidas

- O limite padrão da tabela verdade vetorial é de 12 bits totais de entrada, equivalente a no máximo 4.096 combinações.
- Presença e Broadcast Realtime continuam transitórios; o histórico remoto versionado permanece a fonte de verdade.
- O MCP remoto por HTTP autenticado ainda é roadmap; o perfil publicado continua baseado em stdio local.
- A candidata não promete simulação sequencial vetorial, memória, ALU ou merge CRDT.

### Validação

- 226 testes aprovados em 25 arquivos.
- Typecheck frontend e MCP sem erros.
- Lint sem warnings ou erros.
- Build frontend/PWA e build MCP aprovados.
- Smoke PWA remoto aprovado no workflow `Veritas quality`.

### Próximos passos

- Publicar manualmente `v0.8.0-rc.1` pelo workflow **Actions → Veritas release → Run workflow**, usando `prerelease=true`.
- Executar smoke contra a URL candidata e validar RLS, Realtime, exportadores HDL em toolchains de referência e rollback.
- Iniciar o planejamento v0.9.0 para o workspace sequencial visual.
