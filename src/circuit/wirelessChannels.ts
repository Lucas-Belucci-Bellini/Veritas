import { MAX_BUS_WIDTH } from '../bus'

export type WirelessEndpointKind = 'transmitter' | 'receiver'

export interface WirelessEndpoint {
  nodeId: string
  channel: string
  kind: WirelessEndpointKind
  width: number
}

export interface WirelessChannel {
  channel: string
  width: number
  transmitter: WirelessEndpoint
  receivers: WirelessEndpoint[]
}

export interface WirelessChannelIssue {
  code: 'empty-channel' | 'duplicate-node' | 'duplicate-transmitter' | 'missing-transmitter' | 'invalid-width' | 'width-mismatch'
  message: string
  nodeId?: string
  channel?: string
}

export interface WirelessChannelResolution {
  channels: WirelessChannel[]
  issues: WirelessChannelIssue[]
}

export function normalizeWirelessChannel(channel: string): string {
  return channel.trim().replace(/\s+/g, '-').toLowerCase()
}

export function resolveWirelessChannels(endpoints: readonly WirelessEndpoint[]): WirelessChannelResolution {
  const issues: WirelessChannelIssue[] = []
  const seenNodes = new Set<string>()
  const grouped = new Map<string, WirelessEndpoint[]>()

  for (const endpoint of endpoints) {
    const nodeId = endpoint.nodeId.trim()
    const channel = normalizeWirelessChannel(endpoint.channel)
    if (!nodeId || seenNodes.has(nodeId)) {
      issues.push({ code: 'duplicate-node', nodeId, message: `O endpoint wireless "${nodeId}" está vazio ou duplicado.` })
      continue
    }
    seenNodes.add(nodeId)
    if (!channel) {
      issues.push({ code: 'empty-channel', nodeId, message: `O endpoint wireless "${nodeId}" precisa informar um canal.` })
      continue
    }
    if (!Number.isInteger(endpoint.width) || endpoint.width < 1 || endpoint.width > MAX_BUS_WIDTH) {
      issues.push({ code: 'invalid-width', nodeId, channel, message: `O canal wireless "${channel}" usa uma largura inválida.` })
      continue
    }
    const normalized: WirelessEndpoint = { ...endpoint, nodeId, channel, width: endpoint.width }
    const current = grouped.get(channel) ?? []
    current.push(normalized)
    grouped.set(channel, current)
  }

  const channels: WirelessChannel[] = []
  for (const [channel, channelEndpoints] of [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const transmitters = channelEndpoints.filter((endpoint) => endpoint.kind === 'transmitter').sort((left, right) => left.nodeId.localeCompare(right.nodeId))
    const receivers = channelEndpoints.filter((endpoint) => endpoint.kind === 'receiver').sort((left, right) => left.nodeId.localeCompare(right.nodeId))
    const transmitter = transmitters[0]

    for (const duplicate of transmitters.slice(1)) {
      issues.push({ code: 'duplicate-transmitter', nodeId: duplicate.nodeId, channel, message: `O canal wireless "${channel}" possui mais de um transmissor.` })
    }
    if (!transmitter) {
      for (const receiver of receivers) {
        issues.push({ code: 'missing-transmitter', nodeId: receiver.nodeId, channel, message: `O receptor "${receiver.nodeId}" não encontra transmissor no canal wireless "${channel}".` })
      }
      continue
    }

    for (const receiver of receivers) {
      if (receiver.width !== transmitter.width) {
        issues.push({ code: 'width-mismatch', nodeId: receiver.nodeId, channel, message: `O receptor "${receiver.nodeId}" usa ${receiver.width} bits, mas o transmissor usa ${transmitter.width}.` })
      }
    }
    channels.push({ channel, width: transmitter.width, transmitter, receivers })
  }

  return { channels, issues }
}
