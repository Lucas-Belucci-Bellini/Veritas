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

const VECTOR_AND_CIRCUIT = {
  format: 'veritas-circuit',
  version: 1,
  name: 'AND vetorial MCP',
  nodes: [
    { id: 'a', type: 'input', position: { x: 0, y: 0 }, options: { width: 4 } },
    { id: 'b', type: 'input', position: { x: 0, y: 100 }, options: { width: 4 } },
    { id: 'gate', type: 'and', position: { x: 180, y: 50 }, options: { width: 4 } },
    { id: 'out', type: 'output', position: { x: 360, y: 50 }, options: { width: 4 } },
  ],
  connections: [
    { source: { node: 'a' }, target: { node: 'gate', port: 0 } },
    { source: { node: 'b' }, target: { node: 'gate', port: 1 } },
    { source: { node: 'gate' }, target: { node: 'out', port: 0 } },
  ],
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

const EQUIVALENCE_GATE = (prefix, type) => ({
  format: 'veritas-circuit',
  version: 1,
  name: `Porta ${type} MCP`,
  nodes: [
    { id: `${prefix}a`, type: 'input', position: { x: 0, y: 0 }, label: 'A' },
    { id: `${prefix}b`, type: 'input', position: { x: 0, y: 80 }, label: 'B' },
    { id: `${prefix}g`, type, position: { x: 120, y: 40 } },
    { id: `${prefix}s`, type: 'output', position: { x: 240, y: 40 }, label: 'S' },
  ],
  connections: [
    { source: { node: `${prefix}a` }, target: { node: `${prefix}g`, port: 0 } },
    { source: { node: `${prefix}b` }, target: { node: `${prefix}g`, port: 1 } },
    { source: { node: `${prefix}g` }, target: { node: `${prefix}s`, port: 0 } },
  ],
})

const DIFFERENTIAL_FLIPFLOP = (prefix, sourcePort) => ({
  format: 'veritas-circuit',
  version: 1,
  name: 'Flip-flop MCP',
  nodes: [
    { id: `${prefix}d`, type: 'input', position: { x: 0, y: 0 }, label: 'D' },
    { id: `${prefix}c`, type: 'input', position: { x: 0, y: 60 }, label: 'CLK' },
    { id: `${prefix}ff`, type: 'dff', position: { x: 120, y: 30 } },
    { id: `${prefix}q`, type: 'output', position: { x: 240, y: 30 }, label: 'Q' },
  ],
  connections: [
    { source: { node: `${prefix}d` }, target: { node: `${prefix}ff`, port: 0 } },
    { source: { node: `${prefix}c` }, target: { node: `${prefix}ff`, port: 1 } },
    { source: { node: `${prefix}ff`, port: sourcePort }, target: { node: `${prefix}q`, port: 0 } },
  ],
})

const DIFFERENTIAL_SCRIPT = [
  { set: { D: true, CLK: false }, ticks: 2 },
  { set: { CLK: true }, ticks: 2 },
]

const TESTBENCH_HALF_ADDER = (carry) => ({
  format: 'veritas-circuit',
  version: 1,
  name: 'Meio somador MCP',
  nodes: [
    { id: 'a', type: 'input', position: { x: 0, y: 0 }, label: 'A' },
    { id: 'b', type: 'input', position: { x: 0, y: 60 }, label: 'B' },
    { id: 'x', type: 'xor', position: { x: 120, y: 0 } },
    { id: 'c', type: carry, position: { x: 120, y: 60 } },
    { id: 's', type: 'output', position: { x: 240, y: 0 }, label: 'SOMA' },
    { id: 'v', type: 'output', position: { x: 240, y: 60 }, label: 'VAIUM' },
  ],
  connections: [
    { source: { node: 'a' }, target: { node: 'x', port: 0 } },
    { source: { node: 'b' }, target: { node: 'x', port: 1 } },
    { source: { node: 'a' }, target: { node: 'c', port: 0 } },
    { source: { node: 'b' }, target: { node: 'c', port: 1 } },
    { source: { node: 'x' }, target: { node: 's', port: 0 } },
    { source: { node: 'c' }, target: { node: 'v', port: 0 } },
  ],
})

const TESTBENCH_TABLE = {
  format: 'veritas-testbench',
  version: 1,
  name: 'Tabela do meio somador',
  cases: [
    { name: '0+1', inputs: { A: false, B: true }, expect: { SOMA: true, VAIUM: false } },
    { name: '1+1', inputs: { A: true, B: true }, expect: { SOMA: false, VAIUM: true } },
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
    request(9, 'tools/call', { name: 'export_circuit_hdl', arguments: {
      document: CUSTOM_CHIP_CIRCUIT,
      format: 'verilog',
      custom_chips: [{ id: 7, definition: CUSTOM_CHIP_DEFINITION }],
    } }),
    request(10, 'tools/call', { name: 'circuit_vector_truth_table', arguments: {
      document: VECTOR_AND_CIRCUIT,
      max_bits: 12,
      max_rows: 4,
    } }),
    request(11, 'tools/call', { name: 'circuit_equivalence', arguments: {
      document_a: EQUIVALENCE_GATE('x', 'xor'),
      document_b: EQUIVALENCE_GATE('y', 'xor'),
    } }),
    request(12, 'tools/call', { name: 'circuit_equivalence', arguments: {
      document_a: EQUIVALENCE_GATE('x', 'xor'),
      document_b: EQUIVALENCE_GATE('y', 'or'),
    } }),
    request(13, 'tools/call', { name: 'circuit_differential', arguments: {
      document_a: DIFFERENTIAL_FLIPFLOP('x', 0),
      document_b: DIFFERENTIAL_FLIPFLOP('y', 0),
      script: DIFFERENTIAL_SCRIPT,
    } }),
    request(14, 'tools/call', { name: 'circuit_differential', arguments: {
      document_a: DIFFERENTIAL_FLIPFLOP('x', 0),
      document_b: DIFFERENTIAL_FLIPFLOP('y', 1),
      script: DIFFERENTIAL_SCRIPT,
    } }),
    request(15, 'tools/call', { name: 'run_testbench', arguments: {
      document: TESTBENCH_HALF_ADDER('and'),
      testbench: TESTBENCH_TABLE,
    } }),
    request(16, 'tools/call', { name: 'run_testbench', arguments: {
      document: TESTBENCH_HALF_ADDER('or'),
      testbench: TESTBENCH_TABLE,
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
  const customHdl = responseFor(session.responses, 9)
  const vectorTruthTable = responseFor(session.responses, 10)
  const equivalentPair = responseFor(session.responses, 11)
  const divergentPair = responseFor(session.responses, 12)
  const identicalTimeline = responseFor(session.responses, 13)
  const divergentTimeline = responseFor(session.responses, 14)
  const testbenchPassed = responseFor(session.responses, 15)
  const testbenchFailed = responseFor(session.responses, 16)
  const toolNames = listed.result?.tools?.map((tool) => tool.name) ?? []
  const expectedTools = ['truth_table', 'logic_case', 'propositional_truth_table', 'debug_algorithm', 'simulate_circuit', 'circuit_truth_table', 'circuit_vector_truth_table', 'export_circuit_hdl', 'circuit_equivalence', 'circuit_differential', 'run_testbench']
  const missingTools = expectedTools.filter((name) => !toolNames.includes(name))
  const initializeOk = initialize.result?.serverInfo?.name === 'veritas' && initialize.result?.protocolVersion
  const truthText = textOf(truth)
  const logicText = textOf(logicCase)
  const propositionalText = textOf(propositional)
  const invalidText = textOf(invalid)
  const customSimulationText = textOf(customSimulation)
  const customTruthTableText = textOf(customTruthTable)
  const customHdlText = textOf(customHdl)
  const vectorTruthTableText = textOf(vectorTruthTable)
  const equivalentText = textOf(equivalentPair)
  const divergentText = textOf(divergentPair)
  const identicalTimelineText = textOf(identicalTimeline)
  const divergentTimelineText = textOf(divergentTimeline)
  const testbenchPassedText = textOf(testbenchPassed)
  const testbenchFailedText = textOf(testbenchFailed)
  const results = [
    result('MCP-001', initializeOk ? 'PASS' : 'FAIL', 'initialize JSON-RPC', initializeOk ? `servidor ${initialize.result.serverInfo.name} negociou ${initialize.result.protocolVersion}` : JSON.stringify(initialize)),
    result('MCP-002', missingTools.length === 0 ? 'PASS' : 'FAIL', 'tools/list schema', missingTools.length === 0 ? `${toolNames.length} ferramentas listadas com nomes estáveis` : `ferramentas ausentes: ${missingTools.join(', ')}`),
    result('MCP-003', truthText.includes('| A | B | A XOR B |') && truthText.includes('| 0 | 1 | 1 |') ? 'PASS' : 'FAIL', 'truth_table golden', truthText || JSON.stringify(truth)),
    result('MCP-004', logicText.includes('Caso válido: não') && propositionalText.includes('| A | B |') ? 'PASS' : 'FAIL', 'logic_case/propositional golden', logicText && propositionalText ? 'respostas didáticas e proposicionais preservaram o formato textual' : `${logicText} ${propositionalText}`),
    result('MCP-005', invalid.result?.isError === true && invalidText.includes('Dois operadores seguidos') ? 'PASS' : 'FAIL', 'erro controlado de ferramenta', invalidText || JSON.stringify(invalid)),
    result('MCP-006', session.responses.every((item) => item.jsonrpc === '2.0') ? 'PASS' : 'FAIL', 'transporte stdio JSON-RPC', `${session.responses.length} respostas JSON-RPC válidas sem saída não protocolar`),
    result('MCP-007', customSimulation.result?.isError !== true && customSimulationText.includes('| 3 | 1 | 1 | 1 |') ? 'PASS' : 'FAIL', 'simulate_circuit custom-chip golden', customSimulationText || JSON.stringify(customSimulation)),
    result('MCP-008', customTruthTable.result?.isError !== true && customTruthTableText.includes('| Entrada | Resultado |') && customTruthTableText.includes('| 0 | 1 |') ? 'PASS' : 'FAIL', 'circuit_truth_table custom-chip golden', customTruthTableText || JSON.stringify(customTruthTable)),
    result('MCP-009', customHdl.result?.isError !== true && customHdlText.includes('module Circuito_NOT_MCP') && customHdlText.includes('output Resultado') ? 'PASS' : 'FAIL', 'export_circuit_hdl custom-chip golden', customHdlText || JSON.stringify(customHdl)),
    result('MCP-010', vectorTruthTable.result?.isError !== true && vectorTruthTableText.includes('| a[3:0] | b[3:0] | out[3:0] |') && vectorTruthTableText.includes('| 0000 | 0000 | 0000 |') ? 'PASS' : 'FAIL', 'circuit_vector_truth_table golden', vectorTruthTableText || JSON.stringify(vectorTruthTable)),
    result('MCP-EQ-001', equivalentPair.result?.isError !== true && equivalentText.includes('Resultado: equivalente') && equivalentText.includes('Linhas comparadas: 4 de 4') ? 'PASS' : 'FAIL', 'circuit_equivalence golden equivalente', equivalentText || JSON.stringify(equivalentPair)),
    result('MCP-EQ-002', divergentPair.result?.isError !== true && divergentText.includes('Resultado: não equivalente') && divergentText.includes('Contraexemplo (linha 3)') && divergentText.includes('| S | 0 | 1 |') ? 'PASS' : 'FAIL', 'circuit_equivalence contraexemplo golden', divergentText || JSON.stringify(divergentPair)),
    result('MCP-DIFF-001', identicalTimeline.result?.isError !== true && identicalTimelineText.includes('Resultado: idêntico neste roteiro') && identicalTimelineText.includes('não é prova') ? 'PASS' : 'FAIL', 'circuit_differential golden idêntico', identicalTimelineText || JSON.stringify(identicalTimeline)),
    result('MCP-DIFF-002', divergentTimeline.result?.isError !== true && divergentTimelineText.includes('Resultado: divergente') && divergentTimelineText.includes('Primeira divergência no tique 1') && divergentTimelineText.includes('| Q | 0 | 1 |') ? 'PASS' : 'FAIL', 'circuit_differential primeiro tique divergente', divergentTimelineText || JSON.stringify(divergentTimeline)),
    result('MCP-TB-001', testbenchPassed.result?.isError !== true && testbenchPassedText.includes('Resultado: todos os casos passaram') && testbenchPassedText.includes('Casos: 2 de 2 passaram') && testbenchPassedText.includes('circuit_equivalence') ? 'PASS' : 'FAIL', 'run_testbench golden aprovado', testbenchPassedText || JSON.stringify(testbenchPassed)),
    result('MCP-TB-002', testbenchFailed.result?.isError !== true && testbenchFailedText.includes('Resultado: há casos falhando') && testbenchFailedText.includes('| 0+1 | VAIUM | 0 | 1 | — |') ? 'PASS' : 'FAIL', 'run_testbench golden reprovado', testbenchFailedText || JSON.stringify(testbenchFailed)),
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
