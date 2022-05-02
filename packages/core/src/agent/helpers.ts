import type { ConnectionRecord } from '../modules/connections'
import type { Key } from '../modules/dids/domain/Key'
import type { OutOfBandRecord } from '../modules/oob/repository'
import type { OutboundMessage, OutboundServiceMessage } from '../types'
import type { AgentMessage } from './AgentMessage'
<<<<<<< HEAD

import { IndyAgentService } from '../modules/dids'
import { DidCommService } from '../modules/dids/domain/service/DidCommService'
=======
import type { ResolvedDidCommService } from './MessageSender'
>>>>>>> 73d296f6 (fix: always encode keys according to RFCs (#733))

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
<<<<<<< HEAD
  return service instanceof IndyAgentService || service instanceof DidCommService
=======

  return service !== undefined
>>>>>>> 73d296f6 (fix: always encode keys according to RFCs (#733))
}
