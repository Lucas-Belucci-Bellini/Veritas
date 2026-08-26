import { outputValue, type SequentialSnapshot, type SequentialWatch } from './workspace'

export interface WaveformSample {
  tick: number
  value: boolean
}

export interface WaveformTrack {
  nodeId: string
  label: string
  port?: number
  samples: readonly WaveformSample[]
}

/**
 * Constrói faixas determinísticas de forma de onda sem executar o simulador.
 * A timeline já contém os estados observados; este módulo apenas os projeta
 * para uma forma adequada à visualização e a futuras exportações.
 */
export function buildWaveform(
  watches: readonly SequentialWatch[],
  timeline: readonly SequentialSnapshot[],
): readonly WaveformTrack[] {
  return watches.map((watch) => ({
    nodeId: watch.nodeId,
    label: watch.label,
    ...(watch.port === undefined ? {} : { port: watch.port }),
    samples: timeline.map((snapshot) => ({
      tick: snapshot.tick,
      value: outputValue(snapshot, watch),
    })),
  }))
}

/** Comprimi amostras adjacentes iguais em segmentos de duração observável. */
export function compressWaveform(samples: readonly WaveformSample[]): readonly WaveformSample[] {
  if (samples.length < 2) return [...samples]

  const compressed: WaveformSample[] = []
  for (const sample of samples) {
    const previous = compressed[compressed.length - 1]
    if (!previous || previous.value !== sample.value) {
      compressed.push({ ...sample })
    }
  }
  return compressed
}
