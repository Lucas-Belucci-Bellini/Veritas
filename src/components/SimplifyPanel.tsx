import { ArrowRight, Sparkles } from 'lucide-react'
import type { Simplification } from '../engine'

interface SimplifyPanelProps {
  current: string
  simplification: Simplification | null
  onUse: (expression: string) => void
}

/**
 * Forma mínima em soma de produtos.
 *
 * A conta é feita por Quine-McCluskey em cima da tabela verdade, então vale
 * para qualquer expressão — inclusive as que misturam implicação e XOR, que as
 * regras algébricas de bolso não simplificam.
 */
export function SimplifyPanel({ current, simplification, onUse }: SimplifyPanelProps) {
  if (!simplification) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500">
        A expressão tem variáveis demais para minimizar na hora.
      </p>
    )
  }

  const { expression, operatorsBefore, operatorsAfter, alreadyMinimal } = simplification
  const saved = operatorsBefore - operatorsAfter

  // Quando não há ganho, mostrar "antes → depois" com o mesmo texto dos dois
  // lados só confunde: melhor exibir a expressão uma vez e dizer que é isso aí.
  if (alreadyMinimal) {
    return (
      <div>
        <code className="expr inline-block rounded-lg bg-emerald-50 px-3 py-1.5 font-mono text-sm font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          {expression}
        </code>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Já está na forma mínima — {operatorsAfter} operador
          {operatorsAfter === 1 ? '' : 'es'}, nada a economizar.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <code className="expr rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm text-slate-500 line-through decoration-slate-400/60 dark:bg-slate-800 dark:text-slate-400">
          {current}
        </code>
        <ArrowRight size={16} className="shrink-0 text-slate-400" />
        <code className="expr rounded-lg bg-emerald-50 px-3 py-1.5 font-mono text-sm font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          {expression}
        </code>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {operatorsBefore} → {operatorsAfter} operadores, {saved} porta
          {saved === 1 ? '' : 's'} lógica{saved === 1 ? '' : 's'} a menos.
        </span>
        <button type="button" className="key gap-2" onClick={() => onUse(expression)}>
          <Sparkles size={15} />
          Usar esta expressão
        </button>
      </div>
    </div>
  )
}
