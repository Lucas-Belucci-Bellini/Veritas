import { useId, type ReactNode } from 'react'

interface AccessibleTooltipProps {
  label: string
  children?: ReactNode
}

export function AccessibleTooltip({ label, children = 'i' }: AccessibleTooltipProps) {
  const tooltipId = useId()
  return (
    <span className="group relative inline-flex align-middle">
      <span
        tabIndex={0}
        role="img"
        aria-label={`Informação: ${label}`}
        aria-describedby={tooltipId}
        className="ml-1 inline-grid h-4 w-4 cursor-help place-items-center rounded-full border border-current/40 text-[10px] font-bold leading-none outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        {children}
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-2 text-left text-[11px] font-normal normal-case tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-slate-100 dark:text-slate-900"
      >
        {label}
      </span>
    </span>
  )
}
