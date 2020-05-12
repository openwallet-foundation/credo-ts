import { InboundMessage } from '../../types';
import { createOutboundMessage } from '../helpers';
import { Connection } from '../connections/domain/Connection';
import { MessageRepository } from '../../storage/MessageRepository';

interface RouteUpdate {
  action: 'add' | 'remove';
  recipient_key: Verkey;
}

class ProviderRoutingService {
  routingTable: { [recipientKey: string]: Connection } = {};

  updateRoutes(inboudMessage: InboundMessage, connection: Connection) {
    const { message } = inboudMessage;
    message.updates.forEach((update: RouteUpdate) => {
      const { action, recipient_key } = update;
      if (action === 'add') {
        this.saveRoute(recipient_key, connection);
      } else {
        throw new Error(`Unsupported operation ${action}`);
      }
    });

    return null;
  }

  forward(inboundMessage: InboundMessage) {
    const { message, recipient_verkey, sender_verkey } = inboundMessage;

    const { msg, to } = message;

    if (!to) {
      throw new Error('Invalid Message: Missing required attribute "to"');
    }

    const connection = this.findRecipient(to);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    if (!connection.theirKey) {
      throw new Error(`Connection with verkey ${connection.verkey} has no recipient keys.`);
    }

    return createOutboundMessage(connection, msg);
  }

  getRoutes() {
    return this.routingTable;
  }

  findRecipient(recipientKey: Verkey) {
    const connection = this.routingTable[recipientKey];

    if (!connection) {
      throw new Error(`Routing entry for recipientKey ${recipientKey} does not exists.`);
    }

    return connection;
  }

  saveRoute(recipientKey: Verkey, connection: Connection) {
    if (this.routingTable[recipientKey]) {
      throw new Error(`Routing entry for recipientKey ${recipientKey} already exists.`);
    }

    this.routingTable[recipientKey] = connection;
  }
}

export { ProviderRoutingService };
