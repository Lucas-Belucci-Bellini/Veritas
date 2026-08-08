import { useEffect, useState, type RefObject } from 'react'

export const ROW_HEIGHT = 32
const OVERSCAN = 12

/** A partir daqui vale a pena virtualizar; abaixo disso o DOM inteiro é barato. */
export const VIRTUALIZE_THRESHOLD = 200

export interface RowRange {
  start: number
  end: number
}

/**
 * Janela de linhas visíveis num contêiner rolável.
 *
 * Uma expressão com 12 variáveis dá 4096 linhas; multiplicado pelas colunas de
 * passos intermediários isso passa de 40 mil células no DOM e a rolagem trava.
 * Renderizando só a janela visível (mais uma folga) a tabela fica fluida em
 * qualquer tamanho.
 */
export function useVirtualRows(
  containerRef: RefObject<HTMLElement | null>,
  total: number,
): RowRange {
  const enabled = total > VIRTUALIZE_THRESHOLD
  const [range, setRange] = useState<RowRange>({ start: 0, end: total })

  useEffect(() => {
    const element = containerRef.current
    if (!enabled || !element) {
      setRange({ start: 0, end: total })
      return
    }

    const update = () => {
      const first = Math.floor(element.scrollTop / ROW_HEIGHT)
      const visible = Math.ceil(element.clientHeight / ROW_HEIGHT)
      setRange({
        start: Math.max(0, first - OVERSCAN),
        end: Math.min(total, first + visible + OVERSCAN),
      })
    }

    update()
    element.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(element)

    return () => {
      element.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [containerRef, enabled, total])

  return range
}
