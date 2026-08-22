# Aceitação Beta — interoperabilidade MCP

**Produto:** Veritas  
**Versão candidata:** `v0.9.0-rc.10`
**Transportes validados:** MCP por stdio local e HTTP local controlado
**Objetivo:** comprovar que clientes MCP locais conseguem negociar o servidor, descobrir ferramentas, chamar vetores golden e receber erros controlados sem depender de uma sessão específica de IA, além de validar a fronteira HTTP sem publicar um endpoint remoto.

A superfície atual contém quatorze ferramentas; o MCP-013 adiciona discovery local opt-in de Protected Resource Metadata, o MCP-014 explicita sua política CORS e o MCP-015 protege o path reservado, sem alterar os nomes ou argumentos obrigatórios das ferramentas existentes.

## 1. Matriz golden

O comando `npm run beta:mcp` inicia `mcp/dist/server.js` como subprocesso Node e envia mensagens JSON-RPC delimitadas por newline. A sessão começa com `initialize`, envia `notifications/initialized` e depois executa chamadas determinísticas. O runner aceita somente respostas JSON-RPC válidas em stdout; tokens, URLs e dados privados não entram no relatório.

| ID | Cenário | Critério |
|---|---|---|
| MCP-001 | `initialize` | O servidor negocia protocolo `2025-03-26` e informa `name=veritas`. |
| MCP-002 | `tools/list` | Ferramentas esperadas, incluindo `truth_table`, `logic_case`, `propositional_truth_table`, `debug_algorithm`, `simulate_circuit`, `circuit_truth_table`, `circuit_vector_truth_table` e `export_circuit_hdl`, aparecem com schemas. |
| MCP-003 | `truth_table` | O vetor `A XOR B` preserva cabeçalho, linhas e classificação golden. |
| MCP-004 | `logic_case` e `propositional_truth_table` | Caso didático e tabela proposicional devolvem o formato textual esperado. |
| MCP-005 | Erro de ferramenta | Expressão inválida retorna `isError=true` e mensagem em português; o processo continua protocolar. |
| MCP-006 | Transporte | Todas as respostas observadas são JSON-RPC `2.0`, sem saída não protocolar em stdout. |
| MCP-007 | `simulate_circuit` com `custom-chip` | Instância com `options.customChipId` e definição correspondente em `custom_chips` propaga a saída no vetor golden; definição ausente retorna erro controlado. |
| MCP-008 | `circuit_truth_table` com `custom-chip` | CircuitDocument com uma instância NOT devolve as duas linhas esperadas; definição ausente retorna erro controlado. |
| MCP-009 | `export_circuit_hdl` com `custom-chip` | CircuitDocument com uma instância NOT devolve módulo Verilog com interface externa válida; definição ausente retorna erro controlado. |
| MCP-010 | `circuit_vector_truth_table` | AND vetorial de quatro bits devolve cabeçalho e linhas binárias determinísticas; o limite de 12 bits e truncamento de linhas são respeitados; documento incompatível retorna erro controlado. |
| MCP-011-HTTP-001…009 | `http-server.js` local | OPTIONS, Bearer, Origin allowlist, método, initialize `2025-11-25`, equivalência golden, HeaderMismatch, JSON inválido e limite de payload retornam os status esperados; nenhum token é persistido. |
| MCP-013-HTTP-001…005 | `/.well-known/oauth-protected-resource` local | Sem configuração retorna 404; configuração opt-in retorna JSON determinístico; Origin ausente é rejeitada; configuração parcial e recurso remoto sem HTTPS são rejeitados no startup. |
| MCP-014-HTTP-001…003 | CORS local da metadata e do `/mcp` | Metadata anuncia somente `GET, OPTIONS` com `Vary: Origin`; preflight do MCP mantém `POST, OPTIONS`; `POST` na metadata permanece `405`. |
| MCP-015-HTTP-001 | Configuração local de path | O startup rejeita o path MCP coincidente com `/.well-known/oauth-protected-resource`. |

## 2. Execução

Os dois bundles devem ser compilados antes dos runners:

