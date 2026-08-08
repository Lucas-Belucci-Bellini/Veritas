/** Categorias de erro, usadas para escolher o ícone/dica na interface. */
export type ErrorKind = 'lexical' | 'syntax' | 'paren' | 'empty'

/**
 * Erro de análise com posição. O `start`/`end` apontam para o trecho exato da
 * string digitada, o que permite sublinhar o problema no input.
 */
export class VeritasError extends Error {
  readonly kind: ErrorKind
  readonly start: number
  readonly end: number
  /** Sugestão opcional ("você quis dizer ...?"). */
  readonly hint?: string

  constructor(
    kind: ErrorKind,
    message: string,
    start: number,
    end: number,
    hint?: string,
  ) {
    super(message)
    this.name = 'VeritasError'
    this.kind = kind
    this.start = start
    this.end = end
    this.hint = hint
  }
}

export function isVeritasError(error: unknown): error is VeritasError {
  return error instanceof VeritasError
}
