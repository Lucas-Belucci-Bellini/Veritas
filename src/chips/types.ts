/** Formato do catálogo gerado por `scripts/import-dls-chips.mjs`. */

export interface ChipOutput {
  name: string
  /** Expressão booleana mínima, ou null quando ficou grande demais. */
  expression: string | null
  /** Coluna da tabela verdade, embarcada só para chips pequenos. */
  pattern?: string
}

export interface ChipEntry {
  name: string
  category: string
  /** Quantidade de pinos de entrada e de saída. */
  in: number
  out: number
  /** Nomes dos pinos, presentes apenas em chips com poucos pinos. */
  pins?: { in: string[]; out: string[] }
  /** Larguras de barramento diferentes de 1 bit, quando houver. */
  widths?: number[]
  /** Componentes internos mais usados, do mais frequente para o menos. */
  parts: Record<string, number>
  partCount: number
  wireCount: number
  /** Variáveis usadas nas expressões derivadas (A, B, C...). */
  variables?: string[]
  derivedOutputs?: ChipOutput[]
}

export interface ChipCatalog {
  source: string
  generatedAt: string
  total: number
  derived: number
  chips: ChipEntry[]
}

let cached: Promise<ChipCatalog> | null = null

/**
 * O catálogo tem centenas de kilobytes, então ele é buscado sob demanda —
 * quem só quer a tabela verdade nunca paga por esse download.
 */
export function loadCatalog(): Promise<ChipCatalog> {
  cached ??= import('./catalog.json').then(
    (module) => (module.default ?? module) as unknown as ChipCatalog,
  )
  return cached
}