```bash
npm run build:mcp
MCP_REPORT_PATH=artifacts/mcp-acceptance.md npm run beta:mcp
npm run build:mcp:http
MCP_HTTP_REPORT_PATH=artifacts/mcp-http-acceptance.md npm run beta:mcp:http
```

O workflow `.github/workflows/quality.yml` executa `build:mcp`, `build:mcp:http`, `beta:mcp` e `beta:mcp:http` em cada push/pull request. Para agregar a evidência ao manifesto beta:

```bash
BETA_EXPECTED_VERSION=0.9.0-rc.10 \
BETA_MCP_REPORT=artifacts/mcp-acceptance.md \
BETA_EVIDENCE_OUTPUT=artifacts/beta-evidence-manifest.json \
npm run beta:evidence
```

O gate `mcp` só fica `PASS` quando MCP-001 a MCP-010 possuem `PASS` explícito e o relatório está anexado. O gate HTTP-011 é separado e só fica `PASS` quando MCP-011-HTTP-001 a MCP-011-HTTP-009 possuem `PASS` explícito. O gate MCP-013 é separado e só fica `PASS` quando MCP-013-HTTP-001 a MCP-013-HTTP-005 possuem `PASS` explícito. O gate MCP-014 é separado e só fica `PASS` quando MCP-014-HTTP-001 a MCP-014-HTTP-003 possuem `PASS` explícito. O gate MCP-015 é separado e só fica `PASS` quando MCP-015-HTTP-001 possui `PASS` explícito. Qualquer resposta ausente, schema quebrado, saída não JSON-RPC, `SKIP` ou `FAIL` mantém `MCP-EVIDENCE-INCOMPLETE` em `openP1`.

## 3. Compatibilidade com clientes

Como o transporte stdio é local e o servidor não depende de uma sessão de IA, a mesma matriz pode ser usada por Claude Code, Codex, Hermes, OpenClaw, Manus, ChatGPT e outros clientes que suportem MCP local. O cliente deve iniciar o comando configurado, enviar o handshake padrão, respeitar o stdout exclusivamente protocolar e mostrar `content[].text` e `isError` sem reinterpretar o domínio. Para `custom-chip`, o cliente precisa incluir explicitamente a definição serializável no argumento `custom_chips`; o servidor não acessa o IndexedDB do navegador.

Exemplo de configuração local genérica:

```json
{
  "mcpServers": {
    "veritas": {
      "command": "node",
      "args": ["/caminho/absoluto/Veritas/mcp/dist/server.js"]
    }
  }
}
```

O caminho real deve ser absoluto no ambiente do cliente. Nenhuma API key é necessária para o modo stdio local. O servidor usa somente o motor empacotado e não acessa Supabase, navegador ou arquivos privados durante os vetores golden.

## 4. Limites

Esta aceitação cobre interoperabilidade local de protocolo e conteúdo, além de um transporte HTTP protegido somente em localhost. Ela não prova integração visual de cada host, suporte a configuração específica de cada produto, deployment HTTPS público, OAuth/resource server, performance sob carga ou autorização remota. Cada cliente deve repetir MCP-001 a MCP-010 no seu próprio ambiente; o endpoint HTTP público exige uma etapa posterior com threat model e provedor OAuth aprovado.

Uma falha deve ser classificada por camada: domínio se o resultado lógico estiver errado; schema se `tools/list` mudar sem contrato; protocolo se JSON-RPC ou stdout falhar; transporte se o processo não iniciar; ou cliente se a configuração do host estiver incorreta. Não corrija uma falha de cliente alterando o domínio sem evidência.

## Referências

[1]: ../mcp/src/server.ts "Veritas — servidor MCP stdio"

[2]: ../mcp/src/tools.test.ts "Veritas — testes do núcleo MCP"

[3]: https://modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle "MCP — lifecycle e initialize"

[4]: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports "MCP — transportes"

[5]: ../mcp/src/http-server.test.ts "Veritas — testes HTTP MCP-011, MCP-013 e MCP-014"
