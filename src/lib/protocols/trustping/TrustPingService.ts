import { InboundMessage } from '../../types';
import { createOutboundMessage } from '../helpers';
import { createTrustPingResponseMessage, MessageType } from './messages';
import { Connection } from '../..';
import { ConnectionState } from '../connections/domain/ConnectionState';

export class TrustPingService {
  process_ping(inboundMessage: InboundMessage, connection: Connection) {
    if (inboundMessage.message['response_requested']) {
      const reply = createTrustPingResponseMessage(inboundMessage.message['@id']);
      return createOutboundMessage(connection, reply);
    }
    return null;
  }

  process_ping_response(inboundMessage: InboundMessage, connection: Connection) {
    if (connection.getState() != ConnectionState.COMPLETE) {
      connection.updateState(ConnectionState.COMPLETE);
    }
    return null;
  }
}
