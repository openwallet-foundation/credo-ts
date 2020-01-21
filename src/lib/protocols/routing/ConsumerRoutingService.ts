import logger from '../../logger';
import { createRouteUpdateMessage } from './messages';
import { createOutboundMessage } from '../helpers';
import { Context } from '../../agent/Context';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';

@injectable()
class ConsumerRoutingService {
  context: Context;

  constructor(@inject(TYPES.Context) context: Context) {
    this.context = context;
  }

  async createRoute(verkey: Verkey) {
    logger.log('Creating route...');

    if (!this.context.inboundConnection) {
      logger.log('There is no agency. Creating route skipped.');
    } else {
      const routingConnection = this.context.inboundConnection.connection;
      const routeUpdateMessage = createRouteUpdateMessage(verkey);

      const outboundMessage = createOutboundMessage(routingConnection, routeUpdateMessage);
      await this.context.messageSender.sendMessage(outboundMessage);
    }
  }
}

export { ConsumerRoutingService };
