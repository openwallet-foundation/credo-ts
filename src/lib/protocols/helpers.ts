import { ConnectionRecord } from '../storage/ConnectionRecord';
import { AgentMessage } from '../agent/AgentMessage';
import { OutboundMessage } from '../types';

export function createOutboundMessage<T extends AgentMessage = AgentMessage>(
  connection: ConnectionRecord,
  payload: T,
  invitation?: any
): OutboundMessage<T> {
  if (invitation) {
    return {
      connection,
      endpoint: invitation.serviceEndpoint,
      payload,
      recipientKeys: invitation.recipientKeys,
      routingKeys: invitation.routingKeys || [],
      senderVk: connection.verkey,
    };
  }

  const { theirDidDoc } = connection;

  if (!theirDidDoc) {
    throw new Error(`DidDoc for connection with verkey ${connection.verkey} not found!`);
  }

  return {
    connection,
    endpoint: theirDidDoc.service[0].serviceEndpoint,
    payload,
    recipientKeys: theirDidDoc.service[0].recipientKeys,
    routingKeys: theirDidDoc.service[0].routingKeys,
    senderVk: connection.verkey,
  };
}
