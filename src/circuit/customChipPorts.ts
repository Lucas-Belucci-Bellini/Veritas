import type { CircuitNode } from './editorModel'

/**
 * Ordem canônica dos pinos de um chip customizado.
 *
 * O índice de porta de uma instância `custom-chip` — o `port` de uma conexão —
 * precisa significar a mesma coisa nos três lugares que o consultam: a
 * validação, que indexa `definition.inputs[port]`; a interface, que desenha um
 * conector por porta nessa mesma ordem; e a elaboração, que liga a porta ao
 * pino lá dentro do chip.
 *
 * Enquanto cada um decidia a ordem por conta própria, bastava a ordem do
 * documento divergir da ordem por ID para o sinal entrar numa porta e sair por
 * outra — sem erro, sem aviso, só o valor errado. E divergir é fácil: os IDs
 * do editor são `input-1`, `input-2`, …, e `"input-11"` vem *antes* de
 * `"input-2"` na ordenação textual.
 */
export function orderCustomChipPins<T extends Pick<CircuitNode, 'id'>>(nodes: readonly T[]): T[] {
  return [...nodes].sort((a, b) => a.id.localeCompare(b.id))
}
