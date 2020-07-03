import { Handler, HandlerInboundMessage } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { ConsumerRoutingService } from '../../protocols/routing/ConsumerRoutingService';
import { ConnectionInvitationMessage } from '../../protocols/connections/ConnectionInvitationMessage';

export class InvitationHandler implements Handler {
  connectionService: ConnectionService;
  routingService: ConsumerRoutingService;
  supportedMessages = [ConnectionInvitationMessage];

  constructor(connectionService: ConnectionService, routingService: ConsumerRoutingService) {
    this.connectionService = connectionService;
    this.routingService = routingService;
  }

  async handle(inboundMessage: HandlerInboundMessage<InvitationHandler>) {
    const invitation = inboundMessage.message;
    const outboundMessage = await this.connectionService.acceptInvitation(invitation);

    const { verkey } = outboundMessage.connection;

    // TODO: we should only create a route if we are using a mediator
    await this.routingService.createRoute(verkey);

    return outboundMessage;
  }
}
