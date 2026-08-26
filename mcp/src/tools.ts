import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildKarnaughMap,
  buildNormalForms,
  buildTruthTable,
  classifyForm,
  FORM_LABELS,
  collectVariables,
  evaluateWithSteps,
  formatAst,
  isVeritasError,
  parse,
  simplify,
  spanKey,
  type AstNode,
  type Notation,
} from '../../src/engine/index'
import type { ChipCatalog, ChipEntry } from '../../src/chips/types'
import {
  buildCircuitTruthTable,
  buildCircuitVectorTruthTable,
  buildCustomChipDefinition,
  compareCircuitEquivalence,
  compareCircuitTimelines,
  MAX_DIFFERENTIAL_TICKS,
  MAX_TESTBENCH_CASES,
  runTestbench,
  MAX_EQUIVALENCE_INPUT_BITS,
  elaborateCustomChipDocument,
  exportCircuit,
  isCircuitDocumentShape,
  type CircuitDocument,
  type CircuitDifferentialReport,
  type CircuitDifferentialStep,
  type CircuitEquivalenceReport,
  type TestbenchDocument,
  type TestbenchReport,
  type CustomChipLibraryEntry,
} from '../../src/circuit/index'
import { Simulator, type ComponentSpec } from '../../src/simulation/index'
import { resolveWirelessChannels } from '../../src/circuit/wirelessChannels'
import {
  buildFullPropositionalTruthTable,
  evaluateLogicTestCase,
  logicCaseIsValid,
  LOGIC_TEST_CASES,
  createExecutionState,
  runAlgorithm,
  stepAlgorithm,
  type AlgorithmDocument,
  type ExecutionState,
  type RuntimeValue,
} from '../../src/algorithms/index'

/**
 * Implementação das ferramentas, separada do transporte MCP para poder ser
 * testada direto — sem subir processo nem falar JSON-RPC.
 */

export interface ToolResult {
  text: string
  isError?: boolean
}

function jsonResult(value: unknown): ToolResult {
  return { text: JSON.stringify(value, null, 2) }
}

const here = dirname(fileURLToPath(import.meta.url))

let catalog: ChipCatalog | null = null

/** O catálogo só é lido do disco quando alguma ferramenta de chip é chamada. */
function loadCatalog(): ChipCatalog {
  if (catalog) return catalog
  for (const candidate of [
    join(here, 'catalog.json'),
    join(here, '..', '..', 'src', 'chips', 'catalog.json'),
  ]) {
    try {
      catalog = JSON.parse(readFileSync(candidate, 'utf8')) as ChipCatalog
      return catalog
    } catch {
      continue
    }
  }
  throw new Error('Catálogo de chips não encontrado.')
}

function parseOrExplain(expression: string): AstNode {
  try {
    return parse(expression)
  } catch (error) {
    if (isVeritasError(error)) {
      const marker = `${' '.repeat(error.start)}${'^'.repeat(Math.max(1, error.end - error.start))}`
      throw new Error(
        `${error.message}\n\n    ${expression}\n    ${marker}${error.hint ? `\n\n${error.hint}` : ''}`,
      )
    }
    throw error
  }
}

export function evaluateExpression(
  expression: string,
  values: Record<string, boolean>,
): ToolResult {
  const ast = parseOrExplain(expression)
  const variables = collectVariables(ast)

  const missing = variables.filter((name) => !(name in values))
  if (missing.length > 0) {
    return {
      isError: true,
      text: `Faltam valores para: ${missing.join(', ')}. A expressão usa ${variables.join(', ')}.`,
    }
  }

  const { value, steps } = evaluateWithSteps(ast, values)
  const lines = [
    `${formatAst(ast)} = ${value ? 'VERDADEIRO' : 'FALSO'}`,
    '',
    'Passos:',
  ]
  for (const step of subexpressions(ast)) {
    lines.push(`  ${formatAst(step)} = ${steps.get(spanKey(step)) ? 'V' : 'F'}`)
  }
  return { text: lines.join('\n') }
}

function subexpressions(node: AstNode): AstNode[] {
  const seen = new Set<string>()
  const result: AstNode[] = []
  const visit = (current: AstNode) => {
    if (current.kind === 'not') visit(current.operand)
    if (current.kind === 'binary') {
      visit(current.left)
      visit(current.right)
    }
    if (current.kind === 'var' || current.kind === 'const') return
    const form = formatAst(current)
    if (seen.has(form)) return
    seen.add(form)
    result.push(current)
  }
  visit(node)
  return result
}

