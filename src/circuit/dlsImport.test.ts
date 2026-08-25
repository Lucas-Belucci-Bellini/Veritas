import { describe, expect, it } from 'vitest'
import { buildCustomChipDefinition, type CustomChipLibraryEntry } from './customChip'
import { buildDlsChipDocument, createDlsImportRun, planDlsImport, type DlsChip } from './dlsImport'
import { evaluateCircuit } from './evaluate'
import type { CircuitDocument } from './editorModel'
import notChip from './__fixtures__/dls/NOT.json'
import xorChip from './__fixtures__/dls/XOR.json'

/** Um chip do DLS enxuto: só os campos que a importação lê. */
function chip(name: string, parts: Partial<DlsChip> = {}): DlsChip {
  return { Name: name, InputPins: [], OutputPins: [], SubChips: [], Wires: [], ...parts }
}

function pin(id: number, name = 'IN', bits?: number) {
  return { ID: id, Name: name, ...(bits === undefined ? {} : { BitCount: bits }) }
}

function wire(sourceOwner: number, sourcePin: number, targetOwner: number, targetPin: number) {
  return {
    SourcePinAddress: { PinOwnerID: sourceOwner, PinID: sourcePin },
    TargetPinAddress: { PinOwnerID: targetOwner, PinID: targetPin },
  }
}

/** NOT escrito à mão: um NAND com as duas entradas no mesmo pino. */
const inversor = chip('Inversor', {
  InputPins: [pin(10, 'A')],
  OutputPins: [pin(20, 'Y')],
  SubChips: [{ ID: 30, Name: 'NAND' }],
  Wires: [wire(10, 0, 30, 0), wire(10, 0, 30, 1), wire(30, 2, 20, 0)],
})

describe('plano de importação', () => {
  it('põe o filho antes de quem o usa', () => {
    const pai = chip('Par', {
      InputPins: [pin(1, 'A')],
      OutputPins: [pin(2, 'Y')],
      SubChips: [{ ID: 3, Name: 'Inversor' }],
      Wires: [wire(1, 0, 3, 10), wire(3, 20, 2, 0)],
    })
    // A ordem de entrada é a errada de propósito: o pai vem primeiro.
    const plan = planDlsImport([pai, inversor])
    expect(plan.order.map((step) => step.name)).toEqual(['Inversor', 'Par'])
    expect(plan.order[1].dependencies).toEqual(['Inversor'])
    expect(plan.refused).toEqual([])
  })

  it('recusa pino multi-bit dizendo qual e de quantos bits', () => {
    const plan = planDlsImport([chip('Barramento', {
      InputPins: [pin(1, 'DADOS', 8)],
      OutputPins: [pin(2, 'Y')],
    })])
    expect(plan.order).toEqual([])
    expect(plan.refused).toEqual([
      { name: 'Barramento', reason: 'O pino "DADOS" tem 8 bits, e esta versão liga só sinais de 1 bit.' },
    ])
  })

  it('recusa componente que o Veritas não tem, nomeando ele', () => {
    const plan = planDlsImport([chip('Memoria', {
      InputPins: [pin(1)],
      OutputPins: [pin(2)],
      SubChips: [{ ID: 3, Name: 'ROM 256×16' }],
    })])
    expect(plan.refused[0].reason).toBe(
      'Usa "ROM 256×16", um componente do Digital Logic Sim que o Veritas ainda não tem.',
    )
  })

  it('recusa quem depende de um chip recusado, dizendo de quem depende', () => {
    const quebrado = chip('Quebrado', { InputPins: [pin(1, 'D', 4)], OutputPins: [pin(2)] })
    const usuario = chip('Usuario', {
      InputPins: [pin(1)],
      OutputPins: [pin(2)],
      SubChips: [{ ID: 3, Name: 'Quebrado' }],
    })
    const plan = planDlsImport([quebrado, usuario])
    expect(plan.order).toEqual([])
    const motivos = Object.fromEntries(plan.refused.map((r) => [r.name, r.reason]))
    expect(motivos.Usuario).toBe('Depende de "Quebrado", que não pôde ser importado.')
  })

  it('recusa um ciclo mostrando a corrente inteira', () => {
    const a = chip('A', { InputPins: [pin(1)], OutputPins: [pin(2)], SubChips: [{ ID: 3, Name: 'B' }] })
    const b = chip('B', { InputPins: [pin(1)], OutputPins: [pin(2)], SubChips: [{ ID: 3, Name: 'A' }] })
    const plan = planDlsImport([a, b])
    expect(plan.order).toEqual([])
    expect(plan.refused.every((r) => r.reason.includes('ciclo de dependência'))).toBe(true)
    expect(plan.refused[0].reason).toContain('A → B → A')
  })

  it('recusa nome repetido em vez de escolher um por acaso', () => {
    const plan = planDlsImport([inversor, { ...inversor }])
    expect(plan.refused).toEqual([
      { name: 'Inversor', reason: 'Há mais de um chip com este nome na seleção.' },
    ])
    expect(plan.order.map((step) => step.name)).toEqual(['Inversor'])
  })

  it('recusa um arquivo que não é chip do DLS, dizendo o que faltou', () => {
    const plan = planDlsImport([{ qualquer: 'coisa' }])
    expect(plan.refused).toEqual([
      { name: 'arquivo 1', reason: 'O arquivo não tem o campo "Name" de um chip do Digital Logic Sim.' },
    ])
  })
})

