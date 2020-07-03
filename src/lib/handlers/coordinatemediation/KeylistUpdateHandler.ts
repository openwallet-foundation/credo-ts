import { Handler, HandlerInboundMessage } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { ProviderRoutingService } from '../../protocols/routing/ProviderRoutingService';
import { KeylistUpdateMessage } from '../../protocols/coordinatemediation/KeylistUpdateMessage';

export class KeylistUpdateHandler implements Handler {
  connectionService: ConnectionService;
  routingService: ProviderRoutingService;
  supportedMessages = [KeylistUpdateMessage];

  constructor(connectionService: ConnectionService, routingService: ProviderRoutingService) {
    this.connectionService = connectionService;
    this.routingService = routingService;
  }

  async handle(inboundMessage: HandlerInboundMessage<KeylistUpdateHandler>) {
    const { recipient_verkey } = inboundMessage;
    const connection = await this.connectionService.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    this.routingService.updateRoutes(inboundMessage, connection);
  }
}
