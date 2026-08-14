# API da Edge Function de IA do Veritas

A função `veritas-circuit-ai` é a ponte autenticada entre o frontend e o provedor de IA. Ela recebe o snapshot determinístico criado por `buildCircuitContext()`, valida o documento do circuito e devolve uma análise estruturada. A função foi publicada no Supabase com JWT obrigatório (`verify_jwt: true`). O navegador não recebe nem envia chaves privadas do provedor LLM.

> **Princípio de segurança:** o contexto estrutural do circuito e a instrução opcional do usuário são dados separados. O contexto é validado como documento `veritas-circuit`; a instrução é limitada a 1.200 caracteres antes de ser encaminhada ao provedor.

## Endpoint e autenticação

A função pode ser invocada pelo cliente oficial do Supabase:

```ts
import { supabase } from '../src/lib/supabase'

const { data, error } = await supabase.functions.invoke('veritas-circuit-ai', {
  body: {
    action: 'analyze',
    context,
    instruction: 'Explique se existe redundância na saída.',
  },
})
```

Para uma chamada HTTP direta, use a URL da função no formato abaixo e substitua os valores pelos dados do projeto. O token deve ser um access token de uma sessão Supabase autenticada; a chave publicável identifica o projeto, mas não substitui o JWT.

```bash
curl -X POST \
  "https://<project-ref>.supabase.co/functions/v1/veritas-circuit-ai" \
  -H "Authorization: Bearer <supabase-access-token>" \
  -H "apikey: <supabase-publishable-key>" \
  -H "Content-Type: application/json" \
  -d @request.json
```

As chamadas pelo SDK usam `supabase.functions.invoke()`, enquanto o requisito de JWT é reforçado pela configuração da função no Supabase. Consulte a documentação oficial de [Edge Functions e autenticação][1] e de [invocação pelo cliente JavaScript][2] para configurar ambientes publicados.

## Requisição

O corpo é um objeto JSON com `action`, `context` e, opcionalmente, `instruction`.

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `action` | `"analyze" \| "optimize"` | Sim | Define análise explicativa ou proposta de otimização |
| `context` | `CircuitContextRecord` | Sim | Deve conter um documento `veritas-circuit` válido |
| `instruction` | `string` | Não | Texto adicional do usuário, aparado e limitado a 1.200 caracteres |

O contexto tem este formato resumido:

```json
{
  "sourceRef": "veritas:circuit:Circuito AND",
  "contextType": "circuit",
  "circuitName": "Circuito AND",
  "summary": "Circuito combinacional com 2 entrada(s), 1 saída(s) e 4 combinação(ões) possíveis.",
  "tags": ["veritas", "circuit", "combinational"],
  "contentHash": "fnv1a-…",
  "payload": {
    "format": "veritas-circuit-context",
    "version": 1,
    "document": {
      "format": "veritas-circuit",
      "version": 1,
      "name": "Circuito AND",
      "nodes": [],
      "connections": []
    },
    "inputs": ["A", "B"],
    "outputs": ["Saída"],
    "truthTable": {
      "columns": ["A", "B", "Saída"],
      "rows": [[false, false, false], [true, true, true]],
      "totalRows": 4,
      "truncated": false
    }
  }
}
```

O campo `payload.document` é a fonte estrutural que a função aceita. O hash e a tabela verdade fornecem rastreabilidade e contexto compacto, mas não autorizam o modelo a inventar componentes, IDs ou conexões.

## Resposta de sucesso

A resposta possui a mesma forma para as duas ações:

```json
{
  "action": "optimize",
  "provider": "llm",
  "summary": "A saída pode ser simplificada sem alterar a função observada.",
  "suggestions": [
    "Revise a porta NOT adicionada antes da saída.",
    "Compare a tabela verdade antes de aplicar a proposta."
  ],
  "optimizedDocument": null,
  "confidence": 0.86
}
```

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `action` | string | Ação efetivamente processada |
| `provider` | `"llm" \| "heuristic"` | Indica se a resposta veio do LLM configurado ou do fallback determinístico |
| `summary` | string | Explicação curta para a interface |
| `suggestions` | `string[]` | Recomendações limitadas e exibidas ao usuário |
| `optimizedDocument` | `CircuitDocument \| null` | Documento candidato validado; pode ser nulo quando não há transformação segura |
| `confidence` | number | Confiança normalizada entre `0` e `1`; não substitui revisão humana |

