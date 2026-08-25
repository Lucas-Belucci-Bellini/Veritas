import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCustomChipDefinition, type CustomChipLibraryEntry } from '../src/circuit/customChip'
import { createDlsImportRun, planDlsImport } from '../src/circuit/dlsImport'
import { evaluateCircuit } from '../src/circuit/evaluate'
import type { CircuitDocument } from '../src/circuit/editorModel'
import catalog from '../src/chips/catalog.json'

/**
 * Confere o importador contra uma biblioteca inteira do Digital Logic Sim.
 *
 * Não roda por padrão: aponte `VERITAS_DLS_CHIPS` para a pasta `Chips` de um
 * projeto do DLS.
 *
 *     VERITAS_DLS_CHIPS=~/UMBRA-LIMA-ALFA/Chips npm test
 *
 * O valor está no cruzamento. O `catalog.json` foi gerado por outro caminho —
 * simular o chip em todas as combinações e destilar a expressão booleana de
 * cada saída. Este teste transcreve a netlist e roda pelo simulador do próprio
 * Veritas. São duas implementações independentes: se concordam na tabela
 * verdade de centenas de chips, o erro teria que estar nas duas, do mesmo
 * jeito, no mesmo chip.
 */

const CHIPS = process.env.VERITAS_DLS_CHIPS

/** Acima disto a tabela verdade completa custa mais do que informa. */
const MAX_CROSS_CHECK_INPUTS = 6

interface CatalogEntry {
  name: string
  derivedOutputs?: { name: string; pattern?: string }[]
}

describe.skipIf(!CHIPS || !existsSync(CHIPS))('biblioteca do Digital Logic Sim', () => {
  it('importa a biblioteca e bate com as tabelas verdade já derivadas', () => {
    const sources = readdirSync(CHIPS!)
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(readFileSync(join(CHIPS!, name), 'utf8')))

    const run = createDlsImportRun(planDlsImport(sources))
    const library: CustomChipLibraryEntry[] = []
    const documents = new Map<string, CircuitDocument>()
    let nextId = 1

    for (let step = run.next(); step; step = run.next()) {
      try {
        const document = run.document(step)
        // O mesmo caminho que o app percorre ao salvar: quem valida é o Veritas.
        const definition = buildCustomChipDefinition(document, step.name, { customChips: library })
        library.push({ id: nextId, definition })
        documents.set(step.name, document)
        run.succeeded(step, nextId)
        nextId += 1
      } catch (error) {
        run.failed(step, error instanceof Error ? error.message : String(error))
      }
    }

    const report = run.report()
    const grouped = new Map<string, number>()
    for (const refusal of report.refused) {
      const kind = refusal.reason.replace(/"[^"]*"/g, '"…"').replace(/\d+/g, 'N').slice(0, 90)
      grouped.set(kind, (grouped.get(kind) ?? 0) + 1)
    }
    console.log(`\nimportados: ${report.imported.length} de ${sources.length}`)
    for (const [reason, count] of [...grouped].sort((a, b) => b[1] - a[1])) {
      console.log(`  recusados ${String(count).padStart(4)}  ${reason}`)
    }

    const catalogued = new Map(
      (catalog as { chips: CatalogEntry[] }).chips.map((entry) => [entry.name, entry] as const),
    )
    const byName = new Map(sources.map((chip) => [chip.Name, chip] as const))
    const divergences: string[] = []
    let crossChecked = 0

    for (const [name, document] of documents) {
      const patterns = catalogued.get(name)?.derivedOutputs?.map((output) => output.pattern)
      if (!patterns || patterns.some((pattern) => typeof pattern !== 'string')) continue
      const inputCount = byName.get(name)?.InputPins?.length ?? 0
      if (inputCount === 0 || inputCount > MAX_CROSS_CHECK_INPUTS) continue

      const inputIds = document.nodes.filter((node) => node.type === 'input').map((node) => node.id)
      const outputIds = document.nodes.filter((node) => node.type === 'output').map((node) => node.id)
      const columns = outputIds.map(() => [] as string[])

      for (let row = 0; row < 2 ** inputCount; row += 1) {
        const inputs: Record<string, boolean> = {}
        // Mesma convenção do catálogo: o primeiro pino é o bit mais significativo.
        inputIds.forEach((id, index) => {
          inputs[id] = ((row >> (inputCount - 1 - index)) & 1) === 1
        })
        const values = evaluateCircuit(document, inputs, { customChips: library }).values
        outputIds.forEach((id, index) => columns[index].push(values[id]?.[0] ? '1' : '0'))
      }

      crossChecked += 1
      const mine = columns.map((column) => column.join(''))
      if (mine.join('|') !== patterns.join('|')) {
        divergences.push(`${name}: catálogo ${patterns.join('|')} · importado ${mine.join('|')}`)
      }
    }

    console.log(`cruzados com o catálogo: ${crossChecked}`)
    expect(divergences).toEqual([])
    expect(report.imported.length).toBeGreaterThan(0)
    expect(crossChecked).toBeGreaterThan(0)
  }, 600_000)
})
