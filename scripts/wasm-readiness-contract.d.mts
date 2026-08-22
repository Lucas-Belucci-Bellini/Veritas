export interface WasmImportEntry {
  module?: string
  name?: string
  kind?: string
}

export interface WasmExportEntry {
  name: string
  kind: string
}

export interface WasmModuleShapeResult {
  ok: boolean
  exports: string[]
  abiExports: string[]
  linkerExports: string[]
  errors: string[]
}

export declare const WASM_REQUIRED_ABI_EXPORTS: readonly string[]
export declare const WASM_ALLOWED_LINKER_EXPORTS: readonly string[]
export declare const WASM_EXPECTED_ABI_VERSION: 1
export declare const WASM_EXPECTED_CAPABILITIES: 1
export declare function validateWasmModuleShape(
  importEntries: readonly WasmImportEntry[],
  exportEntries: readonly WasmExportEntry[],
): WasmModuleShapeResult
