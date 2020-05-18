import { InboundMessage } from '../../types';
import { Handler } from '../Handler';
import { ProviderRoutingService } from '../../protocols/routing/ProviderRoutingService';
import { MessageType } from '../../protocols/routing/messages';

export class ForwardHandler implements Handler {
  routingService: ProviderRoutingService;

  constructor(routingService: ProviderRoutingService) {
    this.routingService = routingService;
  }

  get supportedMessageTypes(): [MessageType.ForwardMessage] {
    return [MessageType.ForwardMessage];
  }

  async handle(inboundMessage: InboundMessage) {
    const outboundMessage = this.routingService.forward(inboundMessage);
    return outboundMessage;
  }
}
