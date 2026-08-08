import { CircleAlert, CircleCheck, X } from 'lucide-react'
import type { RefObject } from 'react'
import type { VeritasError } from '../engine'

interface ExpressionInputProps {
  value: string
  onChange: (value: string) => void
  inputRef: RefObject<HTMLInputElement | null>
  error: VeritasError | null
  /** Resumo curto mostrado quando a expressão está válida. */
  summary: string | null
}

/**
 * A barra de input é a estrela da tela: grande, centralizada e com validação a
 * cada tecla — o usuário nunca precisa apertar "verificar" para saber que
 * errou.
 */
export function ExpressionInput({
  value,
  onChange,
  inputRef,
  error,
  summary,
}: ExpressionInputProps) {
  const empty = value.trim().length === 0
  const showError = Boolean(error) && !empty

  return (
    <div className="w-full">
      <div
        className={`flex items-center gap-2 rounded-2xl border-2 bg-white px-4 py-3 shadow-sm transition-colors dark:bg-slate-900 ${
          showError
            ? 'border-rose-400 dark:border-rose-500/70'
            : empty
              ? 'border-slate-200 dark:border-slate-800'
              : 'border-emerald-400 dark:border-emerald-500/70'
        }`}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="characters"
          aria-label="Expressão lógica"
          aria-invalid={showError}
          placeholder="(A AND B) OR NOT C"
          className="expr w-full bg-transparent font-mono text-lg outline-none placeholder:text-slate-400 sm:text-2xl dark:placeholder:text-slate-600"
        />
        {!empty && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Limpar expressão"
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="mt-2 flex min-h-6 items-start gap-2 px-1 text-sm">
        {empty ? (
          <span className="text-slate-400 dark:text-slate-500">
            Digite uma expressão ou use o teclado abaixo.
          </span>
        ) : showError && error ? (
          <span className="flex items-start gap-2 text-rose-600 dark:text-rose-400">
            <CircleAlert size={16} className="mt-0.5 shrink-0" />
            <span>
              {error.message}
              {error.hint && (
                <span className="block text-xs text-rose-500/80 dark:text-rose-400/70">
                  {error.hint}
                </span>
              )}
            </span>
          </span>
        ) : (
          <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CircleCheck size={16} className="shrink-0" />
            Expressão válida{summary ? ` — ${summary}` : ''}
          </span>
        )}
      </div>
    </div>
  )
}
