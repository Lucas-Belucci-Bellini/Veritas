# Contrato de arquivo de algoritmos — v1

## Objetivo e estado

Este documento define o primeiro envelope portátil de algoritmos do Veritas. O formato transporta documentos `veritas-algorithm` v1 como dados locais; ele não transporta código executável, não avalia JavaScript, não acessa a rede e não altera a biblioteca local até que o arquivo inteiro tenha sido validado.

O envelope é `format: "veritas-algorithms"`, `version: 1`, com limite máximo de **5.000.000 bytes** e no máximo **256 projetos** por arquivo. A implementação deve permanecer local-first/offline-first, rejeitando o arquivo inteiro em qualquer erro de shape, versão, limite ou validação semântica do grafo.

## Shape canônico

```json
{
  "format": "veritas-algorithms",
  "version": 1,
  "exportedAt": "2026-08-27T00:00:00.000Z",
  "projects": [
    {
      "ref": "algorithm-opaque-ref",
      "name": "Meu algoritmo",
      "document": {
        "format": "veritas-algorithm",
        "version": 1,
        "name": "Meu algoritmo",
        "entryNodeId": "start",
        "nodes": []
      }
    }
  ]
}
```

A `ref` é uma identidade opaca e local ao arquivo. Ela não é id do Dexie, caminho, URL ou referência para código. Os nomes devem ser únicos dentro do arquivo e a coleção não carrega timestamps nem ids locais.

## Schema e validação

O parser aceita somente as chaves do envelope, dos projetos e dos nós discriminados de `AlgorithmDocument`. Cada nó deve ter `id`, `type` e posição finita; os campos adicionais dependem do tipo (`next`, `thenNext`, `elseNext`, `bodyNext`, `exitNext`, `variable`, `expression`, `condition`, `prompt`, `valueType` e `initialValue`). Campos desconhecidos são erro.

Depois do guard estrutural, cada documento passa por `validateAlgorithmDocument()`. A validação rejeita formato ou versão incompatível, entrada ausente, ids duplicados, posições não finitas, targets/branches inexistentes, variáveis duplicadas e valores iniciais incompatíveis. Avisos de alcançabilidade não transformam um arquivo em execução automática e devem permanecer visíveis ao chamador.

As strings de `condition`, `expression` e `prompt` são dados. A importação não chama o executor, não faz `eval`, não carrega módulos e não permite scripts ou comandos. A execução continua sendo uma ação explícita e separada do usuário no runtime local.

## Importação e rollback

A importação valida JSON, versão, shape e todos os documentos antes da escrita. Colisão com um nome já existente na biblioteca local falha explicitamente; não há substituição, mesclagem ou renomeação heurística. Após a validação, todos os projetos são gravados em uma transação Dexie. Falha de uma linha deve deixar o store exatamente como estava antes da operação.

O formato v1 não possui referências entre algoritmos. Caso uma versão futura introduza bibliotecas auxiliares ou chamadas entre documentos, deverá criar contrato próprio de identidade, limites e rollback, sem reinterpretar strings de expressão como imports.

## Exportação e limites

A exportação valida cada documento com o validador canônico antes de serializar. A ordem dos projetos é determinística por id local; ids e timestamps não são exportados. O envelope não inclui circuitos, testbenches, chips, credenciais, configurações de cloud ou resultados de execução.

Até que parser, serializer, testes de rejeição, rollback e UI sejam aprovados, este formato deve ser tratado como experimental. Mesmo após a aprovação local, distribuição desktop, cloud, sincronização e compatibilidade legada continuam gates independentes.
