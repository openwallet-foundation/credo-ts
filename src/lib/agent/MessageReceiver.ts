import logger from '../logger';
import { AgentConfig } from './AgentConfig';
import { Dispatcher } from './Dispatcher';
import { EnvelopeService } from './EnvelopeService';
import { UnpackedMessage } from '../types';
import { MessageType } from '../protocols/routing/messages';

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

      // TODO: why is it different than before?
      // TODO: we should determine whether we are the target of the forward message
      // if we are we should unpack the msg from the forward message and handle it
      // if we are not, and we should forward, we do not unpack and pass the forward message to the forward handler
      if (inboundMessage.message['@type'] === MessageType.ForwardMessage && this.config.agencyUrl !== undefined) {
        // TODO In this case we assume we got forwarded JWE message (wire message?) to this agent from agency. We should
        // perhaps try to unpack message in some loop until we have a Aries message in here.
        logger.logJson('Forwarded message', inboundMessage);

        inboundMessage = await this.envelopeService.unpackMessage(inboundMessage.message.msg);
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
