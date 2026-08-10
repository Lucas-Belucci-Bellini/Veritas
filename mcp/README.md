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
| `evaluate_expression` | Resolve a expressão para valores específicos, mostrando cada passo |
| `simplify_expression` | Forma mínima em soma de produtos (Quine-McCluskey) e a economia de portas |
| `karnaugh_map` | Mapa de Karnaugh de 1 a 4 variáveis com os agrupamentos |
| `normal_forms` | SOP e POS, canônicas e mínimas, e a classificação da expressão dada |
| `simulate_circuit` | Roda um circuito com clock e flip-flops e devolve o diagrama de tempo |
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
