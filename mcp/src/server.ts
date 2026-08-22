#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  circuitTruthTable,
  circuitVectorTruthTable,
  debugAlgorithm,
  exportCircuitTool,
  evaluateExpression,
  evaluateLogicCase,
  fullPropositionalTable,
  getChip,
  karnaugh,
  listChips,
  normalForms,
  simplifyExpression,
  simulateCircuit,
  truthTable,
  type ToolResult,
} from './tools'
import type { AlgorithmDocument, ExecutionState } from '../../src/algorithms/index'

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

export const VERITAS_MCP_VERSION = '0.9.0-rc.8'
export const VERITAS_MCP_INSTRUCTIONS =
  'Motor de lógica booleana do Veritas. Use estas ferramentas em vez de calcular tabelas verdade ' +
  'ou simplificações de cabeça: elas são exatas. A biblioteca de chips vem de circuitos reais ' +
  'feitos no Digital Logic Sim.'

export function createVeritasServer(): McpServer {
  const server = new McpServer(
    { name: 'veritas', version: VERITAS_MCP_VERSION },
    { instructions: VERITAS_MCP_INSTRUCTIONS },
  )
  registerVeritasTools(server)
  return server
}

export function registerVeritasTools(server: McpServer): void {
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
  'logic_case',
  {
    title: 'Caso lógico didático',
    description:
      'Avalia um exercício de Álgebra de Boole ou Argumentos do catálogo do Veritas e devolve todas as linhas, contraexemplos e validade do caso.',
    inputSchema: {
      case_id: z.string().min(1).describe('ID do caso, por exemplo tautology-excluded-middle ou modus-ponens'),
    },
  },
  async ({ case_id }) => guard(() => evaluateLogicCase(case_id)),
)

server.registerTool(
  'propositional_truth_table',
  {
    title: 'Tabela proposicional completa',
    description:
      'Gera uma tabela verdade completa usando a engine do Veritas. Aceita AND, NAND, OR, NOR, XOR, XNOR, NOT, implicação -> e bicondicional <->.',
    inputSchema: {
      expression: EXPRESSION,
      include_steps: z.boolean().default(true),
      notation: NOTATION,
      max_rows: z.number().int().min(2).max(4096).default(4096),
    },
  },
  async ({ expression, include_steps, notation, max_rows }) =>
    guard(() => fullPropositionalTable(expression, {
      includeSteps: include_steps,
      notation,
      maxRows: max_rows,
    })),
)

const RUNTIME_VALUE = z.union([z.boolean(), z.number(), z.string(), z.null()])

server.registerTool(
  'export_circuit_hdl',
  {
    title: 'Exportar circuito HDL',
    description:
      'Exporta um CircuitDocument validado para Verilog ou VHDL. Instâncias custom-chip ' +
      'exigem suas definições veritas-custom-chip em custom_chips.',
    inputSchema: {
      document: z.unknown().describe('CircuitDocument serializável do formato veritas-circuit'),
      format: z.enum(['verilog', 'vhdl']).describe('Formato industrial de saída'),
      custom_chips: z
        .array(z.object({ id: z.number().int().min(1), definition: z.unknown() }))
        .max(128)
        .default([])
        .describe('Definições veritas-custom-chip usadas pelas instâncias custom-chip'),
    },
  },
  async ({ document, format, custom_chips }) =>
    guard(() => exportCircuitTool({ document, format, customChips: custom_chips })),
)

server.registerTool(
  'circuit_truth_table',
  {
    title: 'Tabela verdade de circuito',
    description:
      'Gera a tabela verdade de um CircuitDocument combinacional. Aceita instâncias custom-chip ' +
      'quando suas definições veritas-custom-chip são enviadas em custom_chips.',
    inputSchema: {
      document: z.unknown().describe('CircuitDocument serializável do formato veritas-circuit'),
      output_id: z.string().min(1).optional().describe('ID da saída a ser destacada; por padrão, usa a primeira'),
      max_rows: z.number().int().min(1).max(4096).default(256).describe('Teto de linhas na resposta'),
      custom_chips: z
        .array(z.object({ id: z.number().int().min(1), definition: z.unknown() }))
        .max(128)
        .default([])
        .describe('Definições veritas-custom-chip usadas pelas instâncias custom-chip'),
    },
  },
  async ({ document, output_id, max_rows, custom_chips }) =>
    guard(() => circuitTruthTable({ document, outputId: output_id, maxRows: max_rows, customChips: custom_chips })),
)

