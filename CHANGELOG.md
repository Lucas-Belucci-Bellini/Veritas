# Changelog do Veritas

As mudanças relevantes do Veritas são registradas neste arquivo. As versões `0.y.z` continuam sendo candidatas de evolução da API e do formato de circuito.

## [Não publicado]

### Adicionado

- Verificador de equivalência comportamental entre dois `CircuitDocument` combinacionais (`compareCircuitEquivalence`), com pareamento de portas por rótulo, ordem canônica e contraexemplo determinístico da primeira combinação divergente.
- Painel “Equivalência entre circuitos” sobre os circuitos salvos localmente, mostrando veredito, entradas do contraexemplo e o valor produzido por cada lado.
- Ferramenta MCP `circuit_equivalence`, com Markdown determinístico, bibliotecas `custom_chips_a`/`custom_chips_b` separadas e checks `MCP-EQ-001`/`MCP-EQ-002` no acceptance stdio.
- `docs/VERIFICATION.md` com o contrato do relatório, a política de exaustividade e os limites medidos.

- Comparação temporal entre dois circuitos (`compareCircuitTimelines`): roda a mesma sequência de entradas nos dois e aponta o primeiro tique divergente, cobrindo a classe sequencial (clock, DFF, TFF, delay) que a equivalência exaustiva recusa.
- Painel “Comparação temporal” com editor de roteiro sobre os circuitos salvos, e ferramenta MCP `circuit_differential` com checks `MCP-DIFF-001`/`MCP-DIFF-002` no acceptance stdio.
- Seletor de circuito extraído para `CircuitPicker`, compartilhado pelos dois painéis de verificação.

### Corrigido

- `scripts/mcpAcceptanceContract.d.mts` declarava apenas `MCP-001…MCP-006` enquanto o runner já usava dez cenários; a declaração voltou a espelhar o contrato real.

### Validação e limites

- Suíte com 447 testes, typecheck, lint, build do frontend, builds MCP stdio/HTTP, lib e plugin aprovados; `npm run beta:mcp` com 14 PASS, `npm run beta:mcp:http` com 18 PASS, `npm run beta:wasm:isolation` com 5 PASS e `npm run beta:accessibility` com 5 PASS, todos sem FAIL.
- Os dois painéis foram verificados no navegador (Chromium) nos dois desfechos cada — equivalente/divergente com contraexemplo, e idêntico/divergente com o primeiro tique — sem erro de console.
- A comparação temporal nunca afirma equivalência: o melhor veredito é “idêntico neste roteiro”, e tanto o MCP quanto o painel dizem em texto que concordar num roteiro não prova que não exista outro que separe os circuitos.
- A comparação é exaustiva por definição: acima de 12 bits de entrada por padrão (teto de 16) ela é **recusada** em vez de truncada, porque uma comparação parcial não prova equivalência. Circuitos com `clock`, `dff`, `tff` ou `delay` não são aceitos.
- Limites escolhidos por medição local: 12 bits ≈ 85 ms e 16 bits ≈ 776 ms na mesma máquina; são justificativa da escolha, não promessa de desempenho.
- O beta público continua bloqueado até a evidência real de RLS-001…RLS-022, RT-001…RT-005, mobile, onboarding externo e demais gates exigidos.

## [0.9.0-rc.13] — 2026-08-22

### Adicionado

- Matriz golden WASM-003 para netlists combinacionais uniformes de 1, 8, 32 e 64 bits, cobrindo constantes, overrides, portas AND/NAND/OR/NOR/XOR/XNOR/NOT e saídas.
- Runner experimental que compara bytes VNET/VRES, valores, saídas e ordem topológica entre o fixture independente e o módulo Rust/WASM.
- Hardening end-to-end da fronteira host/WASM para magic, versão, largura, truncamento, shape, referência, ciclo e capacidade inválidos, com retorno zero e códigos estáveis.

### Validação e limites

