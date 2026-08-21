export declare const REQUIRED_RLS_IDS: readonly string[]

export declare function renderRlsReport(
  prefix: string,
  results: readonly {
    id: string
    status: string
    message: string
    logicalUser: string
    operation: string
  }[],
  generatedAt?: string,
): string
