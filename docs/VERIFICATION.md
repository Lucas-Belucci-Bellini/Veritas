# VERIFY-001 — equivalência comportamental entre circuitos

## Objetivo e fronteira

O `compareCircuitEquivalence` responde a uma pergunta de engenharia, não a uma
pergunta estética: *"eu reescrevi este circuito — ele continua fazendo a mesma
coisa?"*. A comparação é **comportamental**. Dois circuitos com topologias,
IDs e contagens de portas completamente diferentes são equivalentes se
concordarem em todas as combinações de entrada.

O que a etapa **não** faz: não prova equivalência de circuitos sequenciais, não
usa SAT/BDD, não estima área, atraso físico ou consumo, e não altera o
`CircuitDocument`, a persistência local, o Supabase ou o Realtime. A verificação
é local-first e roda inteiramente no navegador ou no processo MCP.

## Identidade das portas

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

## Ordem canônica e determinismo

As portas são ordenadas **alfabeticamente por nome**, não pela ordem de
declaração no documento. A enumeração de linhas deriva dessa ordem, o que dá
uma propriedade verificada em teste: `compare(a, b)` e `compare(b, a)`
encontram sempre a **mesma linha** de contraexemplo, apenas com os valores de A
e B trocados. Nenhuma parte da comparação depende de relógio, ordem incidental
de objetos ou aleatoriedade.

## Exaustividade: a prova é total ou não é prova

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

## Circuitos sequenciais

`clock`, `dff`, `tff` e `delay` são recusados com `sequential-unsupported`. A
saída desses componentes depende do histórico, e uma tabela de combinações de
entrada não descreve o comportamento deles. A regra reusa o
`isStatefulEditorType` do modelo do editor, então não existe uma segunda
definição de "componente com estado" que possa divergir da primeira.

Instâncias `custom-chip` **são** aceitas: a construção de um chip customizado já
rejeita componentes com estado, então o chip elaborado é combinacional por
construção.

## Contrato do relatório

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

## Superfícies

| Camada | Entrada |
| --- | --- |
| Domínio | `compareCircuitEquivalence` em `src/circuit/equivalence.ts` |
| Interface | painel “Equivalência entre circuitos” (`src/components/EquivalencePanel.tsx`), sobre os circuitos salvos localmente |
| MCP | ferramenta `circuit_equivalence`, com Markdown determinístico e contraexemplo tabulado |

O painel compara circuitos já salvos no IndexedDB e não envia nada para a rede.
A ferramenta MCP recebe os dois documentos no payload e aceita bibliotecas
`custom_chips_a`/`custom_chips_b` separadas, sem tocar em IndexedDB, Supabase ou
credenciais.

## Cobertura

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

## O que esta etapa deliberadamente não entrega

Simulação diferencial passo a passo, testbenches declarativos, asserções,
verificação de propriedades, equivalência sequencial e auto-correção por IA
continuam fora do escopo. Todas dependem deste contrato e vêm depois dele.
