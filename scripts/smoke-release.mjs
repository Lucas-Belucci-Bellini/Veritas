#!/usr/bin/env node

const baseUrl = (process.env.SMOKE_URL ?? process.argv[2] ?? '').replace(/\/$/, '')

if (!baseUrl) {
  console.error('Uso: SMOKE_URL=https://... npm run smoke:release')
  process.exit(2)
}

const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 10000)
const failures = []

async function fetchText(path) {
  const url = `${baseUrl}${path}`
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'user-agent': 'veritas-release-smoke/1.0' },
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${url} respondeu HTTP ${response.status}`)
  }

  return { response, text, url }
}

async function check(name, callback) {
  try {
    await callback()
    console.log(`PASS ${name}`)
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
    console.error(`FAIL ${name}`)
  }
}

await check('homepage carrega', async () => {
  const { text } = await fetchText('/')
  if (!text.includes('<div id="root">')) {
    throw new Error('HTML sem o root React esperado')
  }
})

await check('manifest PWA é válido', async () => {
  const { text, url } = await fetchText('/manifest.webmanifest')
  let manifest
  try {
    manifest = JSON.parse(text)
  } catch {
    throw new Error(`${url} não retornou JSON válido`)
  }

  if (!manifest.name || !manifest.start_url || !manifest.display) {
    throw new Error('manifest sem name, start_url ou display')
  }

  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    throw new Error('manifest sem ícones')
  }
})

await check('service worker está publicado', async () => {
  const { text } = await fetchText('/sw.js')
  if (!text.includes('workbox')) {
    throw new Error('sw.js não parece ser o service worker Workbox esperado')
  }
})

if (failures.length > 0) {
  console.error('\nSmoke test reprovado:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`\nSmoke test aprovado para ${baseUrl}`)