A ação `analyze` normalmente retorna `optimizedDocument: null`. A ação `optimize` pode retornar um documento candidato, mas o frontend não o aplica automaticamente. O usuário deve revisar a sugestão e clicar em **Aplicar otimização**.

## Erros HTTP

| Status | Corpo | Causa provável |
| --- | --- | --- |
| `401` | Resposta de autenticação do Supabase | JWT ausente, expirado ou inválido; o gateway rejeita antes da função |
| `405` | `{ "error": "Use POST." }` | Método diferente de `POST` |
| `400` | `{ "error": "Ação inválida." }` | `action` não é `analyze` nem `optimize` |
| `400` | `{ "error": "Contexto de circuito inválido." }` | Documento, versão ou campos estruturais inválidos |
| `413` | `{ "error": "O contexto do circuito excede o limite permitido." }` | Contexto acima de 200.000 caracteres |
| `500` | `{ "error": "Não foi possível analisar o circuito." }` | Falha inesperada na função ou no parsing do corpo |

Quando o provedor LLM não está configurado ou responde com erro, a função não expõe a falha ao navegador como erro de análise. Ela retorna o fallback `provider: "heuristic"`, que só remove componentes inalcançáveis a partir de saídas. Esse fallback não executa transformações algébricas arriscadas.

## Configuração do provedor LLM

A função usa secrets do Supabase, nunca variáveis públicas `VITE_*`:

| Secret | Uso |
| --- | --- |
| `AI_PROVIDER_URL` | Endpoint compatível com Chat Completions |
| `AI_PROVIDER_KEY` | Token privado enviado no header `Authorization` |
| `AI_MODEL` | Modelo opcional; o padrão da função é `gpt-5-mini` |

O provedor deve aceitar saída JSON estruturada com os campos `summary`, `suggestions`, `optimizedDocumentJson` e `confidence`. O documento otimizado é recebido como JSON textual, reparseado e validado pela função antes de aparecer na resposta.

## Exemplos de prompts

As instruções abaixo são exemplos para o campo `instruction`. Elas complementam o prompt de sistema da função; não substituem a validação do circuito.

### Análise geral

```text
Explique a função lógica da saída principal em linguagem didática. Liste as entradas relevantes, indique se a tabela verdade parece tautológica, contraditória ou contingente e não proponha alterações ainda.
```

### Busca de redundância

```text
Procure portas ou conexões redundantes. Para cada sugestão, informe quais IDs de nós estão envolvidos e explique por que a função da saída permanece equivalente. Se não puder provar equivalência pela tabela verdade, não proponha remoção.
```

### Otimização conservadora

```text
Encontre somente otimizações estruturais que preservem todas as saídas. Priorize componentes inalcançáveis e caminhos duplicados claramente equivalentes. Retorne null para optimizedDocumentJson se houver qualquer dúvida e inclua a justificativa em suggestions.
```

### Revisão de circuito didático

```text
Revise este circuito como material de estudo. Explique a função de cada porta, aponte entradas desconectadas e sugira nomes de saída mais claros. Não altere o documento e não invente componentes.
```

### Comparação entre versões

```text
Use o snapshot atual para explicar quais mudanças devem ser verificadas em relação à versão anterior. Concentre-se em nós adicionados, nós removidos, conexões trocadas e possíveis alterações na tabela verdade. Não aplique nada automaticamente.
```

## Regras para bons prompts

Um prompt útil nomeia o objetivo, define o nível de conservadorismo e pede evidências verificáveis. Prefira referências a IDs de nós, entradas, saídas e tabela verdade. Evite instruções que peçam para ignorar validação, acessar dados de outros usuários, executar código ou alterar o banco diretamente. A função deve ser tratada como uma analisadora de circuitos, não como uma autoridade para publicar mudanças silenciosas.

## Testes e rastreabilidade

O cliente possui testes para verificar o nome da função invocada, o envio do `CircuitContextRecord`, a instrução opcional, a aceitação de otimização validada e a rejeição de respostas incompletas ou erros de transporte. A Edge Function mantém validação própria, portanto o cliente não é a única barreira de segurança.

[1]: https://supabase.com/docs/guides/functions/auth "Supabase Edge Functions — Auth"
[2]: https://supabase.com/docs/reference/javascript/functions-invoke "Supabase JavaScript — functions.invoke"
