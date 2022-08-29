import type { ConnectionRecord } from '../modules/connections'
import type { ResolvedDidCommService } from '../modules/didcomm'
import type { Key } from '../modules/dids/domain/Key'
import type { OutOfBandRecord } from '../modules/oob/repository'
import type { OutboundMessage, OutboundServiceMessage } from '../types'
import type { AgentMessage } from './AgentMessage'

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
  service: ResolvedDidCommService
  senderKey: Key
}): OutboundServiceMessage<T> {
  return options
}

export function isOutboundServiceMessage(
  message: OutboundMessage | OutboundServiceMessage
): message is OutboundServiceMessage {
  const service = (message as OutboundServiceMessage).service

  return service !== undefined
}