server.registerTool(
  'circuit_vector_truth_table',
  {
    title: 'Tabela verdade vetorial de circuito',
    description:
      'Gera uma tabela verdade determinística para um CircuitDocument com barramentos de até 12 bits. ' +
      'Instâncias custom-chip exigem suas definições veritas-custom-chip em custom_chips.',
    inputSchema: {
      document: z.unknown().describe('CircuitDocument serializável do formato veritas-circuit'),
      output_id: z.string().min(1).optional().describe('ID da saída a ser destacada; por padrão, usa a primeira'),
      max_bits: z.number().int().min(1).max(12).default(12).describe('Limite total de bits de entrada'),
      max_rows: z.number().int().min(1).max(4096).default(256).describe('Teto de combinações na resposta'),
      custom_chips: z
        .array(z.object({ id: z.number().int().min(1), definition: z.unknown() }))
        .max(128)
        .default([])
        .describe('Definições veritas-custom-chip usadas pelas instâncias custom-chip'),
    },
  },
  async ({ document, output_id, max_bits, max_rows, custom_chips }) =>
    guard(() => circuitVectorTruthTable({
      document,
      outputId: output_id,
      maxBits: max_bits,
      maxRows: max_rows,
      customChips: custom_chips,
    })),
)

server.registerTool(
  'debug_algorithm',
  {
    title: 'Depurar algoritmo',
    description:
      'Executa um AlgorithmDocument do Veritas em modo step ou run, preservando estado, Watch, BranchTrace, breakpoints e razão de pausa. Não grava no banco nem executa código arbitrário.',
    inputSchema: {
      document: z.unknown().describe('AlgorithmDocument serializável do formato veritas-algorithm'),
      state: z.unknown().optional().describe('ExecutionState retornado por uma chamada anterior'),
      mode: z.enum(['step', 'run']).default('run'),
      max_steps: z.number().int().min(1).max(100_000).default(10_000),
      input_queues: z.record(z.string(), z.array(RUNTIME_VALUE)).optional(),
      breakpoints: z.array(z.string()).default([]),
    },
  },
  async ({ document, state, mode, max_steps, input_queues, breakpoints }) =>
    guard(() => debugAlgorithm({
      document: document as AlgorithmDocument,
      state: state as ExecutionState | undefined,
      mode,
      maxSteps: max_steps,
      inputQueues: input_queues,
      breakpoints,
    })),
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
    'transmitter',
    'receiver',
    'custom-chip',
  ]),
  inputs: z
    .array(z.object({ node: z.string(), port: z.number().int().min(0).optional() }))
    .optional()
    .describe('Ligações das entradas, na ordem dos pinos. dff/tff usam [D, CLK]; receiver recebe o sinal do canal wireless'),
  options: z
    .object({
      period: z.number().int().min(1).optional().describe('clock: tiques em cada nível'),
      ticks: z.number().int().min(1).optional().describe('delay: tamanho do atraso'),
      value: z.boolean().optional().describe('constant: o valor fixo'),
      initial: z.boolean().optional().describe('valor no instante zero'),
      channel: z.string().max(64).optional().describe('transmitter/receiver: nome do canal wireless'),
      customChipId: z.number().int().min(1).optional().describe('custom-chip: ID da definição fornecida em custom_chips'),
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
      'tabela verdade, aceita clock, flip-flops (dff/tff), atrasos e canais wireless, cujo resultado ' +
      'depende do que aconteceu antes. Cada componente leva um tique para propagar. ' +
      'As saídas de dff e tff são Q (porta 0) e Q barrado (porta 1). Instâncias custom-chip ' +
      'devem referenciar uma definição correspondente em custom_chips.',
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
      custom_chips: z
        .array(z.object({ id: z.number().int().min(1), definition: z.unknown() }))
        .max(128)
        .default([])
        .describe('Definições veritas-custom-chip portáteis usadas pelas instâncias custom-chip'),
    },
  },
  async ({ components, steps, watch, custom_chips }) =>
    guard(() => simulateCircuit(components, steps, watch, { customChips: custom_chips })),
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

}
