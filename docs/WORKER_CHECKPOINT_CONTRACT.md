# Contrato de checkpoint do Worker de simulação

Este documento define o contrato mínimo para uma futura continuidade de execução entre requests Worker. Ele existe para impedir que `Step`/`Run` canônicos sejam migrados para Worker apenas porque o preview de um request isolado já possui paridade. O contrato é especificação; a presença deste arquivo não habilita resume no protocolo Worker v1.

## Estado atual

O Worker v1 executa uma sequência completa dentro de um único request e devolve snapshots. A UI mantém `Step`/`Run` no runtime canônico direto. Este contrato também é distinto do `runtimeCheckpoint` existente para persistência local do estado do Simulator/documento: o checkpoint Worker é um envelope de transporte versionado para futura troca segura de runtime e não altera o armazenamento local já existente. A regressão `workerSequentialParity.test.ts` prova apenas que uma fixture DFF escalar produz os mesmos snapshots no Worker e no `Simulator` dentro de um request. Nenhum campo de checkpoint é aceito pelo protocolo v1 e nenhum componente da UI deve enviar ou restaurar checkpoint até a versão do protocolo, parser e gates deste documento estarem implementados.

## Envelope versionado

A forma futura deve ser um objeto JSON de dados, sem funções, protótipos, classes, URLs executáveis, módulos, código ou referências a objetos do navegador:

```ts
interface SimulationWorkerCheckpointV1 {
  kind: 'veritas.worker-checkpoint'
  checkpointVersion: 1
  protocolVersion: 1
  netlistSignature: string
  state: SimulationWorkerCheckpointStateV1
}
```

`netlistSignature` é a representação canônica e determinística do netlist escalar normalizado que entrou no Worker, incluindo ordem, ids, tipos, opções escalares e conexões normalizadas. Ela vincula o estado ao circuito correto sem depender de igualdade superficial de ids. O checkpoint não deve carregar uma cópia alternativa do netlist nem permitir que o conteúdo do checkpoint substitua o documento atual.

O estado completo necessário para continuar a semântica temporal é:

```ts
interface SimulationWorkerCheckpointStateV1 {
  tickCount: number
  operationCount: number
  nodes: Record<string, {
    outputs: boolean[]
    next: boolean[]
    lastClock: boolean
    nextLastClock: boolean
    queue: boolean[]
    nextQueue: boolean[]
    counter: number
    nextCounter: number
  }>
}
```

`operationCount` é obrigatório porque retomar somente `tickCount` permitiria resetar silenciosamente o budget acumulado de operações. O `Simulator` atual já exporta quase todo o estado temporal; a implementação do checkpoint precisa também preservar e restaurar a contagem de operações de maneira transacional, sem alterar a semântica pública dos snapshots existentes.

## Invariantes de validação

O parser futuro deve rejeitar o envelope inteiro antes de criar um runtime quando qualquer invariável falhar. `kind`, `checkpointVersion` e `protocolVersion` precisam ser exatamente os valores declarados. `netlistSignature` deve ser uma string não vazia, UTF-8 válida e dentro do limite de transporte do checkpoint. `tickCount`, `operationCount`, `counter` e os comprimentos das filas devem ser inteiros finitos não negativos e estar dentro dos budgets oficiais do request e dos limites do protocolo Worker v1.

Todas as folhas de `outputs`, `next`, `queue` e `nextQueue` devem ser booleanos. Os ids presentes em `nodes` devem coincidir exatamente com os ids do netlist atual, sem duplicação, omissão ou chave extra. Os comprimentos de `outputs` e `next` devem coincidir com a quantidade de saídas do componente correspondente; as filas só podem aparecer em componentes de atraso e precisam respeitar a profundidade declarada. Componentes escalares, larguras, tipos e conexões devem ser comparados pela `netlistSignature` canônica, não apenas pela contagem de nós.

