import { bitVector, toBigInt, type BitVector } from '../bus'
import type { ComponentSpec, ComponentType, Netlist } from '../simulation/components'
import type { VectorInput, CircuitVectorEvaluation } from '../circuit/evaluate'

export const WASM_NETLIST_ABI_VERSION = 1
export const WASM_NETLIST_BUFFER_CAPACITY = 65_536
export const WASM_NETLIST_MAGIC = 'VNET'
export const WASM_RESULT_MAGIC = 'VRES'

export const WASM_NETLIST_KINDS = {
  input: 0,
  constant: 1,
  and: 2,
  nand: 3,
  or: 4,
  nor: 5,
  xor: 6,
  xnor: 7,
  not: 8,
  output: 9,
} as const satisfies Record<Extract<ComponentType, 'input' | 'constant' | 'and' | 'nand' | 'or' | 'nor' | 'xor' | 'xnor' | 'not' | 'output'>, number>

export type WasmNetlistErrorCode =
  | 'invalid-magic'
  | 'invalid-version'
  | 'invalid-width'
  | 'payload-too-large'
  | 'invalid-shape'
  | 'invalid-reference'
  | 'invalid-value'
  | 'invalid-result'

export class WasmNetlistError extends Error {
  readonly code: WasmNetlistErrorCode

  constructor(code: WasmNetlistErrorCode, message: string) {
    super(message)
    this.name = 'WasmNetlistError'
    this.code = code
  }
}

export interface WasmNetlistDecodedResult extends CircuitVectorEvaluation {
  width: number
}

const encoder = new TextEncoder()
export function encodeWasmNetlist(
  netlist: Netlist,
  overrides: Record<string, VectorInput> = {},
): Uint8Array {
  const components = netlist.components
  if (components.length === 0 || components.length > 4096) {
    throw new WasmNetlistError('invalid-shape', 'O netlist WASM precisa ter entre 1 e 4096 componentes.')
  }

  const ids = components.map((component) => validateComponentId(component))
  const idIndexes = new Map(ids.map((id, index) => [id, index]))
  if (new Set(ids).size !== ids.length) {
    throw new WasmNetlistError('invalid-shape', 'O netlist WASM não aceita IDs duplicados.')
  }

  const width = resolveUniformWidth(components)
  const bytes: number[] = []
  pushAscii(bytes, WASM_NETLIST_MAGIC)
  bytes.push(WASM_NETLIST_ABI_VERSION, width)
  pushU16(bytes, components.length)

  for (const component of components) {
    const kind = kindFor(component.type)
    const inputs = component.inputs ?? []
    validateArity(component.type, inputs.length)
    const inputIndexes = inputs.map((input) => {
      if (input.port !== undefined && input.port !== 0) {
        throw new WasmNetlistError('invalid-shape', `A porta ${input.port} não é suportada pela ABI WASM.`)
      }
      const index = idIndexes.get(input.node)
      if (index === undefined) {
        throw new WasmNetlistError('invalid-reference', `A conexão aponta para "${input.node}", que não existe.`)
      }
      return index
    })

    const value = component.type === 'input'
      ? booleanToBits(component.options?.initial ?? false)
      : component.type === 'constant'
        ? booleanToBits(component.options?.value ?? false)
        : 0n
    pushId(bytes, component.id)
    bytes.push(kind)
    pushU64(bytes, value)
    bytes.push(inputIndexes.length)
    inputIndexes.forEach((index) => pushU16(bytes, index))
  }

  const overrideEntries = Object.entries(overrides)
  if (overrideEntries.length > components.length) {
    throw new WasmNetlistError('invalid-reference', 'Há overrides demais para o netlist WASM.')
  }
  pushU16(bytes, overrideEntries.length)
  for (const [id, value] of overrideEntries) {
    const index = idIndexes.get(id)
    if (index === undefined || components[index].type !== 'input') {
      throw new WasmNetlistError('invalid-reference', `O override "${id}" não aponta para uma entrada.`)
    }
    pushU16(bytes, index)
    pushU64(bytes, vectorInputToBits(value, width))
  }

  if (bytes.length > WASM_NETLIST_BUFFER_CAPACITY) {
    throw new WasmNetlistError('payload-too-large', 'O payload WASM excede a capacidade de 65536 bytes.')
  }
  return Uint8Array.from(bytes)
}

