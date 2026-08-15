import { describe, expect, it } from 'vitest'
import {
  BitVectorError,
  bitVector,
  bitwiseAnd,
  bitwiseNot,
  bitwiseOr,
  bitwiseXor,
  combineBus,
  parseBusLiteral,
  splitBus,
  toBigInt,
  toBinary,
  toHex,
} from './bitVector'

describe('BitVector', () => {
  it('normaliza binário, hexadecimal e formatação MSB → LSB', () => {
    const value = parseBusLiteral('0xA5', 8)

    expect(value.width).toBe(8)
    expect(toBinary(value)).toBe('10100101')
    expect(toBinary(value, true)).toBe('1010_0101')
    expect(toHex(value)).toBe('A5')
    expect(toHex(value, true)).toBe('0xA5')
    expect(toBigInt(value)).toBe(165n)
  })

  it('executa operações bitwise apenas entre larguras compatíveis', () => {
    const left = bitVector(4, '1010')
    const right = bitVector(4, '0110')

    expect(toBinary(bitwiseAnd(left, right))).toBe('0010')
    expect(toBinary(bitwiseOr(left, right))).toBe('1110')
    expect(toBinary(bitwiseXor(left, right))).toBe('1100')
    expect(toBinary(bitwiseNot(left))).toBe('0101')
    expect(() => bitwiseAnd(left, bitVector(8, 1))).toThrow('incompatíveis')
  })

  it('divide e recompõe um barramento sem inverter a ordem dos bits', () => {
    const original = bitVector(8, '11001010')
    const parts = splitBus(original, [3, 5])

    expect(parts.map((part) => toBinary(part))).toEqual(['110', '01010'])
    expect(toBinary(combineBus(parts))).toBe('11001010')
    expect(() => splitBus(original, [4, 3])).toThrow('espera 7 bits')
  })

  it('rejeita largura, literal e overflow inválidos', () => {
    expect(() => bitVector(0)).toThrow(BitVectorError)
    expect(() => bitVector(4, '10000')).toThrow('não cabe')
    expect(() => parseBusLiteral('0b102')).toThrow('binário inválido')
    expect(() => parseBusLiteral('0xGG')).toThrow('hexadecimal inválido')
    expect(() => bitVector(2, -1)).toThrow('negativos')
  })

  it('mantém snapshots imutáveis', () => {
    const value = bitVector(2, '01')
    expect(Object.isFrozen(value)).toBe(true)
    expect(Object.isFrozen(value.bits)).toBe(true)
  })
})
