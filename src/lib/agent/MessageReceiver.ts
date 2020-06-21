import logger from '../logger';
import { AgentConfig } from './AgentConfig';
import { Dispatcher } from './Dispatcher';
import { EnvelopeService } from './EnvelopeService';
import { UnpackedMessage } from '../types';

class MessageReceiver {
  config: AgentConfig;
  envelopeService: EnvelopeService;
  dispatcher: Dispatcher;

  constructor(config: AgentConfig, envelopeService: EnvelopeService, dispatcher: Dispatcher) {
    this.config = config;
    this.envelopeService = envelopeService;
    this.dispatcher = dispatcher;
  }

  async receiveMessage(inboundPackedMessage: any) {
    logger.logJson(`Agent ${this.config.label} received message:`, inboundPackedMessage);
    let inboundMessage;

    if (!inboundPackedMessage['@type']) {
      inboundMessage = await this.envelopeService.unpackMessage(inboundPackedMessage);

      if (!inboundMessage.message['@type']) {
        // TODO In this case we assume we got forwarded JWE message (wire message?) to this agent from agency. We should
        // perhaps try to unpack message in some loop until we have a Aries message in here.
        logger.logJson('Forwarded message', inboundMessage);

        // @ts-ignore
        inboundMessage = await this.envelopeService.unpackMessage(inboundMessage.message);
      }
    } else {
      inboundMessage = { message: inboundPackedMessage };
    }

    logger.logJson('inboundMessage', inboundMessage);

    // TODO: dispatcher expects UnpackedMessage
    // however the type can also be { message: inboundPackedMessage }
    return await this.dispatcher.dispatch(inboundMessage as UnpackedMessage);
  }
}

export { MessageReceiver };
