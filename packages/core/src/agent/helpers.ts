import type { ConnectionRecord } from '../modules/connections'
import type { OutboundMessage, OutboundServiceMessage } from '../types'
import type { AgentMessage } from './AgentMessage'

import { IndyAgentService } from '../modules/dids'
import { DidCommService } from '../modules/dids/domain/service/DidCommService'

export function createOutboundMessage<T extends AgentMessage = AgentMessage>(
  connection: ConnectionRecord,
  payload: T
): OutboundMessage<T> {
  return {
    connection,
    payload,
  }
}

export function createOutboundServiceMessage<T extends AgentMessage = AgentMessage>(options: {
  payload: T
  service: DidCommService
  senderKey: string
}): OutboundServiceMessage<T> {
  return options
}

export function isOutboundServiceMessage(
  message: OutboundMessage | OutboundServiceMessage
): message is OutboundServiceMessage {
  const service = (message as OutboundServiceMessage).service
  return service instanceof IndyAgentService || service instanceof DidCommService
}
