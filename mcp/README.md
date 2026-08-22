# veritas-mcp-server

Servidor [MCP](https://modelcontextprotocol.io) que expõe o motor lógico do
Veritas para assistentes de IA.

A ideia é simples: em vez de o modelo tentar adivinhar o resultado de uma
expressão booleana — e às vezes errar com toda a confiança do mundo — ele manda
a expressão para cá e recebe a resposta calculada. O mesmo motor que roda no
site, sem interface gráfica, falando por stdio na máquina do usuário.

## Ferramentas

| Ferramenta | O que faz |
| --- | --- |
| `truth_table` | Tabela verdade completa, com colunas intermediárias e classificação |
| `propositional_truth_table` | Tabela completa para todos os conectivos proposicionais da engine |
| `logic_case` | Casos didáticos de Álgebra de Boole e Argumentos com contraexemplos |
| `debug_algorithm` | Step/Run de AlgorithmDocument com Watch, BranchTrace, While e breakpoints |
| `evaluate_expression` | Resolve a expressão para valores específicos, mostrando cada passo |
| `simplify_expression` | Forma mínima em soma de produtos (Quine-McCluskey) e a economia de portas |
| `karnaugh_map` | Mapa de Karnaugh de 1 a 4 variáveis com os agrupamentos |
| `normal_forms` | SOP e POS, canônicas e mínimas, e a classificação da expressão dada |
| `simulate_circuit` | Roda um circuito com clock, flip-flops, atrasos, canais wireless e instâncias `custom-chip`; devolve o diagrama de tempo |
| `circuit_truth_table` | Gera a tabela verdade escalar de um `CircuitDocument`, incluindo instâncias `custom-chip` com definições explícitas |
| `circuit_vector_truth_table` | Gera tabela verdade determinística para barramentos de até 12 bits de entrada |
| `export_circuit_hdl` | Exporta um `CircuitDocument` validado para Verilog ou VHDL, incluindo chips customizados elaborados |
| `list_chips` | Busca nos 1121 chips importados do Digital Logic Sim |
| `get_chip` | Pinos, componentes internos e a expressão de cada saída de um chip |

Todas aceitam as três notações (`AND`/`&&`/`∧`), mais a de engenharia (`A B'`
com apóstrofo e justaposição), e devolvem na notação pedida.

## Instalação

```bash
npm install
npm run build:mcp     # gera mcp/dist/server.js
```

### Claude Code

```bash
claude mcp add veritas -- node /caminho/para/Veritas/mcp/dist/server.js
```

### Codex CLI

```bash
codex mcp add veritas -- node /caminho/para/Veritas/mcp/dist/server.js
codex mcp list
```

Para limitar ferramentas e pedir aprovação por padrão em `~/.codex/config.toml`:

```toml
[mcp_servers.veritas]
command = "node"
args = ["/caminho/para/Veritas/mcp/dist/server.js"]
enabled_tools = ["truth_table", "propositional_truth_table", "logic_case", "debug_algorithm"]
default_tools_approval_mode = "prompt"
```

### Claude Desktop

Em `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "veritas": {
      "command": "node",
      "args": ["/caminho/para/Veritas/mcp/dist/server.js"]
    }
  }
}
```

### Clientes remotos

A instalação stdio atende clientes que iniciam processos locais. Para Claude API e ChatGPT web, o servidor precisa ser exposto por um endpoint Streamable HTTP HTTPS autenticado; consulte [`docs/MCP-INTEROPERABILITY.md`](../docs/MCP-INTEROPERABILITY.md). Não exponha `mcp/dist/server.js` diretamente à internet e não coloque tokens no frontend.

### MCP-011: transporte HTTP local protegido

O MCP-011 adiciona uma entrada HTTP **somente para execução local/controlada**. Ela não cria deployment público, não usa token fixo no frontend e não substitui o stdio. O servidor exige um Bearer fornecido pelo ambiente, uma allowlist explícita de Origin e os headers `Accept: application/json, text/event-stream`, `Content-Type: application/json` e `MCP-Protocol-Version: 2025-11-25`. O endpoint aceita `POST` em `/mcp`; `GET` é rejeitado nesta fatia para não misturar o contrato atual com transporte legado.

```bash
npm run build:mcp
npm run build:mcp:http
VERITAS_MCP_HTTP_BEARER_TOKEN='defina-fora-do-repositorio' \
VERITAS_MCP_HTTP_ALLOWED_ORIGINS='https://allowed.example' \
VERITAS_MCP_HTTP_HOST='127.0.0.1' \
npm run mcp:http
```

A porta padrão é `8787`; use `VERITAS_MCP_HTTP_PORT` para escolher outra. O processo retorna `401` sem Bearer, `403` para Origin fora da allowlist, `400` para versão/headers incompatíveis, `405` para método não permitido e `413` para payload acima de 1 MiB. O token deve existir apenas no ambiente do processo; nunca o registre em documentação, bundle web, Git ou chat.

Para repetir a aceitação determinística sem rede pública:

```bash
npm run build:mcp:http
npm run beta:mcp:http
```

O runner usa localhost, token efêmero do processo e dados sintéticos. A aprovação do MCP-011 não é autorização para publicar um endpoint remoto. A etapa pública continua condicionada à escolha de um provedor OAuth/resource server, metadata de recurso, validação de audience/resource, PKCE, HTTPS, rate limiting, observabilidade sanitizada e smoke externo.

### MCP-012: Protected Resource Metadata local

O módulo `mcp/src/protectedResourceMetadata.ts` fornece um contrato puro para construir o documento de Protected Resource Metadata sem fazer descoberta, login ou chamada de rede. Ele normaliza `resource` e `authorization_servers`, aceita HTTPS para recursos remotos e HTTP somente em localhost, rejeita credenciais/query/fragmentos e limita `bearer_methods_supported` a `["header"]`. O contrato não está exposto como rota pública nesta versão.

```ts
const metadata = buildProtectedResourceMetadata({
  resource: 'https://veritas.example/mcp',
  authorization_servers: ['https://auth.example/realms/veritas'],
  scopes_supported: ['circuit:read'],
})
```

A metadata não contém tokens. Para habilitar a rota somente durante uma execução local controlada, defina `VERITAS_MCP_HTTP_RESOURCE`, `VERITAS_MCP_HTTP_AUTHORIZATION_SERVERS` e, opcionalmente, `VERITAS_MCP_HTTP_SCOPES`. Se apenas parte da configuração estiver presente, o processo falha sem iniciar. Com a configuração ausente, `GET /.well-known/oauth-protected-resource` retorna `404`; com configuração completa, retorna o JSON validado e continua exigindo Origin permitida.

Antes de publicar `.well-known/oauth-protected-resource` fora do localhost, ainda é obrigatório aprovar o provedor OAuth, resource indicator/audience, PKCE, HTTPS, rate limiting, threat model e smoke remoto.

## Exemplo

```
> Qual a forma mínima de (A AND B) OR (A AND NOT B)?

  simplify_expression → Original: A ∧ B ∨ A ∧ ¬B
                        Mínima:   A
                        Operadores: 4 → 0

> Monta um divisor de frequência por 2 e me mostra as formas de onda.

  simulate_circuit → | tique | clk | ff | evento |
                     | --- | --- | --- | --- |
                     | 0 | 0 | 0 | início |
                     | 2 | 1 | 0 |  |
                     | 3 | 1 | 1 |  |
                     | 6 | 1 | 1 |  |
                     | 7 | 1 | 0 |  |

> Como é o Full Adder da biblioteca?

  get_chip → Full Adder — Somadores
             3 entradas, 2 saídas, 5 componentes, 13 fios
             Composto por: 2× AND, 2× XOR, 1× OR
             BIT       = (NOT A AND NOT B AND C) OR ...
             Carry Out = (B AND C) OR (A AND C) OR (A AND B)
```

## Tabela verdade vetorial

A ferramenta `circuit_vector_truth_table` recebe o mesmo `CircuitDocument` serializável usado pelo editor, mas permite barramentos com `options.width`. O contrato limita a enumeração a 12 bits de entrada e 4096 linhas na resposta. `max_rows` pode reduzir a saída sem alterar `totalRows` ou `truncated`; `custom_chips` deve conter as definições completas de todas as instâncias customizadas.

```json
{
  "name": "circuit_vector_truth_table",
  "arguments": {
    "document": {
      "format": "veritas-circuit",
      "version": 1,
      "name": "AND vetorial MCP",
      "nodes": [
        { "id": "a", "type": "input", "position": { "x": 0, "y": 0 }, "options": { "width": 4 } },
        { "id": "b", "type": "input", "position": { "x": 0, "y": 100 }, "options": { "width": 4 } },
        { "id": "gate", "type": "and", "position": { "x": 180, "y": 50 }, "options": { "width": 4 } },
        { "id": "out", "type": "output", "position": { "x": 360, "y": 50 }, "options": { "width": 4 } }
      ],
      "connections": [
        { "source": { "node": "a" }, "target": { "node": "gate", "port": 0 } },
        { "source": { "node": "b" }, "target": { "node": "gate", "port": 1 } },
        { "source": { "node": "gate" }, "target": { "node": "out", "port": 0 } }
      ]
    },
    "output_id": "out",
    "max_bits": 12,
    "max_rows": 4
  }
}
```

A resposta começa com `| a[3:0] | b[3:0] | out[3:0] |` e contém linhas binárias como `| 0000 | 0000 | 0000 |`, além de bits totais, cardinalidade, truncamento e classificação. Erros de documento, largura total acima do limite e circuito incompatível são retornados como erro controlado, sem fazer acesso à nuvem.

## Erros

A simulação wireless usa `transmitter` com `options.channel` como origem e `receiver` com o mesmo canal como destino virtual. Cada canal aceita um transmissor e vários receptores; canal ausente, transmissor duplicado ou receptor órfão devem ser corrigidos antes da simulação.

As definições de `custom_chips` são validadas e reconstruídas pelo contrato CHIP-001 antes da expansão. O MCP rejeita IDs duplicados, documentos inválidos, chips aninhados e referências sem definição correspondente. A expansão é combinacional e respeita o limite seguro de oito níveis; componentes que não pertencem ao documento canônico são rejeitados com erro controlado quando aparecem junto de um `custom-chip`. A exportação HDL usa o mesmo payload e não expõe portas internas como portas externas; circuitos inválidos falham antes de produzir código.

Erro de sintaxe não derruba o servidor: volta como resposta de erro da
ferramenta, com o dedo no lugar exato do problema.

```
Falta fechar 1 parêntese.

    (A AND
    ^
```

## Como está montado

`mcp/src/tools.ts` tem a lógica das ferramentas, sem nada de MCP — é o que os
 testes exercitam direto. `mcp/src/server.ts` registra schemas e expõe a fábrica
 compartilhada `createVeritasServer`; `mcp/src/stdio.ts` conecta essa fábrica ao
 stdio e `mcp/src/http-entry.ts` ao adaptador HTTP local. O build empacota o motor
 do Veritas junto e deixa o SDK do MCP de fora, como dependência declarada.

## Exemplo de custom-chip portátil

A instância referencia o ID da definição e recebe suas entradas no campo `inputs`. A definição inteira viaja no mesmo pedido, o que torna o comportamento independente da biblioteca local do navegador:

```json
{
  "components": [
    { "id": "input", "type": "input" },
    { "id": "chip", "type": "custom-chip", "inputs": [{ "node": "input" }], "options": { "customChipId": 7 } },
    { "id": "out", "type": "output", "inputs": [{ "node": "chip" }] }
  ],
  "steps": [{ "set": { "input": true }, "ticks": 3 }],
  "watch": ["input", "chip", "out"],
  "custom_chips": [{
    "id": 7,
    "definition": {
      "format": "veritas-custom-chip",
      "version": 1,
      "name": "NOT MCP",
      "document": {
        "format": "veritas-circuit",
        "version": 1,
        "name": "NOT MCP",
        "nodes": [
          { "id": "input", "type": "input", "position": { "x": 0, "y": 0 }, "label": "Entrada" },
          { "id": "not", "type": "not", "position": { "x": 120, "y": 0 }, "label": "NOT" },
          { "id": "output", "type": "output", "position": { "x": 240, "y": 0 }, "label": "Saída" }
        ],
        "connections": [
          { "source": { "node": "input" }, "target": { "node": "not", "port": 0 } },
          { "source": { "node": "not" }, "target": { "node": "output", "port": 0 } }
        ]
      },
      "inputs": [{ "id": "input", "name": "Entrada", "width": 1 }],
      "outputs": [{ "id": "output", "name": "Saída", "width": 1 }]
    }
  }]
}
```
