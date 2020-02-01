import { InboundMessage } from '../../types';
import { createOutboundMessage } from '../helpers';
import { createTrustPingResponseMessage } from './messages';
import { Connection } from '../..';
import { ConnectionState } from '../connections/domain/ConnectionState';

export class TrustPingService {
  processPing(inboundMessage: InboundMessage, connection: Connection) {
    if (connection.getState() != ConnectionState.COMPLETE) {
      connection.updateState(ConnectionState.COMPLETE);
    }
    if (inboundMessage.message['response_requested']) {
      const reply = createTrustPingResponseMessage(inboundMessage.message['@id']);
      return createOutboundMessage(connection, reply);
    }
    return null;
  }

  processPingResponse(inboundMessage: InboundMessage) {
    return null;
  }
}