export function truthTable(
  expression: string,
  options: { includeSteps?: boolean; notation?: Notation; maxRows?: number } = {},
): ToolResult {
  const ast = parseOrExplain(expression)
  const table = buildTruthTable(ast, {
    includeSteps: options.includeSteps ?? true,
    notation: options.notation ?? 'math',
    maxRows: options.maxRows ?? 256,
  })

  const header = `| ${table.columns.map((column) => column.label).join(' | ')} |`
  const divider = `| ${table.columns.map(() => '---').join(' | ')} |`
  const body = table.rows.map(
    (row) => `| ${row.map((value) => (value ? '1' : '0')).join(' | ')} |`,
  )

  const notes = [
    `Classificação: ${table.classification}`,
    `${table.trueCount} de ${table.rows.length} linhas verdadeiras`,
  ]
  if (table.truncated) {
    notes.push(`Exibindo ${table.rows.length} de ${table.totalRows} linhas.`)
  }

  return { text: [header, divider, ...body, '', ...notes].join('\n') }
}

export function simplifyExpression(
  expression: string,
  notation: Notation = 'math',
): ToolResult {
  const ast = parseOrExplain(expression)
  const result = simplify(ast, notation)
  if (!result) {
    return {
      isError: true,
      text: 'A expressão tem variáveis demais para minimizar (limite de 12).',
    }
  }

  return {
    text: [
      `Original: ${formatAst(ast, notation)}`,
      `Mínima:   ${result.expression}`,
      '',
      `Operadores: ${result.operatorsBefore} → ${result.operatorsAfter}`,
      result.alreadyMinimal
        ? 'A forma original já era mínima.'
        : `Economia de ${result.operatorsBefore - result.operatorsAfter} operador(es).`,
    ].join('\n'),
  }
}

export function karnaugh(expression: string, notation: Notation = 'math'): ToolResult {
  const ast = parseOrExplain(expression)
  const map = buildKarnaughMap(ast, notation)
  if (!map) {
    return {
      isError: true,
      text: 'O mapa de Karnaugh só cabe de 1 a 4 variáveis.',
    }
  }

  const head = `| ${map.rowVariables.join('')}\\${map.columnVariables.join('')} | ${map.columnLabels.join(' | ')} |`
  const divider = `| --- | ${map.columnLabels.map(() => '---').join(' | ')} |`
  const rows = map.values.map(
    (row, index) =>
      `| ${map.rowLabels[index]} | ${row.map((value) => (value ? '1' : '0')).join(' | ')} |`,
  )
  const groups = map.groups.map(
    (group) => `  ${group.term}  (${group.cells.length} células)`,
  )

  return {
    text: [
      head,
      divider,
      ...rows,
      '',
      groups.length > 0 ? 'Agrupamentos:' : 'Sem agrupamentos: a função é constante.',
      ...groups,
    ].join('\n'),
  }
}

export function evaluateLogicCase(caseId: string): ToolResult {
  const testCase = LOGIC_TEST_CASES.find((item) => item.id === caseId)
  if (!testCase) {
    return {
      isError: true,
      text: `Caso "${caseId}" não encontrado. Disponíveis: ${LOGIC_TEST_CASES.map((item) => item.id).join(', ')}.`,
    }
  }

  const rows = evaluateLogicTestCase(testCase)
  const variables = testCase.variables
  const header = `| ${variables.join(' | ')} | resultado | passa |`
  const divider = `| ${variables.map(() => '---').join(' | ')} | --- | --- |`
  const body = rows.map((row) => {
    const result = row.expressionValue ?? row.conclusionValue ?? row.premiseValues?.every(Boolean) ?? false
    return `| ${variables.map((variable) => (row.assignment[variable] ? 'V' : 'F')).join(' | ')} | ${result ? 'V' : 'F'} | ${row.passes ? 'sim' : 'não'} |`
  })

  return {
    text: [
      `# ${testCase.title}`,
      `Origem: ${testCase.source}`,
      `Tipo: ${testCase.kind}`,
      '',
      ...(body.length > 0 ? [header, divider, ...body] : []),
      '',
      `Caso válido: ${logicCaseIsValid(testCase) ? 'sim' : 'não'}`,
    ].join('\n'),
  }
}

export function fullPropositionalTable(
  expression: string,
  options: { includeSteps?: boolean; notation?: Notation; maxRows?: number } = {},
): ToolResult {
  const table = buildFullPropositionalTruthTable(expression, options)
  const header = `| ${table.columns.map((column) => column.label).join(' | ')} |`
  const divider = `| ${table.columns.map(() => '---').join(' | ')} |`
  const body = table.rows.map((row) => `| ${row.map((value) => (value ? '1' : '0')).join(' | ')} |`)
  return {
    text: [header, divider, ...body, '', `Classificação: ${table.classification}`, `${table.trueCount} de ${table.rows.length} linhas verdadeiras`].join('\n'),
  }
}

