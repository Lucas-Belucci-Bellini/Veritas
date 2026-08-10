import { describe, expect, it } from 'vitest'
import { collectVariables, type AstNode } from './ast'
import { VeritasError } from './errors'
import { evaluate } from './evaluator'
import { formatAst } from './format'
import { tokenize } from './lexer'
import { parse, tryParse } from './parser'
import { simplify } from './minimize'
import { assignmentForRow, buildTruthTable } from './truthTable'

const evalWith = (source: string, assignment: Record<string, boolean>) =>
  evaluate(parse(source), assignment)

describe('lexer', () => {
  it('aceita as três notações para o mesmo operador', () => {
    for (const source of ['A AND B', 'A && B', 'A ∧ B', 'A & B', 'A · B']) {
      const types = tokenize(source).map((token) => token.type)
      expect(types).toEqual(['var', 'and', 'var', 'eof'])
    }
  })

  it('casa os operadores de vários caracteres antes dos curtos', () => {
    expect(tokenize('A <-> B').map((t) => t.type)).toEqual(['var', 'iff', 'var', 'eof'])
    expect(tokenize('A -> B').map((t) => t.type)).toEqual([
      'var',
      'implies',
      'var',
      'eof',
    ])
  })

  it('trata letra seguida de dígito como variável', () => {
    const tokens = tokenize('A1 AND B2')
    expect(tokens[0]).toMatchObject({ type: 'var', name: 'A1' })
    expect(tokens[2]).toMatchObject({ type: 'var', name: 'B2' })
  })

  it('reconhece 1 e 0 como constantes', () => {
    expect(tokenize('1 OR 0').map((t) => t.type)).toEqual(['const', 'or', 'const', 'eof'])
  })

  it('mantém E, V e F como variáveis', () => {
    expect(tokenize('V AND F').map((t) => t.type)).toEqual(['var', 'and', 'var', 'eof'])
    expect(collectVariables(parse('E OR V'))).toEqual(['E', 'V'])
  })

  it('recusa caracteres fora do dicionário apontando a posição', () => {
    const error = tryParse('A AND B @ C')
    expect(error.ok).toBe(false)
    if (error.ok) return
    expect(error.error.kind).toBe('lexical')
    expect(error.error.start).toBe(8)
    expect(error.error.message).toContain('@')
  })

  it('sugere como separar quando o usuário cola letras', () => {
    const result = tryParse('AB')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.hint).toContain('A AND B')
    expect(result.error.hint).toContain('A B')
  })
})

describe('parser', () => {
  it('dá a NOT a maior precedência', () => {
    expect(formatAst(parse('NOT A AND B'))).toBe('¬A ∧ B')
  })

  it('resolve AND antes de OR', () => {
    expect(formatAst(parse('A OR B AND C'))).toBe('A ∨ B ∧ C')
    expect(formatAst(parse('(A OR B) AND C'))).toBe('(A ∨ B) ∧ C')
  })

  it('escalona AND > XOR > OR > IMPLICA > EQUIVALE', () => {
    const ast = parse('A AND B XOR C OR D -> E <-> F')
    expect(formatAst(ast)).toBe('A ∧ B ⊕ C ∨ D → E ↔ F')
  })

  it('faz a implicação associar à direita', () => {
    const ast = parse('A -> B -> C') as Extract<AstNode, { kind: 'binary' }>
    expect(ast.op).toBe('implies')
    expect(ast.right.kind).toBe('binary')
  })

  it('faz o AND associar à esquerda', () => {
    const ast = parse('A AND B AND C') as Extract<AstNode, { kind: 'binary' }>
    expect(ast.left.kind).toBe('binary')
    expect(ast.right.kind).toBe('var')
  })

  it('aceita NOT encadeado', () => {
    expect(evalWith('NOT NOT A', { A: true })).toBe(true)
    expect(evalWith('!!!A', { A: true })).toBe(false)
  })
})

