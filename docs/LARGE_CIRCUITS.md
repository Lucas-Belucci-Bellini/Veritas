# Circuitos grandes — decisão de capacidade e limites

**Status:** decisão técnica preliminar, não é promessa de suporte de produto.

**Marco:** BENCH-002 — 2026-08-26.

## Contexto

O benchmark de escala usa a topologia determinística `input → N × NOT → output` em dois caminhos deliberadamente diferentes. O caminho de produto constrói um `CircuitDocument`, valida os limites oficiais, converte para `Netlist` e executa o `createDocumentRuntime()`/`Simulator`. O caminho de capacidade constrói somente um `Netlist` bruto e executa o `Simulator` diretamente.

A distinção é necessária porque um runtime capaz de processar um `Netlist` grande não prova que o editor consegue criar, renderizar, salvar, reabrir, importar, exportar ou simular esse circuito de forma responsiva e segura. Também não prova instalação, offline, persistência ou comportamento equivalente no desktop Windows, macOS e Linux.

## Evidência observada

A primeira baseline foi executada em Linux x86_64, Node `v22.13.0`, com CPU reportada como AMD EPYC. Os tempos são específicos do processo e da máquina; não são uma comparação científica entre plataformas ou releases diferentes.

| Caminho | 10 gates | 100 gates | 500 gates | 1000 gates | 5000 gates |
| --- | ---: | ---: | ---: | ---: | ---: |
| `CircuitDocument → Simulator` | 0,642 ms / 220 ticks | 16,519 ms / 2.020 ticks | `NOT SUPPORTED` | `NOT SUPPORTED` | `NOT SUPPORTED` |
| `Netlist → Simulator` | 0,582 ms / 220 ticks | 15,438 ms / 2.020 ticks | 211,942 ms / 5.010 ticks | 423,762 ms / 5.005 ticks | 6.273,959 ms / 15.003 ticks |

Os valores acima são uma medição real, mas não constituem um orçamento de UX. A quantidade de iterações foi reduzida nos alvos maiores para manter o benchmark controlado: 10 iterações em 500 gates, 5 em 1000 e 3 em 5000. O relatório também registra checksum de saída, aquecimento separado e amostras de RSS do processo Node.

## Limite oficial atual

O contrato de `CircuitDocument` limita documentos a **256 nós**, **512 conexões** e **500.000 bytes serializados**. Para uma cadeia linear com um input, um output e um NOT por gate, o maior caso que respeita o limite de nós é 254 gates. O conversor `toNetlist` valida o documento antes de construir o netlist; portanto, 500/1000/5000 gates continuam corretamente classificados como `NOT SUPPORTED` no produto.

Esse comportamento é intencional. O limite não deve ser removido apenas porque o `Simulator` bruto conseguiu processar um fixture. A validação fail-closed protege a interface, a persistência e os fluxos de importação contra documentos que ainda não possuem orçamento de memória, renderização, serialização e interação comprovado.

## Decisão

A decisão desta fase é **manter os limites oficiais** e conservar o benchmark bruto como instrumento diagnóstico. Não haverá aumento de `MAX_CIRCUIT_NODES`, `MAX_CIRCUIT_CONNECTIONS` ou `MAX_CIRCUIT_SERIALIZED_BYTES` sem um contrato de capacidade aprovado, regressões e evidência multiplataforma.

O caminho de runtime bruto pode continuar sendo usado para localizar gargalos do engine. Porém, seus resultados não devem ser apresentados como suporte do editor, como capacidade do formato `.veritas`, como garantia de FPS ou como autorização para criar uma release estável.

O suporte oficial a circuitos grandes, se aprovado posteriormente, deverá entrar como uma capacidade de produto com versão e migração explícitas. A implementação deve considerar um modelo de documento escalável, compilação ou avaliação incremental, budgets de operações e memória, renderização parcial/virtualizada, salvamento por partes ou formato equivalente, import/export com limites claros e cancelamento de operações demoradas. Nenhuma dessas capacidades é declarada implementada por este documento.

## Critérios para ampliar a capacidade oficial

| Critério | Evidência mínima antes de mudar o contrato |
| --- | --- |
| Modelo de dados | Formato versionado, normalização, migração ou rejeição clara e round-trip sem perda |
| Validação | Limites independentes para nós, conexões, bytes, profundidade e fan-out; falhas acionáveis |
| Simulação | Tempo, memória e número de operações medidos para combinacional e sequencial; nenhum loop não limitado |
| Responsividade | Benchmark de renderização/FPS e interação no editor, com viewport grande e operações comuns |
| Persistência | Salvar, reabrir, importar e exportar documentos grandes com checksum e sem truncamento |
| Segurança | Nenhuma execução arbitrária de conteúdo importado; budgets e cancelamento para operações custosas |
| Desktop | Smoke de instalação, startup, editor, simulação, persistência, encerramento e remoção em Windows/macOS/Linux |
| CI e releases | Benchmark repetível por commit/release, artefato de evidência e bloqueio quando houver regressão definida |

Enquanto qualquer linha permanecer sem evidência, o estado deve continuar `NOT VERIFIED` ou `NOT SUPPORTED`, conforme o caso. Um workflow verde sozinho não muda essa classificação.

## Próxima sequência técnica

1. Preservar BENCH-001/BENCH-002 e repetir os números somente em ambiente equivalente, sem comparar raw numbers entre máquinas distintas.
2. Adicionar testes de fronteira do `CircuitDocument` para o maior caso válido e para a rejeição imediata do primeiro caso inválido.
3. Definir budgets de simulação e renderização antes de aumentar limites ou adicionar uma experiência de circuito grande ao editor.
4. Escolher, em uma fase posterior do roadmap, entre ampliar o documento existente com migração explícita ou criar uma representação escalável compilada, mantendo o caminho atual compatível.
5. Só então executar smoke multiplataforma e considerar uma versão de produto que anuncie suporte a circuitos maiores.

Essa decisão não antecipa a v2.0.0. Os documentos `V2_ARCHITECTURE.md`, `V2_MIGRATION.md` e `V2_MASTER_PLAN.md` continuam obrigatórios antes de qualquer release 2.x, conforme o roadmap.

## Referências

[1]: ../src/circuit/documentLimits.ts — Limites canônicos do `CircuitDocument`.

[2]: ../src/circuit/documentContract.ts — Validação de cardinalidade e tamanho serializado.

[3]: ../src/circuit/editorModel.ts — Validação e conversão de `CircuitDocument` para `Netlist`.

[4]: ../src/simulation/components.ts — Contrato de `Netlist` e `ComponentSpec`, sem limite editorial embutido.

[5]: ../tests/desktop/QA_MATRIX.md — Classificação de evidências desktop e registro BENCH-001/BENCH-002.
