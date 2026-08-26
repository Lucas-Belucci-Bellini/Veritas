# Verificação comportamental entre circuitos

## VERIFY-001 — equivalência exaustiva (combinacional)

### Objetivo e fronteira

O `compareCircuitEquivalence` responde a uma pergunta de engenharia, não a uma
pergunta estética: *"eu reescrevi este circuito — ele continua fazendo a mesma
coisa?"*. A comparação é **comportamental**. Dois circuitos com topologias,
IDs e contagens de portas completamente diferentes são equivalentes se
concordarem em todas as combinações de entrada.

O que a etapa **não** faz: não prova equivalência de circuitos sequenciais, não
usa SAT/BDD, não estima área, atraso físico ou consumo, e não altera o
`CircuitDocument`, a persistência local, o Supabase ou o Realtime. A verificação
é local-first e roda inteiramente no navegador ou no processo MCP.

### Identidade das portas

A comparação pareia entradas e saídas pelo **rótulo visual** (`label`), com
fallback para o ID quando não houver rótulo. Essa escolha é o que torna a
ferramenta útil: dois circuitos desenhados separadamente nunca compartilham IDs,
mas compartilham a interface que o autor nomeou.

Consequências diretas, todas cobertas por teste:

- rótulos duplicados dentro do mesmo circuito tornam a identidade ambígua e a
  comparação é recusada (`duplicate-port-name`);
- conjuntos de nomes diferentes entre A e B são recusados antes de qualquer
  avaliação (`input-set-mismatch`, `output-set-mismatch`);
- portas de mesmo nome com larguras diferentes são recusadas
  (`width-mismatch`), porque comparar `A[3:0]` com `A` não teria significado.

### Ordem canônica e determinismo

As portas são ordenadas **alfabeticamente por nome**, não pela ordem de
declaração no documento. A enumeração de linhas deriva dessa ordem, o que dá
uma propriedade verificada em teste: `compare(a, b)` e `compare(b, a)`
encontram sempre a **mesma linha** de contraexemplo, apenas com os valores de A
e B trocados. Nenhuma parte da comparação depende de relógio, ordem incidental
de objetos ou aleatoriedade.

### Exaustividade: a prova é total ou não é prova

A comparação percorre `2^(soma das larguras das entradas)` linhas. Quando esse
espaço excede o limite da execução, a ferramenta **recusa** com
`input-bits-exceeded` e `comparedRows: 0` — ela não avalia um prefixo e chama
isso de resultado. Uma comparação parcial não distingue "equivalentes" de
"ainda não achei a divergência", e reportá-la como equivalência seria uma prova
falsa.

Por isso o relatório carrega `exhaustive` e `status: 'incomparable'` como
estados de primeira classe, separados de `equivalent` e `divergent`.

| Limite | Valor | Origem |
| --- | --- | --- |
| `DEFAULT_EQUIVALENCE_INPUT_BITS` | 12 bits (4 096 linhas) | padrão do domínio, da UI e do MCP |
| `MAX_EQUIVALENCE_INPUT_BITS` | 16 bits (65 536 linhas) | teto absoluto; pedidos maiores são reduzidos a ele |

Os limites foram escolhidos por medição, não por estimativa. No mesmo circuito
de barramentos AND, comparando os dois lados: **12 bits levaram ~85 ms** e
**16 bits levaram ~776 ms**. O padrão de 12 bits mantém a comparação dentro da
faixa interativa; o teto de 16 bits é o ponto em que a operação ainda termina
sem congelar a interface. Números medidos em uma única máquina — são a
justificativa da escolha, não uma promessa de desempenho.

Para manter esse custo, o netlist de cada circuito é construído **uma vez** e
reusado em todas as linhas; apenas a avaliação entra no laço.

### Circuitos sequenciais

`clock`, `dff`, `tff` e `delay` são recusados com `sequential-unsupported`. A
saída desses componentes depende do histórico, e uma tabela de combinações de
entrada não descreve o comportamento deles. A regra reusa o
`isStatefulEditorType` do modelo do editor, então não existe uma segunda
definição de "componente com estado" que possa divergir da primeira.

Instâncias `custom-chip` **são** aceitas: a construção de um chip customizado já
rejeita componentes com estado, então o chip elaborado é combinacional por
construção.

