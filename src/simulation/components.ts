/**
 * Peças que podem existir num circuito simulado.
 *
 * As portas lógicas respondem na hora; clock, flip-flops e atrasos guardam
 * estado entre um tique e outro — é a fronteira entre lógica combinacional e
 * sequencial.
 */
export type ComponentType =
  | 'input'
  | 'output'
  | 'constant'
  | 'and'
  | 'or'
  | 'not'
  | 'nand'
  | 'nor'
  | 'xor'
  | 'xnor'
  | 'clock'
  | 'dff'
  | 'tff'
  | 'delay'
  | 'transmitter'
  | 'receiver'

/** De onde vem um sinal: um componente e qual das saídas dele. */
export interface PortRef {
  node: string
  /** Índice da saída. 0 quando o componente só tem uma. */
  port?: number
}

export interface ComponentOptions {
  /** `clock`: quantos tiques em cada nível antes de virar. */
  period?: number
  /** `delay`: de quantos tiques é o atraso. */
  ticks?: number
  /** `constant`: o valor fixo. */
  value?: boolean
  /** `input`, `dff`, `tff`, `clock`: valor no instante zero. */
  initial?: boolean
  /** Largura do sinal em bits; ausente equivale a um bit. */
  width?: number
  /** Nome normalizado do canal wireless para transmitter/receiver. */
  channel?: string
}

export interface ComponentSpec {
  id: string
  type: ComponentType
  /** Ligações das entradas, na ordem dos pinos. */
  inputs?: PortRef[]
  options?: ComponentOptions
  /** Rótulo livre, só para exibição. */
  label?: string
}

export interface Netlist {
  components: ComponentSpec[]
}

/** Quantas saídas cada tipo de componente tem. */
export function outputCount(type: ComponentType): number {
  return type === 'dff' || type === 'tff' ? 2 : 1
}

/** Nomes das saídas, na ordem — usados nas mensagens e na interface. */
export function outputNames(type: ComponentType): string[] {
  return type === 'dff' || type === 'tff' ? ['Q', 'Q̄'] : ['OUT']
}

/** Nomes das entradas esperadas, quando o componente tem uma ordem fixa. */
export function inputNames(type: ComponentType): string[] | null {
  switch (type) {
    case 'dff':
      return ['D', 'CLK']
    case 'tff':
      return ['T', 'CLK']
    case 'delay':
    case 'not':
    case 'output':
    case 'transmitter':
      return ['IN']
    case 'input':
    case 'constant':
    case 'clock':
    case 'receiver':
      return []
    default:
      // Portas lógicas aceitam qualquer número de entradas.
      return null
  }
}

const FOLDS: Partial<Record<ComponentType, (values: boolean[]) => boolean>> = {
  and: (values) => values.every(Boolean),
  or: (values) => values.some(Boolean),
  nand: (values) => !values.every(Boolean),
  nor: (values) => !values.some(Boolean),
  xor: (values) => values.filter(Boolean).length % 2 === 1,
  xnor: (values) => values.filter(Boolean).length % 2 === 0,
  not: (values) => !values[0],
}

/** Resultado de uma porta combinacional, ou null se o tipo tem estado. */
export function combinationalResult(
  type: ComponentType,
  values: boolean[],
): boolean | null {
  const fold = FOLDS[type]
  if (!fold) return null
  // Uma porta sem nada ligado fica em falso, como um fio solto.
  return values.length === 0 ? false : fold(values)
}
