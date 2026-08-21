import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { renderRlsReport } from './rlsAcceptanceContract.mjs'
const TABLE_SELECTS = {
  veritas_circuit_projects: 'id,user_id,name',
  veritas_circuit_context: 'id,user_id,source_ref',
  veritas_circuit_versions: 'id,project_id,user_id,version_number',
  veritas_circuit_rooms: 'id,project_id,room_id,kind',
  veritas_ai_metrics: 'id,user_id,action',
  veritas_circuit_collaborators: 'project_id,user_id,role',
}

function env(name, required = true) {
  const value = process.env[name]?.trim()
  if (!value && required) throw new Error(`Variável obrigatória ausente: ${name}`)
  return value ?? ''
}

function reportPath() {
  return resolve(process.cwd(), process.env.RLS_REPORT_PATH || `artifacts/rls-acceptance-${Date.now()}.md`)
}

function safeError(error) {
  const message = error?.message ?? String(error)
  return String(message).replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/password\s*=\s*\S+/gi, 'password=[redacted]').slice(0, 240)
}

function client(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function signIn(supabase, label, email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user || !data.session) throw new Error(`${label}: login falhou: ${safeError(error)}`)
  return { label, id: data.user.id, accessToken: data.session.access_token }
}

function fixtureDocument(name) {
  return {
    format: 'veritas-circuit',
    version: 1,
    name,
    nodes: [{ id: 'input-a', type: 'input', position: { x: 0, y: 0 }, data: { label: 'A' } }],
    edges: [],
  }
}

function rpcRow(data) {
  if (Array.isArray(data)) return data[0]
  return data
}

async function syncProject(supabase, projectId, name, document, baseVersion) {
  const { data, error } = await supabase.rpc('veritas_sync_circuit_project', {
    p_project_id: projectId,
    p_name: name,
    p_document: document,
    p_content_hash: `beta-${name}-${baseVersion}`,
    p_change_summary: { fixture: true },
    p_base_version: baseVersion,
  })
  if (error) throw error
  const row = rpcRow(data)
  if (!row?.project_id) throw new Error('sync retornou uma linha inválida')
  return row
}

async function selectFixture(supabase, table, column, value) {
  const { data, error } = await supabase.from(table).select(TABLE_SELECTS[table]).eq(column, value)
  if (error) throw error
  return data ?? []
}

async function expectNoRows(supabase, table, column, value) {
  const rows = await selectFixture(supabase, table, column, value)
  return rows.length === 0
}

async function expectRejected(operation) {
  try {
    const result = await operation()
    if (result?.error) return true
    if (Array.isArray(result?.data)) return result.data.length === 0
    return false
  } catch {
    return true
  }
}

function makeResult(id, status, message, logicalUser, operation) {
  return { id, status, message: String(message).slice(0, 240), logicalUser, operation }
}

async function runCase(results, id, logicalUser, operation, fn) {
  try {
    const outcome = await fn()
    results.push(makeResult(id, outcome ? 'PASS' : 'FAIL', outcome ? 'resultado esperado confirmado' : 'resultado observado não corresponde ao esperado', logicalUser, operation))
  } catch (error) {
    results.push(makeResult(id, 'FAIL', safeError(error), logicalUser, operation))
  }
}

async function runOptionalCase(results, id, logicalUser, operation, required, fn) {
  if (!required) {
    results.push(makeResult(id, 'SKIP', 'execução opcional não habilitada; use o modo obrigatório no beta', logicalUser, operation))
    return
  }
  await runCase(results, id, logicalUser, operation, fn)
}

async function realtimeAttempt(supabase, topic, action) {
  const channel = supabase.channel(topic, { config: { private: true } })
  let status = 'TIMED_OUT'
  let received = false
  channel.on('broadcast', { event: 'circuit_snapshot' }, () => { received = true })
  const subscribed = await new Promise((resolveStatus) => {
    const timeout = setTimeout(() => resolveStatus(false), 8000)
    channel.subscribe((next) => {
      status = next
      if (next === 'SUBSCRIBED' || next === 'CHANNEL_ERROR' || next === 'TIMED_OUT' || next === 'CLOSED') {
        clearTimeout(timeout)
        resolveStatus(next === 'SUBSCRIBED')
      }
    })
  })
  let sendStatus = 'not-subscribed'
  if (subscribed) {
    const response = await action(channel)
    sendStatus = typeof response === 'string' ? response : response?.status ?? 'unknown'
  }
  await supabase.removeChannel(channel)
  return { subscribed, status, sendStatus, received }
}

