# Plano de testes MCP multi-cliente

## Objetivo

Verificar se as ferramentas `logic_case`, `propositional_truth_table` e `debug_algorithm` são descobertas, chamadas e interpretadas corretamente por diferentes hosts MCP, sem confundir falhas do protocolo com diferenças do cliente.

O servidor Veritas mantém o domínio em funções puras e o transporte atual em `stdio`. Em `stdio`, o host inicia o subprocesso, o servidor lê JSON-RPC de `stdin` e escreve somente mensagens MCP em `stdout`; logs devem ir para `stderr` [1]. Clientes remotos, como APIs que não iniciam subprocessos, exigem um endpoint Streamable HTTP autenticado [2].

## Camadas de teste

| Camada | Ferramenta | O que prova |
| --- | --- | --- |
| Domínio | Vitest | Semântica de While, breakpoints, parser e tabelas proposicionais. |
| Registro MCP | Vitest em `mcp/src/tools.test.ts` | Respostas das três novas funções sem processo externo. |
| Protocolo | MCP Inspector ou cliente MCP oficial | `initialize`, `tools/list`, schema e `tools/call`. |
| Cliente | Claude Code, Codex, Hermes e outros hosts | Descoberta, aprovação, timeout, renderização e continuidade de estado. |
| Regressão | Script de golden responses | Mesmo input produz o mesmo output independentemente do host. |

## Vetores determinísticos

### `logic_case`

```json
{
  "name": "logic_case",
  "arguments": { "case_id": "implication-counterexample" }
}
```

Esperado: tabela com quatro linhas para `P` e `Q`, exatamente uma linha falsa (`P = V`, `Q = F`) e `Caso válido: não`.

Também teste um ID inexistente. O servidor deve retornar erro de ferramenta com a lista de IDs disponíveis, sem encerrar o processo MCP.

### `propositional_truth_table`

```json
{
  "name": "propositional_truth_table",
  "arguments": {
    "expression": "(A NAND B) XOR (C NOR D) <-> (A -> B)",
    "notation": "text",
    "include_steps": true,
    "max_rows": 4096
  }
}
```

Esperado: quatro variáveis, 16 linhas, colunas intermediárias para NAND/NOR/XOR e classificação determinística. Faça uma segunda chamada com `max_rows = 2` para confirmar `truncated`/limitação no domínio equivalente e um caso com sintaxe inválida para conferir erro legível.

### `debug_algorithm`

Use o documento mínimo:

```json
{
  "format": "veritas-algorithm",
  "version": 1,
  "name": "MCP breakpoint",
  "entryNodeId": "start",
  "nodes": [
    { "id": "start", "type": "start", "position": { "x": 0, "y": 0 }, "next": "end" },
    { "id": "end", "type": "end", "position": { "x": 120, "y": 0 } }
  ]
}
```

Primeiro chame:

```json
{
  "name": "debug_algorithm",
  "arguments": { "document": { "...": "documento" }, "mode": "step" }
}
```

Depois chame `run` com `breakpoints: ["end"]`. O resultado esperado é `status = "paused"`, `activeNodeId = "end"` e `debug.lastPauseReason = "breakpoint"`. Repita o `run` usando o `state` retornado; o resultado deve finalizar sem travar no mesmo breakpoint.

Para testar While, use `condition: "i < 3"`, `bodyNext` apontando para `assign i = i + 1` e `exitNext` apontando para `end`. Confirme quatro entradas de BranchTrace: verdadeiro, verdadeiro, verdadeiro, falso. Para loop sem progresso, reduza `max_steps` e confirme `lastPauseReason = "max-steps"`.

## Execução por cliente

### Claude Code

Compile e registre o servidor local:

```bash
cd /caminho/para/Veritas
npm install
npm run build:mcp
claude mcp add veritas -- node "$PWD/mcp/dist/server.js"
claude mcp list
```

Na sessão, peça primeiro para listar as ferramentas e depois execute os três vetores. Verifique que o cliente não substitui `V/F` por interpretação própria e que uma segunda chamada `debug_algorithm` recebe o JSON retornado pela primeira.

### Codex

Registre o mesmo processo:

```bash
codex mcp add veritas -- node /caminho/para/Veritas/mcp/dist/server.js
codex mcp list
```

O Codex também permite `~/.codex/config.toml` ou `.codex/config.toml` em projeto confiável. Use `enabled_tools` para limitar a superfície e `default_tools_approval_mode = "prompt"` enquanto houver ferramentas novas [3]. Confirme no `/mcp` do TUI se o servidor está ativo.

### Hermes e outros hosts locais

Não assuma uma configuração proprietária sem documentação do host. O teste genérico é:

1. Verifique se o host suporta MCP stdio e se inicia um comando.
2. Configure `command = "node"` e `args = ["/caminho/para/Veritas/mcp/dist/server.js"]` no formato próprio do host.
3. Confirme `initialize` e `tools/list`.
4. Execute os três vetores com JSON idêntico.
5. Capture `tools/call`, status, erro e tempo limite sem incluir tokens ou dados privados.
6. Compare a resposta com o golden response salvo no teste de domínio.

Se Hermes, OpenClaw, Manus ou Antigravity exigirem URL, não tente apontar para `stdio`. Use o futuro endpoint Streamable HTTP HTTPS autenticado e teste a mesma suíte via cliente HTTP MCP. A interoperabilidade é do protocolo e dos schemas; os arquivos de configuração podem diferir.

### Claude API e ChatGPT web

Esses perfis não devem ser testados contra o processo stdio local. O conector MCP da Anthropic exige servidor remoto HTTP(S) e suporta tool calls, não subprocessos locais [2]. O ChatGPT Developer Mode também trabalha com endpoint e autenticação, e pode exigir habilitação/revisão do workspace [4]. Para ambos, configure um ambiente de staging com HTTPS, Bearer/OAuth, ferramentas read-only e limites de requisição.

## Golden responses e matriz de aceitação

Normalize as respostas removendo timestamps, IDs de sessão e espaços irrelevantes. Não normalize valores, classificação, `activeNodeId`, `stepIndex`, BranchTrace ou razão de pausa.

| Verificação | Claude Code | Codex | Hermes/host local | HTTP remoto |
| --- | ---: | ---: | ---: | ---: |
| `initialize` | obrigatório | obrigatório | obrigatório | obrigatório |
| `tools/list` contém as 3 ferramentas | sim | sim | sim | sim |
| Schema rejeita `case_id` vazio | sim | sim | sim | sim |
| Tabela de 16 linhas | sim | sim | sim | sim |
| Breakpoint pausa antes do nó | sim | sim | sim | sim |
| Continue finaliza | sim | sim | sim | sim |
| Timeout respeita limite | sim | sim | sim | sim |
| Processo permanece disponível após erro | sim | sim | sim | sim |

## Segurança e observabilidade

Use documentos sintéticos e tokens de staging. Não coloque credenciais em exemplos, não habilite escrita remota durante o primeiro ciclo e limite `max_steps`/`max_rows`. O servidor deve manter erros de domínio como respostas MCP, sem stack trace sensível.

Registre apenas métricas necessárias: cliente declarado, versão do protocolo, nome da ferramenta, duração, sucesso/falha e tamanho aproximado do payload. Não registre documentos de usuários, tokens ou prompts completos.

### Referências

[1]: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports "MCP — Transports"
[2]: https://platform.claude.com/docs/en/agents-and-tools/mcp-connector "Anthropic — MCP connector"
[3]: https://developers.openai.com/codex/mcp "OpenAI — Codex MCP"
[4]: https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt "OpenAI — Developer mode and MCP apps in ChatGPT"
