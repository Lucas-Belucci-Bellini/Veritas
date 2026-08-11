import type { GateOp } from './graph'

/** Caixa em que todo símbolo de porta é desenhado, com as pernas já dentro. */
export const GATE_WIDTH = 76
export const GATE_HEIGHT = 44

/** Altura das duas pernas de entrada e da perna de saída. */
export const PIN_TOP = 13
export const PIN_BOTTOM = 31
export const PIN_MIDDLE = 22

/** Portas que levam bolinha de inversão na saída. */
export const INVERTED: ReadonlySet<GateOp> = new Set<GateOp>([
  'nand',
  'nor',
  'xnor',
  'not',
])

/** Onde termina o corpo, antes da bolinha. */
export const BODY_END = 57
export const NOT_BODY_END = 49

export const AND_BODY = 'M12 5 H40 a17 17 0 0 1 0 34 H12 Z'
export const OR_BODY = 'M10 5 c9 9 9 25 0 34 c22 0 38 -9 47 -17 c-9 -8 -25 -17 -47 -17 Z'
/** O arco extra que distingue o XOR do OR. */
export const XOR_ARC = 'M3 5 c9 9 9 25 0 34'
export const NOT_BODY = 'M14 5 L49 22 L14 39 Z'

export type GateFamily = 'and' | 'or' | 'xor' | 'not'

export function gateFamily(op: GateOp): GateFamily {
  if (op === 'not') return 'not'
  if (op === 'and' || op === 'nand') return 'and'
  if (op === 'xor' || op === 'xnor') return 'xor'
  return 'or'
}

/** Nome por extenso, para o tooltip e para leitores de tela. */
export const GATE_NAMES: Record<GateOp, string> = {
  and: 'porta AND',
  nand: 'porta NAND',
  or: 'porta OR',
  nor: 'porta NOR',
  xor: 'porta XOR',
  xnor: 'porta XNOR',
  not: 'inversor NOT',
  implies: 'implicação',
  iff: 'equivalência',
}
