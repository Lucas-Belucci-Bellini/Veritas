# Veritas

Calculadora de tabelas verdade e ferramenta local-first para projetar circuitos lógicos que roda
no navegador. O modo local funciona sem conta; quando configurado, o usuário pode autenticar
com Supabase, sincronizar circuitos na nuvem e pedir análise assistida por IA.

Você digita `(A AND B) OR NOT C` e recebe, no mesmo instante, a tabela verdade
completa com os passos intermediários e o circuito de portas lógicas
equivalente. Clicar numa linha da tabela acende o caminho da eletricidade no
circuito.

O registro completo de ideias está em [`issue.md`](./issue.md). O plano executável,
o backlog priorizado e os critérios de aceite estão em [`docs/ROADMAP.md`](./docs/ROADMAP.md),
com um resumo executivo em [`plano.md`](./plano.md).

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
| v0.6.1 | Motor de simulação sequencial: clock, flip-flops e atrasos |
| v0.6.2 | Notação de engenharia (`A'`, `A B`) e formas normais SOP/POS |
| v0.7.0 | Editor visual combinacional, tabela verdade automática e persistência local IndexedDB |
| v0.7.1 | Autenticação Supabase, sincronização em nuvem, histórico remoto e análise/otimização por IA |
| v0.7.2 | Colaboração Realtime, exportação Verilog/VHDL e painel de métricas da IA |
| v0.8.0 | ALGO-001 executor determinístico local-first e ALGO-002 Watch/BranchTrace |
| v0.9.0 | ALGO-003 While, depuração passo a passo e MCP proposicional/algoritmos |
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

### Projetos salvos localmente e na nuvem

Os projetos locais ficam no **IndexedDB do próprio navegador**, via Dexie.js. O modo
local-first continua funcionando offline e sem conta. Dá para nomear, renomear, reabrir e
excluir projetos, além de exportar tudo num arquivo **`.veritas`** e importar de volta.

Com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` configurados, o usuário pode
criar conta, entrar e usar **Sincronizar nuvem** no editor visual. A tabela remota é
protegida por RLS e só aceita registros do usuário autenticado. A sincronização não é
automática: circuitos locais só são enviados após uma ação explícita.

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

### Notação de engenharia e formas normais (v0.6.2)

Livros e listas de álgebra booleana não escrevem `A AND NOT B` — escrevem
`A B'`. O Veritas agora lê essa notação direto:

* **Apóstrofo posfixo** para negação: `A'`, `(A + B)'`, `A B' C`.
* **Justaposição vale AND**: `A B`, `(A + B)(A + C)`, `A B + B C`.

Letras coladas (`AB`) continuam dando erro de propósito, com a dica de separar
com espaço — assim um `ANDD` digitado errado não vira silenciosamente
`A ∧ N ∧ D ∧ D`.

Junto vieram as **formas normais**:

* SOP e POS **canônicas** (todos os mintermos, todos os maxtermos), com os
  índices Σm e ΠM.
* SOP e POS **mínimas**, com a contagem de operadores de cada uma — a POS sai da
  minimização do complemento, aplicando De Morgan no resultado.
* Um **classificador** que diz se a expressão que você escreveu já está em soma
  de produtos, produto de somas, ou nenhuma das duas.

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

### Lógica sequencial (v0.6.1)

Até aqui tudo era **combinacional**: a saída respondia na hora à entrada. O
simulador em `src/simulation/` dá o salto para a **lógica sequencial**, onde a
saída depende também do que aconteceu antes.

Cada tique acontece em duas fases, como o plano previa: primeiro todo mundo
calcula o próprio próximo valor olhando para os valores *atuais* dos vizinhos, e
só depois todos publicam ao mesmo tempo. É o que a eletricidade faz de verdade —
cada porta tem seu atraso de propagação — e é o que permite simular
realimentação sem o navegador entrar em laço infinito.

Componentes: portas lógicas, `input`, `output`, `constant`, `clock` (com período
ajustável), flip-flops `dff` e `tff` (disparados na borda de subida, com saídas
Q e Q̄) e `delay` de N tiques.

