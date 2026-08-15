import type { CircuitDocument } from './editorModel'

export interface CircuitHistoryOptions {
  limit?: number
}

export class CircuitHistory {
  private readonly limit: number
  private past: CircuitDocument[] = []
  private present: CircuitDocument
  private future: CircuitDocument[] = []

  constructor(initial: CircuitDocument, options: CircuitHistoryOptions = {}) {
    this.limit = normalizeLimit(options.limit)
    this.present = cloneDocument(initial)
  }

  commit(next: CircuitDocument): boolean {
    if (sameDocument(this.present, next)) return false
    this.past = [...this.past, cloneDocument(this.present)].slice(-this.limit)
    this.present = cloneDocument(next)
    this.future = []
    return true
  }

  replace(next: CircuitDocument): void {
    this.past = []
    this.present = cloneDocument(next)
    this.future = []
  }

  undo(): CircuitDocument | null {
    const previous = this.past.at(-1)
    if (!previous) return null
    this.past = this.past.slice(0, -1)
    this.future = [cloneDocument(this.present), ...this.future].slice(0, this.limit)
    this.present = cloneDocument(previous)
    return cloneDocument(this.present)
  }

  redo(): CircuitDocument | null {
    const next = this.future[0]
    if (!next) return null
    this.future = this.future.slice(1)
    this.past = [...this.past, cloneDocument(this.present)].slice(-this.limit)
    this.present = cloneDocument(next)
    return cloneDocument(this.present)
  }

  current(): CircuitDocument {
    return cloneDocument(this.present)
  }

  canUndo(): boolean {
    return this.past.length > 0
  }

  canRedo(): boolean {
    return this.future.length > 0
  }

  get sizes(): { past: number; future: number } {
    return { past: this.past.length, future: this.future.length }
  }
}

function normalizeLimit(value: number | undefined): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? Math.min(value, 500) : 100
}

function sameDocument(left: CircuitDocument, right: CircuitDocument): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function cloneDocument(document: CircuitDocument): CircuitDocument {
  return JSON.parse(JSON.stringify(document)) as CircuitDocument
}
