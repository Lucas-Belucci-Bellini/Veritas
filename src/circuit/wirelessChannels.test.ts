import { describe, expect, it } from 'vitest'
import { normalizeWirelessChannel, resolveWirelessChannels, type WirelessEndpoint } from './wirelessChannels'

const endpoint = (overrides: Partial<WirelessEndpoint> = {}): WirelessEndpoint => ({
  nodeId: 'tx-a',
  channel: 'Sinal Clock',
  kind: 'transmitter',
  width: 1,
  ...overrides,
})

describe('canais wireless', () => {
  it('normaliza nomes de canal sem perder a intenção do usuário', () => {
    expect(normalizeWirelessChannel('  Sinal   Clock  ')).toBe('sinal-clock')
  })

  it('pareia um transmissor com receptores em ordem determinística', () => {
    const result = resolveWirelessChannels([
      endpoint({ nodeId: 'rx-z', kind: 'receiver' }),
      endpoint({ nodeId: 'tx-a' }),
      endpoint({ nodeId: 'rx-a', kind: 'receiver' }),
    ])

    expect(result.issues).toEqual([])
    expect(result.channels[0]).toMatchObject({ channel: 'sinal-clock', width: 1 })
    expect(result.channels[0]?.receivers.map((item) => item.nodeId)).toEqual(['rx-a', 'rx-z'])
  })

  it('bloqueia transmissor duplicado e receptor sem transmissor', () => {
    const duplicate = resolveWirelessChannels([
      endpoint({ nodeId: 'tx-a' }),
      endpoint({ nodeId: 'tx-b' }),
    ])
    const orphan = resolveWirelessChannels([endpoint({ nodeId: 'rx-a', kind: 'receiver' })])

    expect(duplicate.issues).toEqual([expect.objectContaining({ code: 'duplicate-transmitter', nodeId: 'tx-b' })])
    expect(orphan.issues).toEqual([expect.objectContaining({ code: 'missing-transmitter', nodeId: 'rx-a' })])
  })

  it('rejeita canal wireless acima do limite', () => {
    const result = resolveWirelessChannels([endpoint({ channel: 'x'.repeat(65) })])

    expect(result.issues).toEqual([expect.objectContaining({ code: 'channel-too-long', nodeId: 'tx-a' })])
    expect(result.channels).toEqual([])
  })

  it('rejeita largura incompatível entre transmissor e receptor', () => {
    const result = resolveWirelessChannels([
      endpoint({ width: 8 }),
      endpoint({ nodeId: 'rx-a', kind: 'receiver', width: 4 }),
    ])

    expect(result.issues).toEqual([expect.objectContaining({ code: 'width-mismatch', nodeId: 'rx-a' })])
    expect(result.channels[0]?.width).toBe(8)
  })
})
