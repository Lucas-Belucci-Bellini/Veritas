// @ts-ignore Vite resolves this virtual module at build time.
import SimulationWorkerConstructor from './simulation.worker?worker'
import type { SimulationWorkerHandle } from './workerProtocol'

/** Cria o Worker de simulação sob demanda; Step/Run canônicos ainda usam o runtime direto. */
export function createSimulationWorker(): SimulationWorkerHandle {
  if (!('Worker' in globalThis)) throw new Error('A API Worker não está disponível neste ambiente.')
  return new SimulationWorkerConstructor()
}
