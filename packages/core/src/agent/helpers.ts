import type { ConnectionRecord } from '../modules/connections'
import type { OutboundMessage, OutboundPackage } from '../types'

import { AgentMessage } from './AgentMessage'

export function createOutboundMessage<T extends AgentMessage = AgentMessage>(
  connection: ConnectionRecord,
  payload: T
): OutboundMessage<T> {
  return {
    connection,
    payload,
  }
}

export function isUnpackedPackedMessage(
  outboundMessage: OutboundMessage | OutboundPackage
): outboundMessage is OutboundMessage {
  return outboundMessage.payload instanceof AgentMessage
}
