import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { TauriSimulationClient, isTauriSimulationRuntime, NATIVE_SIMULATION_PROGRESS_EVENT, NATIVE_SIMULATION_CANCEL_COMMAND, NATIVE_SIMULATION_COMMAND } from './tauriSimulationClient'
import type { SimulationWorkerProgress, SimulationWorkerRunRequest, SimulationWorkerSnapshot } from './workerProtocol'

const NATIVE_SMOKE_HASH = '#native-smoke'
const NATIVE_SMOKE_REQUEST_ID = 'desktop-native-smoke'
const NATIVE_SMOKE_SETTLE_MS = 300

const nativeSmokeRequest: SimulationWorkerRunRequest = {
  type: 'run',
  protocolVersion: 1,
  requestId: NATIVE_SMOKE_REQUEST_ID,
  components: [
    { id: 'd', type: 'input' },
    { id: 'clk', type: 'clock', options: { period: 1 } },
    { id: 'ff', type: 'dff', inputs: [{ node: 'd' }, { node: 'clk' }] },
  ],
  steps: [
    { set: { d: true }, ticks: 1 },
    { ticks: 1 },
  ],
  watch: ['d', 'clk', 'ff'],
  yieldEvery: 1,
  timeoutMs: 30_000,
}

const cancelComponents: SimulationWorkerRunRequest['components'] = [
  { id: 'n0', type: 'input' },
  ...Array.from({ length: 255 }, (_, index) => ({
    id: `n${index + 1}`,
    type: 'not' as const,
    inputs: [{ node: `n${index}` }],
  })),
]

const nativeErrorSmokeRequest: SimulationWorkerRunRequest = {
  type: 'run',
  protocolVersion: 1,
  requestId: NATIVE_SMOKE_REQUEST_ID,
  components: [
    { id: 'n', type: 'not', inputs: [{ node: 'missing' }] },
  ],
  steps: [{ ticks: 1 }],
  watch: ['n'],
  yieldEvery: 1,
  timeoutMs: 30_000,
}

const nativeCancelSmokeRequest: SimulationWorkerRunRequest = {
  type: 'run',
  protocolVersion: 1,
  requestId: NATIVE_SMOKE_REQUEST_ID,
  components: cancelComponents,
  steps: [{ ticks: 1_000 }],
  watch: Array.from({ length: 128 }, (_, index) => `n${index * 2}`),
  yieldEvery: 1,
  timeoutMs: 30_000,
}

/** Executa apenas com argumento explícito e somente no runtime Tauri. */
export function installNativeSmokeTrigger(): void {
  let attempts = 0
  const bootstrap = (): void => {
    if (!isTauriSimulationRuntime()) {
      if (attempts < 100) {
        attempts += 1
        window.setTimeout(bootstrap, 50)
      }
      return
    }

    let enabled = false
    let started = false
    const recordFailure = (phase: string, error: unknown): void => {
      const message = error instanceof Error
        ? error.message
        : isRecord(error) && typeof error.message === 'string'
          ? `${typeof error.code === 'string' ? `${error.code}: ` : ''}${error.message}`
          : String(error)
      void invoke<void>('record_native_smoke_failure', {
        requestId: NATIVE_SMOKE_REQUEST_ID,
        phase,
        message,
      }).catch(() => undefined)
    }
    const run = (): void => {
      if (!enabled || started || window.location.hash !== NATIVE_SMOKE_HASH) return
      started = true
      void runNativeSmoke()
        .catch((error: unknown) => {
          console.error('Smoke nativo falhou.', error)
          recordFailure('run', error)
        })
    }

    window.addEventListener('hashchange', run, { once: true })
    void invoke<string>('native_smoke_mode')
      .then((mode) => {
        enabled = mode === 'success' || mode === 'cancel' || mode === 'error'
        if (!enabled) return
        if (window.location.hash !== NATIVE_SMOKE_HASH) window.location.hash = NATIVE_SMOKE_HASH
        run()
      })
      .catch((error: unknown) => {
        console.error('Não foi possível verificar o modo smoke nativo.', error)
        recordFailure('bootstrap', error)
      })
  }

  bootstrap()
}

async function runNativeSmoke(): Promise<void> {
  const mode = await invoke<string>('native_smoke_mode')
  if (mode === 'cancel') {
    await runNativeCancelSmoke()
    return
  }
  if (mode === 'error') {
    await runNativeErrorSmoke()
    return
  }
  if (mode !== 'success') throw new Error(`Modo smoke inesperado: ${mode}`)
  await runNativeSuccessSmoke()
}

