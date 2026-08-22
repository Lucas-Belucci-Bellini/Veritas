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
| `circuit_truth_table` | Gera a tabela verdade de um `CircuitDocument`, incluindo instâncias `custom-chip` com definições explícitas |
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
testes exercitam direto. `mcp/src/server.ts` só cuida do transporte e dos
esquemas. O build empacota o motor do Veritas junto e deixa o SDK do MCP de
fora, como dependência declarada.

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
