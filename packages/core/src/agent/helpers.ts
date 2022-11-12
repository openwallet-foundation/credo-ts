import type { Key } from '../crypto'
import type { ConnectionRecord } from '../modules/connections'
import type { ResolvedDidCommService } from '../modules/didcomm'
import type { OutOfBandRecord } from '../modules/oob/repository'
import type { BaseRecord } from '../storage/BaseRecord'
import type { OutboundMessage, OutboundServiceMessage } from '../types'
import type { AgentMessage } from './AgentMessage'

export function createOutboundMessage<T extends AgentMessage = AgentMessage>(options: {
  associatedRecord?: BaseRecord<any, any, any>
  connection: ConnectionRecord
  outOfBand?: OutOfBandRecord
  payload: T
  sessionId?: string
}): OutboundMessage<T> {
  return {
    associatedRecord: options.associatedRecord,
    connection: options.connection,
    outOfBand: options.outOfBand,
    payload: options.payload,
    sessionId: options.sessionId,
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
