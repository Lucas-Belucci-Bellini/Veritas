# Veritas

Calculadora de tabelas verdade e visualizador de circuitos lógicos que roda
inteiramente no navegador — sem servidor, sem banco de dados, sem conta.

Você digita `(A AND B) OR NOT C` e recebe, no mesmo instante, a tabela verdade
completa com os passos intermediários e o circuito de portas lógicas
equivalente. Clicar numa linha da tabela acende o caminho da eletricidade no
circuito.

O plano completo do projeto está em [`issue.md`](./issue.md) e o roadmap
resumido em [`plano.md`](./plano.md).

## O que já está pronto

| Versão | Entrega |
| --- | --- |
| v0.1.0 | Motor lógico: lexer, parser, AST, avaliador e geração das combinações |
| v0.2.0 | Interface: barra de input com validação em tempo real, teclado virtual, tema claro/escuro, exportação |
| v0.3.0 | Simulador visual: circuito gerado da AST com React Flow + Dagre |
| — | Biblioteca com 1121 chips importados do Digital Logic Sim |

### Motor lógico

* **Três notações ao mesmo tempo.** `A AND B`, `A && B` e `A ∧ B` produzem a
  mesma árvore. Trocar de notação reescreve a expressão em vez de só trocar os
  botões da tela.
* **Operadores.** `NOT`, `AND`, `NAND`, `OR`, `NOR`, `XOR`, `XNOR`, implicação
  (`→`) e bicondicional (`↔`), com a precedência e a associatividade usuais.
* **Erros com endereço.** Cada erro carrega a posição exata no texto e uma
  mensagem em português: *"Falta fechar 1 parêntese"*, *"Dois operadores
  seguidos: AND e OR"*, *"A expressão termina em AND e falta o lado direito"*.
* **Passos intermediários.** Uma coluna por subexpressão, na ordem em que são
  resolvidas. Subexpressões idênticas compartilham a mesma coluna.
* **Classificação.** Tautologia, contradição ou contingência, calculada junto
  com a tabela.

### Interface

Barra de input grande com feedback verde/vermelho a cada tecla, teclado virtual
dividido por categoria (os símbolos que ninguém sabe digitar), alternância entre
`V/F` e `1/0`, tema claro e escuro, e exportação em **CSV**, **PNG** (desenhado
em canvas, sem biblioteca externa) e link compartilhável (`?expr=`).

### Biblioteca de chips

O projeto [UMBRA LIMA ALFA](https://github.com/Lucas-Belucci-Bellini/UMBRA-LIMA-ALFA)
guarda 1121 chips criados no Digital Logic Sim. O importador lê essas netlists,
resolve os sub-chips recursivamente, simula cada chip combinacional em todas as
combinações de entrada e destila cada saída em uma expressão booleana mínima
via Quine-McCluskey.

Resultado: 445 chips chegam à interface com expressão pronta — um clique em
"Abrir na calculadora" e você vê a tabela verdade e o circuito do somador
completo, do multiplexador, do comparador de 2 bits. Chips sequenciais
(registradores, contadores, RAM) e multi-bit aparecem catalogados, mas sem
expressão equivalente, porque a saída deles depende do tempo e não só das
entradas.

```bash
npm run chips:import                      # usa ../UMBRA-LIMA-ALFA/Chips
npm run chips:import -- /caminho/dos/chips # ou aponte para outro projeto DLS
```

## Rodando

```bash
npm install
npm run dev        # servidor de desenvolvimento
npm test           # testes do motor lógico
npm run lint       # oxlint
npm run build      # build de produção em dist/
```

## Como o código está organizado

```
src/
  engine/      lexer, parser, AST, avaliador, tabela verdade  (sem React)
  circuit/     AST -> grafo de portas, layout com Dagre, nó visual
  chips/       catálogo importado do Digital Logic Sim
  components/  interface
  lib/         exportação, URL compartilhável, formatação de valores
scripts/
  import-dls-chips.mjs   importador da biblioteca de chips
```

O `engine/` não depende de React nem do DOM: é o mesmo código que um dia pode
rodar num servidor MCP ou numa CLI, como previsto no plano do projeto.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Flow · Dagre · Vitest

## Próximos passos

* v0.4.0 — salvamento local dos projetos com Dexie.js (IndexedDB)
* v0.5.0 — PWA: instalar e usar sem internet
* v0.6.0 — contas de usuário e sincronização opcional
* v0.7.0 — sincronização em tempo real (CRDT) e fios sem fio (túneis Tx/Rx)
* Depois — barramentos multi-bit, lógica sequencial (clock, flip-flops, RAM),
  chips customizados e servidor MCP para IAs consultarem o motor
