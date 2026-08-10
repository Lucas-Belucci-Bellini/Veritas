import { useState } from 'react'
import { ArrowRight, ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { FORM_LABELS, type ExpressionForm, type NormalForms, type Simplification } from '../engine'

interface NormalFormsPanelProps {
  current: string
  form: ExpressionForm
  forms: NormalForms | null
  simplification: Simplification | null
  onUse: (expression: string) => void
}

const FORM_TONES: Record<ExpressionForm, string> = {
  sop: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
  pos: 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300',
  nenhuma:
    'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

/**
 * Soma de produtos e produto de somas, canônicas e mínimas.
 *
 * As duas formas descrevem a mesma função — a diferença é quantas portas cada
 * uma custa, e qual delas sai mais barata depende da expressão. Por isso as
 * duas aparecem lado a lado com a contagem de operadores.
 */
export function NormalFormsPanel({
  current,
  form,
  forms,
  simplification,
  onUse,
}: NormalFormsPanelProps) {
  const [showCanonical, setShowCanonical] = useState(false)

  if (!forms) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500">
        A expressão tem variáveis demais para montar as formas normais.
      </p>
    )
  }

  const cheaper =
    forms.sopOperators === forms.posOperators
      ? null
      : forms.sopOperators < forms.posOperators
        ? 'sop'
        : 'pos'

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400 dark:text-slate-500">
          O que você escreveu:
        </span>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${FORM_TONES[form]}`}
        >
          {FORM_LABELS[form]}
        </span>
      </div>

      {simplification && !simplification.alreadyMinimal && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <code className="expr rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-slate-500 line-through decoration-slate-400/60 dark:bg-slate-800 dark:text-slate-400">
            {current}
          </code>
          <ArrowRight size={15} className="shrink-0 text-slate-400" />
          <span className="text-slate-600 dark:text-slate-300">
            {simplification.operatorsBefore} → {simplification.operatorsAfter} operadores
          </span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <FormCard
          title="Soma de produtos mínima"
          expression={forms.minimalSop}
          operators={forms.sopOperators}
          highlighted={cheaper === 'sop'}
          onUse={onUse}
        />
        <FormCard
          title="Produto de somas mínimo"
          expression={forms.minimalPos}
          operators={forms.posOperators}
          highlighted={cheaper === 'pos'}
          onUse={onUse}
        />
      </div>

      <button
        type="button"
        onClick={() => setShowCanonical((open) => !open)}
        className="mt-4 flex items-center gap-1 text-xs font-semibold text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
      >
        {showCanonical ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Formas canônicas ({forms.minterms.length} mintermos, {forms.maxterms.length}{' '}
        maxtermos)
      </button>

      {showCanonical && (
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              SOP canônica — Σm({forms.minterms.join(', ') || '—'})
            </dt>
            <dd className="expr mt-1 font-mono text-xs break-words text-slate-600 dark:text-slate-300">
              {forms.canonicalSop}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              POS canônica — ΠM({forms.maxterms.join(', ') || '—'})
            </dt>
            <dd className="expr mt-1 font-mono text-xs break-words text-slate-600 dark:text-slate-300">
              {forms.canonicalPos}
            </dd>
          </div>
        </dl>
      )}
    </div>
  )
}

function FormCard({
  title,
  expression,
  operators,
  highlighted,
  onUse,
}: {
  title: string
  expression: string
  operators: number
  highlighted: boolean
  onUse: (expression: string) => void
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlighted
          ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
          {title}
        </h3>
        <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
          {operators} operador{operators === 1 ? '' : 'es'}
          {highlighted && ' · mais barata'}
        </span>
      </div>

      <code className="expr mt-2 block font-mono text-sm font-semibold break-words">
        {expression}
      </code>

      <button
        type="button"
        onClick={() => onUse(expression)}
        className="key mt-2 h-8 gap-1.5 px-2 text-xs"
      >
        <Sparkles size={13} />
        Usar
      </button>
    </div>
  )
}
