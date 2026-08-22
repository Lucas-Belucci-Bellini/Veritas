export interface WasmIsolationEntry {
  path: string
  content: string
}

export interface WasmIsolationResult {
  id: string
  operation: string
  status: 'PASS' | 'FAIL'
  message: string
}

export const WASM_ISOLATION_IDS: readonly string[]
export const FORBIDDEN_ARTIFACT_MARKERS: readonly string[]
export function checkProductionSource(entries: readonly WasmIsolationEntry[]): WasmIsolationResult
export function checkArtifactIsolation(entries: readonly WasmIsolationEntry[]): WasmIsolationResult
export function checkRustFeatureOptIn(cargoToml: string): WasmIsolationResult
export function checkRequiredArtifacts(entries: readonly WasmIsolationEntry[], requiredPaths: readonly string[]): WasmIsolationResult
export function renderWasmIsolationReport(results: readonly WasmIsolationResult[]): string
export function sanitizeWasmIsolationMessage(message: unknown): string
