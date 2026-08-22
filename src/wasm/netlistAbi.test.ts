import { describe, expect, it } from 'vitest'
import fixtureJson from '../../tests/fixtures/wasm/netlist-parity.json'
import { evaluateVectorNetlist } from '../circuit/evaluate'
import { toHex, type BitVector } from '../bus'
import type { Netlist } from '../simulation/components'
import {
  decodeWasmResult,
  encodeWasmNetlist,
  WasmNetlistError,
} from './netlistAbi'

interface GoldenCase {
  name: string
  width: number
  netlist: Netlist
  overrides: Record<string, string>
  payload_hex: string
  expected: {
    values: Record<string, string>
    outputs: Record<string, string>
    order: string[]
    result_hex: string
  }
}

interface GoldenFixture {
  schema: string
  cases: GoldenCase[]
}

const fixture = fixtureJson as GoldenFixture

function hex(vector: BitVector): string {
  return toHex(vector)
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(value: string): Uint8Array {
  if (value.length % 2 !== 0) throw new Error('golden hexadecimal must contain whole bytes')
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16))
}

function summarizeValues(values: Record<string, BitVector>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([id, value]) => [id, hex(value)]))
}

describe('ABI experimental de netlist WASM-003', () => {
  it('usa um fixture versionado com quatro larguras', () => {
    expect(fixture.schema).toBe('veritas-wasm-netlist-golden-v1')
    expect(fixture.cases.map((testCase) => testCase.width)).toEqual([1, 8, 32, 64])
  })

  it.each(fixture.cases)('mantém paridade TypeScript golden em $name', (testCase) => {
    const firstPayload = encodeWasmNetlist(testCase.netlist, testCase.overrides)
    const secondPayload = encodeWasmNetlist(testCase.netlist, testCase.overrides)
    expect(firstPayload).toEqual(secondPayload)
    expect(bytesToHex(firstPayload)).toBe(testCase.payload_hex)

    const evaluation = evaluateVectorNetlist(testCase.netlist, testCase.overrides, {})
    expect(summarizeValues(evaluation.values)).toEqual(testCase.expected.values)
    expect(summarizeValues(evaluation.outputs)).toEqual(testCase.expected.outputs)
    expect(evaluation.order).toEqual(testCase.expected.order)

    const goldenResult = hexToBytes(testCase.expected.result_hex)
    expect(bytesToHex(goldenResult)).toBe(testCase.expected.result_hex)
    const decoded = decodeWasmResult(goldenResult, testCase.netlist)
    expect(summarizeValues(decoded.values)).toEqual(testCase.expected.values)
    expect(summarizeValues(decoded.outputs)).toEqual(testCase.expected.outputs)
    expect(decoded.order).toEqual(testCase.expected.order)
    expect(decoded.width).toBe(testCase.width)
  })

  it('rejeita truncamento, largura não uniforme e componente fora da ABI', () => {
    const testCase = fixture.cases[1]
    const goldenResult = hexToBytes(testCase.expected.result_hex)
    expect(() => decodeWasmResult(goldenResult.slice(0, -1), testCase.netlist)).toThrow(WasmNetlistError)

    const nonUniform = structuredClone(testCase.netlist)
    nonUniform.components[0].options = { width: 4 }
    expect(() => encodeWasmNetlist(nonUniform, testCase.overrides)).toThrowError(/largura uniforme/)

    const sequential = structuredClone(testCase.netlist)
    sequential.components[0] = { id: 'clock', type: 'clock', options: { width: 8 } }
    expect(() => encodeWasmNetlist(sequential, testCase.overrides)).toThrowError(/subconjunto WASM/)
  })
})
