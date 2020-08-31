import { OutboundMessage } from '../../types';
import { createOutboundMessage } from '../helpers';
import { ConnectionRecord } from '../../storage/ConnectionRecord';
import { KeylistUpdateMessage, KeylistUpdateAction } from '../coordinatemediation/KeylistUpdateMessage';
import { ForwardMessage } from './ForwardMessage';
import { InboundMessageContext } from '../../agent/models/InboundMessageContext';

export interface RoutingTable {
  [recipientKey: string]: ConnectionRecord | undefined;
}

class ProviderRoutingService {
  private routingTable: RoutingTable = {};

  /**
   * @todo use connection from message context
   */
  public updateRoutes(messageContext: InboundMessageContext<KeylistUpdateMessage>, connection: ConnectionRecord) {
    const { message } = messageContext;

    for (const update of message.updates) {
      switch (update.action) {
        case KeylistUpdateAction.add:
          this.saveRoute(update.recipientKey, connection);
          break;
        case KeylistUpdateAction.remove:
          this.removeRoute(update.recipientKey, connection);
          break;
      }
    }
  }

  public forward(messageContext: InboundMessageContext<ForwardMessage>): OutboundMessage<ForwardMessage> {
    const { message, recipientVerkey } = messageContext;

    // TODO: update to class-validator validation
    if (!message.to) {
      throw new Error('Invalid Message: Missing required attribute "to"');
    }

    const connection = this.findRecipient(message.to);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipientVerkey} not found!`);
    }

    if (!connection.theirKey) {
      throw new Error(`Connection with verkey ${connection.verkey} has no recipient keys.`);
    }

    return createOutboundMessage(connection, message);
  }

  public getRoutes() {
    return this.routingTable;
  }

  public findRecipient(recipientKey: Verkey) {
    const connection = this.routingTable[recipientKey];

    // TODO: function with find in name should now throw error when not found.
    // It should either be called getRecipient and throw error
    // or findRecipient and return null
    if (!connection) {
      throw new Error(`Routing entry for recipientKey ${recipientKey} does not exists.`);
    }

    return connection;
  }

  public saveRoute(recipientKey: Verkey, connection: ConnectionRecord) {
    if (this.routingTable[recipientKey]) {
      throw new Error(`Routing entry for recipientKey ${recipientKey} already exists.`);
    }

    this.routingTable[recipientKey] = connection;
  }

  public removeRoute(recipientKey: Verkey, connection: ConnectionRecord) {
    const storedConnection = this.routingTable[recipientKey];

    if (!storedConnection) {
      throw new Error('Cannot remove non-existing routing entry');
    }

    if (storedConnection.id !== connection.id) {
      throw new Error('Cannot remove routing entry for another connection');
    }

    delete this.routingTable[recipientKey];
  }
}

export { ProviderRoutingService };
