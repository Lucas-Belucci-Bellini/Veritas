import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  REALTIME_TEMPORAL_EVENTS,
  isBlockedRealtimeStatus,
  isAllowedRealtimeEvent,
  realtimeTopic,
  sanitizeRealtimeMessage,
} from './realtimeAcceptanceContract.mjs'

const REALTIME_TIMEOUT_MS = Number(process.env.RT_TIMEOUT_MS || 6000)
const REALTIME_RUNNER_ALLOW_REAL = process.env.REALTIME_RUNNER_ALLOW_REAL === '1'
const REALTIME_REQUIRE_REAL = process.env.RT_REQUIRE_REAL === '1'

function reportPath() {
  return resolve(process.cwd(), process.env.RT_REPORT_PATH || `artifacts/realtime-acceptance-${Date.now()}.md`)
}

function env(name) {
  return process.env[name]?.trim() || ''
}

function result(id, status, message, operation) {
  return { id, status, message: sanitizeRealtimeMessage(message), operation }
}

function missing(requiredNames) {
  return requiredNames.filter((name) => !env(name))
}

function timeoutPromise(label, timeoutMs = REALTIME_TIMEOUT_MS) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} excedeu ${timeoutMs}ms`)), timeoutMs)
  })
}

async function subscribe(channel, label) {
  return Promise.race([
    new Promise((resolve, reject) => {
      channel.subscribe((status, error) => {
        if (status === 'SUBSCRIBED') resolve(status)
        else if (isBlockedRealtimeStatus(status)) reject(error ?? new Error(`${label}: ${status}`))
      })
    }),
    timeoutPromise(`${label} subscribe`),
  ])
}

async function connect(token, projectId, roomId, label) {
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const channel = client.channel(realtimeTopic(projectId, roomId), { config: { private: true } })
  await subscribe(channel, label)
  return { client, channel }
}

async function closeSession(session) {
  if (!session) return
  try {
    await session.client.removeChannel(session.channel)
  } catch {
    // Cleanup is best effort and must not hide the acceptance result.
  }
}

async function send(channel, event, payload, label) {
  if (!isAllowedRealtimeEvent(event)) throw new Error(`Evento fora da allowlist: ${event}`)
  const response = await Promise.race([
    channel.send({ type: 'broadcast', event, payload }),
    timeoutPromise(`${label} send`),
  ])
  return response
}

async function waitForMessage(received, label) {
  return Promise.race([
    new Promise((resolve) => {
      const started = Date.now()
      const poll = () => {
        if (received.value) resolve(received.value)
        else if (Date.now() - started >= REALTIME_TIMEOUT_MS) resolve(null)
        else setTimeout(poll, 50)
      }
      poll()
    }),
    timeoutPromise(`${label} receive`),
  ])
}

async function runRealScenario(id, operation, requiredNames, callback) {
  if (!REALTIME_RUNNER_ALLOW_REAL) {
    return result(id, 'SKIP', 'modo real desabilitado; use REALTIME_RUNNER_ALLOW_REAL=1', operation)
  }
  const missingNames = missing(['SUPABASE_URL', 'SUPABASE_ANON_KEY', ...requiredNames])
  if (missingNames.length > 0) {
    const message = `variáveis ausentes: ${missingNames.join(', ')}`
    return result(id, REALTIME_REQUIRE_REAL ? 'FAIL' : 'SKIP', message, operation)
  }
  try {
    return result(id, 'PASS', await callback(), operation)
  } catch (error) {
    return result(id, 'FAIL', error instanceof Error ? error.message : String(error), operation)
  }
}

async function main() {
  const projectId = env('RT_PROJECT_ID')
  const roomId = env('RT_ROOM_ID') || 'main'
  const results = []

  if (REALTIME_RUNNER_ALLOW_REAL && !projectId) {
    results.push(result('RT-001', REALTIME_REQUIRE_REAL ? 'FAIL' : 'SKIP', 'RT_PROJECT_ID ausente', 'presença autorizada'))
    for (const id of ['RT-002', 'RT-003', 'RT-004', 'RT-005']) {
      results.push(result(id, REALTIME_REQUIRE_REAL ? 'FAIL' : 'SKIP', 'RT_PROJECT_ID ausente', 'cenário não executado'))
    }
  } else {
    results.push(await runRealScenario('RT-001', 'presença autorizada', ['RT_OWNER_ACCESS_TOKEN'], async () => {
      const session = await connect(env('RT_OWNER_ACCESS_TOKEN'), projectId, roomId, 'RT-001')
      try {
        const presence = { projectId, roomId, kind: 'document', userId: 'acceptance-owner', label: 'acceptance-owner', color: '#2563eb', role: 'owner' }
        const tracked = await session.channel.track(presence)
        if (tracked !== 'ok') throw new Error(`track retornou ${tracked}`)
        return 'owner conectou e publicou Presence'
      } finally {
        await closeSession(session)
      }
    }))

    results.push(await runRealScenario('RT-002', 'runtime_config editor para owner', ['RT_OWNER_ACCESS_TOKEN', 'RT_EDITOR_ACCESS_TOKEN'], async () => {
      const owner = await connect(env('RT_OWNER_ACCESS_TOKEN'), projectId, roomId, 'RT-002 owner')
      const editor = await connect(env('RT_EDITOR_ACCESS_TOKEN'), projectId, roomId, 'RT-002 editor')
      const received = { value: null }
      owner.channel.on('broadcast', { event: 'runtime_config' }, ({ payload }) => { received.value = payload })
      try {
        const payload = {
          projectId,
          roomId,
          clockPeriods: { 'acceptance-clock': 2 },
          configHash: 'acceptance-config',
          baseVersion: 0,
          clientId: 'acceptance-editor',
          sentAt: new Date().toISOString(),
        }
        const sent = await send(editor.channel, 'runtime_config', payload, 'RT-002')
        if (sent !== 'ok') throw new Error(`send runtime_config retornou ${sent}`)
        const message = await waitForMessage(received, 'RT-002')
        if (!message || message.clientId !== 'acceptance-editor') throw new Error('owner não recebeu runtime_config do editor')
        return 'editor publicou runtime_config e owner recebeu o evento'
      } finally {
        await closeSession(editor)
        await closeSession(owner)
      }
    }))

    results.push(await runRealScenario('RT-003', 'viewer não pode publicar runtime_state', ['RT_VIEWER_ACCESS_TOKEN'], async () => {
      const session = await connect(env('RT_VIEWER_ACCESS_TOKEN'), projectId, roomId, 'RT-003 viewer')
      try {
        const response = await send(session.channel, 'runtime_state', {
          projectId,
          roomId,
          state: { acceptance: true },
          stateHash: 'acceptance-state',
          baseVersion: 0,
          clientId: 'acceptance-viewer',
          sentAt: new Date().toISOString(),
        }, 'RT-003')
        throw new Error(`viewer conseguiu publicar runtime_state (${response})`)
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('viewer conseguiu publicar')) throw error
        return 'viewer conectou, mas a policy rejeitou a publicação temporal'
      } finally {
        await closeSession(session)
      }
    }))

    results.push(await runRealScenario('RT-004', 'usuário externo não acessa o projeto', ['RT_OTHER_ACCESS_TOKEN'], async () => {
      try {
        const session = await connect(env('RT_OTHER_ACCESS_TOKEN'), projectId, roomId, 'RT-004 other')
        await closeSession(session)
        throw new Error('usuário externo conseguiu assinar o tópico privado')
      } catch (error) {
        if (error instanceof Error && error.message.includes('conseguiu assinar')) throw error
        return 'usuário externo foi rejeitado ao assinar o tópico do projeto'
      }
    }))

    results.push(await runRealScenario('RT-005', 'sala não permitida não é assinável', ['RT_OWNER_ACCESS_TOKEN'], async () => {
      const invalidRoom = env('RT_INVALID_ROOM') || 'acceptance-room-that-does-not-exist'
      try {
        const session = await connect(env('RT_OWNER_ACCESS_TOKEN'), projectId, invalidRoom, 'RT-005 invalid room')
        await closeSession(session)
        throw new Error('sala inexistente foi assinada')
      } catch (error) {
        if (error instanceof Error && error.message.includes('foi assinada')) throw error
        return `sala ${invalidRoom} foi rejeitada pela allowlist de salas`
      }
    }))
  }

  const report = [
    `# Realtime acceptance ${new Date().toISOString()}`,
    '',
    `Projeto: ${projectId || '[não informado]'}`,
    `Sala: ${roomId}`,
    `Eventos autorizados: ${REALTIME_TEMPORAL_EVENTS.join(', ')}`,
    '',
    'Tokens não são gravados neste relatório.',
    '',
    ...results.map((item) => `${item.id} ${item.status} — ${item.operation}: ${item.message}`),
    '',
    `Resumo: ${results.filter((item) => item.status === 'PASS').length} PASS, ${results.filter((item) => item.status === 'FAIL').length} FAIL, ${results.filter((item) => item.status === 'SKIP').length} SKIP.`,
  ].join('\n')
  const outputFile = reportPath()
  mkdirSync(dirname(outputFile), { recursive: true })
  writeFileSync(outputFile, `${report}\n`)
  console.log(report)
  console.log(`Relatório sanitizado: ${outputFile}`)
  if (results.some((item) => item.status === 'FAIL')) process.exitCode = 1
}

main().catch((error) => {
  console.error(`Realtime runner abortado: ${sanitizeRealtimeMessage(error)}`)
  process.exitCode = 1
})
