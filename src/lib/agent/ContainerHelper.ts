import { Container } from 'inversify';
import { InvitationHandler } from '../handlers/InvitationHandler';
import { ConnectionRequestHandler } from '../handlers/ConnectionRequestHandler';
import { ConnectionResponseHandler } from '../handlers/ConnectionResponseHandler';
import { AckMessageHandler } from '../handlers/AckMessageHandler';
import { RouteUpdateHandler } from '../handlers/RouteUpdateHandler';
import { ForwardHandler } from '../handlers/ForwardHandler';
import { BasicMessageHandler } from '../handlers/BasicMessageHandler';
import { TYPES } from '../types';
import { Handler } from '../handlers/Handler';
import { MessageType as ConnectionsMessageType } from '../protocols/connections/messages';
import { MessageType as BasicMessageMessageType } from '../protocols/basicmessage/messages';
import { MessageType as RoutingMessageType } from '../protocols/routing/messages';

export default class ContainerHelper {
  static registerDefaultHandlers(container: Container) {
    container.bind<InvitationHandler>(TYPES.InvitationHandler).to(InvitationHandler);
    container.bind<ConnectionRequestHandler>(TYPES.ConnectionRequestHandler).to(ConnectionRequestHandler);
    container.bind<ConnectionResponseHandler>(TYPES.ConnectionResponseHandler).to(ConnectionResponseHandler);
    container.bind<AckMessageHandler>(TYPES.AckMessageHandler).to(AckMessageHandler);
    container.bind<BasicMessageHandler>(TYPES.BasicMessageHandler).to(BasicMessageHandler);
    container.bind<RouteUpdateHandler>(TYPES.RouteUpdateHandler).to(RouteUpdateHandler);
    container.bind<ForwardHandler>(TYPES.ForwardHandler).to(ForwardHandler);

    const handlers = {
      [ConnectionsMessageType.ConnectionInvitation]: container.get<InvitationHandler>(TYPES.InvitationHandler),
      [ConnectionsMessageType.ConnectionRequest]: container.get<ConnectionRequestHandler>(
        TYPES.ConnectionRequestHandler
      ),
      [ConnectionsMessageType.ConnectionResponse]: container.get<ConnectionResponseHandler>(
        TYPES.ConnectionResponseHandler
      ),
      [ConnectionsMessageType.Ack]: container.get<AckMessageHandler>(TYPES.AckMessageHandler),
      [BasicMessageMessageType.BasicMessage]: container.get<BasicMessageHandler>(TYPES.BasicMessageHandler),
      [RoutingMessageType.RouteUpdateMessage]: container.get<RouteUpdateHandler>(TYPES.RouteUpdateHandler),
      [RoutingMessageType.ForwardMessage]: container.get<ForwardHandler>(TYPES.ForwardHandler),
    };

    container.bind<{ [key: string]: Handler }>(TYPES.Handlers).toConstantValue(handlers);
  }
}
