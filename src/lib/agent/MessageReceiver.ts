import logger from '../logger';
import { AgentConfig } from './AgentConfig';
import { Dispatcher } from './Dispatcher';
import { EnvelopeService } from './EnvelopeService';
import { UnpackedMessage } from '../types';
import { MessageType } from '../protocols/routing/messages';
import { InboundMessageContext } from './models/InboundMessageContext';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { AgentMessage } from './AgentMessage';
import { MessageTransformer } from './MessageTransformer';

class MessageReceiver {
  config: AgentConfig;
  envelopeService: EnvelopeService;
  connectionService: ConnectionService;
  dispatcher: Dispatcher;

  constructor(
    config: AgentConfig,
    envelopeService: EnvelopeService,
    connectionService: ConnectionService,
    dispatcher: Dispatcher
  ) {
    this.config = config;
    this.envelopeService = envelopeService;
    this.connectionService = connectionService;
    this.dispatcher = dispatcher;
  }

  /**
   * Receive and handle an inbound DIDComm message. It will unpack the message, transform it
   * to it's corresponding message class and finaly dispatch it to the dispatcher.
   *
   * @param inboundPackedMessage the message to receive and handle
   */
  public async receiveMessage(inboundPackedMessage: any) {
    logger.logJson(`Agent ${this.config.label} received message:`, inboundPackedMessage);

    const unpackedMessage = await this.unpackMessage(inboundPackedMessage);

    logger.logJson('inboundMessage', unpackedMessage);

    const message = await this.transformMessage(unpackedMessage);
    let senderKey = unpackedMessage.sender_verkey;
    let connection = undefined;
    if (senderKey && unpackedMessage.recipient_verkey) {
      connection = (await this.connectionService.findByVerkey(unpackedMessage.recipient_verkey)) || undefined;

      // we validate the sender key if it is the one we have the connection with
      // otherwise everyone could send message for our key, and we would just accept
      // it as if it was send by the connection.
      // TODO: does this correctly work for the connection process? Keys can be swapped during the protocol
      if (connection && connection.theirKey != null && connection.theirKey != senderKey) {
        throw new Error(
          `Inbound message 'sender_key' ${senderKey} is different from connection.theirKey ${connection.theirKey}`
        );
      }
    }

    const messageContext = new MessageContext(message, {
      connection,
      senderVerkey: senderKey,
      recipientVerkey: unpackedMessage.recipient_verkey,
    });

    return await this.dispatcher.dispatch(messageContext);
  }

  /**
   * Unpack a message using the envelope service. Will perform extra unpacking steps for forward messages.
   * If message is not packed, it will be returned as is, but in the unpacked message structure
   *
   * @param packedMessage the received, probably packed, message to unpack
   */
  private async unpackMessage(packedMessage: any): Promise<UnpackedMessage> {
    // If the inbound message has no @type field we assume
    // the message is packed and must be unpacked first
    if (!packedMessage['@type']) {
      // TODO: handle when the unpacking fails. At the moment this will throw a cryptic
      // indy-sdk error. Eventually we should create a problem report message
      let unpackedMessage = await this.envelopeService.unpackMessage(packedMessage);

      // if the message is of type forward we should check whether the
      //  - forward message is intended for us (so unpack inner `msg` and pass that to dispatcher)
      //  - or that the message should be forwarded (pass unpacked forward message with packed `msg` to dispatcher)
      if (unpackedMessage.message['@type'] === MessageType.ForwardMessage) {
        logger.logJson('Forwarded message', unpackedMessage);

        try {
          unpackedMessage = await this.envelopeService.unpackMessage(unpackedMessage.message.msg);
        } catch {
          // To check whether the `to` field is a key belonging to us could be done in two ways.
          // We now just try to unpack, if it errors it means we don't have the key to unpack the message
          // if we can unpack the message we certainly are the owner of the key in the to field.
          // Another approach is to first check whether the key belongs to us and only unpack if so.
          // I think this approach is better, but for now the current approach is easier
          // It is thus okay to silently ignore this error
        }
      }

      return unpackedMessage;
    }
    // If the message does have an @type field we assume
    // the message is already unpacked an use it directly
    else {
      const unpackedMessage: UnpackedMessage = { message: packedMessage };
      return unpackedMessage;
    }
  }

  /**
   * Transform an unpacked DIDComm message into it's corresponding message class. Will look at all message types in the registered handlers.
   *
   * @param unpackedMessage the unpacked message for which to transform the message in to a class instance
   */
  private async transformMessage(unpackedMessage: UnpackedMessage): Promise<AgentMessage> {
    const messageType = unpackedMessage.message['@type'];
    const MessageClass = this.dispatcher.getMessageClassForType(messageType);

    if (!MessageClass) {
      throw new Error(`No message class for message type "${messageType}" found`);
    }

    // Cast the plain JSON object to specific instance of Message extended from AgentMessage
    const message = MessageTransformer.toMessageInstance(unpackedMessage.message, MessageClass);

    return message;
  }
}

export { MessageReceiver };
