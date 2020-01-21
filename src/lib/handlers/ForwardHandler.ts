import { InboundMessage, TYPES } from '../types';
import { Handler } from './Handler';
import { ProviderRoutingService } from '../protocols/routing/ProviderRoutingService';
import { inject, injectable } from 'inversify';

@injectable()
export class ForwardHandler implements Handler {
  routingService: ProviderRoutingService;

  constructor(@inject(TYPES.ProviderRoutingService) routingService: ProviderRoutingService) {
    this.routingService = routingService;
  }

  async handle(inboundMessage: InboundMessage) {
    const outboundMessage = this.routingService.forward(inboundMessage);
    return outboundMessage;
  }
}
