# ALGO-003 — depuração passo a passo e breakpoints

## Objetivo

ALGO-003 transforma o executor local-first em uma máquina de depuração reproduzível. O usuário pode executar um nó por vez, rodar até o fim ou até um breakpoint, continuar depois da pausa e investigar Watch/BranchTrace sem alterar a semântica do algoritmo.

## Contrato de estado

```ts
export type DebugPauseReason =
  | 'step'
  | 'breakpoint'
  | 'input'
  | 'finished'
  | 'error'
  | 'max-steps'

export interface ExecutionDebugState {
  breakpoints: string[]
  lastPauseReason: DebugPauseReason | null
}
```

`ExecutionState.debug.breakpoints` contém IDs de nós, não posições de tela. Isso mantém os breakpoints estáveis quando o usuário move nós no canvas. `lastPauseReason` permite a UI explicar por que o fluxo parou.

## Step

`stepAlgorithm()` nunca consulta breakpoints. Ele executa exatamente o nó indicado por `activeNodeId`, adiciona um item ao trace, incrementa `stepIndex` e retorna um novo estado. Essa decisão permite que o usuário avance manualmente mesmo quando o nó atual está marcado.

O nó `while` avalia uma condição booleana. Se o resultado for verdadeiro, segue por `bodyNext`; se for falso, segue por `exitNext`. Cada avaliação produz uma entrada de `BranchTrace`, logo o Watch e o trace conseguem mostrar todas as iterações.

## Run e Continue

`runAlgorithm()` verifica o breakpoint antes de executar o nó ativo:

```ts
let skipBreakpointNodeId =
  state.debug.lastPauseReason === 'breakpoint'
    ? state.activeNodeId
    : null

while (canContinue(state)) {
  if (
    state.activeNodeId &&
    state.debug.breakpoints.includes(state.activeNodeId) &&
    state.activeNodeId !== skipBreakpointNodeId
  ) {
    return pauseAtBreakpoint(state)
  }

  skipBreakpointNodeId = null
  state = stepAlgorithm(document, state, { maxSteps })
}
```

Quando Continue é clicado, o breakpoint atual é ignorado uma única vez. Se o algoritmo voltar ao mesmo nó em uma iteração seguinte, a execução pausa novamente. Isso evita tanto o bloqueio permanente quanto a passagem silenciosa por todas as ocorrências futuras.

## Breakpoint management

As funções são puras:

```ts
setBreakpoint(state, nodeId, true)
toggleBreakpoint(state, nodeId)
clearBreakpoints(state)
```

A UI lista todos os nós do documento e mantém as marcações quando Reset é executado. O reset cria um estado novo, mas copia a lista de breakpoints, pois breakpoint é configuração de depuração e não dado produzido pela execução.

## Segurança contra loops

`maxSteps` continua obrigatório. Um While que nunca altera a variável de sua condição termina em `error` com `lastPauseReason = 'max-steps'`. O limite padrão é 10.000 passos; chamadas MCP podem reduzir o valor para limitar tempo e resposta.

## Critérios de aceite

A cobertura mínima inclui: Step manual no nó marcado; Run pausando antes do breakpoint; Continue executando o nó uma vez; retorno ao mesmo breakpoint pausando novamente; While verdadeiro repetindo; While falso saindo; input aguardando valor; erro de expressão; e limite de passos.
