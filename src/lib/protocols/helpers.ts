import { ConnectionRecord } from '../storage/ConnectionRecord';
import { AgentMessage } from '../agent/AgentMessage';
import { OutboundMessage } from '../types';
import { ConnectionInvitationMessage } from './connections/messages/ConnectionInvitationMessage';
import { IndyAgentService } from './connections/domain/did/service';

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
    };
  }

  const { theirDidDoc } = connection;

  if (!theirDidDoc) {
    throw new Error(`DidDoc for connection with verkey ${connection.verkey} not found!`);
  }

  const [service] = theirDidDoc.getServicesByClassType(IndyAgentService);

  return {
    connection,
    endpoint: service.serviceEndpoint,
    payload,
    recipientKeys: service.recipientKeys,
    routingKeys: service.routingKeys ?? [],
    senderVk: connection.verkey,
  };
}
