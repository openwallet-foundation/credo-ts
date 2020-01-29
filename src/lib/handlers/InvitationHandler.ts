import { InboundMessage } from '../types';
import { Handler } from './Handler';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { ConsumerRoutingService } from '../protocols/routing/ConsumerRoutingService';

export class InvitationHandler implements Handler {
  connectionService: ConnectionService;
  routingService: ConsumerRoutingService;

  constructor(connectionService: ConnectionService, routingService: ConsumerRoutingService) {
    this.connectionService = connectionService;
    this.routingService = routingService;
  }

  async handle(inboundMessage: InboundMessage) {
    const invitation = inboundMessage.message;
    const outboundMessage = await this.connectionService.acceptInvitation(invitation);

    const { verkey } = outboundMessage.connection;
    await this.routingService.createRoute(verkey);

    return outboundMessage;
  }
}
