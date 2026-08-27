import {
  buildDocumentWorkerRequest,
  type DocumentWorkerRequestOptions,
} from './documentWorker'
import { preflightDocumentRuntime } from './documentRuntime'
import type { CircuitDocument, CircuitExecutionSafetyReport, CustomChipLibraryEntry } from '../circuit'
import {
  SimulationWorkerClient,
  type SimulationWorkerRunOutcome,
  type SimulationWorkerRunOptions,
} from './workerClient'
import type { SimulationWorkerHandle } from './workerProtocol'

export interface DocumentWorkerExecutorOptions {
  /** Handle opcional para testes ou para uma factory de Worker controlada pelo host. */
  worker?: SimulationWorkerHandle
  /** Cliente opcional; o executor assume seu lifecycle até `dispose()`. */
  client?: SimulationWorkerClient
  timeoutMs?: number
}

export interface DocumentWorkerExecutionOptions extends Omit<DocumentWorkerRequestOptions, 'requestId'> {
  requestId: string
  signal?: AbortSignal
  onProgress?: SimulationWorkerRunOptions['onProgress']
}

export interface DocumentWorkerExecution {
  preflight: CircuitExecutionSafetyReport
  outcome: SimulationWorkerRunOutcome
}

/**
 * Executor opt-in que mantém a UI atual desacoplada. Ele transforma o documento
 * uma vez, delega execução/lifecycle ao cliente e nunca altera o documento.
 */
export class DocumentWorkerExecutor {
  private readonly client: SimulationWorkerClient
  private closed = false

  constructor(options: DocumentWorkerExecutorOptions = {}) {
    if (options.client && options.worker) throw new TypeError('Informe client ou worker, não ambos.')
    this.client = options.client ?? new SimulationWorkerClient({ worker: options.worker, timeoutMs: options.timeoutMs })
  }

  async run(document: CircuitDocument, options: DocumentWorkerExecutionOptions): Promise<DocumentWorkerExecution> {
    const preflight = preflightDocumentRuntime(document, { customChips: options.customChips })
    try {
      const { request } = buildDocumentWorkerRequest(document, options)
      const runOptions: SimulationWorkerRunOptions = {
        signal: options.signal,
        onProgress: options.onProgress,
      }
      const outcome = await this.client.run(request, runOptions)
      return { preflight, outcome }
    } catch (error) {
      return {
        preflight,
        outcome: {
          type: 'error',
          protocolVersion: 1,
          requestId: options.requestId,
          code: 'invalid-request',
          message: error instanceof Error ? error.message : 'O request documental foi rejeitado.',
        },
      }
    }
  }

  dispose(): void {
    if (this.closed) return
    this.closed = true
    this.client.dispose()
  }
}

export type { CustomChipLibraryEntry }
