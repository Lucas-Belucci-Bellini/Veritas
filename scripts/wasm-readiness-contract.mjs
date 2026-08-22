export const WASM_REQUIRED_ABI_EXPORTS = Object.freeze([
  'veritas_wasm_abi_version',
  'veritas_wasm_capabilities',
])

export const WASM_ALLOWED_LINKER_EXPORTS = Object.freeze([
  '__data_end',
  '__heap_base',
  'memory',
])

export const WASM_EXPECTED_ABI_VERSION = 1
export const WASM_EXPECTED_CAPABILITIES = 1

export function validateWasmModuleShape(importEntries, exportEntries) {
  const requiredAbiExports = new Set(WASM_REQUIRED_ABI_EXPORTS)
  const allowedLinkerExports = new Set(WASM_ALLOWED_LINKER_EXPORTS)
  const exports = exportEntries.map((entry) => entry.name).sort()
  const abiExports = exportEntries.filter((entry) => requiredAbiExports.has(entry.name))
  const linkerExports = exportEntries.filter((entry) => allowedLinkerExports.has(entry.name))
  const unexpectedExports = exportEntries.filter(
    (entry) => !requiredAbiExports.has(entry.name) && !allowedLinkerExports.has(entry.name),
  )
  const errors = []

  if (importEntries.length !== 0) {
    errors.push(`WASM module has ${importEntries.length} imports; expected zero`)
  }
  if (
    abiExports.length !== requiredAbiExports.size
    || abiExports.some((entry) => entry.kind !== 'function')
  ) {
    errors.push(`WASM ABI exports are incomplete or not functions: ${exports.join(', ')}`)
  }
  if (unexpectedExports.length > 0) {
    errors.push(`WASM has unexpected exports: ${unexpectedExports.map((entry) => entry.name).join(', ')}`)
  }

  return {
    ok: errors.length === 0,
    exports,
    abiExports: abiExports.map((entry) => entry.name).sort(),
    linkerExports: linkerExports.map((entry) => entry.name).sort(),
    errors,
  }
}
