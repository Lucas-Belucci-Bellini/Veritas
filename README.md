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
| v0.4.0 | Projetos salvos no navegador com Dexie.js (IndexedDB) e arquivos `.veritas` |
| v0.4.9 | Polimento: tabela virtualizada e circuito carregado sob demanda |
| v0.5.0 | PWA: instalável e 100% funcional sem internet |
| v0.6.0 | Simplificação de expressões, mapas de Karnaugh e servidor MCP |
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

### Projetos salvos (v0.4.0)

Os projetos ficam no **IndexedDB do próprio navegador**, via Dexie.js. Nada sai
da máquina do usuário e nada custa servidor. Dá para nomear, renomear, reabrir e
excluir projetos, além de exportar tudo num arquivo **`.veritas`** e importar de
volta — o mesmo formato que a CLI e o servidor MCP vão ler mais adiante.

O leitor do `.veritas` recusa arquivo de outro programa, JSON quebrado e versão
de formato mais nova do que a que ele entende, em vez de importar lixo em
silêncio.

### Performance (v0.4.9)

* **Tabela virtualizada.** Uma expressão com 10 variáveis dá 1024 linhas; com as
  colunas de passos intermediários isso passa de 20 mil células. Acima de 200
  linhas a tabela renderiza só a janela visível, então a rolagem continua fluida.
* **Circuito sob demanda.** React Flow e Dagre pesam mais que todo o resto
  somado, então viraram um pedaço separado, baixado só quando existe uma
  expressão válida na tela. O pacote inicial caiu de 560 kB para 337 kB.

### Offline de verdade (v0.5.0)

Service worker com Workbox precarregando **970 kB** — o aplicativo inteiro,
incluindo o catálogo de chips. Depois da primeira visita o Veritas abre no modo
avião, e pode ser instalado como aplicativo no computador ou no celular.

Quando a conexão cai, um aviso discreto explica que está tudo funcionando mesmo
assim. Quando sai uma versão nova, o Veritas pergunta antes de recarregar — em
vez de puxar o tapete no meio de uma expressão.

### Simplificação e mapas de Karnaugh (v0.6.0)

**Forma mínima.** Qualquer expressão é reduzida à soma de produtos mínima por
Quine-McCluskey. Como a conta parte da tabela verdade, funciona também para as
que as regras algébricas de bolso não pegam — implicação, XOR, bicondicional:

```
(A AND B) OR (A AND NOT B)   →   A          4 operadores a menos
NOT (A OR B)                 →   ¬A ∧ ¬B
```

**Mapa de Karnaugh** de 1 a 4 variáveis, em código Gray, com os agrupamentos
coloridos. Os grupos destacados são exatamente os implicantes primos que a
simplificação escolheu, então dá para ver de onde veio cada termo — inclusive os
que dão a volta pelas bordas do mapa.

O mesmo minimizador serve o site, o importador de chips e o servidor MCP: uma
implementação só, com testes.

### Servidor MCP (v0.6.0)

`mcp/` é um servidor [MCP](https://modelcontextprotocol.io) que entrega o motor
para assistentes de IA — tabela verdade, avaliação, simplificação, Karnaugh e
consulta à biblioteca de chips. Em vez de o modelo chutar o resultado de uma
expressão, ele pergunta e recebe a conta feita.

```bash
npm run build:mcp
claude mcp add veritas -- node $PWD/mcp/dist/server.js
```

Detalhes em [`mcp/README.md`](./mcp/README.md).

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
npm test           # testes (motor, armazenamento e ferramentas MCP)
npm run lint       # oxlint
npm run typecheck  # TypeScript do site e do servidor MCP
npm run build      # build de produção em dist/
npm run build:mcp  # servidor MCP em mcp/dist/
```

## Como o código está organizado

```
src/
  engine/      lexer, parser, AST, avaliador, tabela verdade  (sem React)
  circuit/     AST -> grafo de portas, layout com Dagre, nó visual
  chips/       catálogo importado do Digital Logic Sim
  storage/     banco local (Dexie) e o formato de arquivo .veritas
  components/  interface
  hooks/       tema, projetos, conexão, virtualização da tabela
  lib/         exportação, URL compartilhável, formatação de valores
mcp/
  src/tools.ts   as ferramentas em si, testáveis sem MCP
  src/server.ts  transporte stdio e esquemas
scripts/
  import-dls-chips.mjs   importador da biblioteca de chips
```

O `engine/` não depende de React nem do DOM — e é justamente por isso que o
servidor MCP e o importador de chips conseguem usar o mesmo código do site, sem
nenhuma cópia paralela.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Flow · Dagre · Dexie.js · Workbox · Vitest · oxlint

## Próximos passos

* v0.6.0 — contas de usuário e sincronização opcional
* v0.7.0 — sincronização em tempo real (CRDT) e fios sem fio (túneis Tx/Rx)
* Depois — barramentos multi-bit, lógica sequencial (clock, flip-flops, RAM),
  chips customizados e servidor MCP para IAs consultarem o motor
