import {
  installSimulationWorker,
  type SimulationWorkerEndpoint,
} from './workerProtocol'

const endpoint: SimulationWorkerEndpoint = {
  addEventListener: (_type, listener) => {
    globalThis.addEventListener('message', listener as unknown as EventListener)
  },
  removeEventListener: (_type, listener) => {
    globalThis.removeEventListener('message', listener as unknown as EventListener)
  },
  postMessage: (message) => {
    globalThis.postMessage(message)
  },
}

installSimulationWorker(endpoint)
