import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { CircuitNode } from './graph'

const ON = 'border-amber-400 bg-amber-400/20 text-amber-700 dark:text-amber-200'
const OFF = 'border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'

/** Bloco visual de uma porta lógica, entrada ou saída do circuito. */
export function LogicNode({ data }: NodeProps<CircuitNode>) {
  const { kind, label, inputs, value } = data
  const lit = value === true
  const tone = lit ? ON : OFF

  if (kind === 'input' || kind === 'constant') {
    return (
      <div
        className={`flex h-11 min-w-16 items-center justify-center rounded-full border-2 px-4 font-mono text-sm font-bold transition-colors ${tone}`}
      >
        {label}
        <Handle type="source" position={Position.Right} className="!h-2 !w-2" />
      </div>
    )
  }

  if (kind === 'output') {
    return (
      <div
        className={`flex h-13 min-w-32 items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${tone}`}
      >
        <Handle type="target" position={Position.Left} id="a" className="!h-2 !w-2" />
        <span
          className={`h-3 w-3 shrink-0 rounded-full transition-colors ${
            lit ? 'bg-amber-400 shadow-[0_0_10px_2px_rgb(251_191_36/0.7)]' : 'bg-slate-400/50'
          }`}
        />
        <span className="expr max-w-40 truncate">{label}</span>
      </div>
    )
  }

  return (
    <div
      className={`relative flex h-14 w-26 items-center justify-center rounded-lg border-2 text-sm font-bold tracking-wide transition-colors ${tone}`}
    >
      {inputs === 2 ? (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="a"
            style={{ top: '30%' }}
            className="!h-2 !w-2"
          />
          <Handle
            type="target"
            position={Position.Left}
            id="b"
            style={{ top: '70%' }}
            className="!h-2 !w-2"
          />
        </>
      ) : (
        <Handle type="target" position={Position.Left} id="a" className="!h-2 !w-2" />
      )}
      {label}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2" />
    </div>
  )
}
