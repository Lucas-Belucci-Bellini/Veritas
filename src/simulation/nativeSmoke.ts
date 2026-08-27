import { invoke } from '@tauri-apps/api/core'
import { TauriSimulationClient, isTauriSimulationRuntime } from './tauriSimulationClient'
import type { SimulationWorkerProgress, SimulationWorkerRunRequest } from './workerProtocol'

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
      const message = error instanceof Error ? error.message : String(error)
      void invoke<void>('record_native_smoke_failure', {
        requestId: NATIVE_SMOKE_REQUEST_ID,
        phase,
        message,
      }).catch(() => undefined)
    }
    const run = (): void => {
      if (!enabled || started || window.location.hash !== NATIVE_SMOKE_HASH) return
      started = true
      void runNativeSmoke().catch((error: unknown) => {
        console.error('Smoke nativo falhou.', error)
        recordFailure('run', error)
      })
    }

    window.addEventListener('hashchange', run, { once: true })
    void invoke<boolean>('is_native_smoke_enabled')
      .then((value) => {
        enabled = value === true
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
