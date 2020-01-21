import { InboundMessage, TYPES } from '../types';
import { Handler } from './Handler';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { ConsumerRoutingService } from '../protocols/routing/ConsumerRoutingService';
import { inject, injectable } from 'inversify';

@injectable()
export class InvitationHandler implements Handler {
  connectionService: ConnectionService;
  routingService: ConsumerRoutingService;

  constructor(
    @inject(TYPES.ConnectionService) connectionService: ConnectionService,
    @inject(TYPES.ConsumerRoutingService) routingService: ConsumerRoutingService
  ) {
    this.connectionService = connectionService;
    this.routingService = routingService;
  }

  async handle(inboundMessage: InboundMessage) {
    const invitation = inboundMessage.message;
    const outboundMessage = await this.connectionService.acceptInvitation(invitation);

    const { verkey } = outboundMessage.connection;
    this.routingService.createRoute(verkey);

    return outboundMessage;
  }
}
