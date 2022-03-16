import type { ConnectionRecord } from '../modules/connections'
import type { OutOfBandRecord } from '../modules/oob/repository'
import type { OutboundMessage, OutboundServiceMessage } from '../types'
import type { AgentMessage } from './AgentMessage'

import { DidCommService } from '../modules/dids/domain/service/DidCommService'

export function createOutboundMessage<T extends AgentMessage = AgentMessage>(
  connection: ConnectionRecord,
  payload: T,
  outOfBand?: OutOfBandRecord
): OutboundMessage<T> {
  return {
    connection,
    outOfBand,
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
  return (message as OutboundServiceMessage).service instanceof DidCommService
}