export interface AlgorithmDebugQuery {
  document: AlgorithmDocument
  state?: ExecutionState
  mode?: 'step' | 'run'
  maxSteps?: number
  inputQueues?: Record<string, RuntimeValue[]>
  breakpoints?: string[]
}

function normalizeDebugState(state: ExecutionState): ExecutionState {
  return {
    ...state,
    debug: {
      breakpoints: [...(state.debug?.breakpoints ?? [])],
      lastPauseReason: state.debug?.lastPauseReason ?? null,
    },
  }
}

export function debugAlgorithm(query: AlgorithmDebugQuery): ToolResult {
  try {
    let state = query.state
      ? normalizeDebugState(query.state)
      : createExecutionState(query.document, {
          inputQueues: query.inputQueues,
          breakpoints: query.breakpoints,
        })
    if (query.breakpoints && query.state) {
      state = {
        ...state,
        debug: { ...state.debug, breakpoints: [...query.breakpoints].sort() },
      }
    }

    const next = query.mode === 'step'
      ? stepAlgorithm(query.document, state, { maxSteps: query.maxSteps })
      : runAlgorithm(query.document, state, { maxSteps: query.maxSteps })
    return jsonResult(next)
  } catch (error) {
    return {
      isError: true,
      text: error instanceof Error ? error.message : 'Falha ao depurar algoritmo.',
    }
  }
}

export interface ChipQuery {
  query?: string
  category?: string
  onlyDerived?: boolean
  limit?: number
}

export function listChips(options: ChipQuery = {}): ToolResult {
  const { chips } = loadCatalog()
  const needle = options.query?.trim().toLowerCase()
  const limit = Math.min(options.limit ?? 30, 200)

  const matches = chips.filter((chip) => {
    if (options.onlyDerived && !chip.derivedOutputs) return false
    if (options.category && chip.category !== options.category) return false
    if (needle && !chip.name.toLowerCase().includes(needle)) return false
    return true
  })

  if (matches.length === 0) return { text: 'Nenhum chip encontrado com esses filtros.' }

  const lines = matches
    .slice(0, limit)
    .map(
      (chip) =>
        `${chip.name} — ${chip.category}, ${chip.in} entradas, ${chip.out} saídas${
          chip.derivedOutputs ? ' (com expressão)' : ''
        }`,
    )

  if (matches.length > limit) {
    lines.push(`… e mais ${matches.length - limit} chips.`)
  }
  return { text: lines.join('\n') }
}

export function getChip(name: string): ToolResult {
  const { chips } = loadCatalog()
  const chip =
    chips.find((entry) => entry.name === name) ??
    chips.find((entry) => entry.name.toLowerCase() === name.toLowerCase())

  if (!chip) {
    const near = chips
      .filter((entry) => entry.name.toLowerCase().includes(name.toLowerCase()))
      .slice(0, 5)
      .map((entry) => entry.name)
    return {
      isError: true,
      text: near.length
        ? `Chip "${name}" não encontrado. Parecidos: ${near.join(', ')}.`
        : `Chip "${name}" não encontrado.`,
    }
  }

  return { text: describeChip(chip) }
}

function describeChip(chip: ChipEntry): string {
  const lines = [
    `${chip.name} — ${chip.category}`,
    `${chip.in} entradas, ${chip.out} saídas, ${chip.partCount} componentes, ${chip.wireCount} fios`,
  ]

  if (chip.pins) {
    lines.push(`Entradas: ${chip.pins.in.join(', ')}`)
    lines.push(`Saídas: ${chip.pins.out.join(', ')}`)
  }
  if (chip.widths) lines.push(`Larguras de barramento: ${chip.widths.join(', ')} bits`)

  const parts = Object.entries(chip.parts)
  if (parts.length > 0) {
    lines.push(`Composto por: ${parts.map(([n, c]) => `${c}× ${n}`).join(', ')}`)
  }

  if (chip.derivedOutputs && chip.variables) {
    lines.push('', `Variáveis: ${chip.variables.join(', ')}`)
    for (const output of chip.derivedOutputs) {
      lines.push(`  ${output.name} = ${output.expression ?? '(expressão longa demais)'}`)
    }
  } else {
    lines.push('', 'Sequencial ou multi-bit: não tem expressão booleana equivalente.')
  }

  return lines.join('\n')
}

