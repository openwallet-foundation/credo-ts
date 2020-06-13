import { InboundMessage } from '../../types';
import { createOutboundMessage } from '../helpers';
import { ConnectionRecord } from '../../storage/ConnectionRecord';
import { TrustPingMessage } from './TrustPingMessage';
import { TrustPingResponseMessage } from './TrustPingResponseMessage';

export class TrustPingService {
  processPing({ message }: InboundMessage<TrustPingMessage>, connection: ConnectionRecord) {
    if (message.responseRequested) {
      const response = new TrustPingResponseMessage({
        threadId: message.id,
      });

      return createOutboundMessage(connection, response);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  processPingResponse(inboundMessage: InboundMessage<TrustPingResponseMessage>) {}
}
