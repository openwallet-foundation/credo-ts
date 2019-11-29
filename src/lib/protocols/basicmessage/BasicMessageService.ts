import { InboundMessage, Connection } from '../../types';
import { createOutboundMessage } from '../helpers';
import { createAckMessage } from '../connections/messages';
import { createBasicMessage } from './messages';

class BasicMessageService {
  send(message: string, connection: Connection) {
    const basicMessage = createBasicMessage(message);
    return createOutboundMessage(connection, basicMessage);
  }

  save(inboundMessage: InboundMessage, connection: Connection) {
    const { message } = inboundMessage;
    connection.messages.push(message);

    const response = createAckMessage(message['@id']);

    return createOutboundMessage(connection, response);
  }
}

export { BasicMessageService };
