#!/usr/bin/env node
/**
 * Importa a biblioteca de chips do Digital Logic Sim para dentro do Veritas.
 *
 * Cada chip do DLS é uma netlist: pinos de entrada, pinos de saída, sub-chips e
 * fios. O script resolve essa netlist recursivamente, simula o chip em todas as
 * combinações de entrada e destila cada saída em uma expressão booleana mínima
 * (Quine-McCluskey + cobertura gulosa) que a calculadora entende.
 *
 * Uso: node scripts/import-dls-chips.mjs [pasta-dos-chips] [saida.json]
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
// O mesmo minimizador que o site usa, empacotado por `npm run build:lib`.
import { minimizeColumn } from '../dist-lib/veritas-engine.js'

const here = dirname(fileURLToPath(import.meta.url))
const chipsDir = resolvePath(
  process.argv[2] ?? join(here, '..', '..', 'UMBRA-LIMA-ALFA', 'Chips'),
)
const outFile = resolvePath(
  process.argv[3] ?? join(here, '..', 'src', 'chips', 'catalog.json'),
)

/** Portas nativas do DLS que sabemos simular. */
const BUILTIN_GATES = {
  NAND: { inputs: 2, apply: ([a, b]) => (a && b ? 0 : 1) },
  Nand: { inputs: 2, apply: ([a, b]) => (a && b ? 0 : 1) },
  AND: { inputs: 2, apply: ([a, b]) => (a && b ? 1 : 0) },
  OR: { inputs: 2, apply: ([a, b]) => (a || b ? 1 : 0) },
  XOR: { inputs: 2, apply: ([a, b]) => (a !== b ? 1 : 0) },
  NOT: { inputs: 1, apply: ([a]) => (a ? 0 : 1) },
}

/** Teto de entradas simuladas por chip (2^10 = 1024 casos). */
const MAX_SIMULATED_INPUTS = 10
const MAX_EXPRESSION_TERMS = 24

const VARIABLE_NAMES = 'ABCDEGHIJKLMNPQRSTUVWXYZ'.split('')

function main() {
  const files = readdirSync(chipsDir).filter((name) => name.endsWith('.json'))
  const definitions = new Map()

  for (const file of files) {
    try {
      const chip = JSON.parse(readFileSync(join(chipsDir, file), 'utf8'))
      if (chip && typeof chip.Name === 'string') definitions.set(chip.Name, chip)
    } catch (error) {
      console.warn(`  ! ${file}: ${error.message}`)
    }
  }

  console.log(`Lendo ${definitions.size} chips de ${chipsDir}`)

  const resolver = createResolver(definitions)
  const entries = []
  let derived = 0

  for (const [name, chip] of [...definitions].sort((a, b) => a[0].localeCompare(b[0]))) {
    const entry = describeChip(name, chip)
    const analysis = analyseChip(name, chip, resolver)
    if (analysis) {
      entry.variables = analysis.variables
      entry.derivedOutputs = analysis.outputs
      derived += 1
    }
    entries.push(entry)
  }

  const catalog = {
    source: 'Digital Logic Sim — projeto UMBRA LIMA ALFA',
    generatedAt: new Date().toISOString().slice(0, 10),
    total: entries.length,
    derived,
    chips: entries,
  }

  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, `${JSON.stringify(catalog)}\n`)
  console.log(`${derived}/${entries.length} chips com expressão derivada`)
  console.log(`Catálogo escrito em ${outFile}`)
}

/** Quantos tipos de componente listamos por chip antes de resumir. */
const MAX_LISTED_PARTS = 6
/** Acima deste total de pinos paramos de listar nomes um a um. */
const MAX_LISTED_PINS = 12
/** Acima disso a coluna da tabela verdade fica grande demais para embarcar. */
const MAX_PATTERN_INPUTS = 6

