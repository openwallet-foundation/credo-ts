import type { OutboundMessageContext, OutboundServiceMessageContext } from './models'

export function isOutboundServiceMessage(
  message: OutboundMessageContext | OutboundServiceMessageContext
): message is OutboundServiceMessageContext {
  const service = (message as OutboundServiceMessageContext).service

  return service !== undefined
}
