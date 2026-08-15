# Changelog do Veritas

As mudanças relevantes do Veritas são registradas neste arquivo. As versões `0.y.z` continuam sendo candidatas de evolução da API e do formato de circuito.

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
