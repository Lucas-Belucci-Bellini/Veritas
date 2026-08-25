import { describe, expect, it } from 'vitest'
import { buildCustomChipDefinition } from './customChip'
import type { CircuitDocument } from './editorModel'
import { createDocumentRuntime } from '../simulation/documentRuntime'

/**
 * Os IDs do editor são `input-1`, `input-2`, … numerados pelo total de nós, e
 * `"input-11"` vem *antes* de `"input-2"` na ordenação textual. Ou seja: basta
 * o autor acrescentar um pino depois do nono componente para a ordem do
 * documento discordar da ordem por ID. Enquanto a elaboração usava a ordem do
 * documento e o resto do sistema usava a ordem por ID, o sinal entrava numa
 * porta e saía por outra — sem erro nenhum, só o valor errado.
 */

function instantiate(document: CircuitDocument, definition: ReturnType<typeof buildCustomChipDefinition>) {
  return createDocumentRuntime(document, { customChips: [{ id: 1, definition }] })
}

describe('ordem dos pinos de um chip customizado', () => {
  it('a porta de entrada k liga no pino que definition.inputs[k] declara', () => {
    // A saída copia apenas `input-11`, que é o *segundo* nó do documento mas o
    // *primeiro* pino por ID.
    const chip: CircuitDocument = {
      format: 'veritas-circuit', version: 1, name: 'entradas',
      nodes: [
        { id: 'input-2', type: 'input', position: { x: 0, y: 0 }, label: 'SEGUNDO' },
        { id: 'input-11', type: 'input', position: { x: 0, y: 60 }, label: 'DECIMO' },
        { id: 'o', type: 'output', position: { x: 120, y: 0 }, label: 'OUT' },
      ],
      connections: [{ source: { node: 'input-11', port: 0 }, target: { node: 'o', port: 0 } }],
    }
    const definition = buildCustomChipDefinition(chip, 'Entradas')
    expect(definition.inputs.map((port) => port.id)).toEqual(['input-11', 'input-2'])

    const document: CircuitDocument = {
      format: 'veritas-circuit', version: 1, name: 'usa',
      nodes: [
        { id: 'a', type: 'input', position: { x: 0, y: 0 } },
        { id: 'b', type: 'input', position: { x: 0, y: 60 } },
        { id: 'chip', type: 'custom-chip', position: { x: 120, y: 0 }, options: { customChipId: 1 } },
        { id: 'q', type: 'output', position: { x: 260, y: 0 } },
      ],
      connections: [
        { source: { node: 'a', port: 0 }, target: { node: 'chip', port: 0 } },
        { source: { node: 'b', port: 0 }, target: { node: 'chip', port: 1 } },
        { source: { node: 'chip', port: 0 }, target: { node: 'q', port: 0 } },
      ],
    }

    const simulator = instantiate(document, definition)
    // Porta 0 é `input-11`, o pino que a saída copia.
    simulator.setInput('a', true)
    simulator.setInput('b', false)
    simulator.tick(10)
    expect(simulator.read('q')).toBe(true)

    // Porta 1 é `input-2`, que não vai a lugar nenhum.
    simulator.setInput('a', false)
    simulator.setInput('b', true)
    simulator.tick(10)
    expect(simulator.read('q')).toBe(false)
  })

  it('a porta de saída k vem do pino que definition.outputs[k] declara', () => {
    // `output-12` é o segundo nó do documento e o primeiro pino por ID.
    const chip: CircuitDocument = {
      format: 'veritas-circuit', version: 1, name: 'saidas',
      nodes: [
        { id: 'i', type: 'input', position: { x: 0, y: 0 }, label: 'IN' },
        { id: 'inv', type: 'not', position: { x: 60, y: 0 } },
        { id: 'output-3', type: 'output', position: { x: 140, y: 0 }, label: 'INVERTIDA' },
        { id: 'output-12', type: 'output', position: { x: 140, y: 60 }, label: 'DIRETA' },
      ],
      connections: [
        { source: { node: 'i', port: 0 }, target: { node: 'inv', port: 0 } },
        { source: { node: 'inv', port: 0 }, target: { node: 'output-3', port: 0 } },
        { source: { node: 'i', port: 0 }, target: { node: 'output-12', port: 0 } },
      ],
    }
    const definition = buildCustomChipDefinition(chip, 'Saidas')
    expect(definition.outputs.map((port) => port.id)).toEqual(['output-12', 'output-3'])

    const document: CircuitDocument = {
      format: 'veritas-circuit', version: 1, name: 'usa',
      nodes: [
        { id: 'd', type: 'input', position: { x: 0, y: 0 } },
        { id: 'chip', type: 'custom-chip', position: { x: 120, y: 0 }, options: { customChipId: 1 } },
        { id: 'direta', type: 'output', position: { x: 260, y: 0 } },
        { id: 'invertida', type: 'output', position: { x: 260, y: 60 } },
      ],
      connections: [
        { source: { node: 'd', port: 0 }, target: { node: 'chip', port: 0 } },
        { source: { node: 'chip', port: 0 }, target: { node: 'direta', port: 0 } },
        { source: { node: 'chip', port: 1 }, target: { node: 'invertida', port: 0 } },
      ],
    }

    const simulator = instantiate(document, definition)
    simulator.setInput('d', true)
    simulator.tick(10)
    // Porta 0 = `output-12` = o sinal direto; porta 1 = `output-3` = o invertido.
    expect(simulator.read('direta')).toBe(true)
    expect(simulator.read('invertida')).toBe(false)

    simulator.setInput('d', false)
    simulator.tick(10)
    expect(simulator.read('direta')).toBe(false)
    expect(simulator.read('invertida')).toBe(true)
  })

  it('a ordem se mantém quando o chip está dentro de outro chip', () => {
    const interno: CircuitDocument = {
      format: 'veritas-circuit', version: 1, name: 'interno',
      nodes: [
        { id: 'input-2', type: 'input', position: { x: 0, y: 0 }, label: 'IGNORADO' },
        { id: 'input-11', type: 'input', position: { x: 0, y: 60 }, label: 'USADO' },
        { id: 'o', type: 'output', position: { x: 120, y: 0 }, label: 'OUT' },
      ],
      connections: [{ source: { node: 'input-11', port: 0 }, target: { node: 'o', port: 0 } }],
    }
    const internoDefinition = buildCustomChipDefinition(interno, 'Interno')

    // O chip de fora tem os pinos já em ordem — assim a permutação do de dentro
    // não encontra outra igual para se cancelar contra.
    const externo: CircuitDocument = {
      format: 'veritas-circuit', version: 1, name: 'externo',
      nodes: [
        { id: 'alfa', type: 'input', position: { x: 0, y: 0 }, label: 'ALFA' },
        { id: 'beta', type: 'input', position: { x: 0, y: 60 }, label: 'BETA' },
        { id: 'dentro', type: 'custom-chip', position: { x: 120, y: 0 }, options: { customChipId: 1 } },
        { id: 'o', type: 'output', position: { x: 260, y: 0 }, label: 'OUT' },
      ],
      connections: [
        { source: { node: 'alfa', port: 0 }, target: { node: 'dentro', port: 0 } },
        { source: { node: 'beta', port: 0 }, target: { node: 'dentro', port: 1 } },
        { source: { node: 'dentro', port: 0 }, target: { node: 'o', port: 0 } },
      ],
    }
    const externoDefinition = buildCustomChipDefinition(externo, 'Externo', {
      customChips: [{ id: 1, definition: internoDefinition }],
    })
    expect(externoDefinition.inputs.map((port) => port.id)).toEqual(['alfa', 'beta'])

    const document: CircuitDocument = {
      format: 'veritas-circuit', version: 1, name: 'usa',
      nodes: [
        { id: 'a', type: 'input', position: { x: 0, y: 0 } },
        { id: 'b', type: 'input', position: { x: 0, y: 60 } },
        { id: 'chip', type: 'custom-chip', position: { x: 120, y: 0 }, options: { customChipId: 2 } },
        { id: 'q', type: 'output', position: { x: 260, y: 0 } },
      ],
      connections: [
        { source: { node: 'a', port: 0 }, target: { node: 'chip', port: 0 } },
        { source: { node: 'b', port: 0 }, target: { node: 'chip', port: 1 } },
        { source: { node: 'chip', port: 0 }, target: { node: 'q', port: 0 } },
      ],
    }

    const simulator = createDocumentRuntime(document, {
      customChips: [
        { id: 1, definition: internoDefinition },
        { id: 2, definition: externoDefinition },
      ],
    })
    // `a` → porta 0 do externo → `alfa` → porta 0 do interno → `input-11`, o pino usado.
    simulator.setInput('a', true)
    simulator.setInput('b', false)
    simulator.tick(12)
    expect(simulator.read('q')).toBe(true)

    simulator.setInput('a', false)
    simulator.setInput('b', true)
    simulator.tick(12)
    expect(simulator.read('q')).toBe(false)
  })
})
