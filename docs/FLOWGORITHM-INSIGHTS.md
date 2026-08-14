# Insights do Flowgorithm para o Veritas

## Escopo da análise

Os arquivos `Flowgorithm.application`, `Flowgorithm.exe`, `Flowgorithm.exe.manifest` e `Flowgorithm.exe.config` foram inspecionados estaticamente. O executável não foi aberto nem executado. O manifesto identifica uma distribuição ClickOnce do Flowgorithm 3.2.0.0, com assembly .NET 4.5.0.0, requisito `.NET Framework 4.7.2`, associações para `.fcht`, `.fclr`, `.fpgt` e `.fprg`, além de um permission set `Unrestricted`. Por segurança e por incompatibilidade com o ambiente web do Veritas, os arquivos não são tratados como dependência executável.

A análise de produto foi complementada pela documentação oficial do Flowgorithm, que descreve símbolos de fluxograma, execução passo a passo, janela de observação de variáveis, breakpoints condicionais, funções, arrays, loops, templates de geração de código, esquemas visuais e arquivos XML [1] [2].

## O que vale incorporar

A principal oportunidade não é copiar o executável, mas aproveitar o modelo pedagógico: desenhar um algoritmo, executá-lo de forma observável e relacionar cada símbolo visual ao estado produzido.

| Capacidade observada | Aplicação proposta no Veritas | Prioridade |
| --- | --- | --- |
| Terminais `Main`/`End` | Workspace separado `Algoritmos`, sem misturar o grafo de fluxo com o netlist combinacional | Alta |
| Assignment e Declare | Nós de atribuição e declaração com tipos explícitos | Alta |
| If, While, Do e For | Estruturas de controle com subgrafos e execução determinística | Alta |
| Input e Output | Console didático com entradas tipadas e saída colorida | Média |
| Watch de variáveis | Painel de estado com valor, tipo, escopo e histórico da execução | Alta |
| Step/Run/Pause | Ponteiro de nó ativo, trilha de execução e pausa segura | Alta |
| Breakpoint condicional | Pausar quando uma expressão booleana for verdadeira | Média |
| Call e funções | Call stack limitada e funções com retorno/sem retorno | Média |
| Templates de código | Geração de pseudocódigo e TypeScript/Python a partir de um IR próprio | Média |
| Arrays, arquivos e turtle graphics | Extensões posteriores, sempre dentro de sandbox e com permissões explícitas | Baixa |

## Arquitetura sugerida

O workspace de algoritmos deve compartilhar o lexer, parser, avaliação booleana, persistência local e autenticação do Veritas, mas possuir um modelo intermediário próprio:

```ts
type AlgorithmDocument = {
  format: 'veritas-algorithm'
  version: 1
  name: string
  variables: AlgorithmVariable[]
  nodes: AlgorithmNode[]
  edges: AlgorithmEdge[]
  functions: AlgorithmFunction[]
}

type ExecutionState = {
  activeNodeId: string
  variables: Record<string, RuntimeValue>
  callStack: CallFrame[]
  output: string[]
  status: 'ready' | 'running' | 'paused' | 'finished' | 'error'
  stepIndex: number
}
```

O executor deve receber um `AlgorithmDocument` validado e produzir uma sequência de estados imutáveis. Isso permite `Step`, `Run`, `Pause`, replay, destaque no canvas e testes sem depender do DOM ou do React.

A validação deve ocorrer em quatro níveis:

1. **Estrutural:** IDs, tipos, entradas/saídas e existência de `Main`/`End`.
2. **Tipada:** variáveis declaradas, atribuições compatíveis e chamadas com aridade correta.
3. **Controle de fluxo:** todos os caminhos relevantes terminam ou são classificados como loop intencional; chamadas recursivas têm limite.
4. **Execução:** limite de passos, tamanho de arrays, profundidade da call stack e operações de I/O autorizadas.

## Primeira fatia executável: `ALGO-001`

A primeira implementação não deve começar com arrays, arquivos ou geração para 18 linguagens. A fatia recomendada é:

- criar `AlgorithmDocument` versionado;
- adicionar Start, End, Declare, Assign, If, Input e Output;
- implementar executor `stepAlgorithm()` puro;
- exibir o nó ativo e um Watch de variáveis;
- persistir localmente com IndexedDB;
- adicionar testes para atribuição, ramificação, entrada/saída, caminho sem saída e limite de passos;
- manter o editor de circuitos combinacionais inalterado.

Depois de `ALGO-001`, a segunda fatia pode adicionar loops `While`/`For`, seguida por `Call`/funções e, somente depois, arrays e templates de código.

## Segurança e compatibilidade

O Flowgorithm enviado deve ser tratado como referência de comportamento, não como plugin. O Veritas não deve executar `.exe`, carregar assembly externo, importar XML arbitrário ou permitir I/O irrestrito. O formato próprio deve ser versionado, validado e convertido para uma IR interna antes da execução.

Qualquer execução de algoritmo deve ter limites explícitos para passos, memória, chamadas, tamanho de saída e tempo. Operações de arquivo e rede devem ser proibidas por padrão no executor web; se forem adicionadas no futuro, deverão passar por uma API sandboxed e por consentimento explícito.

## Relação com os materiais didáticos

Os PDFs enviados sobre proposições, argumentos, tabela verdade e arquitetura de computadores complementam essa direção. O motor lógico já suporta conectivos e regressões didáticas; o workspace de algoritmos adicionaria controle de fluxo, enquanto o backlog de barramentos multi-bit e ALU representaria a ponte entre lógica combinacional e arquitetura de computadores.

## Referências

[1]: http://www.flowgorithm.org/about/features.html "Flowgorithm — Features"
[2]: http://www.flowgorithm.org/documentation/ "Flowgorithm — Documentation"
[3]: http://www.flowgorithm.org/documentation/tutorial/ "Flowgorithm — Tutorial"
