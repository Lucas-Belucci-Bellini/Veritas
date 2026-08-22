import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { MCP_ACCEPTANCE_IDS, renderMcpReport, sanitizeMcpMessage } from './mcpAcceptanceContract.mjs'

const REPORT_PATH = resolve(process.cwd(), process.env.MCP_REPORT_PATH || `artifacts/mcp-acceptance-${Date.now()}.md`)
const SERVER_PATH = resolve(process.cwd(), 'mcp/dist/server.js')

function result(id, status, operation, message) {
  return { id, status, operation, message: sanitizeMcpMessage(message) }
}

function request(id, method, params) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params })
}

function runSession(calls) {
  const input = [
    request(1, 'initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'veritas-mcp-acceptance', version: '1.0.0' },
    }),
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }),
    ...calls,
  ].join('\n') + '\n'
  try {
    const output = execFileSync('node', [SERVER_PATH], {
      cwd: process.cwd(),
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: Number(process.env.MCP_COMMAND_TIMEOUT_MS || 30000),
    })
    const responses = output.split('\n').filter(Boolean).map((line) => JSON.parse(line))
    return { responses, output }
  } catch (error) {
    const output = [error?.stdout, error?.stderr, error?.message].filter(Boolean).join('\n')
    throw new Error(sanitizeMcpMessage(output))
  }
}

function responseFor(responses, id) {
  const response = responses.find((item) => item.id === id)
  if (!response) throw new Error(`Resposta JSON-RPC ausente para id=${id}`)
  return response
}

function textOf(response) {
  return response?.result?.content?.find((item) => item.type === 'text')?.text ?? ''
}

const CUSTOM_CHIP_DEFINITION = {
  format: 'veritas-custom-chip',
  version: 1,
  name: 'NOT MCP',
  document: {
    format: 'veritas-circuit',
    version: 1,
    name: 'NOT MCP',
    nodes: [
      { id: 'input', type: 'input', position: { x: 0, y: 0 }, label: 'Entrada' },
      { id: 'not', type: 'not', position: { x: 120, y: 0 }, label: 'NOT' },
      { id: 'output', type: 'output', position: { x: 240, y: 0 }, label: 'Saída' },
    ],
    connections: [
      { source: { node: 'input' }, target: { node: 'not', port: 0 } },
      { source: { node: 'not' }, target: { node: 'output', port: 0 } },
    ],
  },
  inputs: [{ id: 'input', name: 'Entrada', width: 1 }],
  outputs: [{ id: 'output', name: 'Saída', width: 1 }],
}

const CUSTOM_CHIP_CIRCUIT = {
  format: 'veritas-circuit',
  version: 1,
  name: 'Circuito NOT MCP',
  nodes: [
    { id: 'input', type: 'input', position: { x: 0, y: 0 }, label: 'Entrada' },
    { id: 'chip', type: 'custom-chip', position: { x: 120, y: 0 }, label: 'NOT', options: { customChipId: 7 } },
    { id: 'output', type: 'output', position: { x: 240, y: 0 }, label: 'Resultado' },
  ],
  connections: [
    { source: { node: 'input' }, target: { node: 'chip', port: 0 } },
    { source: { node: 'chip' }, target: { node: 'output', port: 0 } },
  ],
}

