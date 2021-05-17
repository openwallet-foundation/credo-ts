import { ConnectionRecord } from '../modules/connections'
import { AgentMessage } from './AgentMessage'
import { OutboundMessage } from '../types'
import { ConnectionInvitationMessage } from '../modules/connections'
import { AriesFrameworkError } from '../error'

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
