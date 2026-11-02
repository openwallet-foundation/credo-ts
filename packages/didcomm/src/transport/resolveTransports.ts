import type { DidCommModuleConfigOptions } from '../DidCommModuleConfig'
import { DidCommHttpInboundTransport } from './DidCommHttpInboundTransport'
import { DidCommHttpOutboundTransport } from './DidCommHttpOutboundTransport'
import { DidCommWsInboundTransport } from './DidCommWsInboundTransport'
import { DidCommWsOutboundTransport } from './DidCommWsOutboundTransport'

/**
 * Turns the `{ http, ws, custom }` form of the transports options into transport instances.
 */
export function resolveTransports(
  transports: DidCommModuleConfigOptions['transports'] = {}
): DidCommModuleConfigOptions['transports'] {
  const { inbound = [], outbound = [] } = transports

  return {
    inbound: Array.isArray(inbound)
      ? inbound
      : [
          ...(inbound.http ? [new DidCommHttpInboundTransport(inbound.http === true ? {} : inbound.http)] : []),
          ...(inbound.ws ? [new DidCommWsInboundTransport(inbound.ws === true ? {} : inbound.ws)] : []),
          ...(inbound.custom ?? []),
        ],
    outbound: Array.isArray(outbound)
      ? outbound
      : [
          ...(outbound.http ? [new DidCommHttpOutboundTransport()] : []),
          ...(outbound.ws ? [new DidCommWsOutboundTransport()] : []),
          ...(outbound.custom ?? []),
        ],
  }
}