async function edgeRequest(url, token, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, body: text.slice(0, 1200) }
}

async function main() {
  if (process.env.RLS_RUNNER_ALLOW_REAL !== '1') {
    throw new Error('O runner real exige RLS_RUNNER_ALLOW_REAL=1 para evitar execução acidental contra contas reais.')
  }

  const url = env('SUPABASE_URL')
  const key = env('SUPABASE_PUBLISHABLE_KEY')
  const users = {
    owner: { email: env('RLS_OWNER_EMAIL'), password: env('RLS_OWNER_PASSWORD') },
    other: { email: env('RLS_OTHER_EMAIL'), password: env('RLS_OTHER_PASSWORD') },
    editor: { email: env('RLS_EDITOR_EMAIL'), password: env('RLS_EDITOR_PASSWORD') },
    viewer: { email: env('RLS_VIEWER_EMAIL'), password: env('RLS_VIEWER_PASSWORD') },
  }
  const clients = Object.fromEntries(Object.keys(users).map((label) => [label, client(url, key)]))
  const sessions = {}
  for (const label of Object.keys(users)) sessions[label] = await signIn(clients[label], label, users[label].email, users[label].password)

  const results = []
  const prefix = process.env.RLS_FIXTURE_PREFIX?.trim() || `beta-rls-${Date.now()}`
  const name = `${prefix}-owner`
  const document = fixtureDocument(name)
  let ownerProjectId
  let ownerVersion = 0
  let ownerContextId
  let ownerMetricId
  let ownerRoomId
  let otherProjectId
  let otherRoomId

  try {
    const ownerInitial = await syncProject(clients.owner, null, name, document, 0)
    ownerProjectId = ownerInitial.project_id
    ownerVersion = ownerInitial.version_number
    ownerRoomId = 'alpha'
    const room = await clients.owner.rpc('veritas_create_circuit_room', { p_project_id: ownerProjectId, p_room_id: ownerRoomId, p_kind: 'document' })
    if (room.error) throw room.error
    const collaboratorEditor = await clients.owner.rpc('veritas_add_circuit_collaborator', { p_project_id: ownerProjectId, p_user_id: sessions.editor.id, p_role: 'editor' })
    if (collaboratorEditor.error) throw collaboratorEditor.error
    const collaboratorViewer = await clients.owner.rpc('veritas_add_circuit_collaborator', { p_project_id: ownerProjectId, p_user_id: sessions.viewer.id, p_role: 'viewer' })
    if (collaboratorViewer.error) throw collaboratorViewer.error

    const context = await clients.owner.from('veritas_circuit_context').insert({
      user_id: sessions.owner.id,
      source_ref: prefix,
      context_type: 'circuit',
      circuit_name: name,
      summary: 'Fixture descartável de aceitação RLS.',
      payload: { fixture: true },
      tags: ['beta', 'rls'],
      content_hash: `${prefix}-context`,
    }).select('id').single()
    if (context.error) throw context.error
    ownerContextId = context.data.id

    const metric = await clients.owner.from('veritas_ai_metrics').insert({
      user_id: sessions.owner.id,
      action: 'analyze',
      provider: 'heuristic',
      latency_ms: 1,
      success: true,
      confidence: 1,
      content_hash: `${prefix}-metric`,
      metadata: { fixture: true },
    }).select('id').single()
    if (metric.error) throw metric.error
    ownerMetricId = metric.data.id

    const otherInitial = await syncProject(clients.other, null, `${prefix}-other`, fixtureDocument(`${prefix}-other`), 0)
    otherProjectId = otherInitial.project_id
    const otherRoom = await clients.other.rpc('veritas_create_circuit_room', { p_project_id: otherProjectId, p_room_id: 'alpha', p_kind: 'document' })
    if (otherRoom.error) throw otherRoom.error
    otherRoomId = 'alpha'

    await runCase(results, 'RLS-001', 'anon', 'select protected tables', async () => {
      const anon = client(url, key)
      return (await Promise.all([
        expectNoRows(anon, 'veritas_circuit_projects', 'id', ownerProjectId),
        expectNoRows(anon, 'veritas_circuit_context', 'id', ownerContextId),
        expectNoRows(anon, 'veritas_circuit_versions', 'project_id', ownerProjectId),
        expectNoRows(anon, 'veritas_circuit_rooms', 'project_id', ownerProjectId),
        expectNoRows(anon, 'veritas_ai_metrics', 'id', ownerMetricId),
      ])).every(Boolean)
    })

    await runCase(results, 'RLS-002', 'owner', 'select own fixture', async () => (await Promise.all([
      selectFixture(clients.owner, 'veritas_circuit_projects', 'id', ownerProjectId),
      selectFixture(clients.owner, 'veritas_circuit_context', 'id', ownerContextId),
      selectFixture(clients.owner, 'veritas_circuit_versions', 'project_id', ownerProjectId),
      selectFixture(clients.owner, 'veritas_circuit_rooms', 'project_id', ownerProjectId),
      selectFixture(clients.owner, 'veritas_ai_metrics', 'id', ownerMetricId),
    ])).every((rows) => rows.length > 0))

    await runCase(results, 'RLS-003', 'other', 'select owner fixture', async () => (await Promise.all([
      expectNoRows(clients.other, 'veritas_circuit_projects', 'id', ownerProjectId),
      expectNoRows(clients.other, 'veritas_circuit_context', 'id', ownerContextId),
      expectNoRows(clients.other, 'veritas_circuit_versions', 'project_id', ownerProjectId),
      expectNoRows(clients.other, 'veritas_circuit_rooms', 'project_id', ownerProjectId),
      expectNoRows(clients.other, 'veritas_ai_metrics', 'id', ownerMetricId),
    ])).every(Boolean))

    await runCase(results, 'RLS-004', 'other', 'insert with owner user_id', async () => (await Promise.all([
      expectRejected(() => clients.other.from('veritas_circuit_context').insert({ user_id: sessions.owner.id, source_ref: `${prefix}-forbidden`, context_type: 'circuit', circuit_name: 'forbidden', summary: 'forbidden', payload: {} })),
      expectRejected(() => clients.other.from('veritas_ai_metrics').insert({ user_id: sessions.owner.id, action: 'analyze', provider: 'heuristic', latency_ms: 1, success: true, metadata: {} })),
      expectRejected(() => clients.other.from('veritas_circuit_projects').insert({ user_id: sessions.owner.id, name: `${prefix}-forbidden`, document, content_hash: `${prefix}-forbidden` })),
    ])).every(Boolean))

    await runCase(results, 'RLS-005', 'other', 'update/delete owner rows', async () => (await Promise.all([
      expectRejected(() => clients.other.from('veritas_circuit_projects').update({ name: `${prefix}-changed` }).eq('id', ownerProjectId).select('id')),
      expectRejected(() => clients.other.from('veritas_circuit_context').delete().eq('id', ownerContextId).select('id')),
      expectRejected(() => clients.other.from('veritas_ai_metrics').delete().eq('id', ownerMetricId).select('id')),
      expectRejected(() => clients.other.from('veritas_circuit_versions').delete().eq('project_id', ownerProjectId).select('id')),
    ])).every(Boolean))

    await runCase(results, 'RLS-006', 'owner', 'add collaborators', async () => {
      const validEditor = await clients.owner.rpc('veritas_add_circuit_collaborator', { p_project_id: ownerProjectId, p_user_id: sessions.editor.id, p_role: 'editor' })
      const validViewer = await clients.owner.rpc('veritas_add_circuit_collaborator', { p_project_id: ownerProjectId, p_user_id: sessions.viewer.id, p_role: 'viewer' })
      const invalidRole = await clients.owner.rpc('veritas_add_circuit_collaborator', { p_project_id: ownerProjectId, p_user_id: sessions.other?.id ?? sessions.other.id, p_role: 'admin' })
      return !validEditor.error && !validViewer.error && Boolean(invalidRole.error)
    })

    await runCase(results, 'RLS-007', 'other/editor', 'manage collaborators as non-owner', async () => {
      const otherAdd = await clients.other.rpc('veritas_add_circuit_collaborator', { p_project_id: ownerProjectId, p_user_id: sessions.other.id, p_role: 'viewer' })
      const editorRemove = await clients.editor.rpc('veritas_remove_circuit_collaborator', { p_project_id: ownerProjectId, p_user_id: sessions.viewer.id })
      return Boolean(otherAdd.error) && Boolean(editorRemove.error)
    })

    await runCase(results, 'RLS-008', 'editor', 'select shared project', async () => (await Promise.all([
      selectFixture(clients.editor, 'veritas_circuit_projects', 'id', ownerProjectId),
      selectFixture(clients.editor, 'veritas_circuit_collaborators', 'project_id', ownerProjectId),
      selectFixture(clients.editor, 'veritas_circuit_rooms', 'project_id', ownerProjectId),
      selectFixture(clients.editor, 'veritas_circuit_versions', 'project_id', ownerProjectId),
    ])).every((rows) => rows.length > 0))

    await runCase(results, 'RLS-009', 'viewer', 'write shared project', async () => {
      const projectUpdate = await clients.viewer.from('veritas_circuit_projects').update({ name: `${prefix}-viewer` }).eq('id', ownerProjectId).select('id')
      const versionInsert = await clients.viewer.from('veritas_circuit_versions').insert({ project_id: ownerProjectId, user_id: sessions.viewer.id, version_number: 999, name, document, content_hash: `${prefix}-viewer` })
      const sync = await clients.viewer.rpc('veritas_sync_circuit_project', { p_project_id: ownerProjectId, p_name: name, p_document: document, p_content_hash: `${prefix}-viewer-sync`, p_change_summary: {}, p_base_version: ownerVersion })
      return Boolean(projectUpdate.error) && Boolean(versionInsert.error) && Boolean(sync.error)
    })

    const editorSync = await syncProject(clients.editor, ownerProjectId, name, document, ownerVersion)
    ownerVersion = editorSync.version_number
    await runCase(results, 'RLS-010', 'editor', 'sync valid project', async () => Boolean(editorSync.project_id && editorSync.version_number > 1))

    const ownerSync = await syncProject(clients.owner, ownerProjectId, name, document, ownerVersion)
    const conflict = await clients.editor.rpc('veritas_sync_circuit_project', { p_project_id: ownerProjectId, p_name: name, p_document: document, p_content_hash: `${prefix}-conflict`, p_change_summary: {}, p_base_version: ownerVersion })
    await runCase(results, 'RLS-011', 'owner/editor', 'optimistic conflict', async () => ownerSync.version_number === ownerVersion + 1 && Boolean(conflict.error) && /CIRCUIT_CONFLICT/.test(conflict.error.message ?? ''))
    ownerVersion = ownerSync.version_number

    const realtimeRequired = process.env.RLS_REQUIRE_REALTIME === '1'
    await runOptionalCase(results, 'RLS-012', 'editor', 'ghost room realtime', realtimeRequired, async () => {
      const attempt = await realtimeAttempt(clients.editor, `veritas:project:${ownerProjectId}:room:ghost`, (channel) => channel.send({ type: 'presence', event: 'track', payload: { fixture: true } }))
      return !attempt.subscribed || attempt.sendStatus !== 'ok'
    })

    await runCase(results, 'RLS-013', 'editor A', 'room of project B realtime', async () => {
      const attempt = await realtimeAttempt(clients.editor, `veritas:project:${otherProjectId}:room:${otherRoomId}`, (channel) => channel.send({ type: 'broadcast', event: 'circuit_snapshot', payload: { fixture: true } }))
      return !attempt.subscribed || attempt.sendStatus !== 'ok'
    })

    await runOptionalCase(results, 'RLS-014', 'editor/viewer', 'authorized presence', realtimeRequired, async () => {
      const editorAttempt = await realtimeAttempt(clients.editor, `veritas:project:${ownerProjectId}:room:${ownerRoomId}`, (channel) => channel.track({ fixture: true, role: 'editor' }))
      const viewerAttempt = await realtimeAttempt(clients.viewer, `veritas:project:${ownerProjectId}:room:${ownerRoomId}`, (channel) => channel.track({ fixture: true, role: 'viewer' }))
      return editorAttempt.subscribed && viewerAttempt.subscribed && editorAttempt.sendStatus === 'ok' && viewerAttempt.sendStatus === 'ok'
    })

    await runOptionalCase(results, 'RLS-015', 'viewer', 'broadcast snapshot', realtimeRequired, async () => {
      const attempt = await realtimeAttempt(clients.viewer, `veritas:project:${ownerProjectId}:room:${ownerRoomId}`, (channel) => channel.send({ type: 'broadcast', event: 'circuit_snapshot', payload: { fixture: true } }))
      return !attempt.subscribed || attempt.sendStatus !== 'ok'
    })

    await runOptionalCase(results, 'RLS-016', 'editor', 'broadcast snapshot autorizado', realtimeRequired, async () => {
      const attempt = await realtimeAttempt(clients.editor, `veritas:project:${ownerProjectId}:room:${ownerRoomId}`, (channel) => channel.send({ type: 'broadcast', event: 'circuit_snapshot', payload: { fixture: true, baseVersion: ownerVersion } }))
      return attempt.subscribed && attempt.sendStatus === 'ok'
    })

    await runOptionalCase(results, 'RLS-017', 'editor', 'broadcast event inválido', realtimeRequired, async () => {
      const attempt = await realtimeAttempt(clients.editor, `veritas:project:${ownerProjectId}:room:${ownerRoomId}`, (channel) => channel.send({ type: 'broadcast', event: 'other_event', payload: { fixture: true } }))
      return !attempt.subscribed || attempt.sendStatus !== 'ok'
    })

    await runOptionalCase(results, 'RLS-018', 'other', 'métrica Realtime de owner', realtimeRequired, async () => {
      const attempt = await realtimeAttempt(clients.other, `veritas:ai-metrics:${sessions.owner.id}`, (channel) => channel.track({ fixture: true }))
      return !attempt.subscribed
    })

    const edgeUrl = process.env.RLS_EDGE_FUNCTION_URL?.trim()
    const edgeRequired = process.env.RLS_REQUIRE_EDGE === '1'
    await runOptionalCase(results, 'RLS-019', 'anon', 'Edge Function sem JWT', edgeRequired, async () => {
      const response = await edgeRequest(edgeUrl, '', { prompt: 'beta-rsl-anon', context: {} })
      return response.status === 401 || response.status === 403
    })

    await runOptionalCase(results, 'RLS-020', 'owner', 'Edge Function autenticada', edgeRequired, async () => {
      const response = await edgeRequest(edgeUrl, sessions.owner.accessToken, { prompt: 'beta-rls-owner', context: { fixture: true } })
      return response.status >= 200 && response.status < 300
    })

    await runOptionalCase(results, 'RLS-021', 'owner', 'contexto de outro usuário na Edge Function', edgeRequired, async () => {
      const response = await edgeRequest(edgeUrl, sessions.owner.accessToken, { user_id: sessions.other.id, project_id: otherProjectId, prompt: 'beta-rls-cross-user', context: { fixture: true } })
      return response.status < 200 || response.status >= 300 || (!response.body.includes(otherProjectId) && !response.body.includes(sessions.other.id))
    })

    const beforeInvalid = await selectFixture(clients.editor, 'veritas_circuit_versions', 'project_id', ownerProjectId)
    const invalidDocument = { format: 'veritas-circuit', version: 1, name, nodes: [{ id: 'a', type: 'input', position: { x: 0, y: 0 } }, { id: 'b', type: 'output', position: { x: 1, y: 1 } }], edges: [{ id: 'ab', source: 'a', target: 'missing' }] }
    const invalidSync = await clients.editor.rpc('veritas_sync_circuit_project', { p_project_id: ownerProjectId, p_name: name, p_document: invalidDocument, p_content_hash: `${prefix}-invalid`, p_change_summary: {}, p_base_version: ownerVersion })
    const afterInvalid = await selectFixture(clients.editor, 'veritas_circuit_versions', 'project_id', ownerProjectId)
    await runCase(results, 'RLS-022', 'editor', 'sync documento inválido', async () => Boolean(invalidSync.error) && afterInvalid.length === beforeInvalid.length)
  } finally {
    await Promise.allSettled([
      ownerContextId && clients.owner.from('veritas_circuit_context').delete().eq('id', ownerContextId),
      ownerMetricId && clients.owner.from('veritas_ai_metrics').delete().eq('id', ownerMetricId),
      ownerProjectId && clients.owner.from('veritas_circuit_projects').delete().eq('id', ownerProjectId),
      otherProjectId && clients.other.from('veritas_circuit_projects').delete().eq('id', otherProjectId),
    ])
    await Promise.all(Object.values(clients).map((supabase) => supabase.auth.signOut().catch(() => undefined)))
  }

  const output = renderRlsReport(prefix, results)
  const outputFile = reportPath()
  mkdirSync(dirname(outputFile), { recursive: true })
  writeFileSync(outputFile, `${output}\n`)
  console.log(output)
  console.log(`Relatório sanitizado: ${outputFile}`)
  if (results.some((result) => result.status === 'FAIL')) process.exitCode = 1
}

main().catch((error) => {
  console.error(`RLS runner abortado: ${safeError(error)}`)
  process.exitCode = 1
})
