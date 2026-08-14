# ALGO-002 — UI observável e casos lógicos interativos

## Visão geral

O ALGO-002 é uma camada React sobre o executor puro do ALGO-001. A UI não reimplementa a semântica: ela fornece controles, apresenta `ExecutionState.watch` e `ExecutionState.branches` e envia entradas por `provideInput()`.

A implementação está dividida em quatro peças:

| Arquivo | Responsabilidade |
| --- | --- |
| `src/components/AlgorithmVariableWatch.tsx` | Exibir nome, tipo, valor atual, valor anterior e passo da última alteração. |
| `src/components/AlgorithmBranchTrace.tsx` | Exibir expressão, operandos, resultado, ramo escolhido e permitir selecionar o nó. |
| `src/components/AlgorithmWorkspace.tsx` | Controlar `Step`, `Run`, `Reset`, entrada tipada, status, erro e saída. |
| `src/components/LogicCaseLab.tsx` | Selecionar casos dos PDFs, alternar premissas e visualizar a tabela de resultados. |

## 1. Extensão do estado

O executor agora mantém observabilidade como dados, não como efeito colateral visual:

```ts
export interface VariableWatchEntry {
  name: string
  type: AlgorithmValueType
  value: RuntimeValue
  previousValue: RuntimeValue | undefined
  changedAtStep: number | null
  scope: 'global' | 'function'
}

export interface BranchTraceEntry {
  nodeId: string
  expression: string
  operands: Record<string, RuntimeValue>
  result: boolean
  selectedBranch: 'then' | 'else'
  step: number
}
```

`ExecutionState` possui `watch` e `branches`. Quando um nó Declare, Assign ou Input altera uma variável, `recordWatchChange()` registra o valor anterior, o valor novo e o passo. Quando um nó If é avaliado, o executor registra a expressão, o snapshot de operandos e o branch selecionado.

A regra importante é manter o estado imutável por transição. `cloneState()` copia arrays, mapas e objetos aninhados antes de inserir a nova evidência.

## 2. Componente Watch

O componente recebe somente dados observáveis:

```tsx
<AlgorithmVariableWatch
  entries={state.watch}
  activeStep={state.stepIndex}
/>
```

Isso permite que o mesmo componente seja usado em Step, Run, replay e colaboração, sem conhecer como uma variável foi calculada. Valores booleanos são formatados como `verdadeiro`/`falso`, strings permanecem legíveis e `null` aparece como `—`.

## 3. Componente BranchTrace

Cada decisão é apresentada como uma linha selecionável:

```tsx
<AlgorithmBranchTrace
  entries={state.branches}
  selectedNodeId={selectedNodeId}
  onSelectNode={setSelectedNodeId}
/>
```

A seleção deve ser conectada ao canvas quando o editor visual de algoritmos for criado. O callback não altera a execução; ele apenas permite destacar o nó `If` correspondente.

## 4. Workspace e transições

O `AlgorithmWorkspace` inicia o estado usando `createExecutionState(document)`. Os controles chamam o executor:

```tsx
function handleStep() {
  if (state.status === 'awaiting-input' && inputNode) {
    const value = parseAlgorithmInput(
      rawInput,
      state.variableTypes[inputNode.variable],
    )
    commit(stepAlgorithm(
      document,
      provideInput(state, inputNode.variable, value),
      { maxSteps },
    ))
    return
  }

  commit(stepAlgorithm(document, state, { maxSteps }))
}

function handleRun() {
  commit(runAlgorithm(document, state, { maxSteps }))
}
```

A UI nunca usa `eval` para converter entrada. `parseAlgorithmInput()` aceita números finitos, strings e booleanos em português/inglês; valores inválidos viram `error`.

O estado `awaiting-input` é deliberado: o executor pausa no nó Input e a interface fornece o valor antes de retomar. Isso permite aulas passo a passo e replay determinístico.

## 5. Casos interativos dos PDFs

`src/algorithms/logicCases.ts` converte exercícios em dados executáveis, e não em texto fixo. Cada `LogicTestCase` informa origem, tipo, variáveis, expressões, premissas e conclusão.

```ts
export const LOGIC_TEST_CASES = [
  {
    id: 'tautology-excluded-middle',
    title: 'Lei do terceiro excluído',
    source: 'Algebra de Boole',
    kind: 'tautology',
    variables: ['P'],
    expression: 'P OR NOT P',
  },
  {
    id: 'modus-ponens',
    title: 'Modus Ponens',
    source: 'Argumentos',
    kind: 'argument',
    variables: ['P', 'Q'],
    premises: ['NOT P OR Q', 'P'],
    conclusion: 'Q',
  },
] as const
```

`evaluateLogicTestCase()` enumera todas as atribuições booleanas, avalia as expressões pelo mesmo parser do executor e retorna linhas com `passes`. Isso evita que o laboratório use uma segunda semântica diferente da engine.

Os casos incluídos são:

| Caso | Resultado esperado |
| --- | --- |
| Lei do terceiro excluído | Todas as linhas passam. |
| De Morgan | As duas expressões têm o mesmo valor em todas as linhas. |
| Contrapositiva | `P → Q` e `¬Q → ¬P` são equivalentes; em forma material, `NOT P OR Q` e `Q OR NOT P`. |
| Implicação material | O único contraexemplo é `P = verdadeiro`, `Q = falso`. |
| Modus Ponens | Premissas verdadeiras implicam conclusão `Q`. |
| Modus Tollens | Premissas verdadeiras implicam conclusão `NOT P`. |

O `LogicCaseLab` fornece seleção do caso, botões para alternar P/Q, indicação de `caso satisfeito`/`contraexemplo` e uma tabela de resultados. A integração atual é demonstrativa no App principal; o próximo passo visual é conectar as linhas ao canvas do workspace.

## 6. Critérios de aceitação

Uma alteração ALGO-002 só deve ser considerada concluída quando o Watch mantiver valor anterior e passo, o BranchTrace registrar cada avaliação, a entrada inválida produzir erro seguro, o replay produzir o mesmo trace e os casos de tautologia/equivalência/argumento continuarem passando.

A UI atual foi integrada sem remover o editor combinacional e sem introduzir uma dependência Supabase. O executor e o laboratório funcionam localmente; sincronização dos documentos de algoritmo será uma etapa posterior, após definir versionamento e isolamento por sala.