O checkpoint deve ser serializável por `JSON.stringify` e rejeitado se contiver propriedades desconhecidas que possam esconder dados executáveis ou semântica não versionada. A validação deve ser fail-closed: nenhum valor inválido pode ser convertido silenciosamente em `false`, zero, array vazio ou estado inicial. O tamanho serializado do envelope deve possuir limite explícito e bounded; esse limite é do checkpoint e não aumenta os limites editoriais de 256 nós, 512 conexões e 500.000 bytes do documento.

## Resume seguro

Uma futura continuação seguirá esta ordem: o host valida o checkpoint contra o documento/netlist atual; o Worker valida novamente o envelope e a assinatura; o runtime é criado com budgets explícitos; o estado é restaurado de modo transacional; somente depois os novos steps são aplicados. Falha de assinatura, versão, shape, budget, documento ou estado deve devolver erro tipado e não iniciar execução parcial.

O restore não pode alterar o documento, o netlist ou os watches. O request de continuação deve preservar `requestId` próprio e não reutilizar o `requestId` do request ancestral. A resposta deve identificar o request atual, e progresso/resultado não podem misturar snapshots de linhagens diferentes. Cancelamento, timeout, budget e dispose devem fazer rollback para o estado anterior ao request atual; um checkpoint anterior não deve ser sobrescrito por um resultado parcial.

Para impedir reset de budget por resume, a linhagem deve carregar `tickCount` e `operationCount` acumulados e o novo runtime deve restaurá-los antes de executar. A política exata de budgets — orçamento original imutável ou orçamento novo explicitamente compatível — precisa ser fechada pelo parser e pelo supervisor antes de habilitar a UI. O supervisor também deve reservar apenas o custo incremental declarado do novo request e manter a contabilização de linhagem separada das reservas temporárias do Worker.

## Determinismo e segurança

Com o mesmo `netlistSignature`, checkpoint validado, sequência de steps, configuração de clock e budgets compatíveis, o resultado deve ter snapshots idênticos entre runtime direto, Worker web e futuros alvos nativos suportados. O checkpoint é estado de simulação, não um mecanismo de importação, plugin, HDL, IA ou execução de código. Nenhuma cadeia de caracteres do envelope pode ser avaliada como JavaScript, carregada como módulo ou interpretada como comando.

O checkpoint não representa persistência de projeto, backup cloud, licença, entitlement ou autorização para upload. A política local-first/offline-first/privacy-first continua valendo; salvar checkpoint no navegador ou em arquivo deve ser uma ação explícita do usuário e não pode enviar dados para a nuvem sem uma operação opt-in separada.

## Gates antes de habilitar continuidade

A implementação de parser e serializer isolados só poderá ser considerada base para continuidade depois de possuir também rejeições de shape/assinatura/budget, round-trip determinístico, rollback em abort/timeout/falha, paridade golden de DFF/TFF/JK/SR/delay e pelo menos uma fixture de feedback temporal. Também serão necessários smoke web com dois requests independentes, troca de Worker entre requests, cancelamento durante resume, ausência de mistura de `requestId`, teste de documento imutável e matriz separada para Tauri/Rust.

Até que esses gates sejam concluídos, o `Preview Worker` continua opt-in e isolado, enquanto `Step` e `Run` canônicos permanecem diretos. A existência de um checkpoint válido em uma unidade de teste não autoriza declarar continuidade de produto, suporte a vetores/custom-chip ou runtime desktop.

## Classificação atual

| Capacidade | Estado |
|---|---|
| Paridade temporal dentro de um request Worker escalar | `SMOKE VERIFIED` para `dff-clock` no Chromium e `PASSED` em regressão determinística |
| Serializer/parser de checkpoint v1 | `PASSED` em regressões determinísticas locais; ainda não integrado ao protocolo |
| Resume entre requests | `NOT IMPLEMENTED` |
| Continuidade de `Step`/`Run` em Worker | `NOT VERIFIED` e deliberadamente não habilitada |
| Paridade Worker/Tauri/Rust com checkpoint | `NOT VERIFIED` |
| Suporte de checkpoint para vector/custom-chip | `NOT SUPPORTED` pelo Worker v1 |
