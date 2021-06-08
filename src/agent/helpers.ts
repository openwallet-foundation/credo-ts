import { AriesFrameworkError } from '../error'
import { ConnectionRecord, ConnectionInvitationMessage } from '../modules/connections'
import { OutboundMessage } from '../types'

import { AgentMessage } from './AgentMessage'

export function createOutboundMessage<T extends AgentMessage = AgentMessage>(
  connection: ConnectionRecord,
  payload: T,
  invitation?: ConnectionInvitationMessage
): OutboundMessage<T> {
  if (invitation) {
    // TODO: invitation recipientKeys, routingKeys, endpoint could be missing
    // When invitation uses DID
    return {
      connection,
      payload,
      recipientKeys: invitation.recipientKeys || [],
      routingKeys: invitation.routingKeys || [],
      senderVk: connection.verkey,
    }
  }

  const { theirDidDoc } = connection

  if (!theirDidDoc) {
    throw new AriesFrameworkError(`DidDoc for connection with verkey ${connection.verkey} not found!`)
  }

  const [service] = theirDidDoc.didCommServices

  return {
    connection,
    payload,
    recipientKeys: service.recipientKeys,
    routingKeys: service.routingKeys ?? [],
    senderVk: connection.verkey,
  }
}
