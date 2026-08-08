export type ValueStyle = 'vf' | 'binary'

export function renderValue(value: boolean, style: ValueStyle): string {
  if (style === 'binary') return value ? '1' : '0'
  return value ? 'V' : 'F'
}
