import { AgentConfig } from './AgentConfig'
import { Dispatcher } from './Dispatcher'
import { EnvelopeService } from './EnvelopeService'
import { UnpackedMessageContext, UnpackedMessage } from '../types'
import { InboundMessageContext } from './models/InboundMessageContext'
import { RoutingMessageType as MessageType } from '../modules/routing'
import { ConnectionService } from '../modules/connections'
import { AgentMessage } from './AgentMessage'
import { JsonTransformer } from '../utils/JsonTransformer'
import { Logger } from '../logger'
import { replaceLegacyDidSovPrefixOnMessage } from '../utils/messageType'

class MessageReceiver {
  private config: AgentConfig
  private envelopeService: EnvelopeService
  private connectionService: ConnectionService
  private dispatcher: Dispatcher
  private logger: Logger

  public constructor(
    config: AgentConfig,
    envelopeService: EnvelopeService,
    connectionService: ConnectionService,
    dispatcher: Dispatcher
  ) {
    this.config = config
    this.envelopeService = envelopeService
    this.connectionService = connectionService
    this.dispatcher = dispatcher
    this.logger = this.config.logger
  }

  /**
   * Receive and handle an inbound DIDComm message. It will unpack the message, transform it
   * to it's corresponding message class and finally dispatch it to the dispatcher.
   *
   * @param inboundPackedMessage the message to receive and handle
   */
  public async receiveMessage(inboundPackedMessage: unknown) {
    if (typeof inboundPackedMessage !== 'object' || inboundPackedMessage == null) {
      throw new Error('Invalid message received. Message should be object')
    }

    this.logger.debug(`Agent ${this.config.label} received message:`, inboundPackedMessage)

    const unpackedMessage = await this.unpackMessage(inboundPackedMessage as Record<string, unknown>)

    const senderKey = unpackedMessage.sender_verkey
    let connection = undefined
    if (senderKey && unpackedMessage.recipient_verkey) {
      // TODO: only attach if theirKey is present. Otherwise a connection that may not be complete, validated or correct will
      // be attached to the message context. See #76
      connection = (await this.connectionService.findByVerkey(unpackedMessage.recipient_verkey)) || undefined

      // We check whether the sender key is the same as the key we have stored in the connection
      // otherwise everyone could send messages to our key and we would just accept
      // it as if it was send by the key of the connection.
      if (connection && connection.theirKey != null && connection.theirKey != senderKey) {
        throw new Error(
          `Inbound message 'sender_key' ${senderKey} is different from connection.theirKey ${connection.theirKey}`
        )
      }
    }

    this.logger.info(`Received message with type '${unpackedMessage.message['@type']}'`, unpackedMessage.message)

    const message = await this.transformMessage(unpackedMessage)
    const messageContext = new InboundMessageContext(message, {
      connection,
      senderVerkey: senderKey,
      recipientVerkey: unpackedMessage.recipient_verkey,
    })

    return await this.dispatcher.dispatch(messageContext)
  }

  /**
   * Unpack a message using the envelope service. Will perform extra unpacking steps for forward messages.
   * If message is not packed, it will be returned as is, but in the unpacked message structure
   *
   * @param packedMessage the received, probably packed, message to unpack
   */
  private async unpackMessage(packedMessage: Record<string, unknown>): Promise<UnpackedMessageContext> {
    // If the inbound message has no @type field we assume
    // the message is packed and must be unpacked first
    if (!this.isUnpackedMessage(packedMessage)) {
      let unpackedMessage: UnpackedMessageContext
      try {
        // TODO: handle when the unpacking fails. At the moment this will throw a cryptic
        // indy-sdk error. Eventually we should create a problem report message
        unpackedMessage = await this.envelopeService.unpackMessage(packedMessage)
      } catch (error) {
        this.logger.error('error while unpacking message', error)
        throw error
      }

      // if the message is of type forward we should check whether the
      //  - forward message is intended for us (so unpack inner `msg` and pass that to dispatcher)
      //  - or that the message should be forwarded (pass unpacked forward message with packed `msg` to dispatcher)
      if (unpackedMessage.message['@type'] === MessageType.ForwardMessage) {
        this.logger.debug('unpacking forwarded message', unpackedMessage)

        try {
          unpackedMessage = await this.envelopeService.unpackMessage(unpackedMessage.message.msg as JsonWebKey)
        } catch {
          // To check whether the `to` field is a key belonging to us could be done in two ways.
          // We now just try to unpack, if it errors it means we don't have the key to unpack the message
          // if we can unpack the message we certainly are the owner of the key in the to field.
          // Another approach is to first check whether the key belongs to us and only unpack if so.
          // I think this approach is better, but for now the current approach is easier
          // It is thus okay to silently ignore this error
        }
      }

      return unpackedMessage
    }
    // If the message does have an @type field we assume
    // the message is already unpacked an use it directly
    else {
      const unpackedMessage: UnpackedMessageContext = { message: packedMessage }
      return unpackedMessage
    }
  }

  private isUnpackedMessage(message: Record<string, unknown>): message is UnpackedMessage {
    return '@type' in message
  }

  /**
   * Transform an unpacked DIDComm message into it's corresponding message class. Will look at all message types in the registered handlers.
   *
   * @param unpackedMessage the unpacked message for which to transform the message in to a class instance
   */
  private async transformMessage(unpackedMessage: UnpackedMessageContext): Promise<AgentMessage> {
    // replace did:sov:BzCbsNYhMrjHiqZDTUASHg;spec prefix for message type with https://didcomm.org
    replaceLegacyDidSovPrefixOnMessage(unpackedMessage.message)

    const messageType = unpackedMessage.message['@type']
    const MessageClass = this.dispatcher.getMessageClassForType(messageType)

    if (!MessageClass) {
      throw new Error(`No handler for message type "${messageType}" found`)
    }

    // Cast the plain JSON object to specific instance of Message extended from AgentMessage
    const message = JsonTransformer.fromJSON(unpackedMessage.message, MessageClass)

    return message
  }
}

export { MessageReceiver }
