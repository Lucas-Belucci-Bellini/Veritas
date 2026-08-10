#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  evaluateExpression,
  getChip,
  karnaugh,
  listChips,
  normalForms,
  simplifyExpression,
  simulateCircuit,
  truthTable,
  type ToolResult,
} from './tools'

/**
 * Servidor MCP do Veritas.
 *
 * Expõe o motor lógico para assistentes de IA: em vez de o modelo tentar
 * adivinhar o resultado de uma expressão booleana, ele manda para cá e recebe a
 * resposta calculada. Roda no terminal do usuário, por stdio — nada sai da
 * máquina dele.
 */

const NOTATION = z
  .enum(['math', 'programming', 'text'])
  .default('math')
  .describe('Notação da resposta: ∧∨¬, && || ! ou AND OR NOT')

const EXPRESSION = z
  .string()
  .min(1)
  .describe(
    'Expressão booleana. Aceita AND/&&/∧, OR/||/∨, NOT/!/¬, XOR, NAND, NOR, XNOR, -> e <->',
  )

/** Converte o resultado interno no formato de conteúdo do MCP. */
function toContent(result: ToolResult) {
  return {
    content: [{ type: 'text' as const, text: result.text }],
    isError: result.isError,
  }
}

/** Erro de sintaxe vira resposta de erro da ferramenta, não queda do servidor. */
function guard(run: () => ToolResult) {
  try {
    return toContent(run())
  } catch (error) {
    return toContent({
      isError: true,
      text: error instanceof Error ? error.message : 'Erro desconhecido.',
    })
  }
}

const server = new McpServer(
  { name: 'veritas', version: '0.6.0' },
  {
    instructions:
      'Motor de lógica booleana do Veritas. Use estas ferramentas em vez de calcular tabelas verdade ' +
      'ou simplificações de cabeça: elas são exatas. A biblioteca de chips vem de circuitos reais ' +
      'feitos no Digital Logic Sim.',
  },
)

server.registerTool(
  'truth_table',
  {
    title: 'Tabela verdade',
    description:
      'Gera a tabela verdade completa de uma expressão booleana, com colunas intermediárias ' +
      'e a classificação em tautologia, contradição ou contingência.',
    inputSchema: {
      expression: EXPRESSION,
      include_steps: z
        .boolean()
        .default(true)
        .describe('Incluir uma coluna por subexpressão'),
      notation: NOTATION,
      max_rows: z
        .number()
        .int()
        .min(2)
        .max(4096)
        .default(256)
        .describe('Teto de linhas na resposta'),
    },
  },
  async ({ expression, include_steps, notation, max_rows }) =>
    guard(() =>
      truthTable(expression, {
        includeSteps: include_steps,
        notation,
        maxRows: max_rows,
      }),
    ),
)

server.registerTool(
  'evaluate_expression',
  {
    title: 'Avaliar expressão',
    description:
      'Calcula o valor de uma expressão para valores específicos das variáveis, ' +
      'mostrando o resultado de cada subexpressão pelo caminho.',
    inputSchema: {
      expression: EXPRESSION,
      values: z
        .record(z.string(), z.boolean())
        .describe('Valor de cada variável, por exemplo {"A": true, "B": false}'),
    },
  },
  async ({ expression, values }) => guard(() => evaluateExpression(expression, values)),
)

server.registerTool(
  'simplify_expression',
  {
    title: 'Simplificar expressão',
    description:
      'Reduz a expressão à soma de produtos mínima por Quine-McCluskey e informa ' +
      'quantos operadores foram economizados.',
    inputSchema: { expression: EXPRESSION, notation: NOTATION },
  },
  async ({ expression, notation }) => guard(() => simplifyExpression(expression, notation)),
)