describe('conversão para documento', () => {
  it('transcreve pinos, NAND e fios', () => {
    const document = buildDlsChipDocument(
      planDlsImport([inversor]).order[0],
      new Map(),
      new Map([['Inversor', inversor]]),
    )
    expect(document.name).toBe('Inversor')
    expect(document.nodes.map((node) => [node.id, node.type, node.label])).toEqual([
      ['in-00', 'input', 'A'],
      ['out-00', 'output', 'Y'],
      ['sub-00', 'nand', 'NAND'],
    ])
    expect(document.connections).toEqual([
      { source: { node: 'in-00' }, target: { node: 'sub-00', port: 0 } },
      { source: { node: 'in-00' }, target: { node: 'sub-00', port: 1 } },
      { source: { node: 'sub-00' }, target: { node: 'out-00', port: 0 } },
    ])
  })

  it('o sub-chip vira instância apontando para o ID que o filho recebeu', () => {
    const pai = chip('Par', {
      InputPins: [pin(1, 'A')],
      OutputPins: [pin(2, 'Y')],
      SubChips: [{ ID: 3, Name: 'Inversor', Label: 'INV' }],
      Wires: [wire(1, 0, 3, 10), wire(3, 20, 2, 0)],
    })
    const plan = planDlsImport([pai, inversor])
    const document = buildDlsChipDocument(
      plan.order[1],
      new Map([['Inversor', 7]]),
      new Map([['Inversor', inversor], ['Par', pai]]),
    )
    const instancia = document.nodes.find((node) => node.type === 'custom-chip')
    expect(instancia).toMatchObject({ id: 'sub-00', label: 'INV', options: { customChipId: 7 } })
  })

  it('explica quando o filho ainda não está na biblioteca', () => {
    const pai = chip('Par', {
      InputPins: [pin(1)], OutputPins: [pin(2)], SubChips: [{ ID: 3, Name: 'Inversor' }],
    })
    const plan = planDlsImport([pai, inversor])
    expect(() => buildDlsChipDocument(plan.order[1], new Map(), new Map([['Inversor', inversor]])))
      .toThrow('O chip "Inversor", usado por "Par", ainda não está na biblioteca.')
  })

  /**
   * O índice de porta de uma instância é a posição em `definition.inputs`, que
   * sai ordenada por ID. Os IDs gerados aqui levam zeros à esquerda justamente
   * para essa ordem coincidir com a ordem em que o autor declarou os pinos —
   * sem isso, o pino 10 entraria antes do pino 2.
   */
  it('mantém a ordem declarada dos pinos além do décimo', () => {
    const largo = chip('Largo', {
      InputPins: Array.from({ length: 12 }, (_, index) => pin(100 + index, `A${index}`)),
      OutputPins: Array.from({ length: 12 }, (_, index) => pin(200 + index, `Y${index}`)),
      Wires: Array.from({ length: 12 }, (_, index) => wire(100 + index, 0, 200 + index, 0)),
    })
    const plan = planDlsImport([largo])
    const document = buildDlsChipDocument(plan.order[0], new Map(), new Map([['Largo', largo]]))
    const definition = buildCustomChipDefinition(document, 'Largo')
    expect(definition.inputs.map((port) => port.name)).toEqual(
      Array.from({ length: 12 }, (_, index) => `A${index}`),
    )
    expect(definition.outputs.map((port) => port.name)).toEqual(
      Array.from({ length: 12 }, (_, index) => `Y${index}`),
    )
  })
})