function main() {
  if (!existsSync(SERVER_PATH)) throw new Error('mcp/dist/server.js ausente; execute npm run build:mcp antes do gate')
  const session = runSession([
    request(2, 'tools/list', {}),
    request(3, 'tools/call', { name: 'truth_table', arguments: { expression: 'A XOR B', notation: 'text', include_steps: false, max_rows: 4 } }),
    request(4, 'tools/call', { name: 'logic_case', arguments: { case_id: 'implication-counterexample' } }),
    request(5, 'tools/call', { name: 'propositional_truth_table', arguments: { expression: 'A -> B', notation: 'text', include_steps: false, max_rows: 4 } }),
    request(6, 'tools/call', { name: 'truth_table', arguments: { expression: 'A AND OR B', notation: 'text', include_steps: false, max_rows: 4 } }),
    request(7, 'tools/call', { name: 'simulate_circuit', arguments: {
      components: [
        { id: 'input', type: 'input' },
        { id: 'chip', type: 'custom-chip', inputs: [{ node: 'input' }], options: { customChipId: 7 } },
        { id: 'out', type: 'output', inputs: [{ node: 'chip' }] },
      ],
      steps: [{ set: { input: true }, ticks: 3 }],
      watch: ['input', 'chip', 'out'],
      custom_chips: [{ id: 7, definition: CUSTOM_CHIP_DEFINITION }],
    } }),
    request(8, 'tools/call', { name: 'circuit_truth_table', arguments: {
      document: CUSTOM_CHIP_CIRCUIT,
      max_rows: 4,
      custom_chips: [{ id: 7, definition: CUSTOM_CHIP_DEFINITION }],
    } }),
  ])
  const initialize = responseFor(session.responses, 1)
  const listed = responseFor(session.responses, 2)
  const truth = responseFor(session.responses, 3)
  const logicCase = responseFor(session.responses, 4)
  const propositional = responseFor(session.responses, 5)
  const invalid = responseFor(session.responses, 6)
  const customSimulation = responseFor(session.responses, 7)
  const customTruthTable = responseFor(session.responses, 8)
  const toolNames = listed.result?.tools?.map((tool) => tool.name) ?? []
  const expectedTools = ['truth_table', 'logic_case', 'propositional_truth_table', 'debug_algorithm', 'simulate_circuit', 'circuit_truth_table']
  const missingTools = expectedTools.filter((name) => !toolNames.includes(name))
  const initializeOk = initialize.result?.serverInfo?.name === 'veritas' && initialize.result?.protocolVersion
  const truthText = textOf(truth)
  const logicText = textOf(logicCase)
  const propositionalText = textOf(propositional)
  const invalidText = textOf(invalid)
  const customSimulationText = textOf(customSimulation)
  const customTruthTableText = textOf(customTruthTable)
  const results = [
    result('MCP-001', initializeOk ? 'PASS' : 'FAIL', 'initialize JSON-RPC', initializeOk ? `servidor ${initialize.result.serverInfo.name} negociou ${initialize.result.protocolVersion}` : JSON.stringify(initialize)),
    result('MCP-002', missingTools.length === 0 ? 'PASS' : 'FAIL', 'tools/list schema', missingTools.length === 0 ? `${toolNames.length} ferramentas listadas com nomes estáveis` : `ferramentas ausentes: ${missingTools.join(', ')}`),
    result('MCP-003', truthText.includes('| A | B | A XOR B |') && truthText.includes('| 0 | 1 | 1 |') ? 'PASS' : 'FAIL', 'truth_table golden', truthText || JSON.stringify(truth)),
    result('MCP-004', logicText.includes('Caso válido: não') && propositionalText.includes('| A | B |') ? 'PASS' : 'FAIL', 'logic_case/propositional golden', logicText && propositionalText ? 'respostas didáticas e proposicionais preservaram o formato textual' : `${logicText} ${propositionalText}`),
    result('MCP-005', invalid.result?.isError === true && invalidText.includes('Dois operadores seguidos') ? 'PASS' : 'FAIL', 'erro controlado de ferramenta', invalidText || JSON.stringify(invalid)),
    result('MCP-006', session.responses.every((item) => item.jsonrpc === '2.0') ? 'PASS' : 'FAIL', 'transporte stdio JSON-RPC', `${session.responses.length} respostas JSON-RPC válidas sem saída não protocolar`),
    result('MCP-007', customSimulation.result?.isError !== true && customSimulationText.includes('| 3 | 1 | 1 | 1 |') ? 'PASS' : 'FAIL', 'simulate_circuit custom-chip golden', customSimulationText || JSON.stringify(customSimulation)),
    result('MCP-008', customTruthTable.result?.isError !== true && customTruthTableText.includes('| Entrada | Resultado |') && customTruthTableText.includes('| 0 | 1 |') ? 'PASS' : 'FAIL', 'circuit_truth_table custom-chip golden', customTruthTableText || JSON.stringify(customTruthTable)),
  ]
  if (results.some((item) => !MCP_ACCEPTANCE_IDS.includes(item.id))) throw new Error('IDs MCP fora do contrato')
  mkdirSync(dirname(REPORT_PATH), { recursive: true })
  const report = renderMcpReport(results)
  writeFileSync(REPORT_PATH, report)
  console.log(report)
  console.log(`Relatório sanitizado: ${REPORT_PATH}`)
  if (results.some((item) => item.status === 'FAIL')) process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(`MCP runner abortado: ${sanitizeMcpMessage(error)}`)
  process.exitCode = 1
}