- WASM-003 passou localmente e no Quality do GitHub no commit `c91be1c`, com zero imports, capabilities `3` e quatro casos golden executados.
- A feature `wasm-netlist-abi` continua opt-in e não entra no build produtivo, no navegador, no MCP ou no plugin. O TypeScript continua como runtime produtivo e fallback local-first.
- O beta público continua bloqueado até a evidência real de RLS-001…RLS-022, RT-001…RT-005, mobile, onboarding externo e demais gates exigidos.

## [0.9.0-rc.12] — 2026-08-22

### Adicionado

- Contrato experimental VNET/VRES versionado para um subconjunto de netlists combinacionais uniformes de 1 a 64 bits, com payload little-endian, limites explícitos e códigos de erro estáveis.
- Adaptador TypeScript fail-closed e decoder Rust/WASM-002 com buffer linear opt-in; componentes sequenciais, `custom-chip`, wireless, múltiplas larguras e `CircuitDocument` permanecem fora da ponte.
- Gate `npm run beta:wasm:parity` integrado aos workflows Quality e Release, comparando bytes, valores e ordem topológica contra fixture golden independente.

### Validação e limites

- WASM-002 passou localmente e no Quality do GitHub com zero imports, capabilities `3`, payload VNET de 104 bytes, resultado VRES de 60 bytes e paridade confirmada; os números de build são observações da execução, não promessa de desempenho.
- A feature `wasm-netlist-abi` é opt-in e não entra no build produtivo, no navegador, no MCP ou no plugin. O TypeScript continua como runtime produtivo e fallback local-first.
- O beta público continua bloqueado até a evidência real de RLS-001…RLS-022, RT-001…RT-005, mobile, onboarding externo e demais gates exigidos.

## [0.9.0-rc.11] — 2026-08-22

### Adicionado

- Gate experimental WASM-001 (`npm run beta:wasm`) com compilação para `wasm32-unknown-unknown` usando Rust 1.75, ABI mínimo versionado e validação por API WASM nativa do Node.
- Teste determinístico do contrato WASM que aceita somente as duas funções ABI (`veritas_wasm_abi_version` e `veritas_wasm_capabilities`) e os metadados técnicos conhecidos do linker, rejeitando imports e exports desconhecidos.
- Relatório sanitizado local com tamanho bruto/gzip, imports, exports, cold start e 100 instanciações repetidas; artefatos continuam fora do Git e do bundle do navegador.

### Validação e limites

- WASM-001 passou localmente e no Quality do GitHub; o módulo não recebe documentos, tokens, rede ou IndexedDB, não expõe uma API pública de memória e não avalia netlists.
- O runtime produtivo continua em TypeScript, com fallback local-first preservado; nenhuma integração WASM no navegador, Web Worker, MCP ou plugin foi habilitada.
- O beta público continua bloqueado até a evidência real de RLS-001…RLS-022, RT-001…RT-005, mobile, onboarding externo e demais gates exigidos.

## [0.9.0-rc.10] — 2026-08-22

### Adicionado

- Benchmark comparativo controlado `npm run bench:compare`, com fixture compartilhado entre TypeScript e Rust, quatro larguras, aquecimento separado e saída/checksum independentes.
- Gate RUST-002 integrado aos workflows Quality e Release; divergência de saída ou checksum encerra a validação.

### Validação e limites

- RUST-002 passou em quatro cenários com paridade de saída; os tempos registrados são observações da mesma execução e não comprovam superioridade de desempenho entre runtimes.
- O avaliador TypeScript permanece no caminho produtivo e o núcleo Rust continua experimental, sem WASM, sem mudança no navegador e com fallback TypeScript preservado.
- O beta público continua bloqueado até a evidência real de RLS-001…RLS-022, RT-001…RT-005, mobile, onboarding externo e demais gates exigidos.

## [0.9.0-rc.9] — 2026-08-22

### Adicionado

- Núcleo experimental `engine-rs/` em Rust, sem dependências externas, para avaliação combinacional determinística com sinais de 1 a 64 bits.
- Contrato `Signal`, operadores AND/NAND/OR/NOR/XOR/XNOR/NOT, ordenação topológica estável, erros explícitos e fixture golden compartilhado com as primitivas vetoriais TypeScript.
- Acceptance `npm run beta:rust`, comandos `test:rust`/`bench:rust`, documentação de arquitetura e gate Rust nos workflows de qualidade e release.