export function normalForms(expression: string, notation: Notation = 'math'): ToolResult {
  const ast = parseOrExplain(expression)
  const forms = buildNormalForms(ast, notation)
  if (!forms) {
    return {
      isError: true,
      text: 'A expressão tem variáveis demais para montar as formas normais.',
    }
  }

  const cheaper =
    forms.sopOperators === forms.posOperators
      ? 'As duas custam o mesmo.'
      : forms.sopOperators < forms.posOperators
        ? 'A soma de produtos sai mais barata.'
        : 'O produto de somas sai mais barato.'

  return {
    text: [
      `Expressão: ${formatAst(ast, notation)}`,
      `Como está escrita: ${FORM_LABELS[classifyForm(ast)]}`,
      `Variáveis: ${forms.variables.join(', ')}`,
      '',
      `SOP canônica — Σm(${forms.minterms.join(', ') || '—'})`,
      `  ${forms.canonicalSop}`,
      `POS canônica — ΠM(${forms.maxterms.join(', ') || '—'})`,
      `  ${forms.canonicalPos}`,
      '',
      `SOP mínima (${forms.sopOperators} operadores)`,
      `  ${forms.minimalSop}`,
      `POS mínima (${forms.posOperators} operadores)`,
      `  ${forms.minimalPos}`,
      '',
      cheaper,
    ].join('\n'),
  }
}

export interface ExportCircuitToolQuery {
  document: unknown
  format: 'verilog' | 'vhdl'
  customChips?: readonly CustomChipToolDefinition[]
}

export function exportCircuitTool(query: ExportCircuitToolQuery): ToolResult {
  try {
    if (!isCircuitDocumentShape(query.document)) return { isError: true, text: 'O documento não possui o formato veritas-circuit esperado.' }
    const customChips = normalizeCustomChipLibrary(query.customChips)
    return { text: exportCircuit(query.document, query.format, { customChips }) }
  } catch (error) {
    return { isError: true, text: error instanceof Error ? error.message : 'Falha ao exportar o circuito.' }
  }
}

export interface CircuitTruthTableToolQuery {
  document: unknown
  maxRows?: number
  outputId?: string
  customChips?: readonly CustomChipToolDefinition[]
}

export function circuitTruthTable(query: CircuitTruthTableToolQuery): ToolResult {
  try {
    if (!isCircuitDocumentShape(query.document)) return { isError: true, text: 'O documento não possui o formato veritas-circuit esperado.' }
    const customChips = normalizeCustomChipLibrary(query.customChips)
    const table = buildCircuitTruthTable(query.document, {
      maxRows: query.maxRows,
      outputId: query.outputId,
      customChips,
    })
    const header = `| ${table.columns.map((column) => column.label).join(' | ')} |`
    const divider = `| ${table.columns.map(() => '---').join(' | ')} |`
    const rows = table.rows.map((row) => `| ${row.map((value) => (value ? '1' : '0')).join(' | ')} |`)
    const notes = [
      `Classificação: ${table.classification}`,
      `${table.trueCount} de ${table.rows.length} linhas verdadeiras`,
    ]
    if (table.truncated) notes.push(`Exibindo ${table.rows.length} de ${table.totalRows} linhas.`)
    return { text: [header, divider, ...rows, '', ...notes].join('\n') }
  } catch (error) {
    return { isError: true, text: error instanceof Error ? error.message : 'Falha ao gerar a tabela verdade do circuito.' }
  }
}

export interface CircuitVectorTruthTableToolQuery {
  document: unknown
  maxBits?: number
  maxRows?: number
  outputId?: string
  customChips?: readonly CustomChipToolDefinition[]
}

export function circuitVectorTruthTable(query: CircuitVectorTruthTableToolQuery): ToolResult {
  try {
    if (!isCircuitDocumentShape(query.document)) return { isError: true, text: 'O documento não possui o formato veritas-circuit esperado.' }
    const customChips = normalizeCustomChipLibrary(query.customChips)
    const table = buildCircuitVectorTruthTable(query.document, {
      maxBits: query.maxBits,
      maxRows: query.maxRows,
      outputId: query.outputId,
      customChips,
    })
    const header = `| ${table.columns.map((column) => vectorColumnLabel(column.label, column.width)).join(' | ')} |`
    const divider = `| ${table.columns.map(() => '---').join(' | ')} |`
    const rows = table.rows.map((row) => `| ${row.join(' | ')} |`)
    const notes = [
      `Bits de entrada: ${table.totalInputBits}`,
      `Combinações geradas: ${table.generatedRows} de ${table.totalRows}`,
      `Linhas com algum bit ativo: ${table.activeCount}`,
      `Classificação: ${table.classification}`,
    ]
    if (table.truncated) notes.push(`Exibindo ${table.generatedRows} de ${table.totalRows} combinações.`)
    return { text: [header, divider, ...rows, '', ...notes].join('\n') }
  } catch (error) {
    return { isError: true, text: error instanceof Error ? error.message : 'Falha ao gerar a tabela verdade vetorial do circuito.' }
  }
}

function vectorColumnLabel(label: string, width: number): string {
  return width > 1 ? `${label}[${width - 1}:0]` : label
}

export interface CustomChipToolDefinition {
  id: number
  definition: unknown
}

