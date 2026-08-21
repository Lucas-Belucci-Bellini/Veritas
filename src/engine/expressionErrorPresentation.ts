import type { VeritasError } from './errors'

export interface ExpressionErrorPresentation {
  location: string
  sourceLine: string
  caret: string
  excerpt: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function formatExpressionError(source: string, error: VeritasError): ExpressionErrorPresentation {
  const start = clamp(error.start, 0, source.length)
  const end = clamp(Math.max(error.end, start), start, source.length)
  const before = source.slice(0, start)
  const lineNumber = before.split('\n').length
  const lastBreak = before.lastIndexOf('\n')
  const columnNumber = start - lastBreak
  const lines = source.split('\n')
  const sourceLine = lines[lineNumber - 1] ?? ''
  const lineStart = lastBreak + 1
  const lineEnd = source.indexOf('\n', start)
  const lineEndOffset = lineEnd === -1 ? source.length : lineEnd
  const lineLocalEnd = clamp(end - lineStart, 0, sourceLine.length)
  const lineLocalStart = clamp(start - lineStart, 0, sourceLine.length)
  const width = Math.max(1, lineLocalEnd - lineLocalStart)
  const excerpt = source.slice(start, end) || 'fim da expressão'

  return {
    location: `Posição ${lineNumber}:${columnNumber}`,
    sourceLine: sourceLine.slice(0, Math.max(1, lineEndOffset - lineStart)),
    caret: `${' '.repeat(lineLocalStart)}^${'~'.repeat(Math.max(0, width - 1))}`,
    excerpt,
  }
}
