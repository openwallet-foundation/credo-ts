import type { ConnectionRecord } from '../modules/connections'
import type {
  OutboundDIDCommV2Message,
  OutboundMessage,
  OutboundPlainMessage,
  OutboundServiceMessage,
  OutboundSignedMessage,
} from '../types'
import type { DIDCommMessage, DIDCommV2Message } from './didcomm'

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

export function createOutboundSignedMessage<T extends DIDCommMessage = DIDCommMessage>(
  payload: T,
  from: string
): OutboundSignedMessage<T> {
  return {
    payload,
    from,
  }
}

export function createOutboundPlainMessage<T extends DIDCommMessage = DIDCommMessage>(
  payload: T
): OutboundPlainMessage<T> {
  return {
    payload,
  }
}

export function createOutboundDIDCommV2Message<T extends DIDCommV2Message = DIDCommV2Message>(
  payload: T
): OutboundDIDCommV2Message<T> {
  return {
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