### Limites e validação

- O motor TypeScript continua sendo o runtime de produção; Rust ainda não é carregado pelo navegador, não substitui MCP/HDL/IndexedDB e não habilita WASM automaticamente.
- `RUST-001` e `RUST-002` passam em modo offline; o benchmark é somente baseline local e não comprova superioridade de desempenho entre runtimes.
- A referência Digital Logic Sim foi analisada somente em leitura; nenhum código, asset ou binário foi copiado. O beta segue bloqueado por falta de evidência RLS/Realtime cross-user real.

## [0.9.0-rc.8] — 2026-08-22

### Segurança e validação

- MCP-015 rejeita no startup qualquer configuração em que o path do MCP coincida com `/.well-known/oauth-protected-resource`, preservando a separação entre o endpoint protegido e a rota de metadata local.
- Acceptance combinado MCP-011/MCP-013/MCP-014/MCP-015 com 18 checks PASS, além de testes do handler, typecheck e build HTTP; nenhuma rota OAuth pública, token estático ou deployment remoto foi habilitado.
- RLS-001…RLS-022 e RT-001…RT-005 reais continuam pendentes e bloqueiam o beta público.

## [0.9.0-rc.7] — 2026-08-22

### Alterado

- MCP-014 torna explícita a política CORS da metadata local: somente `GET, OPTIONS`, `Vary: Origin` e `POST` bloqueado; o endpoint `/mcp` mantém `POST, OPTIONS` e Bearer obrigatório.

### Segurança e validação

- A alteração é local-only, não cria rota nova, não emite tokens e não modifica o transporte stdio, schemas das ferramentas ou qualquer deployment remoto.
- Acceptance combinado MCP-011/MCP-013/MCP-014 com 17 checks PASS, além dos testes do handler, typecheck e build HTTP; RLS-001…RLS-022 e RT-001…RT-005 reais continuam pendentes e bloqueiam o beta público.

## [0.9.0-rc.6] — 2026-08-22

### Adicionado

- Rota local opt-in `/.well-known/oauth-protected-resource` integrada ao transporte HTTP do MCP para discovery controlada de Protected Resource Metadata.
- Configuração por `VERITAS_MCP_HTTP_RESOURCE`, `VERITAS_MCP_HTTP_AUTHORIZATION_SERVERS` e `VERITAS_MCP_HTTP_SCOPES`, com 404 por padrão e falha fechada para configuração parcial ou recurso remoto sem HTTPS.

### Segurança e validação

- A metadata exige Origin explicitamente permitida, não exige Bearer para a leitura de discovery, não emite tokens e não altera o Bearer obrigatório do endpoint `/mcp`.
- O stdio permanece preservado; nenhum endpoint OAuth público, provider, login, PKCE ou deployment remoto foi habilitado.
- Acceptance HTTP MCP-011 e MCP-013, com 14 checks PASS, além de regressões unitárias do contrato e do handler; RLS-001…RLS-022 e RT-001…RT-005 reais continuam pendentes e bloqueiam o beta público.

## [0.9.0-rc.5] — 2026-08-22

### Adicionado

- Contrato puro `buildProtectedResourceMetadata` para Protected Resource Metadata, sem descoberta, login, rede ou persistência.
- Normalização determinística de `resource`, `authorization_servers`, escopos e `bearer_methods_supported`, com HTTPS obrigatório fora de localhost.
- Rejeição controlada de credenciais, query strings, fragmentos, escopos inválidos/duplicados e authorization servers ausentes.

### Segurança e validação

- O MCP-012 não publica rota `.well-known`, não emite tokens e não altera o transporte stdio ou o HTTP local do MCP-011.
- Foram adicionados cinco testes unitários positivos/negativos; os gates MCP-001…MCP-010 e MCP-011 HTTP continuam sendo executados como regressão.
- RLS-001…RLS-022 e RT-001…RT-005 reais continuam pendentes e bloqueiam o beta público.

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