server.registerTool(
  'normal_forms',
  {
    title: 'Formas normais',
    description:
      'Devolve a soma de produtos e o produto de somas da expressão, nas versões ' +
      'canônica (todos os mintermos e maxtermos) e mínima, com a contagem de ' +
      'operadores de cada uma, e diz se a expressão dada já está escrita em SOP ou POS.',
    inputSchema: { expression: EXPRESSION, notation: NOTATION },
  },
  async ({ expression, notation }) => guard(() => normalForms(expression, notation)),
)

server.registerTool(
  'karnaugh_map',
  {
    title: 'Mapa de Karnaugh',
    description:
      'Monta o mapa de Karnaugh (1 a 4 variáveis) em código Gray, com os agrupamentos ' +
      'que geram a expressão mínima.',
    inputSchema: { expression: EXPRESSION, notation: NOTATION },
  },
  async ({ expression, notation }) => guard(() => karnaugh(expression, notation)),
)

const COMPONENT = z.object({
  id: z.string().min(1),
  type: z.enum([
    'input',
    'output',
    'constant',
    'and',
    'or',
    'not',
    'nand',
    'nor',
    'xor',
    'xnor',
    'clock',
    'dff',
    'tff',
    'delay',
  ]),
  inputs: z
    .array(z.object({ node: z.string(), port: z.number().int().min(0).optional() }))
    .optional()
    .describe('Ligações das entradas, na ordem dos pinos. dff/tff usam [D, CLK]'),
  options: z
    .object({
      period: z.number().int().min(1).optional().describe('clock: tiques em cada nível'),
      ticks: z.number().int().min(1).optional().describe('delay: tamanho do atraso'),
      value: z.boolean().optional().describe('constant: o valor fixo'),
      initial: z.boolean().optional().describe('valor no instante zero'),
    })
    .optional(),
  label: z.string().optional(),
})

server.registerTool(
  'simulate_circuit',
  {
    title: 'Simular circuito',
    description:
      'Roda um circuito por alguns tiques e devolve o diagrama de tempo. Diferente da ' +
      'tabela verdade, aceita clock, flip-flops (dff/tff) e atrasos, cujo resultado ' +
      'depende do que aconteceu antes. Cada componente leva um tique para propagar. ' +
      'As saídas de dff e tff são Q (porta 0) e Q barrado (porta 1).',
    inputSchema: {
      components: z.array(COMPONENT).min(1).describe('Os componentes do circuito'),
      steps: z
        .array(
          z.object({
            set: z
              .record(z.string(), z.boolean())
              .optional()
              .describe('Valores a aplicar nos pinos de entrada antes de rodar'),
            ticks: z.number().int().min(1).default(1),
          }),
        )
        .min(1)
        .describe('Roteiro da simulação, em ordem'),
      watch: z
        .array(z.string())
        .default([])
        .describe('Quais componentes acompanhar. Vazio acompanha todos'),
    },
  },
  async ({ components, steps, watch }) =>
    guard(() => simulateCircuit(components, steps, watch)),
)

server.registerTool(
  'list_chips',
  {
    title: 'Listar chips',
    description:
      'Busca na biblioteca de 1121 chips importados do Digital Logic Sim: somadores, ' +
      'multiplexadores, comparadores, registradores e afins.',
    inputSchema: {
      query: z.string().optional().describe('Filtro por parte do nome'),
      category: z.string().optional().describe('Categoria exata, como "Somadores"'),
      only_derived: z
        .boolean()
        .default(false)
        .describe('Só chips que têm expressão booleana derivada'),
      limit: z.number().int().min(1).max(200).default(30),
    },
  },
  async ({ query, category, only_derived, limit }) =>
    guard(() => listChips({ query, category, onlyDerived: only_derived, limit })),
)

server.registerTool(
  'get_chip',
  {
    title: 'Detalhes de um chip',
    description:
      'Mostra pinos, componentes internos e a expressão booleana de cada saída de um chip.',
    inputSchema: { name: z.string().min(1).describe('Nome exato do chip') },
  },
  async ({ name }) => guard(() => getChip(name)),
)

await server.connect(new StdioServerTransport())
