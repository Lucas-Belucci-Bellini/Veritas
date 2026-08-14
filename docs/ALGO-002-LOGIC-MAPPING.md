# ALGO-002 — Watch de variáveis e ramificações lógicas

## Objetivo

O ALGO-002 deve transformar a execução do workspace de algoritmos em uma experiência de raciocínio observável: o usuário acompanha o valor de cada variável, a condição avaliada, o ramo escolhido e a razão pela qual a execução avançou. Os PDFs enviados fornecem casos didáticos para essa camada.

## Mapeamento dos conceitos

| Conceito dos PDFs | Representação no ALGO-002 | Evidência exibida no Watch |
| --- | --- | --- |
| Proposição simples `P` | Variável booleana declarada | `P = verdadeiro/falso`, tipo `boolean` |
| Negação `¬P` | Condição `NOT P` ou `!P` | Operandos e resultado da condição |
| Conjunção `P ∧ Q` | `P AND Q`/`P && Q` | `P`, `Q`, resultado e branch escolhido |
| Disjunção `P ∨ Q` | `P OR Q`/`P || Q` | Valor curto-circuitado e resultado |
| Condicional `P → Q` | `IF P THEN ... ELSE ...` | Hipótese, tese, resultado e caminho |
| Bicondicional `P ↔ Q` | `P == Q` ou `(P AND Q) OR (NOT P AND NOT Q)` | Igualdade dos valores |
| Tautologia | Condição sempre verdadeira | Badge `tautologia` após execução de todas as linhas |
| Contradição | Condição sempre falsa | Badge `contradição` e ramo `else` repetido/inalcançado |
| Implicação | Regra de decisão sobre uma condição | Linhas em que antecedente verdadeiro e consequente falso |
| Contraexemplo | Estado de variáveis que quebra uma implicação | Snapshot reproduzível do Watch |
| De Morgan | Expressões equivalentes em branches | Comparação de duas execuções com mesma saída |
| Modus Ponens/Tollens | Fluxos de decisão com premissas | Trace das premissas e da conclusão |
| Sentença aberta/quantificadores | Futuro: domínio de entrada e conjunto de execuções | Não implementar no ALGO-002 booleano sem modelo de domínio |

## Exemplo de atividade didática

Algoritmo: classificar se uma entrada satisfaz uma implicação.

```text
Declare P : boolean
Declare Q : boolean
Input P
Input Q
If P -> Q Then
  Output "implicação satisfeita"
Else
  Output "contraexemplo"
End If
```

Para compatibilidade imediata com o avaliador do ALGO-001, a expressão da condição pode ser escrita como `NOT P OR Q`. O Watch deve mostrar:

| Passo | Nó | Estado |
| --- | --- | --- |
| 1 | `input-p` | `P = verdadeiro` |
| 2 | `input-q` | `Q = falso` |
| 3 | `if-implication` | `NOT P OR Q = falso`; ramo `else` |
| 4 | `output-counterexample` | saída `contraexemplo` |

A linha `(P = verdadeiro, Q = falso)` é precisamente o único caso falso da condicional material apresentada no PDF de conectivos e tabela verdade.

## Watch de variáveis

O painel deve apresentar o estado atual e a mudança anterior, não somente o valor final:

```ts
type VariableWatchEntry = {
  name: string
  type: AlgorithmValueType
  value: RuntimeValue
  previousValue: RuntimeValue | undefined
  changedAtStep: number | null
  scope: 'global' | 'function'
}

type BranchTrace = {
  nodeId: string
  expression: string
  operands: Record<string, RuntimeValue>
  result: boolean
  selectedBranch: 'then' | 'else'
  step: number
}
```

A execução deve gerar `BranchTrace` junto com o `ExecutionState`. Com isso, o usuário pode selecionar uma linha do trace e ver a expressão, os operandos e a saída que motivou a decisão.

## Casos de teste prioritários

1. **Dupla negação:** `NOT NOT P` deve produzir o mesmo valor de `P`.
2. **De Morgan:** `NOT (P AND Q)` e `NOT P OR NOT Q` devem produzir o mesmo ramo para as quatro combinações.
3. **Contrapositiva:** `P -> Q` e `NOT Q -> NOT P` devem selecionar o mesmo ramo em todas as combinações.
4. **Recíproca:** `Q -> P` deve divergir de `P -> Q` no contraexemplo `P = falso`, `Q = verdadeiro`.
5. **Tautologia:** `P OR NOT P` deve sempre selecionar `then`.
6. **Contradição:** `P AND NOT P` deve sempre selecionar `else`.
7. **Modus Ponens:** premissas `(P -> Q)` e `P` devem levar a `Q`.
8. **Modus Tollens:** premissas `(P -> Q)` e `NOT Q` devem levar a `NOT P`.
9. **Estado observável:** cada atribuição deve registrar valor anterior, valor novo e passo.
10. **Replay:** executar o mesmo documento com as mesmas entradas deve gerar o mesmo trace e a mesma saída.

## Limites deliberados

O ALGO-002 não deve tentar resolver quantificadores, paradoxos, domínios matemáticos gerais ou prova automática completa. A engine atual é proposicional/booleana; esses temas devem gerar um backlog de lógica simbólica separado, com AST e semântica próprios.
