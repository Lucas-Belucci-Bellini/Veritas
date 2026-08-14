# MCP interoperável do Veritas

## Estado atual

O Veritas já possui um servidor [Model Context Protocol](https://modelcontextprotocol.io) em `mcp/`. O domínio está separado do transporte: `mcp/src/tools.ts` contém funções puras e `mcp/src/server.ts` registra schemas e fala MCP por `stdio`.

Essa separação é a base correta para interoperabilidade. Clientes locais podem iniciar o processo Node, enquanto clientes remotos precisam de um endpoint MCP HTTP autenticado. O mesmo conjunto de ferramentas e os mesmos contratos devem permanecer compartilhados entre os transports.

## Ferramentas

| Ferramenta | Superfície |
| --- | --- |
| `truth_table` | Tabela verdade existente com passos, classificação e limite de linhas. |
| `propositional_truth_table` | Tabela completa para AND, NAND, OR, NOR, XOR, XNOR, NOT, `->` e `<->`. |
| `evaluate_expression` | Avaliação de uma atribuição com passos das subexpressões. |
| `logic_case` | Casos didáticos de Álgebra de Boole e Argumentos, incluindo contraexemplos. |
| `debug_algorithm` | Step/Run serializável de `AlgorithmDocument`, com estado, Watch, BranchTrace, While e breakpoints. |
| `simplify_expression` | Minimização booleana. |
| `normal_forms` | SOP/POS canônicas e mínimas. |
| `karnaugh_map` | Mapa de Karnaugh de até quatro variáveis. |
| `simulate_circuit` | Simulação determinística com clock, flip-flops e atrasos. |
| `list_chips` / `get_chip` | Consulta à biblioteca de chips. |

As novas ferramentas de algoritmo são deliberadamente locais e determinísticas. Elas não salvam documentos, não alteram Supabase e não executam código arbitrário. Essa escolha permite habilitá-las em vários clientes sem ampliar o risco de escrita remota.

## Perfis de transporte

### Stdio local

`stdio` é o perfil padrão para Claude Code, Claude Desktop, Codex CLI, Codex IDE, ChatGPT desktop/Codex local e clientes que conseguem iniciar subprocessos. O servidor deve escrever somente JSON-RPC válido em `stdout`; logs devem usar `stderr` [1].

```bash
cd /caminho/para/Veritas
npm install
npm run build:mcp
```

Claude Code:

```bash
claude mcp add veritas -- node /caminho/para/Veritas/mcp/dist/server.js
```

Codex CLI:

```bash
codex mcp add veritas -- node /caminho/para/Veritas/mcp/dist/server.js
codex mcp list
```

Ou em `~/.codex/config.toml`:

```toml
[mcp_servers.veritas]
command = "node"
args = ["/caminho/para/Veritas/mcp/dist/server.js"]
startup_timeout_sec = 10
tool_timeout_sec = 60
enabled_tools = [
  "truth_table",
  "propositional_truth_table",
  "logic_case",
  "debug_algorithm",
]
default_tools_approval_mode = "prompt"
```

O Codex também aceita servidores Streamable HTTP e compartilha a configuração MCP entre CLI, desktop e extensão IDE [3].

### Streamable HTTP remoto

Clientes que não conseguem iniciar subprocessos locais, como o conector MCP da API Messages da Anthropic, exigem um servidor HTTPS público. O conector da Anthropic suporta tool calls, allowlist/denylist e OAuth via Bearer token, mas não conecta diretamente a um servidor local stdio [2].

O ChatGPT Developer Mode permite criar apps MCP com endpoint, metadados e autenticação; ações de escrita podem exigir confirmação, e OAuth deve fornecer refresh token/offline access para manter a sessão [4].

A arquitetura recomendada é:

```text
                 ┌─────────────────────────┐
                 │ tools.ts + engine       │
                 │ domínio puro Veritas    │
                 └───────────┬─────────────┘
                             │
             ┌───────────────┴────────────────┐
             │                                │
     server.ts / stdio                 http-server.ts
     processo local                    endpoint /mcp HTTPS
             │                                │
 Claude Code, Codex,               Claude API, ChatGPT,
OpenClaw, Manus local              Codex remoto, outros
```

O adaptador HTTP deve usar `StreamableHTTPServerTransport` do SDK oficial, validar `Origin`, exigir autenticação, limitar payload/tempo e bindar em localhost quando usado apenas localmente. A especificação MCP exige um endpoint que aceite POST e GET, e recomenda validação de Origin e autenticação [1].

Não se deve duplicar as ferramentas para o segundo transporte. Extraia um `createVeritasServer()` que registre as mesmas ferramentas e injete o transport escolhido:

```ts
export function createVeritasServer() {
  const server = new McpServer(
    { name: 'veritas', version: '0.7.0' },
    { instructions: VERITAS_MCP_INSTRUCTIONS },
  )

  registerVeritasTools(server)
  return server
}
```

O entrypoint stdio chama `createVeritasServer().connect(new StdioServerTransport())`. O entrypoint HTTP cria uma sessão `StreamableHTTPServerTransport` e chama `createVeritasServer().connect(transport)` por sessão. A autenticação deve ficar fora das ferramentas, em middleware, e nunca deve ser simulada no frontend.

## Compatibilidade por cliente

| Cliente | Perfil recomendado | Observação |
| --- | --- | --- |
| Claude Code | `stdio` | O cliente lança o comando local. |
| Claude Desktop | `stdio` | Usa configuração `mcpServers`. |
| Claude API/Messages | Streamable HTTP HTTPS | Exige endpoint público e token/OAuth; não usa stdio local [2]. |
| Codex CLI/IDE/Desktop | `stdio` ou Streamable HTTP | Configuração em `config.toml`; possui allowlist e modos de aprovação [3]. |
| ChatGPT web Developer Mode | Streamable HTTP HTTPS | Workspace/admin pode precisar habilitar Developer Mode; apps entram em revisão/publicação [4]. |
| Manus | stdio local quando o runtime puder lançar processo; HTTP quando o conector exigir endpoint | Usar o mesmo schema MCP, sem acoplamento ao cliente. |
| OpenClaw/Hermes/Antigravity | Depende do host MCP do produto | Oferecer primeiro stdio e, se suportado, URL Streamable HTTP. Não assumir uma configuração proprietária. |

O que é interoperável é o **protocolo MCP e o schema das ferramentas**, não um único arquivo de configuração para todos os produtos. Distribua exemplos por cliente, mantenha nomes de ferramentas estáveis e evite respostas dependentes da interface visual.

## Segurança e governança

A primeira superfície remota deve ser read-only/determinística. `debug_algorithm` pode devolver estado e trace, mas não deve persistir ou executar código. Ações futuras de salvar, sincronizar, convidar usuário ou publicar HDL devem ser ferramentas separadas, com autenticação, confirmação e auditoria.

Também é importante manter `instructions` curto e operacional: explicar que o servidor é fonte exata para lógica, que há limites de linhas/tiques/passos e que documentos inválidos devem ser corrigidos antes de tentar exportar. O Codex lê esse campo e o usa como orientação global do servidor [3].

## Próxima implementação recomendada

A próxima fatia MCP deve extrair o registro comum de ferramentas para `mcp/src/registerTools.ts`, criar `mcp/src/http-server.ts` com `StreamableHTTPServerTransport`, adicionar autenticação Bearer/OAuth configurável por ambiente e testar o endpoint com o MCP Inspector. O servidor stdio atual deve permanecer inalterado para não quebrar clientes locais.

### Referências

[1]: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports "MCP — Transports"
[2]: https://platform.claude.com/docs/en/agents-and-tools/mcp-connector "Anthropic — MCP connector"
[3]: https://developers.openai.com/codex/mcp "OpenAI — Codex MCP"
[4]: https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt "OpenAI — Developer mode and MCP apps in ChatGPT"
