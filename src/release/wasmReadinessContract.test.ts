import { describe, expect, it } from 'vitest'
import {
  validateWasmModuleShape,
  WASM_ALLOWED_LINKER_EXPORTS,
  WASM_EXPECTED_ABI_VERSION,
  WASM_EXPECTED_CAPABILITIES,
  WASM_REQUIRED_ABI_EXPORTS,
} from '../../scripts/wasm-readiness-contract.mjs'

describe('contrato de prontidão WASM-001', () => {
  it('mantém ABI e metadados do linker explicitamente versionados', () => {
    expect(WASM_REQUIRED_ABI_EXPORTS).toEqual([
      'veritas_wasm_abi_version',
      'veritas_wasm_capabilities',
    ])
    expect(WASM_ALLOWED_LINKER_EXPORTS).toEqual(['__data_end', '__heap_base', 'memory'])
    expect(WASM_EXPECTED_ABI_VERSION).toBe(1)
    expect(WASM_EXPECTED_CAPABILITIES).toBe(1)
  })

  it('aceita somente as duas funções ABI e os metadados auxiliares conhecidos', () => {
    const result = validateWasmModuleShape(
      [],
      [
        { name: 'veritas_wasm_abi_version', kind: 'function' },
        { name: 'veritas_wasm_capabilities', kind: 'function' },
        { name: '__data_end', kind: 'global' },
        { name: '__heap_base', kind: 'global' },
        { name: 'memory', kind: 'memory' },
      ],
    )

    expect(result).toEqual({
      ok: true,
      exports: [
        '__data_end',
        '__heap_base',
        'memory',
        'veritas_wasm_abi_version',
        'veritas_wasm_capabilities',
      ],
      abiExports: ['veritas_wasm_abi_version', 'veritas_wasm_capabilities'],
      linkerExports: ['__data_end', '__heap_base', 'memory'],
      errors: [],
    })
  })

  it('rejeita imports, exports desconhecidos e ABI incompleto', () => {
    const result = validateWasmModuleShape(
      [{ module: 'env', name: 'unexpected' }],
      [
        { name: 'veritas_wasm_abi_version', kind: 'global' },
        { name: 'unexpected_export', kind: 'function' },
      ],
    )

    expect(result.ok).toBe(false)
    expect(result.errors).toEqual([
      'WASM module has 1 imports; expected zero',
      'WASM ABI exports are incomplete or not functions: unexpected_export, veritas_wasm_abi_version',
      'WASM has unexpected exports: unexpected_export',
    ])
  })
})
