import { InboundMessage } from '../types';
import { Handler } from './Handler';
import { ProviderRoutingService } from '../protocols/routing/ProviderRoutingService';

export class ForwardHandler implements Handler {
  routingService: ProviderRoutingService;

  constructor(routingService: ProviderRoutingService) {
    this.routingService = routingService;
  }

  async handle(inboundMessage: InboundMessage) {
    const outboundMessage = this.routingService.forward(inboundMessage);
    return outboundMessage;
  }
}
