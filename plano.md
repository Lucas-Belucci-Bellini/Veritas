# Veritas — Plano executivo

O Veritas é uma ferramenta local-first para estudar, projetar e validar circuitos digitais. A calculadora de expressões e o simulador derivado da AST já estão funcionais; o próximo salto é transformar o visualizador em um editor visual bidirecional.

## Fonte de verdade

O roadmap detalhado, o backlog priorizado, os critérios de aceite e as decisões de escopo estão em [`docs/ROADMAP.md`](./docs/ROADMAP.md). O [`issue.md`](./issue.md) permanece como histórico de descoberta e visão de longo prazo, não como uma lista linear de tarefas.

## Estado atual — Release 0.11.6 + fundação da V1

| Entrega | Estado |
| --- | --- |
| Lexer, parser, AST, avaliação e tabela verdade | Concluído |
| Notações textual, matemática, programação e engenharia | Concluído |
| Validação em tempo real, teclado virtual, temas e exportação | Concluído |
| Simplificação, Karnaugh e formas normais | Concluído |
| Circuito derivado da expressão com React Flow e Dagre | Concluído |
| Projetos locais, IndexedDB e arquivos `.veritas` | Concluído |
| PWA offline-first | Concluído |
| Clock, flip-flops e atrasos no motor sequencial | Concluído no motor e no workspace visual |
| Chips customizados, composição hierárquica e subcircuitos reutilizáveis | Fundação da V1 concluída; expansão recursiva, runtime temporal e biblioteca local ativos |
| Chips multi-bit combinacionais DLS | Allowlist local ativa: `4-ADD`, EQUAL-4, `8-ADD`, `8-1AND`, `AND-3 8 bits`, `Full Adder - 8 Bits`, `(8 Bits) 8-bit Adder`, `8x2-AND`, `8x2-OR`, `8x2-XOR`, bancos reais `AND-8 Bits`/`NAND-8Bits`/`OR-8 Bits`/`XOR - 8 BIT`, `1-8MUX`, `NOT-8 Bits`, `NEGATE-8`, `16 para 8 e 4 bits`, `ZEXT-4-8` e `SEXT-4-8`, com larguras preservadas e assinaturas verificadas |
| Catálogo DLS importado | 1121 descrições; 445 com expressão escalar; allowlist multi-bit explicitamente nomeada em `4-ADD`, `EQUAL-4`, `8-ADD`, `8-1AND`, `AND-8 Bits`, `8x2-AND`, `NAND-8Bits`, `OR-8 Bits`, `8x2-OR`, `XOR - 8 BIT`, `8x2-XOR`, `AND-3 8 bits`, `Full Adder - 8 Bits`, `(8 Bits) 8-bit Adder`, `1-8MUX`, `NOT-8 Bits`, `NEGATE-8` e `16 para 8 e 4 bits`; bancos diretos/hierárquicos foram confirmados na Release 0.11.0, o mux na 0.11.1, o inversor na 0.11.2, a negação condicional na 0.11.3, o roteador misto na 0.11.4 e o expansor vetorial na 0.11.5; o expansor de sinal, na 0.11.6 |
| Servidor MCP e plugin do Claude Code | Concluído |

## Histórico de construção — v0.7.0

A primeira fase de construção organizada implementará o editor visual combinacional. O recorte inicial terá apenas sinais booleanos de um bit e os componentes `input`, `constant`, `and`, `or`, `not`, `xor` e `output`.

A arquitetura será dividida em quatro camadas:

1. **Domínio:** tipos canônicos de nós, portas, conexões e versões do formato.
2. **Engine:** normalização, validação, detecção de ciclos, avaliação e conversão para tabela ou expressão.
3. **Adaptadores:** conversão entre netlist, React Flow e arquivos `.veritas`.
4. **Interface:** canvas editável, paleta, propriedades, mensagens de erro, tutorial e ações de desfazer/refazer.

## Critérios de conclusão da v0.7.0

O usuário deverá conseguir criar um circuito simples sem digitar uma expressão, conectar componentes, receber erros compreensíveis para entradas inválidas ou ciclos, calcular a tabela verdade, salvar e reabrir o projeto. A entrega só será concluída após testes unitários e de integração, `lint`, `typecheck`, `test` e `build` passarem.

## Roadmap resumido

O roadmap executável em `docs/ROADMAP.md` é a fonte de verdade para os incrementos atuais. A branch de trabalho `feature/chip-hierarchy-v1` consolidou a fundação da V1 sem alterar a `main`.

| Versão | Objetivo |
| --- | --- |
| v0.7.0 | Editor visual combinacional |
| v0.7.1 | Usabilidade, undo/redo e confiabilidade |
| v0.8.0 | Barramentos multi-bit e Splitter |
| v0.9.0 | Workspace sequencial visual |
| v0.10.0 | Chips customizados e subcircuitos |
| v0.10.2 | Importação segura de chips multi-bit combinacionais DLS e integração com biblioteca/canvas |
| v0.10.3 | Comparador multi-bit EQUAL-4, normalização de portas duplicadas e exportação HDL |
| v0.10.4 | Somador multi-bit 8-ADD, ripple-carry, carry e ordem de portas do DLS |
| v0.10.5 | Máscara multi-bit 8-1AND, entrada escalar, barramento de 8 bits e saída vetorial |
| v0.10.6 | Operadores binários 8x2-AND/OR/XOR, dois barramentos de 8 bits e saída vetorial |
| v0.10.7 | AND-3 8 bits, três barramentos de entrada e redução vetorial em dois estágios |
| v0.10.8 | Full Adder - 8 Bits, três barramentos de entrada e soma/carry vetoriais |
| v0.10.9 | Alias `(8 Bits) 8-bit Adder`, entradas 8/8/1, saídas 8/1 e ripple-carry |
| v0.11.0 | Bancos reais AND/NAND/OR/XOR de 8 bits, assinaturas diretas e hierárquicas |
| v0.11.1 | Multiplexador real `1-8MUX`, seleção de 1 bit, entradas 8/8 e saída 8 bits |
| v0.11.2 | Inversor real `NOT-8 Bits`, uma entrada e uma saída de 8 bits |
| v0.11.3 | `NEGATE-8` real, entrada vetorial de 8 bits, controle escalar e saída vetorial de 8 bits |
| v0.11.4 | `16 para 8 e 4 bits` real, 16 entradas escalares, dez saídas e AND dividido em dois nibbles de 4 bits |
| v0.11.5 | `ZEXT-4-8` real, quatro entradas escalares, saída vetorial de 8 bits e zeros explícitos |
| v0.11.6 | `SEXT-4-8` real, quatro entradas escalares, saída vetorial de 8 bits e fan-out do bit de sinal |
| v0.10.x | Ampliação controlada do catálogo; runtime temporal vetorial permanece como etapa separada |
| v1.0.0 | API de contexto do canvas e MCP declarativo |
| v1.x | Sync, desktop, agentes e recursos 3D, somente após validação técnica |

## Princípios

O motor de domínio não dependerá de React ou do DOM. O formato `.veritas` será versionado e validado defensivamente. Recursos de IA não poderão executar alterações silenciosas: futuras operações deverão ser declarativas, verificáveis, registradas e confirmadas pelo usuário. Ideias como 250 subagentes, fabricação 3D e roteamento físico permanecem como visão de longo prazo, fora do próximo ciclo.
