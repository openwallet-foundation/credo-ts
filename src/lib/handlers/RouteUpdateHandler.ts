import { InboundMessage, TYPES } from '../types';
import { Handler } from './Handler';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { ProviderRoutingService } from '../protocols/routing/ProviderRoutingService';
import { inject, injectable } from 'inversify';

@injectable()
export class RouteUpdateHandler implements Handler {
  connectionService: ConnectionService;
  routingService: ProviderRoutingService;

  constructor(
    @inject(TYPES.ConnectionService) connectionService: ConnectionService,
    @inject(TYPES.ProviderRoutingService) routingService: ProviderRoutingService
  ) {
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
