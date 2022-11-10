import type { Key } from '../crypto'
import type { ConnectionRecord } from '../modules/connections'
import type { ResolvedDidCommService } from '../modules/didcomm'
import type { OutOfBandRecord } from '../modules/oob/repository'
import type { OutboundDIDCommV1Message, OutboundDIDCommV1ServiceMessage, OutboundDIDCommV2Message } from '../types'
import type { DIDCommV1Message, DIDCommV2Message } from './didcomm'

import { DIDCommMessageVersion } from './didcomm/types'

export function createOutboundDIDCommV1Message<T extends DIDCommV1Message = DIDCommV1Message>(
  connection: ConnectionRecord,
  payload: T,
  outOfBand?: OutOfBandRecord
): OutboundDIDCommV1Message<T> {
  return {
    connection,
    outOfBand,
    payload,
  }
}

export function createOutboundServiceMessage<T extends DIDCommV1Message = DIDCommV1Message>(options: {
  payload: T
  service: ResolvedDidCommService
  senderKey: Key
}): OutboundDIDCommV1ServiceMessage<T> {
  return options
}

export function createOutboundDIDCommV2Message<T extends DIDCommV2Message = DIDCommV2Message>(
  payload: T
): OutboundDIDCommV2Message<T> {
  return {
    payload,
  }
}

export function isOutboundServiceMessage(
  message: OutboundDIDCommV1Message | OutboundDIDCommV1ServiceMessage | OutboundDIDCommV2Message
): message is OutboundDIDCommV1ServiceMessage {
  const service = (message as OutboundDIDCommV1ServiceMessage).service

  return service !== undefined
}

export function isOutboundDIDCommV1Message(
  message: OutboundDIDCommV1Message | OutboundDIDCommV1ServiceMessage | OutboundDIDCommV2Message
): message is OutboundDIDCommV1Message {
  return message.payload.version === DIDCommMessageVersion.V1
}

export function isOutboundDIDCommV2Message(
  message: OutboundDIDCommV1Message | OutboundDIDCommV1ServiceMessage | OutboundDIDCommV2Message
): message is OutboundDIDCommV2Message {
  return message.payload.version === DIDCommMessageVersion.V2
}
