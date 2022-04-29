import type { ConnectionRecord } from '../modules/connections'
import type { OutboundMessage, OutboundServiceMessage } from '../types'
import type { DIDCommMessage } from './didcomm'

import { DidCommService } from '../modules/dids/domain/service/DidCommService'

export function createOutboundMessage<T extends DIDCommMessage = DIDCommMessage>(
  connection: ConnectionRecord,
  payload: T
): OutboundMessage<T> {
  return {
    connection,
    payload,
  }
}

export function createOutboundServiceMessage<T extends DIDCommMessage = DIDCommMessage>(options: {
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
