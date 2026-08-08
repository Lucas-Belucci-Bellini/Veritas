import type { TruthTable } from '../engine'
import { renderValue, type ValueStyle } from './values'

/** Nome de arquivo seguro derivado da expressão. */
export function fileNameFor(table: TruthTable, extension: string): string {
  const slug = table.formula
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .toLowerCase()
  return `veritas-${slug || 'tabela'}.${extension}`
}

export function toCsv(table: TruthTable, style: ValueStyle): string {
  const escape = (cell: string) =>
    /[",;\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell

  const lines = [table.columns.map((column) => escape(column.label)).join(',')]
  for (const row of table.rows) {
    lines.push(row.map((value) => renderValue(value, style)).join(','))
  }
  return lines.join('\n')
}

export function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function downloadCsv(table: TruthTable, style: ValueStyle): void {
  // O BOM faz o Excel abrir os acentos corretamente.
  const blob = new Blob(['﻿', toCsv(table, style)], {
    type: 'text/csv;charset=utf-8',
  })
  download(fileNameFor(table, 'csv'), blob)
}

interface PngTheme {
  background: string
  headerBackground: string
  resultBackground: string
  stripe: string
  text: string
  mutedText: string
  border: string
  trueColor: string
  falseColor: string
}

const LIGHT: PngTheme = {
  background: '#ffffff',
  headerBackground: '#f1f5f9',
  resultBackground: '#eff6ff',
  stripe: '#f8fafc',
  text: '#0f172a',
  mutedText: '#64748b',
  border: '#cbd5e1',
  trueColor: '#059669',
  falseColor: '#e11d48',
}

const DARK: PngTheme = {
  background: '#0f172a',
  headerBackground: '#1e293b',
  resultBackground: '#172554',
  stripe: '#111c33',
  text: '#e2e8f0',
  mutedText: '#94a3b8',
  border: '#334155',
  trueColor: '#34d399',
  falseColor: '#fb7185',
}

/**
 * Desenha a tabela em um canvas e devolve um PNG.
 *
 * Fazer isso na mão evita puxar uma biblioteca de screenshot só para exportar
 * imagem — e o resultado fica nítido em telas retina porque escalamos o canvas.
 */
export function tableToPngBlob(
  table: TruthTable,
  style: ValueStyle,
  theme: 'light' | 'dark' = 'light',
): Promise<Blob> {
  const palette = theme === 'dark' ? DARK : LIGHT
  const scale = Math.min(window.devicePixelRatio || 1, 2)

  const padding = 24
  const rowHeight = 34
  const headerHeight = 44
  const titleHeight = 46
  const footerHeight = 30
  const cellPadding = 18

  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = '600 15px ui-sans-serif, system-ui, sans-serif'

  const widths = table.columns.map((column) =>
    Math.max(56, measure.measureText(column.label).width + cellPadding * 2),
  )
  const tableWidth = widths.reduce((sum, width) => sum + width, 0)
  const width = tableWidth + padding * 2
  const height =
    padding * 2 + titleHeight + headerHeight + rowHeight * table.rows.length + footerHeight

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)

  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = palette.text
  ctx.font = '700 18px ui-sans-serif, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(table.formula, padding, padding + titleHeight / 2)

  const top = padding + titleHeight
  const resultIndex = table.columns.length - 1

  // Cabeçalho.
  let x = padding
  table.columns.forEach((column, index) => {
    ctx.fillStyle =
      index === resultIndex ? palette.resultBackground : palette.headerBackground
    ctx.fillRect(x, top, widths[index], headerHeight)
    ctx.fillStyle = index === resultIndex ? palette.text : palette.mutedText
    ctx.font = '600 15px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(column.label, x + widths[index] / 2, top + headerHeight / 2)
    x += widths[index]
  })

  // Linhas.
  ctx.font = '600 15px ui-monospace, SFMono-Regular, Menlo, monospace'
  table.rows.forEach((row, rowIndex) => {
    const y = top + headerHeight + rowIndex * rowHeight
    if (rowIndex % 2 === 1) {
      ctx.fillStyle = palette.stripe
      ctx.fillRect(padding, y, tableWidth, rowHeight)
    }
    let cellX = padding
    row.forEach((value, columnIndex) => {
      if (columnIndex === resultIndex) {
        ctx.fillStyle = palette.resultBackground
        ctx.fillRect(cellX, y, widths[columnIndex], rowHeight)
      }
      ctx.fillStyle = value ? palette.trueColor : palette.falseColor
      ctx.fillText(
        renderValue(value, style),
        cellX + widths[columnIndex] / 2,
        y + rowHeight / 2,
      )
      cellX += widths[columnIndex]
    })
  })

  // Grade.
  ctx.strokeStyle = palette.border
  ctx.lineWidth = 1
  const bottom = top + headerHeight + rowHeight * table.rows.length
  let lineX = padding
  for (const columnWidth of widths) {
    ctx.beginPath()
    ctx.moveTo(lineX + 0.5, top)
    ctx.lineTo(lineX + 0.5, bottom)
    ctx.stroke()
    lineX += columnWidth
  }
  ctx.beginPath()
  ctx.moveTo(lineX + 0.5, top)
  ctx.lineTo(lineX + 0.5, bottom)
  ctx.stroke()

  for (let rowIndex = 0; rowIndex <= table.rows.length; rowIndex += 1) {
    const y = top + headerHeight + rowIndex * rowHeight
    ctx.beginPath()
    ctx.moveTo(padding, y + 0.5)
    ctx.lineTo(padding + tableWidth, y + 0.5)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(padding, top + 0.5)
  ctx.lineTo(padding + tableWidth, top + 0.5)
  ctx.stroke()

  ctx.textAlign = 'left'
  ctx.fillStyle = palette.mutedText
  ctx.font = '400 12px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('Gerado com Veritas', padding, bottom + footerHeight / 2 + 4)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Não foi possível gerar a imagem.'))
    }, 'image/png')
  })
}

export async function downloadPng(
  table: TruthTable,
  style: ValueStyle,
  theme: 'light' | 'dark',
): Promise<void> {
  const blob = await tableToPngBlob(table, style, theme)
  download(fileNameFor(table, 'png'), blob)
}
