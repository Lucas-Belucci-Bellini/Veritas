# Contrato de arquivo de chips customizados — v1

## Objetivo e estado

Este documento define o primeiro envelope portátil para uma biblioteca de chips customizados do Veritas. Ele é uma especificação de implementação da fase v2.8; não cria uma release, não altera a biblioteca local automaticamente e não transforma a importação do Digital Logic Sim em um formato nativo do Veritas.

O envelope proposto é `format: "veritas-chip-library"`, `version: 1`, com limite máximo de **5.000.000 bytes**. A implementação deve permanecer local-first/offline-first e rejeitar a entrada inteira quando qualquer chip, dependência ou documento for inválido.

## Shape canônico

```json
{
  "format": "veritas-chip-library",
  "version": 1,
  "exportedAt": "2026-08-27T00:00:00.000Z",
  "chips": [
    {
      "ref": "chip-opaque-ref",
      "name": "Meio somador",
      "document": {
        "format": "veritas-circuit",
        "version": 1,
        "name": "Meio somador",
        "nodes": [],
        "connections": []
      }
    }
  ]
}
```

Cada `ref` é uma identidade opaca e **local ao arquivo**. Ele não é um id do Dexie, não pode ser usado para escolher um registro já existente e não deve ser interpretado como caminho, URL ou código. O `name` é exibido ao usuário e deve ser único dentro do arquivo. A definição exportada não carrega `inputs` e `outputs` redundantes: os pinos são reconstruídos pelo builder canônico a partir dos nós `input` e `output`.

Dentro de `document.nodes`, uma instância de `custom-chip` usa `options.customChipRef` para apontar a outro chip do mesmo envelope. O shape portátil não usa `options.customChipId`, porque o id numérico só tem significado no banco local de origem. Um documento sem dependências pode omitir `customChipRef`; uma dependência ausente, vazia ou desconhecida é erro de importação.

## Regras de segurança e determinismo

O envelope permite somente as chaves declaradas, documentos `veritas-circuit` v1 válidos e opções de componentes suportadas pelo contrato visual. `customChipRef` deve ser uma string curta e não vazia, e toda referência usada deve existir exatamente uma vez no arquivo. Códigos, scripts, HDL, URLs, caminhos locais, módulos, comandos e blobs executáveis não fazem parte do formato.

A biblioteca deve ser um grafo acíclico de dependências. O importador pode aceitar a ordem textual e ordenar de forma determinística, mas precisa detectar ciclos, referências duplicadas, nomes duplicados, profundidade acima do limite e largura fora do limite antes de gravar. A construção de cada chip usa `buildCustomChipDefinition()` e a validação hierárquica já existente; não se deve duplicar a semântica do builder.

A importação cria novos ids locais somente depois de validar o arquivo completo. Colisão com um nome já existente na biblioteca local não deve mesclar ou substituir silenciosamente: a operação deve falhar ou exigir uma política explícita de renomeação fora do parser. A gravação do lote deve ser transacional; se uma definição falhar, nenhum chip novo pode permanecer no store.

## Exportação

A exportação recebe projetos de chips locais e inclui todas as dependências necessárias, uma vez cada, em ordem topológica determinística. Se uma definição apontar para um id que não esteja na coleção fornecida, a exportação falha em vez de criar uma referência incompleta. Os ids numéricos locais podem ser convertidos em refs opacos apenas durante a serialização; nenhum id local deve ser usado como destino durante a importação.

## Escopo deliberadamente excluído

O formato não exporta algoritmos, testbenches, projetos de expressão, credenciais ou documentos externos. Ele também não promete compatibilidade direta com arquivos DLS. O pipeline DLS continua sendo uma entrada controlada separada, com seus limites e relatórios próprios. A UI de biblioteca agora oferece esse fluxo de forma opt-in e local, com os controles `Exportar local` e `Importar local`. O arquivo baixado usa o nome `veritas-chip-library-v1.json`; o seletor aceita JSON e o limite de 5.000.000 bytes é verificado antes da leitura e novamente pelo parser. O fluxo não envia chips para a nuvem, não conecta o engine Tauri/Rust e exibe a mensagem de erro sem gravar quando o parser ou a transação falham.

## Critérios de aceitação

O contrato de storage e a UI opt-in foram exercitados por round-trip determinístico, dependência aninhada, dependência ausente, ciclo, refs duplicadas, nomes duplicados, campo desconhecido, documento inválido, limite de bytes, colisão local e rollback transacional. Isso é **PASSED** para a API e o fluxo local experimental; não é `RUNTIME VERIFIED` para Tauri, distribuição desktop, cloud, sincronização ou bibliotecas compartilhadas.
