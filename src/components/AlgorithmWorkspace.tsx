import { useMemo, useState } from 'react'
import {
  createExecutionState,
  parseAlgorithmInput,
  provideInput,
  runAlgorithm,
  stepAlgorithm,
  toggleBreakpoint,
  type AlgorithmDocument,
  type AlgorithmNode,
  type ExecutionState,
} from '../algorithms'
import { AlgorithmBranchTrace } from './AlgorithmBranchTrace'
import { AlgorithmVariableWatch } from './AlgorithmVariableWatch'

interface AlgorithmWorkspaceProps {
  document: AlgorithmDocument
  maxSteps?: number
  onStateChange?: (state: ExecutionState) => void
}

function statusLabel(status: ExecutionState['status']): string {
  switch (status) {
    case 'ready':
      return 'pronto'
    case 'paused':
      return 'pausado'
    case 'awaiting-input':
      return 'aguardando entrada'
    case 'finished':
      return 'finalizado'
    case 'error':
      return 'erro'
  }
}

function pauseReasonLabel(reason: ExecutionState['debug']['lastPauseReason']): string {
  switch (reason) {
    case 'breakpoint':
      return 'breakpoint'
    case 'input':
      return 'entrada'
    case 'finished':
      return 'fim'
    case 'max-steps':
      return 'limite de passos'
    case 'error':
      return 'erro'
    case 'step':
      return 'step manual'
    default:
      return '—'
  }
}

function currentInputNode(
  document: AlgorithmDocument,
  state: ExecutionState,
): Extract<AlgorithmNode, { type: 'input' }> | null {
  const node = document.nodes.find((candidate) => candidate.id === state.activeNodeId)
  return node?.type === 'input' ? node : null
}

export function AlgorithmWorkspace({
  document,
  maxSteps = 10_000,
  onStateChange,
}: AlgorithmWorkspaceProps) {
  const [state, setState] = useState<ExecutionState>(() => createExecutionState(document))
  const [rawInput, setRawInput] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const inputNode = useMemo(() => currentInputNode(document, state), [document, state])
  const activeNode = document.nodes.find((node) => node.id === state.activeNodeId)

  function commit(next: ExecutionState) {
    setState(next)
    onStateChange?.(next)
  }

  function handleStep() {
    if (state.status === 'awaiting-input' && inputNode) {
      try {
        const value = parseAlgorithmInput(rawInput, state.variableTypes[inputNode.variable])
        commit(stepAlgorithm(document, provideInput(state, inputNode.variable, value), { maxSteps }))
        setRawInput('')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Não foi possível ler a entrada.'
        commit({ ...state, status: 'error', error: message })
      }
      return
    }
    commit(stepAlgorithm(document, state, { maxSteps }))
  }

  function handleRun() {
    commit(runAlgorithm(document, state, { maxSteps }))
  }

  function handleToggleBreakpoint(nodeId: string) {
    commit(toggleBreakpoint(state, nodeId))
  }

  function handleReset() {
    commit(createExecutionState(document, { breakpoints: state.debug.breakpoints }))
    setRawInput('')
    setSelectedNodeId(null)
  }

  return (
    <section className="space-y-4" aria-label={`Workspace de algoritmo: ${document.name}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div>
          <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase dark:text-brand-300">
            ALGO-002 · execução observável
          </p>
          <h1 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
            {document.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Nó ativo: <span className="font-mono">{activeNode?.id ?? '—'}</span>
            <span className="mx-2">·</span>
            pausa: <span className="font-mono">{pauseReasonLabel(state.debug.lastPauseReason)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            status: {statusLabel(state.status)}
          </span>
          <button
            type="button"
            onClick={handleStep}
            disabled={state.status === 'finished' || state.status === 'error'}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state.status === 'awaiting-input' ? 'Enviar entrada' : 'Step'}
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={state.status === 'finished' || state.status === 'error' || state.status === 'awaiting-input'}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
          >
            {state.debug.lastPauseReason === 'breakpoint' ? 'Continue' : 'Run'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:text-brand-700 dark:border-slate-600 dark:text-slate-200"
          >
            Reset
          </button>
        </div>
      </header>

      <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <summary className="cursor-pointer text-sm font-bold text-slate-900 dark:text-slate-100">
          Breakpoints ({state.debug.breakpoints.length})
        </summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {document.nodes.map((node) => (
            <label key={node.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
              <input
                type="checkbox"
                checked={state.debug.breakpoints.includes(node.id)}
                onChange={() => handleToggleBreakpoint(node.id)}
              />
              <span className="font-mono">{node.id}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{node.type}</span>
            </label>
          ))}
        </div>
      </details>

      {state.status === 'awaiting-input' && inputNode && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"
          onSubmit={(event) => {
            event.preventDefault()
            handleStep()
          }}
        >
          <label className="min-w-[220px] flex-1">
            <span className="mb-1 block text-sm font-semibold text-amber-900 dark:text-amber-200">
              {inputNode.prompt ?? `Digite ${inputNode.variable}`} ({state.variableTypes[inputNode.variable]})
            </span>
            <input
              autoFocus
              value={rawInput}
              onChange={(event) => setRawInput(event.target.value)}
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-amber-800 dark:bg-slate-900 dark:text-slate-100"
              aria-label={`Entrada para ${inputNode.variable}`}
            />
          </label>
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Valores booleanos aceitos: verdadeiro/falso, true/false, 1/0.
          </p>
        </form>
      )}

      {state.error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {state.error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <AlgorithmVariableWatch entries={state.watch} activeStep={state.stepIndex} />
        <AlgorithmBranchTrace
          entries={state.branches}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Saída</h2>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {state.output.length} item(ns)
          </span>
        </div>
        <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-slate-950 px-3 py-3 text-sm text-emerald-300">
          {state.output.length > 0 ? state.output.map(String).join('\n') : 'Nenhuma saída ainda.'}
        </pre>
      </section>
    </section>
  )
}
