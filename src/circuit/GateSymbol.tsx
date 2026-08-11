import {
  AND_BODY,
  BODY_END,
  GATE_HEIGHT,
  GATE_WIDTH,
  gateFamily,
  INVERTED,
  NOT_BODY,
  NOT_BODY_END,
  OR_BODY,
  PIN_BOTTOM,
  PIN_MIDDLE,
  PIN_TOP,
  XOR_ARC,
} from './gateGeometry'
import type { GateOp } from './graph'

/**
 * Símbolo ANSI de uma porta lógica.
 *
 * Caixas iguais com o nome escrito dentro obrigam a ler texto para entender o
 * desenho. A forma distintiva — o "D" do AND, o escudo do OR, o triângulo com
 * bolinha do NOT — é o que faz um esquemático ser reconhecido de relance, e é
 * a notação que aparece na aula e no livro.
 */
export function GateSymbol({ op, lit }: { op: GateOp; lit: boolean }) {
  const family = gateFamily(op)
  const inverted = INVERTED.has(op)
  const bodyEnd = family === 'not' ? NOT_BODY_END : BODY_END
  const bubbleX = bodyEnd + 5
  const outputStart = inverted ? bubbleX + 4.5 : bodyEnd
  const leadEnd = family === 'and' ? 12 : 16

  const stroke = lit ? 'stroke-amber-500' : 'stroke-slate-400 dark:stroke-slate-500'
  const fill = lit ? 'fill-amber-400/25' : 'fill-white dark:fill-slate-800'

  return (
    <svg
      viewBox={`0 0 ${GATE_WIDTH} ${GATE_HEIGHT}`}
      width={GATE_WIDTH}
      height={GATE_HEIGHT}
      aria-hidden
    >
      <g className={stroke} strokeWidth={1.6} strokeLinejoin="round" fill="none">
        {family === 'not' ? (
          <line x1={0} y1={PIN_MIDDLE} x2={14} y2={PIN_MIDDLE} />
        ) : (
          <>
            <line x1={0} y1={PIN_TOP} x2={leadEnd} y2={PIN_TOP} />
            <line x1={0} y1={PIN_BOTTOM} x2={leadEnd} y2={PIN_BOTTOM} />
          </>
        )}

        {family === 'xor' && <path d={XOR_ARC} />}
        <path
          d={family === 'and' ? AND_BODY : family === 'not' ? NOT_BODY : OR_BODY}
          className={fill}
        />
        {inverted && <circle cx={bubbleX} cy={PIN_MIDDLE} r={4.5} className={fill} />}

        <line x1={outputStart} y1={PIN_MIDDLE} x2={GATE_WIDTH} y2={PIN_MIDDLE} />
      </g>
    </svg>
  )
}