describe('mensagens de erro', () => {
  const expectError = (source: string) => {
    const result = tryParse(source)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('deveria falhar')
    return result.error
  }

  it('conta os parênteses que faltam fechar', () => {
    const error = expectError('(A OR B')
    expect(error.kind).toBe('paren')
    expect(error.message).toBe('Falta fechar 1 parêntese.')
  })

  it('usa o plural quando falta mais de um', () => {
    expect(expectError('((A OR B').message).toBe('Faltam fechar 2 parênteses.')
  })

  it('detecta parêntese fechado sem abrir', () => {
    const error = expectError('A AND B )')
    expect(error.kind).toBe('paren')
    expect(error.message).toContain('nunca foi aberto')
  })

  it('detecta dois operadores seguidos', () => {
    expect(expectError('A AND OR B').message).toContain('Dois operadores seguidos')
  })

  it('detecta expressão terminando em operador', () => {
    expect(expectError('A AND').message).toContain('termina em "AND"')
  })

  it('recusa letras coladas e ensina como separar', () => {
    const error = expectError('AB')
    expect(error.message).toContain('não é um operador conhecido')
    expect(error.hint).toContain('A B')
  })

  it('recusa apóstrofo sem nada para negar', () => {
    expect(expectError("' A").message).toContain('não há nada antes')
  })

  it('recusa parênteses vazios', () => {
    expect(expectError('A AND ()').message).toContain('Parênteses vazios')
  })

  it('avisa quando não há nada digitado', () => {
    const error = expectError('   ')
    expect(error.kind).toBe('empty')
  })

  it('lança VeritasError, não Error genérico', () => {
    expect(() => parse('A @')).toThrow(VeritasError)
  })
})

describe('avaliação', () => {
  const cases: Array<[string, Record<string, boolean>, boolean]> = [
    ['A AND B', { A: true, B: false }, false],
    ['A OR B', { A: true, B: false }, true],
    ['A XOR B', { A: true, B: true }, false],
    ['A NAND B', { A: true, B: true }, false],
    ['A NOR B', { A: false, B: false }, true],
    ['A XNOR B', { A: false, B: false }, true],
    ['A -> B', { A: true, B: false }, false],
    ['A -> B', { A: false, B: false }, true],
    ['A <-> B', { A: false, B: false }, true],
    ['NOT A', { A: false }, true],
    ['1 AND A', { A: true }, true],
    ['0 OR A', { A: false }, false],
  ]

  it.each(cases)('%s resolve corretamente', (source, assignment, expected) => {
    expect(evalWith(source, assignment)).toBe(expected)
  })

  it('trata De Morgan como equivalência', () => {
    for (const a of [false, true]) {
      for (const b of [false, true]) {
        expect(evalWith('NOT (A OR B)', { A: a, B: b })).toBe(
          evalWith('NOT A AND NOT B', { A: a, B: b }),
        )
      }
    }
  })
})

describe('geração de combinações', () => {
  it('coloca a primeira variável como bit mais significativo', () => {
    const variables = ['A', 'B', 'C']
    const columnA = Array.from({ length: 8 }, (_, i) => assignmentForRow(variables, i).A)
    const columnC = Array.from({ length: 8 }, (_, i) => assignmentForRow(variables, i).C)
    expect(columnA).toEqual([false, false, false, false, true, true, true, true])
    expect(columnC).toEqual([false, true, false, true, false, true, false, true])
  })
})

describe('tabela verdade', () => {
  it('gera 2^n linhas', () => {
    expect(buildTruthTable(parse('A')).rows).toHaveLength(2)
    expect(buildTruthTable(parse('A AND B')).rows).toHaveLength(4)
    expect(buildTruthTable(parse('A AND B OR C')).rows).toHaveLength(8)
  })

  it('monta colunas de variáveis, passos e resultado', () => {
    const table = buildTruthTable(parse('(A AND B) OR C'))
    expect(table.columns.map((c) => c.label)).toEqual(['A', 'B', 'C', 'A ∧ B', 'A ∧ B ∨ C'])
    expect(table.columns.at(-1)?.type).toBe('result')
  })

  it('omite os passos quando pedido', () => {
    const table = buildTruthTable(parse('(A AND B) OR C'), { includeSteps: false })
    expect(table.columns.filter((c) => c.type === 'step')).toHaveLength(0)
  })

  it('produz os valores certos para A AND B', () => {
    const table = buildTruthTable(parse('A AND B'), { includeSteps: false })
    expect(table.rows.map((row) => row.at(-1))).toEqual([false, false, false, true])
  })

  it('classifica tautologia, contradição e contingência', () => {
    expect(buildTruthTable(parse('A OR NOT A')).classification).toBe('tautologia')
    expect(buildTruthTable(parse('A AND NOT A')).classification).toBe('contradicao')
    expect(buildTruthTable(parse('A AND B')).classification).toBe('contingencia')
  })

  it('limita a exibição de tabelas gigantes', () => {
    const table = buildTruthTable(parse('A AND B AND C AND D AND E AND G'), {
      maxRows: 16,
    })
    expect(table.totalRows).toBe(64)
    expect(table.rows).toHaveLength(16)
    expect(table.truncated).toBe(true)
  })
})

