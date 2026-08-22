import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bitVector, bitwiseAnd, bitwiseNot, bitwiseOr, bitwiseXor, toBigInt } from '../src/bus'

function fixtureRows(): Array<[string, number, bigint, bigint, bigint[]]> {
  const fixture = readFileSync(new URL('./fixtures/rust-engine/gates.tsv', import.meta.url), 'utf8')
  return fixture
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const fields = line.split('|')
      if (fields.length !== 10) throw new Error(`Fixture row inválida: ${line}`)
      return [
        fields[0],
        Number(fields[1]),
        BigInt(fields[2]),
        BigInt(fields[3]),
        fields.slice(4).map(BigInt),
      ]
    })
}

describe('Rust engine golden parity', () => {
  it('keeps TypeScript vector primitives aligned with the shared gate fixture', () => {
    for (const [id, width, leftValue, rightValue, expected] of fixtureRows()) {
      const left = bitVector(width, leftValue)
      const right = bitVector(width, rightValue)
      const actual = [
        toBigInt(bitwiseAnd(left, right)),
        toBigInt(bitwiseNot(bitwiseAnd(left, right))),
        toBigInt(bitwiseOr(left, right)),
        toBigInt(bitwiseNot(bitwiseOr(left, right))),
        toBigInt(bitwiseXor(left, right)),
        toBigInt(bitwiseNot(bitwiseXor(left, right))),
      ]
      expect(actual, `fixture row ${id} diverged`).toEqual(expected)
    }
  })
})
