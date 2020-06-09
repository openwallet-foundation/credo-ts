import { InboundMessage } from '../../types';
import { createOutboundMessage } from '../helpers';
import { createTrustPingResponseMessage } from './messages';
import { ConnectionRecord } from '../../storage/ConnectionRecord';

export class TrustPingService {
  processPing(inboundMessage: InboundMessage, connection: ConnectionRecord) {
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
