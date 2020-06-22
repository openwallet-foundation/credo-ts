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

    // If the inbound message has no @type field we assume
    // the message is packed and must be unpacked first
    if (!inboundPackedMessage['@type']) {
      // TODO: handle when the unpacking fails. At the moment this will throw a cryptic
      // indy-sdk error. Eventually we should create a problem report message
      inboundMessage = await this.envelopeService.unpackMessage(inboundPackedMessage);

      // if the message is of type forward we should check whether the
      //  - forward message is intended for us (so unpack inner `msg` and pass that to dispatcher)
      //  - or that the message should be forwarded (pass unpacked forward message with packed `msg` to dispatcher)
      if (inboundMessage.message['@type'] === MessageType.ForwardMessage) {
        logger.logJson('Forwarded message', inboundMessage);

        try {
          inboundMessage = await this.envelopeService.unpackMessage(inboundMessage.message.msg);
        } catch {
          // To check whether the `to` field is a key belonging to us could be done in two ways.
          // We now just try to unpack, if it errors it means we don't have the key to unpack the message
          // if we can unpack the message we certainly are the owner of the key in the to field.
          // Another approach is to first check whether the key belongs to us and only unpack if so.
          // I think this approach is better, but for now the current approach is easier
          // It is thus okay to silently ignore this error
        }
      }
    }
    // If the message does have an @type field we assume
    // the message is already unpacked an use it directly
    else {
      inboundMessage = { message: inboundPackedMessage };
    }

    logger.logJson('inboundMessage', inboundMessage);

    // TODO: dispatcher expects UnpackedMessage type
    // however the type can also be { message: inboundPackedMessage }
    // when we receive an already unpacked message
    return await this.dispatcher.dispatch(inboundMessage as UnpackedMessage);
  }
}

export { MessageReceiver };
