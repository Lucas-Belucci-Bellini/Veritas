export const WASM_ISOLATION_IDS = [
  'WASM-004-001',
  'WASM-004-002',
  'WASM-004-003',
  'WASM-004-004',
  'WASM-004-005',
]

export const FORBIDDEN_ARTIFACT_MARKERS = [
  'veritas_wasm_',
  'wasm-netlist-abi',
  'wasm-netlist-parity',
  'WASM-NETLIST-ABI',
  'VNET',
  'VRES',
]

function sanitizeMessage(message) {
  return String(message)
    .replace(/[\r\n]+/g, ' ')
    .split('')
    .map((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127 ? '?' : character
    })
    .join('')
    .slice(0, 400)
}

function result(id, operation, status, message) {
  return { id, operation, status, message: sanitizeMessage(message) }
}

export function checkProductionSource(entries) {
  const forbidden = []
  for (const entry of entries) {
    if (/src[\\/]wasm(?:[\\/]|$)/.test(entry.path)) continue
    const importPattern = /(?:from\s*['"]|import\s*\(\s*['"]|require\(\s*['"])[^'"]*(?:src[\\/]wasm|[./]wasm[\\/])/u
    if (importPattern.test(entry.content) || entry.content.includes('wasm-netlist-abi')) {
      forbidden.push(entry.path)
    }
  }
  return result(
    'WASM-004-001',
    'fontes produtivas não importam a ponte experimental',
    forbidden.length === 0 ? 'PASS' : 'FAIL',
    forbidden.length === 0 ? 'nenhuma entrada produtiva referencia src/wasm ou a feature opt-in' : `referências experimentais em ${forbidden.join(', ')}`,
  )
}

export function checkArtifactIsolation(entries) {
  const violations = []
  for (const entry of entries) {
    for (const marker of FORBIDDEN_ARTIFACT_MARKERS) {
      if (entry.content.includes(marker)) violations.push(`${entry.path}:${marker}`)
    }
  }
  return result(
    'WASM-004-002',
    'artefatos distribuíveis não contêm símbolos experimentais',
    violations.length === 0 ? 'PASS' : 'FAIL',
    violations.length === 0 ? `${entries.length} arquivos distribuíveis verificados` : `marcadores proibidos em ${violations.join(', ')}`,
  )
}

export function checkRustFeatureOptIn(cargoToml) {
  const defaultMatch = cargoToml.match(/^default\s*=\s*\[([^\]]*)\]\s*$/mu)
  const hasEmptyDefault = defaultMatch !== null && defaultMatch[1].trim() === ''
  const hasOptInFeature = /^wasm-netlist-abi\s*=\s*\[\s*\]\s*$/mu.test(cargoToml)
  const status = hasEmptyDefault && hasOptInFeature ? 'PASS' : 'FAIL'
  return result(
    'WASM-004-003',
    'feature Rust de netlist permanece opt-in',
    status,
    status === 'PASS' ? 'default vazio e wasm-netlist-abi declarado sem ativação automática' : 'Cargo.toml não mantém default vazio e feature experimental opt-in',
  )
}

export function checkRequiredArtifacts(entries, requiredPaths) {
  const available = new Set(entries.map((entry) => entry.path))
  const missing = requiredPaths.filter((requiredPath) => !available.has(requiredPath))
  return result(
    'WASM-004-004',
    'artefatos produtivos esperados foram construídos',
    missing.length === 0 ? 'PASS' : 'FAIL',
    missing.length === 0 ? `${requiredPaths.length} saídas distribuíveis presentes` : `saídas ausentes: ${missing.join(', ')}`,
  )
}

export function renderWasmIsolationReport(results) {
  const lines = [
    '# WASM-004 — isolamento do runtime produtivo',
    '',
    ...results.map((item) => `- **${item.id} ${item.status}:** ${item.operation} — ${sanitizeMessage(item.message)}`),
    '',
    'O guard verifica fontes e artefatos reais após o build. Ele não carrega WASM no navegador, não cria loader/Worker/endpoint e não altera o runtime TypeScript ou a persistência local.',
    '',
  ]
  return lines.join('\n')
}

export function sanitizeWasmIsolationMessage(message) {
  return sanitizeMessage(message)
}