export interface SimulateCircuitOptions {
  customChips?: readonly CustomChipToolDefinition[]
}

export const MAX_CUSTOM_CHIP_LIBRARY_ENTRIES = 128

export interface CircuitEquivalenceToolQuery {
  documentA: unknown
  documentB: unknown
  maxInputBits?: number
  customChipsA?: readonly CustomChipToolDefinition[]
  customChipsB?: readonly CustomChipToolDefinition[]
}

export function circuitEquivalence(query: CircuitEquivalenceToolQuery): ToolResult {
  try {
    if (!isCircuitDocumentShape(query.documentA)) {
      return { isError: true, text: 'O documento A não possui o formato veritas-circuit esperado.' }
    }
    if (!isCircuitDocumentShape(query.documentB)) {
      return { isError: true, text: 'O documento B não possui o formato veritas-circuit esperado.' }
    }
    const report = compareCircuitEquivalence(query.documentA, query.documentB, {
      customChipsA: normalizeCustomChipLibrary(query.customChipsA),
      customChipsB: normalizeCustomChipLibrary(query.customChipsB),
      maxInputBits: query.maxInputBits,
    })
    return { text: formatEquivalenceReport(report) }
  } catch (error) {
    return { isError: true, text: error instanceof Error ? error.message : 'Falha ao comparar os circuitos.' }
  }
}

function formatEquivalenceReport(report: CircuitEquivalenceReport): string {
  if (report.status === 'incomparable') {
    return [
      'Resultado: não comparável',
      '',
      ...report.issues.map((issue) => `- [${issue.code}] ${issue.message}`),
      '',
      'Nenhuma linha foi avaliada; este resultado não afirma nem nega equivalência.',
    ].join('\n')
  }

  const interfaceLine = (ports: readonly { name: string; width: number }[]): string =>
    ports.map((port) => (port.width > 1 ? `${port.name}[${port.width - 1}:0]` : port.name)).join(', ')

  const lines = [
    report.status === 'equivalent' ? 'Resultado: equivalente' : 'Resultado: não equivalente',
    '',
    `Entradas: ${interfaceLine(report.inputs)}`,
    `Saídas: ${interfaceLine(report.outputs)}`,
    `Linhas comparadas: ${report.comparedRows} de ${report.totalRows} (comparação exaustiva)`,
  ]

  if (report.status === 'equivalent') {
    lines.push('', 'Os dois circuitos concordam em todas as combinações de entrada.')
    return lines.join('\n')
  }

  const counterexample = report.counterexample
  lines.push(`Linhas divergentes: ${report.divergentRows}`)
  lines.push(`Saídas divergentes: ${report.divergentOutputs.join(', ')}`)
  if (counterexample) {
    lines.push('', `Contraexemplo (linha ${counterexample.row}):`)
    lines.push('', '| Entrada | Valor |', '| --- | --- |')
    for (const input of counterexample.inputs) lines.push(`| ${input.name} | ${input.value} |`)
    lines.push('', '| Saída | A | B |', '| --- | --- | --- |')
    for (const divergence of counterexample.divergences) {
      lines.push(`| ${divergence.output} | ${divergence.a} | ${divergence.b} |`)
    }
  }
  return lines.join('\n')
}

export interface CircuitDifferentialToolQuery {
  documentA: unknown
  documentB: unknown
  script: readonly CircuitDifferentialStep[]
  maxTicks?: number
}

export function circuitDifferential(query: CircuitDifferentialToolQuery): ToolResult {
  try {
    if (!isCircuitDocumentShape(query.documentA)) {
      return { isError: true, text: 'O documento A não possui o formato veritas-circuit esperado.' }
    }
    if (!isCircuitDocumentShape(query.documentB)) {
      return { isError: true, text: 'O documento B não possui o formato veritas-circuit esperado.' }
    }
    const report = compareCircuitTimelines(query.documentA, query.documentB, query.script, {
      maxTicks: query.maxTicks,
    })
    return { text: formatDifferentialReport(report) }
  } catch (error) {
    return { isError: true, text: error instanceof Error ? error.message : 'Falha ao comparar as linhas do tempo.' }
  }
}

