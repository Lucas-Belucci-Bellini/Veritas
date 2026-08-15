export const MAX_BUS_WIDTH = 64

export class BitVectorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BitVectorError'
  }
}

/**
 * Valor de barramento imutável com bits em ordem MSB → LSB.
 * A ordem explícita evita divergências entre tabela, display e exportadores.
 */
export interface BitVector {
  readonly width: number
  readonly bits: readonly boolean[]
}

export function bitVector(width: number, value: bigint | number | string | readonly boolean[] = 0): BitVector {
  assertWidth(width)
  const bits = typeof value === 'string'
    ? parseLiteralBits(value, width)
    : isBooleanArray(value)
      ? normalizeBits(value, width)
      : bitsFromBigInt(toBigIntValue(value), width)
  return freezeVector({ width, bits: Object.freeze(bits) })
}

export function zeroBus(width: number): BitVector {
  return bitVector(width, 0n)
}

export function oneBus(width: number): BitVector {
  return bitVector(width, 1n)
}

export function toBigInt(vector: BitVector): bigint {
  assertVector(vector)
  return vector.bits.reduce((value, bit) => (value << 1n) | (bit ? 1n : 0n), 0n)
}

export function toBinary(vector: BitVector, grouped = false): string {
  assertVector(vector)
  const binary = vector.bits.map((bit) => bit ? '1' : '0').join('')
  return grouped ? group(binary, 4) : binary
}

export function toHex(vector: BitVector, prefix = false): string {
  assertVector(vector)
  const digits = Math.ceil(vector.width / 4)
  const hex = toBigInt(vector).toString(16).toUpperCase().padStart(digits, '0')
  return `${prefix ? '0x' : ''}${hex}`
}

export function bitwiseAnd(left: BitVector, right: BitVector): BitVector {
  return binaryOperation(left, right, (a, b) => a && b)
}

export function bitwiseOr(left: BitVector, right: BitVector): BitVector {
  return binaryOperation(left, right, (a, b) => a || b)
}

export function bitwiseXor(left: BitVector, right: BitVector): BitVector {
  return binaryOperation(left, right, (a, b) => a !== b)
}

export function bitwiseNot(vector: BitVector): BitVector {
  assertVector(vector)
  return bitVector(vector.width, vector.bits.map((bit) => !bit))
}

/** Divide um barramento MSB → LSB nos widths informados, também MSB → LSB. */
export function splitBus(vector: BitVector, widths: readonly number[]): BitVector[] {
  assertVector(vector)
  if (widths.length === 0 || widths.some((width) => !isValidWidth(width))) {
    throw new BitVectorError('O splitter precisa de larguras positivas e inteiras.')
  }
  const total = widths.reduce((sum, width) => sum + width, 0)
  if (total !== vector.width) {
    throw new BitVectorError(`O splitter espera ${total} bits, mas recebeu ${vector.width}.`)
  }
  let offset = 0
  return widths.map((width) => {
    const part = vector.bits.slice(offset, offset + width)
    offset += width
    return bitVector(width, part)
  })
}

/** Concatena partes MSB → LSB em um barramento único. */
export function combineBus(parts: readonly BitVector[]): BitVector {
  if (parts.length === 0) throw new BitVectorError('O combiner precisa de pelo menos uma parte.')
  parts.forEach(assertVector)
  const bits = parts.flatMap((part) => [...part.bits])
  return bitVector(bits.length, bits)
}

export function parseBusLiteral(literal: string, width?: number): BitVector {
  const cleaned = literal.trim().replace(/_/g, '')
  if (!cleaned) throw new BitVectorError('Literal de barramento vazio.')
  const inferredWidth = cleaned.startsWith('0b') || cleaned.startsWith('0B')
    ? cleaned.slice(2).length
    : cleaned.startsWith('0x') || cleaned.startsWith('0X')
      ? cleaned.slice(2).length * 4
      : cleaned.length
  return bitVector(width ?? Math.max(1, inferredWidth), cleaned)
}

function toBigIntValue(value: bigint | number): bigint {
  if (typeof value === 'bigint') return value
  if (!Number.isSafeInteger(value)) throw new BitVectorError('O valor numérico precisa ser um inteiro seguro.')
  return BigInt(value)
}

function binaryOperation(left: BitVector, right: BitVector, operation: (a: boolean, b: boolean) => boolean): BitVector {
  assertVector(left)
  assertVector(right)
  if (left.width !== right.width) {
    throw new BitVectorError(`Barramentos incompatíveis: ${left.width} e ${right.width} bits.`)
  }
  return bitVector(left.width, left.bits.map((bit, index) => operation(bit, right.bits[index])))
}

function parseLiteralBits(value: string, width: number): boolean[] {
  const cleaned = value.trim().replace(/_/g, '')
  if (!cleaned) throw new BitVectorError('Literal de barramento vazio.')
  const isBinary = cleaned.startsWith('0b') || cleaned.startsWith('0B')
  const isHex = cleaned.startsWith('0x') || cleaned.startsWith('0X')
  const digits = isBinary || isHex ? cleaned.slice(2) : cleaned
  if (!digits) throw new BitVectorError('Literal de barramento sem dígitos.')
  if (isBinary && !/^[01]+$/.test(digits)) throw new BitVectorError('Literal binário inválido.')
  if (isHex && !/^[0-9a-f]+$/i.test(digits)) throw new BitVectorError('Literal hexadecimal inválido.')
  if (!isBinary && !isHex && !/^[01]+$/.test(digits)) throw new BitVectorError('Literal sem prefixo deve conter apenas 0 e 1.')
  const numeric = isHex ? BigInt(`0x${digits}`) : BigInt(`0b${digits}`)
  return bitsFromBigInt(numeric, width)
}

function bitsFromBigInt(value: bigint, width: number): boolean[] {
  if (value < 0n) throw new BitVectorError('Barramentos não aceitam valores negativos nesta versão.')
  const max = (1n << BigInt(width)) - 1n
  if (value > max) throw new BitVectorError(`O valor não cabe em ${width} bits.`)
  return Array.from({ length: width }, (_, index) => {
    const shift = BigInt(width - index - 1)
    return (value & (1n << shift)) !== 0n
  })
}

function isBooleanArray(value: bigint | number | string | readonly boolean[]): value is readonly boolean[] {
  return Array.isArray(value)
}

function normalizeBits(bits: readonly boolean[], width: number): boolean[] {
  if (bits.length !== width || bits.some((bit) => typeof bit !== 'boolean')) {
    throw new BitVectorError(`Esperados exatamente ${width} bits booleanos.`)
  }
  return [...bits]
}

function assertVector(vector: BitVector): void {
  if (!vector || !isValidWidth(vector.width) || vector.bits.length !== vector.width || vector.bits.some((bit) => typeof bit !== 'boolean')) {
    throw new BitVectorError('Valor de barramento inválido.')
  }
}

function assertWidth(width: number): void {
  if (!isValidWidth(width)) throw new BitVectorError(`A largura deve ser um inteiro entre 1 e ${MAX_BUS_WIDTH}.`)
}

function isValidWidth(width: number): boolean {
  return Number.isInteger(width) && width >= 1 && width <= MAX_BUS_WIDTH
}

function freezeVector(vector: BitVector): BitVector {
  return Object.freeze(vector)
}

function group(value: string, size: number): string {
  const first = value.length % size || size
  return [value.slice(0, first), ...value.slice(first).match(new RegExp(`.{1,${size}}`, 'g')) ?? []].join('_')
}
