import { ConnectionRecord } from '../modules/connections'
import { AgentMessage } from './AgentMessage'
import { OutboundMessage } from '../types'
import { ConnectionInvitationMessage } from '../modules/connections'
import { IndyAgentService } from '../modules/connections'

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
      endpoint: invitation.serviceEndpoint,
      payload,
      recipientKeys: invitation.recipientKeys || [],
      routingKeys: invitation.routingKeys || [],
      senderVk: connection.verkey,
    }
  }

  const { theirDidDoc } = connection

  if (!theirDidDoc) {
    throw new Error(`DidDoc for connection with verkey ${connection.verkey} not found!`)
  }

  const [service] = theirDidDoc.getServicesByClassType(IndyAgentService)

  return {
    connection,
    endpoint: service.serviceEndpoint,
    payload,
    recipientKeys: service.recipientKeys,
    routingKeys: service.routingKeys ?? [],
    senderVk: connection.verkey,
  }
}