describe('conversão de notação', () => {
  it('reescreve nas três notações', () => {
    const ast = parse('(A AND B) OR NOT C')
    expect(formatAst(ast, 'math')).toBe('A ∧ B ∨ ¬C')
    expect(formatAst(ast, 'programming')).toBe('A && B || !C')
    expect(formatAst(ast, 'text')).toBe('A AND B OR NOT C')
  })

  it('gera texto que volta a ser analisável', () => {
    const source = '(A -> B) XOR (C NAND D) OR (E NOR G) AND (H XNOR I)'
    const ast = parse(source)
    for (const notation of ['math', 'programming', 'text'] as const) {
      const rendered = formatAst(ast, notation)
      expect(formatAst(parse(rendered))).toBe(formatAst(ast))
    }
  })
})

describe('colunas repetidas', () => {
  it('reaproveita a coluna de uma subexpressão que aparece duas vezes', () => {
    const table = buildTruthTable(parse('(NOT A AND B) OR (NOT A AND C)'))
    const labels = table.columns.map((column) => column.label)
    expect(labels.filter((label) => label === '¬A')).toHaveLength(1)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('mantém a última coluna como o resultado', () => {
    const table = buildTruthTable(parse('(NOT A AND B) OR (NOT A AND C)'))
    expect(table.columns.at(-1)).toMatchObject({
      type: 'result',
      label: '¬A ∧ B ∨ ¬A ∧ C',
    })
  })
})

describe('notação de engenharia', () => {
  it('lê o apóstrofo como negação do que vem antes', () => {
    expect(formatAst(parse("A'"))).toBe('¬A')
    expect(formatAst(parse("(A + B)'"))).toBe('¬(A ∨ B)')
    expect(formatAst(parse("A''"))).toBe('¬¬A')
  })

  it('trata justaposição como AND', () => {
    expect(formatAst(parse('A B'))).toBe('A ∧ B')
    expect(formatAst(parse('A B C'))).toBe('A ∧ B ∧ C')
    expect(formatAst(parse('(A + B)(A + C)'))).toBe('(A ∨ B) ∧ (A ∨ C)')
  })

  it('dá ao AND implícito a mesma precedência do explícito', () => {
    expect(formatAst(parse('A B + C'))).toBe('A ∧ B ∨ C')
    expect(formatAst(parse('A + B C'))).toBe('A ∨ B ∧ C')
  })

  it('gruda o apóstrofo só no operando mais próximo', () => {
    expect(formatAst(parse("A B'"))).toBe('A ∧ ¬B')
    expect(formatAst(parse("A' B C"))).toBe('¬A ∧ B ∧ C')
  })

  it('aceita a aspa curva que os editores de texto inserem', () => {
    expect(formatAst(parse('A\u2019 B'))).toBe('¬A ∧ B')
  })

  it('lê as expressões da atividade exatamente como estão escritas', () => {
    const cases: Array<[string, string]> = [
      ["A + A B'", 'A'],
      ["A' B C + B C", 'B ∧ C'],
      ["(A + B)(A + B')", 'A'],
      ["(A' + B)' (A + C)'", '0'],
      ['A B + B C (B + C)', 'B ∧ C ∨ A ∧ B'],
    ]
    for (const [source, minimal] of cases) {
      const result = tryParse(source)
      expect(result.ok, source).toBe(true)
      if (!result.ok) continue
      expect(simplify(result.ast)!.expression, source).toBe(minimal)
    }
  })
})
