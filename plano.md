# Veritas — Plano executivo

O Veritas é uma ferramenta local-first para estudar, projetar e validar circuitos digitais. A calculadora de expressões e o simulador derivado da AST já estão funcionais; o próximo salto é transformar o visualizador em um editor visual bidirecional.

## Fonte de verdade

O roadmap detalhado, o backlog priorizado, os critérios de aceite e as decisões de escopo estão em [`docs/ROADMAP.md`](./docs/ROADMAP.md). O [`issue.md`](./issue.md) permanece como histórico de descoberta e visão de longo prazo, não como uma lista linear de tarefas.

## Estado atual — v0.6.2

| Entrega | Estado |
| --- | --- |
| Lexer, parser, AST, avaliação e tabela verdade | Concluído |
| Notações textual, matemática, programação e engenharia | Concluído |
| Validação em tempo real, teclado virtual, temas e exportação | Concluído |
| Simplificação, Karnaugh e formas normais | Concluído |
| Circuito derivado da expressão com React Flow e Dagre | Concluído |
| Projetos locais, IndexedDB e arquivos `.veritas` | Concluído |
| PWA offline-first | Concluído |
| Clock, flip-flops e atrasos no motor sequencial | Concluído no motor; edição visual pendente |
| Servidor MCP e plugin do Claude Code | Concluído |

## Próximo incremento — v0.7.0

A primeira fase de construção organizada implementará o editor visual combinacional. O recorte inicial terá apenas sinais booleanos de um bit e os componentes `input`, `constant`, `and`, `or`, `not`, `xor` e `output`.

A arquitetura será dividida em quatro camadas:

1. **Domínio:** tipos canônicos de nós, portas, conexões e versões do formato.
2. **Engine:** normalização, validação, detecção de ciclos, avaliação e conversão para tabela ou expressão.
3. **Adaptadores:** conversão entre netlist, React Flow e arquivos `.veritas`.
4. **Interface:** canvas editável, paleta, propriedades, mensagens de erro, tutorial e ações de desfazer/refazer.

## Critérios de conclusão da v0.7.0

O usuário deverá conseguir criar um circuito simples sem digitar uma expressão, conectar componentes, receber erros compreensíveis para entradas inválidas ou ciclos, calcular a tabela verdade, salvar e reabrir o projeto. A entrega só será concluída após testes unitários e de integração, `lint`, `typecheck`, `test` e `build` passarem.

## Roadmap resumido

| Versão | Objetivo |
| --- | --- |
| v0.7.0 | Editor visual combinacional |
| v0.7.1 | Usabilidade, undo/redo e confiabilidade |
| v0.8.0 | Barramentos multi-bit e Splitter |
| v0.9.0 | Workspace sequencial visual |
| v0.10.0 | Chips customizados e subcircuitos |
| v1.0.0 | API de contexto do canvas e MCP declarativo |
| v1.x | Sync, desktop, agentes e recursos 3D, somente após validação técnica |

## Princípios

O motor de domínio não dependerá de React ou do DOM. O formato `.veritas` será versionado e validado defensivamente. Recursos de IA não poderão executar alterações silenciosas: futuras operações deverão ser declarativas, verificáveis, registradas e confirmadas pelo usuário. Ideias como 250 subagentes, fabricação 3D e roteamento físico permanecem como visão de longo prazo, fora do próximo ciclo.