function describeChip(name, chip) {
  const counts = {}
  for (const sub of chip.SubChips ?? []) {
    counts[sub.Name] = (counts[sub.Name] ?? 0) + 1
  }
  const parts = Object.fromEntries(
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_LISTED_PARTS),
  )

  const inputPins = chip.InputPins ?? []
  const outputPins = chip.OutputPins ?? []

  const entry = {
    name,
    category: categorise(name),
    in: inputPins.length,
    out: outputPins.length,
    parts,
    partCount: (chip.SubChips ?? []).length,
    wireCount: (chip.Wires ?? []).length,
  }

  // Os nomes dos pinos só ajudam em chips pequenos; num somador de 32 bits são
  // 65 repetições de "IN" que só engordariam o pacote.
  if (inputPins.length + outputPins.length <= MAX_LISTED_PINS) {
    entry.pins = {
      in: inputPins.map((pin) => pin.Name),
      out: outputPins.map((pin) => pin.Name),
    }
  }

  const widths = [...inputPins, ...outputPins].map((pin) => pin.BitCount ?? 1)
  if (widths.some((bits) => bits !== 1)) {
    entry.widths = [...new Set(widths)].sort((a, b) => a - b)
  }

  return entry
}

const CATEGORY_RULES = [
  [/BANK/i, 'Bancos de portas'],
  [/^(AND|OR|NOT|NAND|NOR|XOR|XNOR)(-\d+|\s.*)?$/i, 'Portas lógicas'],
  [/(adder|somador|^\d*-?ADD)/i, 'Somadores'],
  [/(subtractor|SUB)/i, 'Subtratores'],
  [/(MULT|ULA|ALU|NEGATE)/i, 'Aritmética'],
  [/(MUX|SELECT)/i, 'Multiplexadores'],
  [/DEMUX/i, 'Demultiplexadores'],
  [/(REG|RAM|ROM|LATCH|FLIP)/i, 'Memória'],
  [/(EQ|NEQ|GT|GTE|LT|LTE|COMPARE|EQUAL)-?\d*/i, 'Comparadores'],
  [/(DEC|INC)-?\d+/i, 'Decodificadores'],
  [/(DELAY|RISE|COUNTER|LFSR|CLOCK|T-400)/i, 'Tempo e sequencial'],
  [/(SPLIT|MERGE|LONGIFY|BUFFER|3-STATE|bits)/i, 'Barramentos'],
  [/(COMPUTER|^ui$|Teste)/i, 'Projetos'],
]

function categorise(name) {
  for (const [pattern, category] of CATEGORY_RULES) {
    if (pattern.test(name)) return category
  }
  return 'Outros'
}

/**
 * Resolve um chip para uma função pura (entradas -> saídas), com memoização e
 * detecção de ciclo. Chips sequenciais e componentes não suportados devolvem
 * `null`.
 */
function createResolver(definitions) {
  const cache = new Map()
  const inProgress = new Set()

  function resolve(name) {
    if (cache.has(name)) return cache.get(name)
    if (inProgress.has(name)) return null // ciclo entre chips

    const chip = definitions.get(name)

    // A definição do projeto sempre vence: este projeto constrói o próprio
    // AND, OR, NOT e XOR a partir de NAND, e usar a porta nativa no lugar
    // deles faria os IDs dos pinos não baterem com os fios.
    if (!chip) {
      const gate = BUILTIN_GATES[name]
      if (!gate) return null
      return {
        inputPinIds: Array.from({ length: gate.inputs }, (_, i) => i),
        outputPinIds: [gate.inputs],
        run: (values) => [gate.apply(values)],
      }
    }

    inProgress.add(name)
    const compiled = compile(chip, resolve)
    inProgress.delete(name)
    cache.set(name, compiled)
    return compiled
  }

  return resolve
}

function pinKey(address) {
  return `${address.PinOwnerID}:${address.PinID}`
}