export function decodeWasmResult(
  bytes: Uint8Array,
  netlist: Netlist,
): WasmNetlistDecodedResult {
  const components = netlist.components
  if (components.length === 0 || components.length > 4096) {
    throw new WasmNetlistError('invalid-shape', 'O netlist WASM precisa ter entre 1 e 4096 componentes.')
  }
  const ids = components.map((component) => validateComponentId(component))
  if (new Set(ids).size !== ids.length) {
    throw new WasmNetlistError('invalid-shape', 'O netlist WASM não aceita IDs duplicados.')
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const cursor = new Reader(view)
  if (cursor.readAscii(4) !== WASM_RESULT_MAGIC) {
    throw new WasmNetlistError('invalid-magic', 'O resultado WASM não possui o magic VRES esperado.')
  }
  if (cursor.readU8() !== WASM_NETLIST_ABI_VERSION) {
    throw new WasmNetlistError('invalid-version', 'A versão do resultado WASM não é suportada.')
  }
  const width = cursor.readU8()
  if (width < 1 || width > 64) {
    throw new WasmNetlistError('invalid-width', 'A largura do resultado WASM é inválida.')
  }
  const nodeCount = cursor.readU16()
  if (nodeCount !== components.length) {
    throw new WasmNetlistError('invalid-result', 'A quantidade de nós do resultado não coincide com o netlist.')
  }

  const values: Record<string, BitVector> = {}
  for (const id of ids) {
    const rawValue = cursor.readU64()
    try {
      values[id] = bitVector(width, rawValue)
    } catch {
      throw new WasmNetlistError('invalid-result', `O valor VRES de "${id}" não cabe na largura declarada.`)
    }
  }
  const orderCount = cursor.readU16()
  if (orderCount !== nodeCount) {
    throw new WasmNetlistError('invalid-result', 'A ordem topológica retornada está incompleta.')
  }
  const order: string[] = []
  const seen = new Set<number>()
  for (let index = 0; index < orderCount; index += 1) {
    const nodeIndex = cursor.readU16()
    if (nodeIndex >= nodeCount || seen.has(nodeIndex)) {
      throw new WasmNetlistError('invalid-result', 'A ordem topológica retornada não é uma permutação.')
    }
    seen.add(nodeIndex)
    order.push(ids[nodeIndex])
  }
  if (!cursor.atEnd()) {
    throw new WasmNetlistError('invalid-result', 'O resultado WASM contém bytes extras.')
  }

  const outputs: Record<string, BitVector> = {}
  components.forEach((component) => {
    if (component.type === 'output') outputs[component.id] = values[component.id]
  })
  return { width, values, outputs, order }
}

function validateComponentId(component: ComponentSpec): string {
  if (!component.id || encoder.encode(component.id).length > 255) {
    throw new WasmNetlistError('invalid-shape', 'Cada ID do netlist WASM deve ter de 1 a 255 bytes UTF-8.')
  }
  return component.id
}

function resolveUniformWidth(components: readonly ComponentSpec[]): number {
  const widths = components.map((component) => component.options?.width ?? 1)
  const width = widths[0]
  if (!Number.isInteger(width) || width < 1 || width > 64 || widths.some((candidate) => candidate !== width)) {
    throw new WasmNetlistError('invalid-width', 'A ABI WASM exige largura uniforme entre 1 e 64 bits.')
  }
  return width
}

function kindFor(type: ComponentType): number {
  const kind = (WASM_NETLIST_KINDS as Partial<Record<ComponentType, number>>)[type]
  if (kind === undefined) {
    throw new WasmNetlistError('invalid-shape', `O componente "${type}" não faz parte do subconjunto WASM.`)
  }
  return kind
}

function validateArity(type: ComponentType, inputCount: number): void {
  const expected = type === 'input' || type === 'constant' ? 0 : type === 'not' || type === 'output' ? 1 : undefined
  if (expected !== undefined && inputCount !== expected) {
    throw new WasmNetlistError('invalid-shape', `O componente "${type}" espera ${expected} entradas.`)
  }
  if (expected === undefined && inputCount === 0) {
    throw new WasmNetlistError('invalid-shape', `A porta "${type}" precisa de pelo menos uma entrada.`)
  }
}

function booleanToBits(value: boolean): bigint {
  return value ? 1n : 0n
}

function vectorInputToBits(value: VectorInput, width: number): bigint {
  try {
    const vector = typeof value === 'object' && value !== null && 'bits' in value
      ? value
      : bitVector(width, value)
    if (vector.width !== width) {
      throw new Error(`width ${vector.width}`)
    }
    return toBigInt(vector)
  } catch {
    throw new WasmNetlistError('invalid-value', `O override não cabe em ${width} bits.`)
  }
}

function pushAscii(bytes: number[], value: string): void {
  for (const character of value) bytes.push(character.charCodeAt(0))
}

function pushId(bytes: number[], id: string): void {
  const encoded = encoder.encode(id)
  bytes.push(encoded.length, ...encoded)
}

function pushU16(bytes: number[], value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new WasmNetlistError('invalid-shape', 'Inteiro fora do limite u16 no payload WASM.')
  }
  bytes.push(value & 0xff, (value >>> 8) & 0xff)
}

function pushU64(bytes: number[], value: bigint): void {
  if (value < 0n || value > 0xffff_ffff_ffff_ffffn) {
    throw new WasmNetlistError('invalid-value', 'Valor fora do limite u64 no payload WASM.')
  }
  const buffer = new ArrayBuffer(8)
  new DataView(buffer).setBigUint64(0, value, true)
  bytes.push(...new Uint8Array(buffer))
}

class Reader {
  private offset = 0

  constructor(private readonly view: DataView) {}

  readAscii(length: number): string {
    return String.fromCharCode(...this.readBytes(length))
  }

  readU8(): number {
    return this.readBytes(1)[0]
  }

  readU16(): number {
    this.ensure(2)
    const value = this.view.getUint16(this.offset, true)
    this.offset += 2
    return value
  }

  readU64(): bigint {
    this.ensure(8)
    const value = this.view.getBigUint64(this.offset, true)
    this.offset += 8
    return value
  }

  atEnd(): boolean {
    return this.offset === this.view.byteLength
  }

  private readBytes(length: number): Uint8Array {
    this.ensure(length)
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length)
    this.offset += length
    return bytes
  }

  private ensure(length: number): void {
    if (length < 0 || this.offset + length > this.view.byteLength) {
      throw new WasmNetlistError('invalid-result', 'O resultado WASM foi truncado.')
    }
  }
}
