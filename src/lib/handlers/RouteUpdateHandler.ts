import { InboundMessage } from '../types';
import { Handler } from './Handler';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { ProviderRoutingService } from '../protocols/routing/ProviderRoutingService';

export class RouteUpdateHandler implements Handler {
  connectionService: ConnectionService;
  routingService: ProviderRoutingService;

  constructor(connectionService: ConnectionService, routingService: ProviderRoutingService) {
    this.connectionService = connectionService;
    this.routingService = routingService;
  }

  async handle(inboundMessage: InboundMessage) {
    const { recipient_verkey } = inboundMessage;
    const connection = this.connectionService.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    const outboundMessage = this.routingService.updateRoutes(inboundMessage, connection);
    return outboundMessage;
  }
}
