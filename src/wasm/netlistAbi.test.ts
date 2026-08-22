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

interface GoldenFixture {
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

const fixture = fixtureJson as GoldenFixture

function hex(vector: BitVector): string {
  return toHex(vector)
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function goldenResultBytes(): Uint8Array {
  const bytes: number[] = [0x56, 0x52, 0x45, 0x53, 1, fixture.width, 5, 0]
  for (const value of ['F0', 'FF', 'F0', '0F', '0F']) {
    const buffer = new ArrayBuffer(8)
    new DataView(buffer).setBigUint64(0, BigInt(`0x${value}`), true)
    bytes.push(...new Uint8Array(buffer))
  }
  bytes.push(5, 0, 1, 0, 0, 0, 2, 0, 3, 0, 4, 0)
  return Uint8Array.from(bytes)
}

describe('ABI experimental de netlist WASM-002', () => {
  it('mantém fixture, codificação determinística e paridade TypeScript golden', () => {
    const firstPayload = encodeWasmNetlist(fixture.netlist, fixture.overrides)
    const secondPayload = encodeWasmNetlist(fixture.netlist, fixture.overrides)
    expect(firstPayload).toEqual(secondPayload)
    expect(bytesToHex(firstPayload)).toBe(fixture.payload_hex)
    expect(Array.from(firstPayload.slice(0, 8))).toEqual([0x56, 0x4e, 0x45, 0x54, 1, 8, 5, 0])

    const evaluation = evaluateVectorNetlist(fixture.netlist, fixture.overrides, {})
    expect(Object.fromEntries(Object.entries(evaluation.values).map(([id, value]) => [id, hex(value)]))).toEqual(fixture.expected.values)
    expect(Object.fromEntries(Object.entries(evaluation.outputs).map(([id, value]) => [id, hex(value)]))).toEqual(fixture.expected.outputs)
    expect(evaluation.order).toEqual(fixture.expected.order)

    const goldenResult = goldenResultBytes()
    expect(bytesToHex(goldenResult)).toBe(fixture.expected.result_hex)
    const decoded = decodeWasmResult(goldenResult, fixture.netlist)
    expect(Object.fromEntries(Object.entries(decoded.values).map(([id, value]) => [id, hex(value)]))).toEqual(fixture.expected.values)
    expect(Object.fromEntries(Object.entries(decoded.outputs).map(([id, value]) => [id, hex(value)]))).toEqual(fixture.expected.outputs)
    expect(decoded.order).toEqual(fixture.expected.order)
    expect(decoded.width).toBe(fixture.width)
  })

  it('rejeita truncamento, largura não uniforme e componente fora da ABI', () => {
    expect(() => decodeWasmResult(goldenResultBytes().slice(0, -1), fixture.netlist)).toThrow(WasmNetlistError)

    const nonUniform = structuredClone(fixture.netlist)
    nonUniform.components[0].options = { width: 4 }
    expect(() => encodeWasmNetlist(nonUniform, fixture.overrides)).toThrowError(/largura uniforme/)

    const sequential = structuredClone(fixture.netlist)
    sequential.components[0] = { id: 'clock', type: 'clock', options: { width: 8 } }
    expect(() => encodeWasmNetlist(sequential, fixture.overrides)).toThrowError(/subconjunto WASM/)
  })
})