function formatDifferentialReport(report: CircuitDifferentialReport): string {
  if (report.status === 'incomparable') {
    return [
      'Resultado: não comparável',
      '',
      ...report.issues.map((issue) => `- [${issue.code}] ${issue.message}`),
      '',
      'Nenhum tique foi simulado.',
    ].join('\n')
  }

  const lines = [
    report.status === 'identical'
      ? 'Resultado: idêntico neste roteiro'
      : 'Resultado: divergente',
    '',
    `Entradas: ${report.inputs.join(', ') || '(nenhuma)'}`,
    `Saídas: ${report.outputs.join(', ')}`,
    `Tiques simulados: ${report.comparedTicks}`,
  ]

  if (report.status === 'identical') {
    lines.push(
      '',
      'Os dois circuitos concordaram em todos os tiques do roteiro. Isso não é prova de',
      'equivalência: outro roteiro ainda pode separá-los.',
    )
    return lines.join('\n')
  }

  const first = report.firstDivergence
  lines.push(`Tiques divergentes: ${report.divergentTicks}`)
  lines.push(`Saídas divergentes: ${report.divergentOutputs.join(', ')}`)
  if (first) {
    lines.push('', `Primeira divergência no tique ${first.tick} (passo ${first.step}):`)
    if (first.inputs.length > 0) {
      lines.push('', '| Entrada | Valor |', '| --- | --- |')
      for (const input of first.inputs) lines.push(`| ${input.name} | ${input.value ? 1 : 0} |`)
    }
    lines.push('', '| Saída | A | B |', '| --- | --- | --- |')
    for (const signal of first.signals) {
      lines.push(`| ${signal.signal} | ${signal.a ? 1 : 0} | ${signal.b ? 1 : 0} |`)
    }
  }
  return lines.join('\n')
}

export interface RunTestbenchToolQuery {
  document: unknown
  testbench: unknown
  customChips?: readonly CustomChipToolDefinition[]
}

export function runTestbenchTool(query: RunTestbenchToolQuery): ToolResult {
  try {
    if (!isCircuitDocumentShape(query.document)) {
      return { isError: true, text: 'O documento não possui o formato veritas-circuit esperado.' }
    }
    const report = runTestbench(query.document, query.testbench as TestbenchDocument, {
      customChips: normalizeCustomChipLibrary(query.customChips),
    })
    return { text: formatTestbenchReport(report) }
  } catch (error) {
    return { isError: true, text: error instanceof Error ? error.message : 'Falha ao rodar o testbench.' }
  }
}

function formatTestbenchReport(report: TestbenchReport): string {
  if (report.status === 'invalid') {
    return [
      'Resultado: documento de teste inválido',
      '',
      ...report.issues.map((issue) => `- [${issue.code}] ${issue.message}`),
      '',
      'Nenhum caso foi executado.',
    ].join('\n')
  }

  const lines = [
    report.status === 'passed' ? 'Resultado: todos os casos passaram' : 'Resultado: há casos falhando',
    '',
    `Casos: ${report.passed} de ${report.total} passaram`,
  ]

  if (report.status === 'passed') {
    lines.push(
      '',
      'O circuito satisfez todos os vetores declarados. Isso cobre exatamente os casos escritos —',
      'para uma prova sobre todo o espaço de entrada, use circuit_equivalence.',
    )
    appendDiagnostics(lines, report)
    return lines.join('\n')
  }

  lines.push('', '| Caso | Saída | Esperado | Obtido | Tique |', '| --- | --- | --- | --- | --- |')
  for (const item of report.cases) {
    if (item.status === 'passed') continue
    for (const mismatch of item.mismatches) {
      lines.push(
        `| ${item.name} | ${mismatch.output} | ${mismatch.expected ? 1 : 0} | ${mismatch.actual ? 1 : 0} | ` +
        `${mismatch.tick === undefined ? '—' : mismatch.tick} |`,
      )
    }
  }
  appendDiagnostics(lines, report)
  return lines.join('\n')
}

function appendDiagnostics(lines: string[], report: TestbenchReport): void {
  const diagnostics = report.cases.filter((item) => item.diagnostic)
  if (diagnostics.length === 0) return

  lines.push('', 'Diagnóstico bounded por caso:')
  for (const item of diagnostics) {
    const diagnostic = item.diagnostic!
    lines.push(`- ${item.name}: ${formatDiagnostic(diagnostic)}`)
  }
}

function formatDiagnostic(diagnostic: NonNullable<TestbenchReport['cases'][number]['diagnostic']>): string {
  if (diagnostic.status === 'stabilized') {
    return `estabilizado após ${diagnostic.ticksExecuted} tique(s)`
  }
  if (diagnostic.status === 'cycle-detected') {
    const cycle = diagnostic.cyclePeriod === undefined ? 'período desconhecido' : `período ${diagnostic.cyclePeriod}`
    const start = diagnostic.cycleStartTick === undefined ? 'início desconhecido' : `início no tique ${diagnostic.cycleStartTick}`
    return `ciclo detectado (${start}, ${cycle}; ${diagnostic.ticksExecuted} tique(s) observados)`
  }
  return `budget esgotado após ${diagnostic.ticksExecuted} tique(s)`
}

export const MCP_MAX_TESTBENCH_CASES = MAX_TESTBENCH_CASES