async function runNativeSuccessSmoke(): Promise<void> {
  let progressEvents = 0
  const onProgress = (progress: SimulationWorkerProgress): void => {
    if (progress.requestId === NATIVE_SMOKE_REQUEST_ID && progress.protocolVersion === 1) {
      progressEvents += 1
    }
  }

  const outcome = await new TauriSimulationClient().run(nativeSmokeRequest, { onProgress })
  if (outcome.type !== 'result') {
    throw new Error(`Smoke nativo falhou: ${outcome.type} — ${outcome.message}`)
  }

  await new Promise<void>((resolve) => window.setTimeout(resolve, NATIVE_SMOKE_SETTLE_MS))
  await invoke<void>('finish_native_smoke', {
    requestId: NATIVE_SMOKE_REQUEST_ID,
    progressEvents,
    snapshotCount: outcome.snapshots.length,
  })
}

async function runNativeErrorSmoke(): Promise<void> {
  let progressEvents = 0
  let finished = false
  let lateProgressEvents = 0
  const unlisten = await listen<NativeSimulationProgressPayload>(NATIVE_SIMULATION_PROGRESS_EVENT, (event) => {
    const progress = event.payload
    if (progress.protocolVersion !== 1 || progress.requestId !== NATIVE_SMOKE_REQUEST_ID) return
    if (finished) lateProgressEvents += 1
    else progressEvents += 1
  })

  let outcomeCode = 'completed'
  try {
    await invoke<NativeSimulationResultPayload>(NATIVE_SIMULATION_COMMAND, {
      request: toNativeRequest(nativeErrorSmokeRequest),
    })
  } catch (error) {
    outcomeCode = nativeErrorCode(error)
  } finally {
    finished = true
  }

  let cleanupResult = 'ok'
  try {
    await invoke<void>(NATIVE_SIMULATION_CANCEL_COMMAND, { requestId: NATIVE_SMOKE_REQUEST_ID })
  } catch (error) {
    cleanupResult = nativeErrorCode(error)
  }
  await new Promise<void>((resolve) => window.setTimeout(resolve, NATIVE_SMOKE_SETTLE_MS))
  unlisten()
  await invoke<void>('finish_native_error_smoke', {
    requestId: NATIVE_SMOKE_REQUEST_ID,
    outcomeCode,
    cleanupResult,
    progressEvents,
    lateProgressEvents,
  })
}

async function runNativeCancelSmoke(): Promise<void> {
  let progressEvents = 0
  let finished = false
  let lateProgressEvents = 0
  const unlisten = await listen<NativeSimulationProgressPayload>(NATIVE_SIMULATION_PROGRESS_EVENT, (event) => {
    const progress = event.payload
    if (progress.protocolVersion !== 1 || progress.requestId !== NATIVE_SMOKE_REQUEST_ID) return
    if (finished) lateProgressEvents += 1
    else progressEvents += 1
  })

  const cancelPromise = new Promise<string>((resolve) => {
    window.setTimeout(() => {
      void invoke<void>(NATIVE_SIMULATION_CANCEL_COMMAND, { requestId: NATIVE_SMOKE_REQUEST_ID })
        .then(() => resolve('ok'))
        .catch((error: unknown) => resolve(`failed:${nativeErrorMessage(error)}`))
    }, 2)
  })

  let outcomeCode = 'completed'
  try {
    const result = await invoke<NativeSimulationResultPayload>(NATIVE_SIMULATION_COMMAND, {
      request: toNativeRequest(nativeCancelSmokeRequest),
    })
    if (!Array.isArray(result.snapshots)) throw new Error('resultado nativo inválido')
  } catch (error) {
    outcomeCode = nativeErrorCode(error)
  } finally {
    finished = true
  }

  const cancelResult = await cancelPromise
  await new Promise<void>((resolve) => window.setTimeout(resolve, NATIVE_SMOKE_SETTLE_MS))
  unlisten()
  await invoke<void>('finish_native_cancel_smoke', {
    requestId: NATIVE_SMOKE_REQUEST_ID,
    cancelResult,
    outcomeCode,
    progressEvents,
    lateProgressEvents,
  })
}

type NativeSimulationProgressPayload = {
  protocolVersion: number
  requestId: string
  snapshot: SimulationWorkerSnapshot
}

type NativeSimulationResultPayload = {
  protocolVersion: number
  requestId: string
  snapshots: SimulationWorkerSnapshot[]
}

function toNativeRequest(request: SimulationWorkerRunRequest): Omit<SimulationWorkerRunRequest, 'type'> {
  const { type: _type, ...nativeRequest } = request
  return nativeRequest
}

function nativeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (isRecord(error) && typeof error.message === 'string') return error.message
  return String(error)
}

function nativeErrorCode(error: unknown): string {
  if (isRecord(error) && typeof error.code === 'string') return error.code
  if (isRecord(error) && typeof error.message === 'string') {
    const match = error.message.match(/\b(cancelled|timeout|invalid-request|execution)\b/)
    if (match) return match[1]
  }
  return 'execution'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
