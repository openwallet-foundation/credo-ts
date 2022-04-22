import type { ConnectionRecord } from '../modules/connections'
import type { OutboundMessage, OutboundServiceMessage } from '../types'
import type { DIDCommV1Message } from './didcomm/v1/AgentMessage'

import { DidCommService } from '../modules/dids/domain/service/DidCommService'

export function createOutboundMessage<T extends DIDCommV1Message = DIDCommV1Message>(
  connection: ConnectionRecord,
  payload: T
): OutboundMessage<T> {
  return {
    connection,
    payload,
  }
}

export function createOutboundServiceMessage<T extends DIDCommV1Message = DIDCommV1Message>(options: {
  payload: T
  service: DidCommService
  senderKey: string
}): OutboundServiceMessage<T> {
  return options
}

export function isOutboundServiceMessage(
  message: OutboundMessage | OutboundServiceMessage
): message is OutboundServiceMessage {
  return (message as OutboundServiceMessage).service instanceof DidCommService
}
