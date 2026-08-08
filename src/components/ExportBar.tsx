import { Check, Image, Link2, Table2 } from 'lucide-react'
import { useState } from 'react'
import type { TruthTable } from '../engine'
import { downloadCsv, downloadPng } from '../lib/export'
import { buildShareUrl, copyToClipboard } from '../lib/url'
import type { ValueStyle } from '../lib/values'

interface ExportBarProps {
  table: TruthTable
  expression: string
  style: ValueStyle
  theme: 'light' | 'dark'
}

export function ExportBar({ table, expression, style, theme }: ExportBarProps) {
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(buildShareUrl(expression))
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const handlePng = async () => {
    setBusy(true)
    try {
      await downloadPng(table, style, theme)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="key gap-2" onClick={() => downloadCsv(table, style)}>
        <Table2 size={16} />
        CSV
      </button>
      <button type="button" className="key gap-2" disabled={busy} onClick={handlePng}>
        <Image size={16} aria-hidden />
        {busy ? 'Gerando…' : 'PNG'}
      </button>
      <button type="button" className="key gap-2" onClick={handleCopyLink}>
        {copied ? <Check size={16} className="text-emerald-500" /> : <Link2 size={16} />}
        {copied ? 'Link copiado' : 'Copiar link'}
      </button>
    </div>
  )
}
