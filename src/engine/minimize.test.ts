import { describe, expect, it } from 'vitest'
import { collectVariables } from './ast'
import { buildKarnaughMap, grayCode, KARNAUGH_MAX_VARIABLES } from './karnaugh'
import { minimizeColumn, simplify, truthColumn } from './minimize'
import { parse } from './parser'
import { buildTruthTable } from './truthTable'

/** Duas expressões são equivalentes se as colunas de resultado batem. */
function equivalent(a: string, b: string): boolean {
  const left = parse(a)
  const right = parse(b)
  const variables = [
    ...new Set([...collectVariables(left), ...collectVariables(right)]),
  ].sort()
  const columnA = truthColumn(left, variables)
  const columnB = truthColumn(right, variables)
  return columnA.every((value, index) => value === columnB[index])
}

describe('simplificação', () => {
  it('colapsa uma variável redundante', () => {
    const result = simplify(parse('(A AND B) OR (A AND NOT B)'))!
    expect(result.expression).toBe('A')
    expect(result.operatorsAfter).toBeLessThan(result.operatorsBefore)
  })

  it('aplica De Morgan', () => {
    expect(simplify(parse('NOT (A OR B)'))!.expression).toBe('¬A ∧ ¬B')
  })

  it('reconhece tautologia e contradição', () => {
    expect(simplify(parse('A OR NOT A'))!.expression).toBe('1')
    expect(simplify(parse('A AND NOT A'))!.expression).toBe('0')
  })

  it('reescreve XOR como soma de produtos', () => {
    const result = simplify(parse('A XOR B'))!
    expect(equivalent(result.expression, 'A XOR B')).toBe(true)
  })

  it('preserva o significado em expressões variadas', () => {
    const cases = [
      '(A AND B) OR C',
      'A -> (B -> C)',
      '(A OR B) AND (NOT A OR C)',
      'A XNOR B XOR C',
      '(A AND NOT B) OR (NOT A AND B) OR (A AND B)',
      'NOT (A AND (B OR NOT C)) <-> D',
    ]
    for (const source of cases) {
      const result = simplify(parse(source))!
      expect(equivalent(result.expression, source), source).toBe(true)
    }
  })

  it('não piora uma expressão que já é mínima', () => {
    const result = simplify(parse('A AND B'))!
    expect(result.expression).toBe('A ∧ B')
    expect(result.alreadyMinimal).toBe(true)
  })

  it('respeita a notação pedida', () => {
    expect(simplify(parse('NOT (A OR B)'), 'text')!.expression).toBe('NOT A AND NOT B')
  })

  it('desiste acima do limite de variáveis', () => {
    const many = 'A AND B AND C AND D AND E AND G AND H AND I AND J AND K AND L AND M AND N'
    expect(simplify(parse(many))).toBeNull()
  })

  it('minimiza uma coluna solta', () => {
    // Maioria de 3 entradas.
    const column = [false, false, false, true, false, true, true, true]
    const { text } = minimizeColumn(column, ['A', 'B', 'C'])
    expect(equivalent(text, '(A AND B) OR (A AND C) OR (B AND C)')).toBe(true)
  })
})

describe('mapa de Karnaugh', () => {
  it('usa código Gray', () => {
    expect(grayCode(1)).toEqual([0, 1])
    expect(grayCode(2)).toEqual([0, 1, 3, 2])
  })

  it('monta 4x4 para quatro variáveis', () => {
    const map = buildKarnaughMap(parse('A AND B OR C AND D'))!
    expect(map.rowVariables).toEqual(['A', 'B'])
    expect(map.columnVariables).toEqual(['C', 'D'])
    expect(map.rowLabels).toEqual(['00', '01', '11', '10'])
    expect(map.values).toHaveLength(4)
    expect(map.values[0]).toHaveLength(4)
  })

  it('monta 2x4 para três variáveis', () => {
    const map = buildKarnaughMap(parse('A AND B OR C'))!
    expect(map.rowVariables).toEqual(['A'])
    expect(map.columnVariables).toEqual(['B', 'C'])
    expect(map.values).toHaveLength(2)
    expect(map.values[0]).toHaveLength(4)
  })

  it('põe cada célula no mintermo certo', () => {
    const map = buildKarnaughMap(parse('A AND B'))!
    const table = buildTruthTable(parse('A AND B'), { includeSteps: false })
    for (let row = 0; row < map.values.length; row += 1) {
      for (let column = 0; column < map.values[row].length; column += 1) {
        const minterm = map.minterms[row][column]
        expect(map.values[row][column]).toBe(table.rows[minterm].at(-1))
      }
    }
  })

  it('destaca os agrupamentos da simplificação', () => {
    const map = buildKarnaughMap(parse('(A AND B) OR (A AND NOT B)'))!
    expect(map.groups).toHaveLength(1)
    expect(map.groups[0].term).toBe('A')
    expect(map.groups[0].cells).toHaveLength(2)
  })

  it('não destaca nada quando é tudo verdadeiro ou tudo falso', () => {
    expect(buildKarnaughMap(parse('A OR NOT A'))!.groups).toEqual([])
    expect(buildKarnaughMap(parse('A AND NOT A'))!.groups).toEqual([])
  })

  it('desiste acima de quatro variáveis', () => {
    expect(buildKarnaughMap(parse('A AND B AND C AND D AND E'))).toBeNull()
    expect(KARNAUGH_MAX_VARIABLES).toBe(4)
  })
})
