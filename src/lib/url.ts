/** A expressão viaja na URL (?expr=...) para poder ser compartilhada. */

const PARAM = 'expr'

export function expressionFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get(PARAM)
  return value && value.trim() ? value : null
}

export function buildShareUrl(expression: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set(PARAM, expression)
  return url.toString()
}

/** Mantém a barra de endereços em dia sem empilhar entradas no histórico. */
export function syncUrl(expression: string): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (expression.trim()) {
    url.searchParams.set(PARAM, expression)
  } else {
    url.searchParams.delete(PARAM)
  }
  window.history.replaceState(null, '', url.toString())
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
