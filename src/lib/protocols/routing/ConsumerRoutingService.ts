import logger from '../../logger';
import { createRouteUpdateMessage } from './messages';
import { createOutboundMessage } from '../helpers';
import { AgentConfig } from '../../agent/AgentConfig';
import { MessageSender } from '../../agent/MessageSender';

class ConsumerRoutingService {
  messageSender: MessageSender;
  agentConfig: AgentConfig;

  constructor(messageSender: MessageSender, agentConfig: AgentConfig) {
    this.messageSender = messageSender;
    this.agentConfig = agentConfig;
  }

  async createRoute(verkey: Verkey) {
    logger.log('Creating route...');

    if (!this.agentConfig.inboundConnection) {
      logger.log('There is no agency. Creating route skipped.');
    } else {
      const routingConnection = this.agentConfig.inboundConnection.connection;
      const routeUpdateMessage = createRouteUpdateMessage(verkey);

      const outboundMessage = createOutboundMessage(routingConnection, routeUpdateMessage);
      await this.messageSender.sendMessage(outboundMessage);
    }
  }
}

export { ConsumerRoutingService };
