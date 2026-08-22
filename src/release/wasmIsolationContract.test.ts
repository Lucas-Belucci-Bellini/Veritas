import { describe, expect, it } from 'vitest'
import {
  checkArtifactIsolation,
  checkProductionSource,
  checkRequiredArtifacts,
  checkRustFeatureOptIn,
  FORBIDDEN_ARTIFACT_MARKERS,
  renderWasmIsolationReport,
  WASM_ISOLATION_IDS,
} from '../../scripts/wasm-isolation-contract.mjs'

const cleanSources = [
  { path: 'src/main.tsx', content: "import App from './App'" },
  { path: 'src/App.tsx', content: 'export function App() { return null }' },
]

const cleanArtifacts = [
  { path: 'dist/index.html', content: '<main id="root"></main>' },
  { path: 'dist/assets/index.js', content: 'evaluateVectorNetlist; IndexedDB;' },
  { path: 'mcp/dist/server.js', content: 'createVeritasServer;' },
  { path: 'plugins/veritas-logic/server.mjs', content: 'createVeritasServer;' },
]

describe('contrato de isolamento WASM-004', () => {
  it('mantém IDs estáveis e únicos', () => {
    expect(WASM_ISOLATION_IDS).toEqual(['WASM-004-001', 'WASM-004-002', 'WASM-004-003', 'WASM-004-004', 'WASM-004-005'])
    expect(new Set(WASM_ISOLATION_IDS).size).toBe(WASM_ISOLATION_IDS.length)
    expect(FORBIDDEN_ARTIFACT_MARKERS).toContain('veritas_wasm_')
    expect(FORBIDDEN_ARTIFACT_MARKERS).toContain('VNET')
  })

  it('aceita fontes produtivas e artefatos sem a ponte experimental', () => {
    expect(checkProductionSource(cleanSources)).toMatchObject({ id: 'WASM-004-001', status: 'PASS' })
    expect(checkArtifactIsolation(cleanArtifacts)).toMatchObject({ id: 'WASM-004-002', status: 'PASS' })
    expect(checkRustFeatureOptIn('[features]\ndefault = []\nwasm-netlist-abi = []')).toMatchObject({ id: 'WASM-004-003', status: 'PASS' })
    expect(checkRequiredArtifacts(cleanArtifacts, cleanArtifacts.map((entry) => entry.path))).toMatchObject({ id: 'WASM-004-004', status: 'PASS' })
  })

  it('rejeita imports, símbolos, feature default e artefatos ausentes', () => {
    expect(checkProductionSource([{ path: 'src/main.tsx', content: "import { encodeWasmNetlist } from './wasm/netlistAbi'" }])).toMatchObject({ status: 'FAIL' })
    expect(checkArtifactIsolation([{ path: 'dist/assets/index.js', content: 'veritas_wasm_evaluate' }])).toMatchObject({ status: 'FAIL' })
    expect(checkRustFeatureOptIn('[features]\ndefault = ["wasm-netlist-abi"]\nwasm-netlist-abi = []')).toMatchObject({ status: 'FAIL' })
    expect(checkRequiredArtifacts(cleanArtifacts, ['dist/missing.js'])).toMatchObject({ status: 'FAIL' })
  })

  it('renderiza somente mensagens sanitizadas no relatório', () => {
    const report = renderWasmIsolationReport([{ id: 'WASM-004-001', operation: 'fonte', status: 'PASS', message: 'ok\nsem segredo' }])
    expect(report).toContain('WASM-004-001 PASS')
    expect(report).toContain('ok sem segredo')
    expect(report).not.toContain('\nsem segredo')
  })
})
