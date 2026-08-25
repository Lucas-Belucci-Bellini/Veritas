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

## O que estas etapas deliberadamente não entregam

Testbenches declarativos, asserções (`assert ALWAYS`/`NEVER`), verificação de
propriedades, equivalência **sequencial provada** (não amostrada) e
auto-correção por IA continuam fora do escopo. Todas dependem destes dois
contratos e vêm depois deles.