export const MCP_MAX_DIFFERENTIAL_TICKS = MAX_DIFFERENTIAL_TICKS

export const MCP_MAX_EQUIVALENCE_INPUT_BITS = MAX_EQUIVALENCE_INPUT_BITS

/**
 * Constrói a biblioteca em ordem de dependência.
 *
 * Um chip pode conter outros chips, e construir a definição de um pai exige as
 * definições dos filhos. Como o payload chega em ordem arbitrária, cada chip é
 * resolvido sob demanda, com memoização e detecção de ciclo — construir na
 * ordem recebida falharia sempre que o pai viesse antes do filho.
 */
function normalizeCustomChipLibrary(entries: readonly CustomChipToolDefinition[] = []): CustomChipLibraryEntry[] {
  if (entries.length > MAX_CUSTOM_CHIP_LIBRARY_ENTRIES) {
    throw new Error(`A biblioteca MCP aceita no máximo ${MAX_CUSTOM_CHIP_LIBRARY_ENTRIES} chips customizados por chamada.`)
  }

  const sources = new Map<number, { document: CircuitDocument; name?: string }>()
  entries.forEach((entry, index) => {
    if (!Number.isSafeInteger(entry.id) || entry.id < 1) throw new Error(`O chip customizado ${index + 1} possui um ID inválido.`)
    if (sources.has(entry.id)) throw new Error(`O ID de chip customizado ${entry.id} aparece mais de uma vez.`)
    if (!isRecord(entry.definition) || !isCircuitDocumentShape(entry.definition.document)) {
      throw new Error(`A definição do chip customizado ${entry.id} não possui um documento veritas-circuit válido.`)
    }
    sources.set(entry.id, {
      document: entry.definition.document,
      name: typeof entry.definition.name === 'string' ? entry.definition.name : undefined,
    })
  })

  const built = new Map<number, CustomChipLibraryEntry['definition']>()
  const building = new Set<number>()

  const build = (id: number): CustomChipLibraryEntry['definition'] => {
    const done = built.get(id)
    if (done) return done
    if (building.has(id)) {
      throw new Error(`O chip customizado ${id} participa de uma hierarquia circular.`)
    }
    const source = sources.get(id)
    if (!source) throw new Error(`O chip customizado ${id} foi referenciado mas não veio na biblioteca.`)

    building.add(id)
    const children: CustomChipLibraryEntry[] = []
    for (const childId of childChipIds(source.document)) {
      children.push({ id: childId, definition: build(childId) })
    }
    const definition = buildCustomChipDefinition(source.document, source.name, { customChips: children })
    building.delete(id)
    built.set(id, definition)
    return definition
  }

  return [...sources.keys()].map((id) => ({ id, definition: build(id) }))
}

function childChipIds(document: CircuitDocument): number[] {
  const ids = new Set<number>()
  for (const node of document.nodes) {
    if (node.type !== 'custom-chip') continue
    const childId = node.options?.customChipId
    if (typeof childId === 'number') ids.add(childId)
  }
  return [...ids]
}

