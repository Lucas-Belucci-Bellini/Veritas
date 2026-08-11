import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GateSymbol } from './GateSymbol'
import {
  GATE_HEIGHT,
  GATE_NAMES,
  GATE_WIDTH,
  PIN_BOTTOM,
  PIN_TOP,
} from './gateGeometry'
import type { CircuitNode } from './graph'

const HANDLE = '!h-1.5 !w-1.5 !border-0 !bg-slate-400 dark:!bg-slate-500'
const HANDLE_LIT = '!h-1.5 !w-1.5 !border-0 !bg-amber-500'

/** Rótulo curto o bastante para caber no nó; o inteiro fica no title. */
function short(text: string): string {
  return text.length > 22 ? `${text.slice(0, 21)}…` : text
}

/**
 * Um bloco do circuito: pino de entrada, porta lógica ou saída.
 *
 * As portas usam os símbolos ANSI de verdade, então o desenho se lê como um
 * esquemático e não como um fluxograma de caixas nomeadas.
 */
export function LogicNode({ data }: NodeProps<CircuitNode>) {
  const { kind, label, inputs, op, value } = data
  const lit = value === true
  const dot = lit ? HANDLE_LIT : HANDLE

  if (kind === 'input' || kind === 'constant') {
    return (
      <div className="flex items-center" style={{ height: 32 }}>
        <span
          className={`grid h-8 min-w-8 place-items-center rounded-full border-2 px-2 font-mono text-sm font-bold transition-colors ${
            lit
              ? 'border-amber-500 bg-amber-400/25 text-amber-700 dark:text-amber-200'
              : 'border-slate-400 bg-white text-slate-600 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200'
          }`}
        >
          {label}
        </span>
        {/* Perna curta, para o fio sair do pino como num esquemático. */}
        <span
          className={`h-0.5 w-4 transition-colors ${lit ? 'bg-amber-500' : 'bg-slate-400 dark:bg-slate-500'}`}
        />
        <Handle type="source" position={Position.Right} className={dot} />
      </div>
    )
  }

  if (kind === 'output') {
    return (
      <div className="flex items-center gap-2" title={label} style={{ height: 40 }}>
        <Handle type="target" position={Position.Left} id="a" className={dot} />
        <span
          className={`h-0.5 w-4 transition-colors ${lit ? 'bg-amber-500' : 'bg-slate-400 dark:bg-slate-500'}`}
        />
        <span
          className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${
            lit
              ? 'border-amber-500 bg-amber-400 shadow-[0_0_12px_2px_rgb(245_158_11/0.6)]'
              : 'border-slate-400 bg-transparent dark:border-slate-500'
          }`}
        />
        <span className="expr font-mono text-xs font-semibold whitespace-nowrap">
          {short(label)}
        </span>
      </div>
    )
  }

  return (
    <div
      className="relative"
      style={{ width: GATE_WIDTH, height: GATE_HEIGHT }}
      title={op ? GATE_NAMES[op] : label}
    >
      <GateSymbol op={op ?? 'and'} lit={lit} />
      {inputs === 2 ? (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="a"
            style={{ top: PIN_TOP }}
            className={dot}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="b"
            style={{ top: PIN_BOTTOM }}
            className={dot}
          />
        </>
      ) : (
        <Handle type="target" position={Position.Left} id="a" className={dot} />
      )}
      <Handle type="source" position={Position.Right} className={dot} />
    </div>
  )
}