Com isso já dá para montar latch SR, contador, divisor de frequência e linhas de
atraso — os testes cobrem todos eles. E um teste cruzado confere que, para
expressões combinacionais, o circuito simulado concorda com o avaliador em
**todas** as linhas da tabela: os dois motores não podem discordar.

### Plugin do Claude Code

Este repositório também é um **marketplace de plugin do Claude Code**. Dá para
instalar o motor do Veritas direto no seu Claude Code:

```
/plugin marketplace add Lucas-Belucci-Bellini/Veritas
/plugin install veritas-logic@veritas
```

O plugin traz o servidor MCP já empacotado — nenhum `npm install`, nenhum build
do lado de quem instala — mais uma skill que ensina o Claude a notação aceita e
qual ferramenta usar em cada pergunta.

Por isso `plugins/veritas-logic/server.mjs` e `catalog.json` são artefatos de
build **versionados**: quem instala um plugin recebe uma cópia da pasta, e ela
precisa funcionar sozinha. Para regerá-los:

```bash
npm run build:plugin
npm run validate:plugin
```

### Servidor MCP (v0.9.0)

`mcp/` é um servidor [MCP](https://modelcontextprotocol.io) que entrega o motor
para assistentes de IA — tabela verdade, avaliação, simplificação, Karnaugh,
simulação de circuitos sequenciais, casos didáticos, debug de `AlgorithmDocument`
e consulta à biblioteca de chips. Em vez de o modelo chutar o resultado de uma
expressão ou estado, ele pergunta e recebe a conta/execução feita.

```bash
npm run build:mcp
claude mcp add veritas -- node $PWD/mcp/dist/server.js
```

Detalhes em [`mcp/README.md`](./mcp/README.md) e no desenho de compatibilidade [`docs/MCP-INTEROPERABILITY.md`](./docs/MCP-INTEROPERABILITY.md). O perfil atual é stdio; Streamable HTTP autenticado é a próxima camada para clientes remotos.

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
  simulation/  simulador por tiques: clock, flip-flops, atrasos
  storage/     banco local (Dexie) e o formato de arquivo .veritas
  auth/        sessão e autenticação Supabase
  cloud/       CRUD autenticado dos circuitos sincronizados
  ai/          cliente da análise/otimização por IA
  components/  interface
  hooks/       tema, projetos, sessão, sincronização e virtualização da tabela
  lib/         Supabase, exportação, URL compartilhável, formatação de valores
mcp/
  src/tools.ts   as ferramentas em si, testáveis sem MCP
  src/server.ts  transporte stdio e esquemas
.claude-plugin/
  marketplace.json       catálogo do marketplace
plugins/veritas-logic/
  .claude-plugin/        manifesto do plugin
  .mcp.json              como o Claude Code sobe o servidor
  skills/veritas/        skill com a notação e o guia de ferramentas
  server.mjs             servidor empacotado (gerado, versionado)
scripts/
  import-dls-chips.mjs   importador da biblioteca de chips
```

O `engine/` não depende de React nem do DOM — e é justamente por isso que o
servidor MCP e o importador de chips conseguem usar o mesmo código do site, sem
nenhuma cópia paralela.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Flow · Dagre · Dexie.js · Supabase Auth · Supabase Edge Functions · Workbox · Vitest · oxlint

## Testes derivados dos materiais didáticos

Os materiais enviados sobre proposições, conectivos, tabela verdade, implicação, equivalência, álgebra booleana, argumentos e organização de computadores foram usados para criar regressões em `src/engine/courseMaterials.test.ts`. A suíte verifica tautologias, contradições, contrapositiva, não equivalência da recíproca, De Morgan, bicondicional, Modus Ponens, Modus Tollens e silogismo hipotético. O mapeamento completo e a proposta de colaboração multi-room estão em [`docs/EDUCATIONAL-TESTS-MULTIROOM.md`](./docs/EDUCATIONAL-TESTS-MULTIROOM.md).

A suíte passou com **18 arquivos e 179 testes**, mantendo typecheck, lint e build limpos. O conteúdo de arquitetura de computadores também foi convertido em backlog conceitual para barramentos multi-bit, ALU didática, registradores e interconexões; esses componentes ainda não foram adicionados ao editor combinacional atual.

## Próximos passos

A v0.7.0 começou com um editor visual combinacional em prévia. Ele já possui um
modelo canônico de circuito, validação de entradas, detecção de ciclos, avaliação
determinística, tabela verdade automática, destaque de sinais por linha selecionada
e um canvas com paleta de componentes. Circuitos podem ser salvos, reabertos,
exportados e importados usando IndexedDB e o formato versionado de circuitos. A autenticação Supabase, a sincronização explícita na nuvem, o histórico imutável com
comparação de versões e a Edge Function autenticada para análise/otimização de portas já
estão disponíveis quando o ambiente é configurado. Consulte [`docs/AUTH-SYNC-AI.md`](./docs/AUTH-SYNC-AI.md),
[`docs/CLOUD-HISTORY.md`](./docs/CLOUD-HISTORY.md), [`docs/EDGE-FUNCTION-API.md`](./docs/EDGE-FUNCTION-API.md)
e [`docs/REALTIME-EXPORT-METRICS.md`](./docs/REALTIME-EXPORT-METRICS.md) para os fluxos completos.

### Colaboração, HDL e métricas (v0.7.2)

Usuários autenticados podem compartilhar um circuito pelo UUID de outro usuário e escolher o papel **editor** ou **visualizador**. O canal privado do Supabase Realtime usa Broadcast para snapshots e Presence para participantes online; o visualizador recebe atualizações, mas tem o canvas bloqueado. A persistência oficial continua sendo o salvamento versionado na nuvem, enquanto o IndexedDB mantém o caminho local-first.

O editor exporta circuitos combinacionais válidos para **Verilog-2001** (`.v`) e **VHDL-2008** (`.vhd`). Identificadores são sanitizados de forma determinística e circuitos inválidos são rejeitados antes do download. O painel de métricas acompanha latência, sucesso, confiança, provedor e fallback da IA em tempo real, sempre com RLS por usuário e telemetria best-effort.

O próximo trabalho é adicionar desfazer/refazer e evoluir a colaboração para múltiplas salas com isolamento por tópico, versão otimista e rejeição explícita de conflitos. O desenho inicial está em [`docs/EDUCATIONAL-TESTS-MULTIROOM.md`](./docs/EDUCATIONAL-TESTS-MULTIROOM.md).
Depois virão barramentos multi-bit, workspace sequencial visual e chips customizados. O núcleo `ALGO-001` já está disponível como módulo local-first: `AlgorithmDocument` versionado, validação estrutural, avaliador de expressões restrito, executor determinístico Step/Run, fila de entrada, trace e persistência IndexedDB. A documentação está em [`docs/FLOWGORITHM-INSIGHTS.md`](./docs/FLOWGORITHM-INSIGHTS.md). O `ALGO-002` possui Watch, `BranchTrace`, entrada tipada, Step/Run/Reset, laboratório lógico e integração demonstrativa no App. O `ALGO-003` agora adiciona While, razões de pausa, Continue e breakpoints por ID, documentado em [`docs/ALGO-003-DEBUG.md`](./docs/ALGO-003-DEBUG.md). A API proposicional completa reutiliza a engine para NAND, NOR, XNOR, implicação e bicondicional. O MCP expõe essas capacidades com schemas determinísticos; o desenho de stdio/HTTP está em [`docs/MCP-INTEROPERABILITY.md`](./docs/MCP-INTEROPERABILITY.md). O executor não executa o Flowgorithm enviado nem importa assemblies externos. Uma API de contexto para integrações MCP, desktop nativo, agentes em larga escala e recursos 3D só entra após validação técnica e planejamento próprios. Consulte o
[`roadmap executável`](./docs/ROADMAP.md) e a documentação [`Supabase`](./docs/SUPABASE.md)
para ver a ordem completa.