describe('cascata durante a importação', () => {
  it('derruba quem dependia de um chip que o Veritas rejeitou', () => {
    const pai = chip('Par', {
      InputPins: [pin(1)], OutputPins: [pin(2)],
      SubChips: [{ ID: 3, Name: 'Inversor' }],
      Wires: [wire(1, 0, 3, 10), wire(3, 20, 2, 0)],
    })
    const run = createDlsImportRun(planDlsImport([pai, inversor]))

    const primeiro = run.next()!
    expect(primeiro.name).toBe('Inversor')
    run.failed(primeiro, 'O circuito pode ter no máximo 256 componentes.')

    // O pai nem chega a ser oferecido: sem o filho, não há o que construir.
    expect(run.next()).toBeNull()
    const report = run.report()
    expect(report.imported).toEqual([])
    expect(report.refused).toEqual([
      { name: 'Inversor', reason: 'O circuito pode ter no máximo 256 componentes.' },
      { name: 'Par', reason: 'Depende de "Inversor", que não pôde ser importado.' },
    ])
  })
})

describe('arquivos reais do Digital Logic Sim', () => {
  it('importa o XOR com a hierarquia do autor e a tabela verdade certa', () => {
    const plan = planDlsImport([xorChip, notChip])
    // O NOT precisa existir antes do XOR, que o usa.
    expect(plan.order.map((step) => step.name)).toEqual(['NOT', 'XOR'])
    expect(plan.refused).toEqual([])

    const run = createDlsImportRun(plan)
    const library: CustomChipLibraryEntry[] = []
    const documents = new Map<string, CircuitDocument>()
    let nextId = 1
    for (let step = run.next(); step; step = run.next()) {
      const document = run.document(step)
      const definition = buildCustomChipDefinition(document, step.name, { customChips: library })
      library.push({ id: nextId, definition })
      documents.set(step.name, document)
      run.succeeded(step, nextId)
      nextId += 1
    }

    const xor = documents.get('XOR')!
    // O XOR do autor é feito de NANDs e NOTs — não de uma porta XOR nativa.
    expect(xor.nodes.filter((node) => node.type === 'nand')).toHaveLength(3)
    expect(xor.nodes.filter((node) => node.type === 'custom-chip')).toHaveLength(2)
    expect(xor.nodes.some((node) => node.type === 'xor')).toBe(false)

    const [a, b] = xor.nodes.filter((node) => node.type === 'input').map((node) => node.id)
    const saida = xor.nodes.find((node) => node.type === 'output')!.id
    const tabela = [[false, false], [false, true], [true, false], [true, true]].map(([x, y]) =>
      evaluateCircuit(xor, { [a]: x, [b]: y }, { customChips: library }).values[saida]?.[0],
    )
    expect(tabela).toEqual([false, true, true, false])
  })
})
