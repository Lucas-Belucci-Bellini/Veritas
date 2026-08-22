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

O adaptador HTTP local do MCP-011 usa `StreamableHTTPServerTransport` do SDK oficial, valida `Origin`, exige Bearer de ambiente, limita payload/tempo e faz bind em localhost por padrão. O contrato adotado pela implementação é `2025-11-25`, que a SDK instalada suporta; a entrada local aceita apenas POST em `/mcp`, retorna JSON e não cria sessão. O endpoint público OAuth ainda não foi implementado. A revisão oficial consultada mais recente descreve mudanças adicionais de transporte e deverá ser fixada em uma etapa própria antes de qualquer deploy público [1] [5].

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

O entrypoint stdio chama `createVeritasServer().connect(new StdioServerTransport())`. O entrypoint HTTP local cria um `StreamableHTTPServerTransport` stateless por request e chama `createVeritasServer().connect(transport)`. A autenticação fica fora das ferramentas, no handler HTTP, e nunca deve ser simulada no frontend.

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

## Estado do MCP-011 e próxima etapa

A implementação inicial foi entregue como MCP-011: a fábrica comum vive em `mcp/src/server.ts`, o stdio em `mcp/src/stdio.ts`, o entrypoint HTTP em `mcp/src/http-entry.ts` e o handler em `mcp/src/http-server.ts`. O runner `beta:mcp:http` testa autenticação Bearer local, allowlist de Origin, headers de protocolo, HeaderMismatch, limite de payload e equivalência com o golden stdio.

A próxima etapa pública não é habilitada automaticamente por esta fatia. Antes de expor uma URL remota, será necessário escolher o authorization server, implementar Protected Resource Metadata, resource indicator/audience, PKCE, validação de escopo, HTTPS, rate limiting, logs sanitizados e smoke remoto. O servidor stdio deve permanecer inalterado para não quebrar clientes locais.

O MCP-012 fornece apenas o construtor puro `buildProtectedResourceMetadata` em `mcp/src/protectedResourceMetadata.ts`. Ele valida e normaliza `resource`, `authorization_servers`, `scopes_supported` e `bearer_methods_supported` sem rede, login ou persistência. A metadata não é publicada por uma rota `.well-known` nesta etapa; isso evita transformar um contrato local em uma promessa de autorização remota incompleta.

O MCP-013 integra essa metadata ao handler HTTP local apenas quando `VERITAS_MCP_HTTP_RESOURCE` e `VERITAS_MCP_HTTP_AUTHORIZATION_SERVERS` são fornecidos explicitamente. Sem essas variáveis, a rota `/.well-known/oauth-protected-resource` retorna 404; com configuração completa, retorna o documento validado e mantém a allowlist de Origin. Essa integração continua limitada ao ambiente local/controlado e não habilita OAuth público.

O MCP-014 torna a política CORS explícita: a rota de metadata anuncia apenas `GET, OPTIONS`, conserva `Vary: Origin` e rejeita `POST`; o endpoint `/mcp` permanece limitado a `POST, OPTIONS`, com Bearer obrigatório. Essa correção reduz ambiguidade de clientes sem ampliar a superfície para HTTP remoto ou autorização.

O MCP-015 rejeita no startup qualquer configuração em que o path configurável do MCP coincida com `/.well-known/oauth-protected-resource`. A rota reservada de metadata e o endpoint `/mcp` permanecem semanticamente separados, sem alterar stdio ou habilitar OAuth remoto.

### Referências

[1]: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports "MCP — Transports"
[2]: https://platform.claude.com/docs/en/agents-and-tools/mcp-connector "Anthropic — MCP connector"
[3]: https://developers.openai.com/codex/mcp "OpenAI — Codex MCP"
[4]: https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt "OpenAI — Developer mode and MCP apps in ChatGPT"
[5]: https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http "MCP — Streamable HTTP (2026-07-28)"