Circuitos com estado não ficam sem resposta: eles são o domínio de
[VERIFY-002](#verify-002--comparação-temporal-sequencial), abaixo.

### Contrato do relatório

```ts
interface CircuitEquivalenceReport {
  status: 'equivalent' | 'divergent' | 'incomparable'
  equivalent: boolean      // só true quando exhaustive e sem divergência
  exhaustive: boolean      // false sempre que a comparação não percorreu tudo
  inputs: { name: string; width: number }[]
  outputs: { name: string; width: number }[]
  totalRows: number
  comparedRows: number
  divergentRows: number
  divergentOutputs: string[]
  counterexample: {
    row: number
    inputs: { name: string; width: number; value: string }[]
    divergences: { output: string; width: number; a: string; b: string }[]
  } | null
  issues: { code: CircuitEquivalenceIssueCode; message: string }[]
}
```

O contraexemplo é o produto mais útil da verificação. Ele responde *onde* os
circuitos discordam, com a combinação exata de entradas e o valor que cada lado
produziu — o suficiente para reproduzir a divergência no editor.

Documentos inválidos não produzem relatório: `compareCircuitEquivalence` lança
`Circuito A inválido: …` ou `Circuito B inválido: …`, identificando o lado.

### Superfícies

| Camada | Entrada |
| --- | --- |
| Domínio | `compareCircuitEquivalence` em `src/circuit/equivalence.ts` |
| Interface | painel “Equivalência entre circuitos” (`src/components/EquivalencePanel.tsx`), sobre os circuitos salvos localmente |
| MCP | ferramenta `circuit_equivalence`, com Markdown determinístico e contraexemplo tabulado |

O painel compara circuitos já salvos no IndexedDB e não envia nada para a rede.
A ferramenta MCP recebe os dois documentos no payload e aceita bibliotecas
`custom_chips_a`/`custom_chips_b` separadas, sem tocar em IndexedDB, Supabase ou
credenciais.

### Cobertura

- `src/circuit/equivalence.test.ts` — 15 casos: XOR direto contra XOR em soma de
  produtos, contraexemplo determinístico, simetria da troca de lados, comparação
  por rótulo com IDs e ordem diferentes, barramentos de 4 bits, meio somador com
  duas saídas (só o vai-um divergindo), circuitos sem entradas, recusa de
  sequenciais, divergência de interface, divergência de largura, rótulo
  duplicado, espaço de entrada acima do limite, teto absoluto e documento
  inválido.
- `mcp/src/tools.test.ts` — golden de equivalência, golden de contraexemplo,
  documento fora do formato e recusa por limite.
- `scripts/mcp-acceptance.mjs` — `MCP-EQ-001` e `MCP-EQ-002` exercitam a
  ferramenta pelo transporte stdio real.

## VERIFY-002 — comparação temporal (sequencial)

`compareCircuitTimelines` é a contraparte temporal: roda a **mesma sequência de
entradas** nos dois circuitos e aponta o primeiro tique em que discordam. Cobre
exatamente a classe que VERIFY-001 recusa — `clock`, `dff`, `tff` e `delay`.

### A força da conclusão faz parte da conclusão

A diferença entre as duas ferramentas está no vocabulário do relatório, e é
deliberada:

| | VERIFY-001 | VERIFY-002 |
| --- | --- | --- |
| percorre | todo o espaço de entrada | só o roteiro escrito |
| melhor veredito | `equivalent` | `identical` |
| significa | "concordam sempre" | "concordaram **neste roteiro**" |
| classe | combinacional | sequencial (e combinacional) |

Um roteiro que termina sem divergência **não prova** que não existe uma. O campo
se chama `identical`, e não `equivalent`, para que nenhum consumidor — pessoa,
IA ou código — leia mais força do que existe. O relatório do MCP e o painel
dizem isso em texto, junto do resultado positivo.

### Roteiro

```ts
interface CircuitDifferentialStep {
  set?: Record<string, boolean>  // valores por nome de porta; ausente = mantém
  ticks?: number                 // padrão 1
}
```

Entradas e saídas são pareadas pelo rótulo, com as mesmas regras de identidade
de VERIFY-001: rótulo duplicado, interface divergente e nome desconhecido no
roteiro são recusados **antes** de simular, com `comparedTicks: 0`.

A simulação é escalar (um bit por porta), porque é o que o runtime de
`src/simulation/` oferece; barramentos ficam para quando o runtime os suportar.
O limite é `MAX_DIFFERENTIAL_TICKS = 1000` tiques somados; um roteiro maior é
recusado sem simular nada, em vez de truncado.

### Contrato do relatório

```ts
interface CircuitDifferentialReport {
  status: 'identical' | 'divergent' | 'incomparable'
  identical: boolean
  inputs: string[]
  outputs: string[]
  totalTicks: number
  comparedTicks: number
  divergentTicks: number
  divergentOutputs: string[]
  firstDivergence: {
    tick: number
    step: number
    inputs: { name: string; value: boolean }[]
    signals: { signal: string; a: boolean; b: boolean }[]
  } | null
  issues: { code: CircuitDifferentialIssueCode; message: string }[]
}
```

### Superfícies

| Camada | Entrada |
| --- | --- |
| Domínio | `compareCircuitTimelines` em `src/circuit/differential.ts` |
| Interface | painel “Comparação temporal” (`src/components/TimelineComparisonPanel.tsx`), com editor de roteiro |
| MCP | ferramenta `circuit_differential` |

### Cobertura

- `src/circuit/differential.test.ts` — 14 casos: sequenciais idênticos, primeiro
  tique divergente, divergência que só aparece depois de vários ciclos
  (atrasos de 1 contra 3 tiques), determinismo da repetição, contagem de tiques
  divergentes, valor inicial de entrada que o roteiro nunca toca, divergência
  de interface, entrada desconhecida no roteiro,
  roteiro vazio, limite de tiques, teto absoluto, passo sem `ticks`, documento
  inválido e rótulo duplicado.
- `mcp/src/tools.test.ts` — golden idêntico (incluindo o aviso de que não é
  prova), golden do primeiro tique divergente, recusa por limite e documento
  fora do formato.
- `scripts/mcp-acceptance.mjs` — `MCP-DIFF-001` e `MCP-DIFF-002` pelo transporte
  stdio real.

## VERIFY-003 — testbench declarativo

`runTestbench` roda um documento de teste contra um circuito. A diferença para
as duas anteriores é o que se compara: em vez de circuito contra circuito, aqui
é **circuito contra a intenção do autor**.

### O teste é dado, não código

Um caso declara valores, nunca uma expressão. Nada é compilado, nada é avaliado
fora do avaliador do próprio Veritas, e um documento de teste importado não é
mais perigoso que um `.veritas`. Essa restrição é deliberada: assim que um
testbench aceita expressões, ele vira uma linguagem, e uma linguagem precisa de
um sandbox.

```ts
interface TestbenchCase {
  name?: string
  inputs?: Record<string, boolean>   // modo combinacional
  expect?: Record<string, boolean>
  steps?: TestbenchStep[]            // modo sequencial
}

interface TestbenchStep {
  set?: Record<string, boolean>
  ticks?: number                     // padrão 1
  expect?: Record<string, boolean>   // conferido DEPOIS dos tiques
}
```

Um caso é combinacional **ou** sequencial. Misturar `steps` com
`inputs`/`expect` torna a intenção ambígua e é recusado (`mixed-case-mode`).

### Um caso sem expectativa não é um teste

Um caso que não declara nenhuma saída esperada não pode falhar — e um teste que
nunca falha não testa nada, só dá uma sensação de cobertura. Por isso ele é
recusado com `missing-expectation`, em vez de contar como "passou".

### Todos os casos rodam

A execução não para no primeiro caso que falha. O produto útil de um testbench
é saber **quantos e quais** falharam; parar no primeiro esconde os outros e
transforma a correção em um jogo de um erro por vez.

### O que passar num testbench significa

Passar cobre **exatamente os casos escritos**. Não é prova sobre o espaço de
entrada — isso é `compareCircuitEquivalence`. O relatório do MCP e o painel
dizem isso junto do resultado positivo, pela mesma razão que a comparação
temporal diz "idêntico neste roteiro".

Para casos sequenciais, o resultado também inclui um diagnóstico bounded do
estado final. O diagnóstico é informativo e não substitui `passed` ou `failed`:

| Diagnóstico | Significado |
| --- | --- |
| `stabilized` | O estado final ficou estável dentro da janela diagnóstica |
| `cycle-detected` | O runtime repetiu um estado; o relatório informa início e período quando observáveis |
| `budget-exhausted` | A janela bounded terminou sem estabilização ou repetição observável |

O diagnóstico roda sobre uma cópia isolada do estado final do caso. Ele não
avança o runtime usado para conferir as expectativas e não altera o runtime ativo
da interface. O budget padrão é `MAX_TESTBENCH_DIAGNOSTIC_TICKS` (64 tiques), e
o chamador pode fornecer um valor inteiro entre 1 e 64 por meio de
`TestbenchOptions.diagnosticTicks`.

| | VERIFY-001 | VERIFY-002 | VERIFY-003 |
| --- | --- | --- | --- |
| compara | circuito × circuito | circuito × circuito | circuito × intenção |
| percorre | todo o espaço | o roteiro | os casos escritos |
| melhor veredito | `equivalent` | `identical` | `passed` |

### Limites e fronteiras

| Limite | Valor |
| --- | --- |
| `MAX_TESTBENCH_CASES` | 512 casos |
| `MAX_TESTBENCH_TICKS` | 1000 tiques somados nos casos sequenciais |
| `MAX_TESTBENCH_DIAGNOSTIC_TICKS` | 64 tiques na janela diagnóstica por caso sequencial |

Referências a portas inexistentes (`unknown-input`, `unknown-output`) e rótulos
duplicados são recusados **antes** de qualquer execução.

Casos sequenciais aceitam instâncias `custom-chip` desde CHIP-006: o runtime
temporal recebe a biblioteca e achata os chips antes de simular.

### Superfícies

| Camada | Entrada |
| --- | --- |
| Domínio | `runTestbench` em `src/circuit/testbench.ts`; casos sequenciais retornam diagnóstico bounded |
| Interface | painel “Testes do circuito” (`src/components/TestbenchPanel.tsx`) — a tabela **é** o documento de teste e apresenta o diagnóstico por caso |
| MCP | ferramenta `run_testbench`, com o diagnóstico serializado em texto |

### Cobertura

- `src/circuit/testbench.test.ts` — 19 casos: meio somador aprovado, meio
  somador com o vai-um errado apontando caso/saída/valores, execução de todos os
  casos sem parar no primeiro, nomeação por posição, caso sequencial com
  expectativa por passo, tique e passo no relatório de falha sequencial, mistura
  de modos, caso sem expectativa (combinacional e sequencial), portas
  inexistentes, formato inválido, sem casos, limite de casos, limite de tiques,
  rótulo duplicado, guarda de custom-chip sequencial, passo sem `ticks`,
  determinismo e ordem canônica das divergências.
- `mcp/src/tools.test.ts` — golden aprovado (incluindo o aviso sobre o que não
  prova), golden reprovado tabulado, documento inválido, circuito fora do
  formato e diagnóstico bounded de ciclo no resultado headless.
- `scripts/mcp-acceptance.mjs` — `MCP-TB-001` e `MCP-TB-002` pelo transporte
  stdio real.

## Identidade de portas compartilhada

As três ferramentas pareiam portas pelo mesmo caminho: `collectCircuitPorts` em
`src/circuit/portIdentity.ts`. Antes dele, `collectPorts` existia duplicado em
`equivalence.ts` e `differential.ts`, e uma terceira cópia teria criado três
definições de "identidade de porta" livres para divergir. A ordem canônica
alfabética, a regra de rótulo-com-reserva-no-ID e a mensagem de rótulo duplicado
moram nesse módulo.

## O que estas etapas deliberadamente não entregam

Asserções (`assert ALWAYS`/`NEVER`), verificação de propriedades, equivalência
**sequencial provada** (não amostrada), geração automática de casos e
auto-correção por IA continuam fora do escopo. As asserções precisam de um
avaliador de expressões sobre sinais — e ele deve reusar o parser da engine, não
qualquer coisa parecida com `eval`.

O painel de testes cobre o modo combinacional; casos sequenciais existem no
domínio e no MCP, e a interface deles depende de um editor de roteiro com
expectativas.