function expandCustomChipComponents(
  components: readonly ComponentSpec[],
  customChips: readonly CustomChipLibraryEntry[],
  watch: readonly string[],
): ComponentSpec[] {
  if (!components.some((component) => component.type === 'custom-chip')) return [...components]
  // ComponentSpec e CircuitDocument compartilham o mesmo union de componentes;
  // a validação do documento continua sendo a autoridade para tipos inválidos.
  const canonicalComponents = [...components]
  const document: CircuitDocument = {
    format: 'veritas-circuit',
    version: 1,
    name: 'MCP custom circuit',
    nodes: canonicalComponents.map((component) => ({
      id: component.id,
      type: component.type,
      position: { x: 0, y: 0 },
      ...(component.label ? { label: component.label } : {}),
      ...(component.options ? { options: component.options } : {}),
    })),
    connections: canonicalComponents.flatMap((component) => (component.inputs ?? []).map((input, port) => ({
      source: { node: input.node, ...(input.port === undefined ? {} : { port: input.port }) },
      target: { node: component.id, port },
    }))),
  }
  const expanded = elaborateCustomChipDocument(document, { customChips })
  const incoming = new Map<string, Array<{ node: string; port?: number }>>()
  for (const connection of expanded.connections) {
    const inputs = incoming.get(connection.target.node) ?? []
    inputs[connection.target.port] = {
      node: connection.source.node,
      ...(connection.source.port === undefined ? {} : { port: connection.source.port }),
    }
    incoming.set(connection.target.node, inputs)
  }
  const result: ComponentSpec[] = expanded.nodes.map((node) => {
    const type = node.type === 'input' && node.options?.customChipBoundary === 'internal' ? 'output' : node.type
    return {
      id: node.id,
      type,
      ...(node.label ? { label: node.label } : {}),
      ...(node.options ? { options: node.options } : {}),
      ...(incoming.has(node.id) ? { inputs: (incoming.get(node.id) ?? []).filter(Boolean) } : {}),
    }
  })
  const entries = new Map(customChips.map((entry) => [entry.id, entry] as const))
  for (const component of canonicalComponents) {
    if (component.type !== 'custom-chip' || !watch.includes(component.id)) continue
    const entry = entries.get(component.options?.customChipId ?? NaN)
    const output = entry?.definition.outputs[0]
    if (!entry || !output) continue
    result.push({
      id: component.id,
      type: 'output',
      label: component.label,
      inputs: [{ node: `${component.id}__${output.id}` }],
    })
  }
  return result
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export interface SimulationStep {
  /** Valores a aplicar nos pinos de entrada antes de rodar os tiques. */
  set?: Record<string, boolean>
  ticks?: number
}

/** Teto de tiques por chamada, para não deixar o servidor rodando à toa. */
export const MAX_SIMULATION_TICKS = 1000

/**
 * Roda um circuito por alguns tiques e devolve o diagrama de tempo.
 *
 * É o que dá acesso à parte sequencial do Veritas: clock, flip-flops e atrasos,
 * que a tabela verdade não consegue descrever porque a saída deles depende do
 * que aconteceu antes.
 */
function resolveWirelessComponentInputs(components: readonly ComponentSpec[]): ComponentSpec[] {
  const resolution = resolveWirelessChannels(
    components
      .filter((component) => component.type === 'transmitter' || component.type === 'receiver')
      .map((component) => ({
        nodeId: component.id,
        channel: component.options?.channel ?? '',
        kind: component.type as 'transmitter' | 'receiver',
        width: component.options?.width ?? 1,
      })),
  )
  if (resolution.issues.length > 0) throw new Error(resolution.issues.map((issue) => issue.message).join(' '))

  const wirelessByReceiver = new Map(
    resolution.channels.flatMap((channel) => channel.receivers.map((receiver) => [
      receiver.nodeId,
      { node: channel.transmitter.nodeId },
    ] as const)),
  )
  return components.map((component) => component.type === 'receiver'
    ? { ...component, inputs: [wirelessByReceiver.get(component.id)!] }
    : component)
}

export function simulateCircuit(
  components: ComponentSpec[],
  steps: SimulationStep[],
  watch: string[],
  options: SimulateCircuitOptions = {},
): ToolResult {
  const total = steps.reduce((sum, step) => sum + (step.ticks ?? 1), 0)
  if (total > MAX_SIMULATION_TICKS) {
    return {
      isError: true,
      text: `São ${total} tiques no total; o limite por chamada é ${MAX_SIMULATION_TICKS}.`,
    }
  }

  let simulator: Simulator
  let resolvedComponents: ComponentSpec[]
  try {
    const customChips = normalizeCustomChipLibrary(options.customChips)
    const expandedComponents = expandCustomChipComponents(components, customChips, watch)
    resolvedComponents = resolveWirelessComponentInputs(expandedComponents)
    simulator = new Simulator({ components: resolvedComponents })
  } catch (error) {
    return {
      isError: true,
      text: error instanceof Error ? error.message : 'Circuito inválido.',
    }
  }

  const known = new Set(resolvedComponents.map((component) => component.id))
  const unknown = watch.filter((id) => !known.has(id))
  if (unknown.length > 0) {
    return { isError: true, text: `Não existem no circuito: ${unknown.join(', ')}.` }
  }

  const observed = watch.length > 0 ? watch : resolvedComponents.map((component) => component.id)
  const rows: string[] = []
  const record = (tick: number, note: string) => {
    const values = observed.map((id) => (simulator.read(id) ? '1' : '0'))
    rows.push(`| ${tick} | ${values.join(' | ')} | ${note} |`)
  }

  record(0, 'início')

  try {
    for (const step of steps) {
      const changes = Object.entries(step.set ?? {})
      for (const [id, value] of changes) simulator.setInput(id, value)

      const note = changes.length
        ? changes.map(([id, value]) => `${id}=${value ? 1 : 0}`).join(', ')
        : ''

      const ticks = step.ticks ?? 1
      for (let index = 0; index < ticks; index += 1) {
        simulator.tick()
        record(simulator.tickCount, index === 0 ? note : '')
      }
    }
  } catch (error) {
    return {
      isError: true,
      text: error instanceof Error ? error.message : 'Falha ao simular.',
    }
  }

  return {
    text: [
      `| tique | ${observed.join(' | ')} | evento |`,
      `| --- | ${observed.map(() => '---').join(' | ')} | --- |`,
      ...rows,
    ].join('\n'),
  }
}