function compile(chip, resolve) {
  const inputPins = chip.InputPins ?? []
  const outputPins = chip.OutputPins ?? []
  const subChips = chip.SubChips ?? []

  if (inputPins.some((pin) => (pin.BitCount ?? 1) !== 1)) return null
  if (outputPins.some((pin) => (pin.BitCount ?? 1) !== 1)) return null

  const parts = new Map()
  for (const sub of subChips) {
    const compiled = resolve(sub.Name)
    if (!compiled) return null
    parts.set(sub.ID, { sub, compiled })
  }

  // driver[destino] = origem. Um pino só pode ter um alimentador.
  const driver = new Map()
  for (const wire of chip.Wires ?? []) {
    const target = pinKey(wire.TargetPinAddress)
    if (!driver.has(target)) driver.set(target, wire.SourcePinAddress)
  }

  return {
    inputPinIds: inputPins.map((pin) => pin.ID),
    outputPinIds: outputPins.map((pin) => pin.ID),
    run(values) {
      const inputValues = new Map()
      inputPins.forEach((pin, index) => inputValues.set(pin.ID, values[index] ?? 0))

      const memo = new Map()
      const visiting = new Set()
      let failed = false

      const runPart = (id) => {
        if (memo.has(id)) return memo.get(id)
        if (visiting.has(id)) {
          failed = true // realimentação: circuito sequencial
          return null
        }
        visiting.add(id)

        const part = parts.get(id)
        const inputs = part.compiled.inputPinIds.map((pinId) =>
          sourceValue(driver.get(`${id}:${pinId}`)),
        )
        const outputs = part.compiled.run(inputs)

        visiting.delete(id)
        memo.set(id, outputs)
        return outputs
      }

      /** Valor que sai de um pino de origem: entrada do chip ou saída de sub-chip. */
      function sourceValue(address) {
        if (!address) return 0
        if (inputValues.has(address.PinOwnerID)) return inputValues.get(address.PinOwnerID)

        const part = parts.get(address.PinOwnerID)
        if (!part) return 0

        const outputs = runPart(address.PinOwnerID)
        if (!outputs) return 0
        const index = part.compiled.outputPinIds.indexOf(address.PinID)
        return outputs[index >= 0 ? index : 0] ?? 0
      }

      const result = outputPins.map((pin) => sourceValue(driver.get(`${pin.ID}:0`)))
      return failed ? null : result
    },
  }
}

/** Simula o chip em todas as combinações e destila uma expressão por saída. */
function analyseChip(name, chip, resolve) {
  const compiled = resolve(name)
  if (!compiled) return null

  const inputPins = chip.InputPins ?? []
  const outputPins = chip.OutputPins ?? []
  if (inputPins.length === 0 || outputPins.length === 0) return null
  if (inputPins.length > MAX_SIMULATED_INPUTS) return null
  if (inputPins.some((pin) => (pin.BitCount ?? 1) !== 1)) return null
  if (outputPins.some((pin) => (pin.BitCount ?? 1) !== 1)) return null

  const variables = inputPins.map((_, index) => uniqueVariable(index))
  const rows = 2 ** inputPins.length
  const columns = outputPins.map(() => [])

  for (let row = 0; row < rows; row += 1) {
    const values = inputPins.map(
      (_, index) => (row >> (inputPins.length - 1 - index)) & 1,
    )
    const outputs = compiled.run(values)
    if (!outputs) return null
    outputs.forEach((value, index) => columns[index].push(value))
  }

  const outputs = outputPins.map((pin, index) => {
    const output = {
      name: pin.Name,
      expression: minimise(columns[index], variables),
    }
    // A coluna crua só vale a pena embarcar para chips pequenos; nos grandes a
    // interface recalcula a tabela a partir da expressão.
    if (inputPins.length <= MAX_PATTERN_INPUTS) {
      output.pattern = columns[index].join('')
    }
    return output
  })

  return { variables, outputs }
}

function uniqueVariable(index) {
  return VARIABLE_NAMES[index] ?? `X${index}`
}

/** Expressao minima da coluna, ou null quando ela tem termos demais para caber. */
function minimise(column, variables) {
  const { text, implicants } = minimizeColumn(column, variables)
  return implicants.length > MAX_EXPRESSION_TERMS ? null : text
}

main()
