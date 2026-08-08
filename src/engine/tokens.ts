/**
 * Tabela de símbolos do Veritas.
 *
 * A calculadora aceita três "dialetos" ao mesmo tempo: matemático (∧ ∨ ¬),
 * de programação (&& || !) e textual (AND OR NOT). O lexer normaliza todos
 * eles para o mesmo conjunto de tokens, então `A && B`, `A ∧ B` e `A AND B`
 * produzem exatamente a mesma árvore.
 */

export type TokenType =
  | 'var'
  | 'const'
  | 'not'
  | 'and'
  | 'nand'
  | 'or'
  | 'nor'
  | 'xor'
  | 'xnor'
  | 'implies'
  | 'iff'
  | 'lparen'
  | 'rparen'
  | 'eof'

export interface Token {
  type: TokenType
  /** Texto exatamente como o usuário digitou (para mensagens de erro). */
  lexeme: string
  /** Nome da variável, quando `type === 'var'`. */
  name?: string
  /** Valor da constante, quando `type === 'const'`. */
  value?: boolean
  start: number
  end: number
}

/** Operadores escritos com símbolos, ordenados do mais longo para o mais curto. */
export const SYMBOL_OPERATORS: ReadonlyArray<readonly [string, TokenType]> = [
  ['<->', 'iff'],
  ['<=>', 'iff'],
  ['->', 'implies'],
  ['=>', 'implies'],
  ['&&', 'and'],
  ['||', 'or'],
  ['↔', 'iff'],
  ['⇔', 'iff'],
  ['≡', 'iff'],
  ['→', 'implies'],
  ['⇒', 'implies'],
  ['⊃', 'implies'],
  ['∧', 'and'],
  ['&', 'and'],
  ['·', 'and'],
  ['*', 'and'],
  ['∨', 'or'],
  ['|', 'or'],
  ['+', 'or'],
  ['⊕', 'xor'],
  ['⊻', 'xor'],
  ['^', 'xor'],
  ['⊙', 'xnor'],
  ['↑', 'nand'],
  ['↓', 'nor'],
  ['¬', 'not'],
  ['!', 'not'],
  ['~', 'not'],
  ['(', 'lparen'],
  [')', 'rparen'],
]

/**
 * Palavras reservadas. Só entram aqui termos com duas letras ou mais — letras
 * isoladas continuam sendo variáveis, senão `E`, `V` e `F` deixariam de poder
 * ser usadas como nomes.
 */
export const KEYWORDS: Readonly<Record<string, TokenType>> = {
  NOT: 'not',
  NAO: 'not',
  NÃO: 'not',
  AND: 'and',
  OU: 'or',
  OR: 'or',
  XOR: 'xor',
  NAND: 'nand',
  NOR: 'nor',
  NEM: 'nor',
  XNOR: 'xnor',
  IMPLICA: 'implies',
  IMPLIES: 'implies',
  ENTAO: 'implies',
  ENTÃO: 'implies',
  EQUIVALE: 'iff',
  EQUIV: 'iff',
  IFF: 'iff',
  SSE: 'iff',
}

/** Constantes literais reconhecidas pelo lexer. */
export const CONSTANTS: Readonly<Record<string, boolean>> = {
  '1': true,
  '0': false,
  '⊤': true,
  '⊥': false,
  TRUE: true,
  FALSE: false,
  VERDADEIRO: true,
  FALSO: false,
}

/** Notações de exibição oferecidas ao usuário. */
export type Notation = 'math' | 'programming' | 'text'

type OperatorTokenType = Exclude<TokenType, 'var' | 'const' | 'lparen' | 'rparen' | 'eof'>

/** Como cada operador é escrito em cada notação. */
export const OPERATOR_GLYPHS: Record<OperatorTokenType, Record<Notation, string>> = {
  not: { math: '¬', programming: '!', text: 'NOT' },
  and: { math: '∧', programming: '&&', text: 'AND' },
  nand: { math: '↑', programming: 'NAND', text: 'NAND' },
  or: { math: '∨', programming: '||', text: 'OR' },
  nor: { math: '↓', programming: 'NOR', text: 'NOR' },
  xor: { math: '⊕', programming: '^', text: 'XOR' },
  xnor: { math: '⊙', programming: 'XNOR', text: 'XNOR' },
  implies: { math: '→', programming: '->', text: 'IMPLICA' },
  iff: { math: '↔', programming: '<->', text: 'EQUIVALE' },
}

export const OPERATOR_LABELS: Record<OperatorTokenType, string> = {
  not: 'NOT',
  and: 'AND',
  nand: 'NAND',
  or: 'OR',
  nor: 'NOR',
  xor: 'XOR',
  xnor: 'XNOR',
  implies: 'IMPLICA',
  iff: 'EQUIVALE',
}

export function isOperatorToken(type: TokenType): type is OperatorTokenType {
  return type in OPERATOR_LABELS
}

/** Rótulo humano de um token, usado nas mensagens de erro. */
export function describeToken(token: Token): string {
  switch (token.type) {
    case 'var':
      return `a variável "${token.name}"`
    case 'const':
      return `a constante "${token.lexeme}"`
    case 'lparen':
      return 'um parêntese "("'
    case 'rparen':
      return 'um parêntese ")"'
    case 'eof':
      return 'o fim da expressão'
    default:
      return `o operador "${OPERATOR_LABELS[token.type]}"`
  }
}
