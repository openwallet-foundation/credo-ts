import type { Logger } from '../logger'
import type { ConnectionRecord } from '../modules/connections'
import type { InboundTransport } from '../transport'
import type { PlaintextMessage, EncryptedMessage } from '../types'
import type { AgentMessage } from './AgentMessage'
import type { DecryptedMessageContext } from './EnvelopeService'
import type { TransportSession } from './TransportService'

import { Lifecycle, scoped } from 'tsyringe'

import { AriesFrameworkError } from '../error'
import { ConnectionsModule } from '../modules/connections'
import { ProblemReportError, ProblemReportMessage, ProblemReportReason } from '../modules/problem-reports'
import { isValidJweStructure } from '../utils/JWE'
import { JsonTransformer } from '../utils/JsonTransformer'
import { MessageValidator } from '../utils/MessageValidator'
import { canHandleMessageType, parseMessageType, replaceLegacyDidSovPrefixOnMessage } from '../utils/messageType'

import { AgentConfig } from './AgentConfig'
import { Dispatcher } from './Dispatcher'
import { EnvelopeService } from './EnvelopeService'
import { MessageSender } from './MessageSender'
import { TransportService } from './TransportService'
import { createOutboundMessage } from './helpers'
import { InboundMessageContext } from './models/InboundMessageContext'

@scoped(Lifecycle.ContainerScoped)
export class MessageReceiver {
  private config: AgentConfig
  private envelopeService: EnvelopeService
  private transportService: TransportService
  private messageSender: MessageSender
  private dispatcher: Dispatcher
  private logger: Logger
  private connectionsModule: ConnectionsModule
  public readonly inboundTransports: InboundTransport[] = []

  public constructor(
    config: AgentConfig,
    envelopeService: EnvelopeService,
    transportService: TransportService,
    messageSender: MessageSender,
    connectionsModule: ConnectionsModule,
    dispatcher: Dispatcher
  ) {
    this.config = config
    this.envelopeService = envelopeService
    this.transportService = transportService
    this.messageSender = messageSender
    this.connectionsModule = connectionsModule
    this.dispatcher = dispatcher
    this.logger = this.config.logger
  }

  public registerInboundTransport(inboundTransport: InboundTransport) {
    this.inboundTransports.push(inboundTransport)
  }

  /**
   * Receive and handle an inbound DIDComm message. It will decrypt the message, transform it
   * to it's corresponding message class and finally dispatch it to the dispatcher.
   *
   * @param inboundMessage the message to receive and handle
   */
  public async receiveMessage(
    inboundMessage: unknown,
    { session, connection }: { session?: TransportSession; connection?: ConnectionRecord }
  ) {
    this.logger.debug(`Agent ${this.config.label} received message`)
    if (this.isEncryptedMessage(inboundMessage)) {
      await this.receiveEncryptedMessage(inboundMessage as EncryptedMessage, session)
    } else if (this.isPlaintextMessage(inboundMessage)) {
      await this.receivePlaintextMessage(inboundMessage, connection)
    } else {
      throw new AriesFrameworkError('Unable to parse incoming message: unrecognized format')
    }
  }

  private async receivePlaintextMessage(plaintextMessage: PlaintextMessage, connection?: ConnectionRecord) {
    const message = await this.transformAndValidate(plaintextMessage)
    const messageContext = new InboundMessageContext(message, { connection })
    await this.dispatcher.dispatch(messageContext)
  }

  private async receiveEncryptedMessage(encryptedMessage: EncryptedMessage, session?: TransportSession) {
    const decryptedMessage = await this.decryptMessage(encryptedMessage)
    const { plaintextMessage, senderKey, recipientKey } = decryptedMessage

    this.logger.info(
      `Received message with type '${plaintextMessage['@type']}', recipient key ${recipientKey?.fingerprint} and sender key ${senderKey?.fingerprint}`,
      plaintextMessage
    )

    const connection = await this.findConnectionByMessageKeys(decryptedMessage)

    const message = await this.transformAndValidate(plaintextMessage, connection)

    const messageContext = new InboundMessageContext(message, {
      // Only make the connection available in message context if the connection is ready
      // To prevent unwanted usage of unready connections. Connections can still be retrieved from
      // Storage if the specific protocol allows an unready connection to be used.
      connection: connection?.isReady ? connection : undefined,
      senderKey,
      recipientKey,
    })

    // We want to save a session if there is a chance of returning outbound message via inbound transport.
    // That can happen when inbound message has `return_route` set to `all` or `thread`.
    // If `return_route` defines just `thread`, we decide later whether to use session according to outbound message `threadId`.
    if (senderKey && recipientKey && message.hasAnyReturnRoute() && session) {
      this.logger.debug(`Storing session for inbound message '${message.id}'`)
      const keys = {
        recipientKeys: [senderKey],
        routingKeys: [],
        senderKey: recipientKey,
      }
      session.keys = keys
      session.inboundMessage = message
      // We allow unready connections to be attached to the session as we want to be able to
      // use return routing to make connections. This is especially useful for creating connections
      // with mediators when you don't have a public endpoint yet.
      session.connection = connection ?? undefined
      messageContext.sessionId = session.id
      this.transportService.saveSession(session)
    } else if (session) {
      // No need to wait for session to stay open if we're not actually going to respond to the message.
      await session.close()
    }

    await this.dispatcher.dispatch(messageContext)
  }

  /**
   * Decrypt a message using the envelope service.
   *
   * @param message the received inbound message to decrypt
   */
  private async decryptMessage(message: EncryptedMessage): Promise<DecryptedMessageContext> {
    try {
      return await this.envelopeService.unpackMessage(message)
    } catch (error) {
      this.logger.error('Error while decrypting message', {
        error,
        encryptedMessage: message,
        errorMessage: error instanceof Error ? error.message : error,
      })
      throw error
    }
  }

  private isPlaintextMessage(message: unknown): message is PlaintextMessage {
    if (typeof message !== 'object' || message == null) {
      return false
    }
    // If the message has a @type field we assume the message is in plaintext and it is not encrypted.
    return '@type' in message
  }

  private isEncryptedMessage(message: unknown): message is EncryptedMessage {
    // If the message does has valid JWE structure, we can assume the message is encrypted.
    return isValidJweStructure(message)
  }

  private async transformAndValidate(
    plaintextMessage: PlaintextMessage,
    connection?: ConnectionRecord | null
  ): Promise<AgentMessage> {
    let message: AgentMessage
    try {
      message = await this.transformMessage(plaintextMessage)
      await this.validateMessage(message)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (connection) await this.sendProblemReportMessage(error.message, connection, plaintextMessage)
      throw error
    }
    return message
  }

  private async findConnectionByMessageKeys({
    recipientKey,
    senderKey,
  }: DecryptedMessageContext): Promise<ConnectionRecord | null> {
    // We only fetch connections that are sent in AuthCrypt mode
    if (!recipientKey || !senderKey) return null

    // Try to find the did records that holds the sender and recipient keys
    return this.connectionsModule.findByKeys({
      senderKey,
      recipientKey,
    })
  }

  /**
   * Transform an plaintext DIDComm message into it's corresponding message class. Will look at all message types in the registered handlers.
   *
   * @param message the plaintext message for which to transform the message in to a class instance
   */
  private async transformMessage(message: PlaintextMessage): Promise<AgentMessage> {
    // replace did:sov:BzCbsNYhMrjHiqZDTUASHg;spec prefix for message type with https://didcomm.org
    replaceLegacyDidSovPrefixOnMessage(message)

    const messageType = message['@type']
    const MessageClass = this.dispatcher.getMessageClassForType(messageType)

    if (!MessageClass) {
      throw new ProblemReportError(`No message class found for message type "${messageType}"`, {
        problemCode: ProblemReportReason.MessageParseFailure,
      })
    }

    // Cast the plain JSON object to specific instance of Message extended from AgentMessage
    return JsonTransformer.fromJSON(message, MessageClass, { validate: false })
  }

  /**
   * Validate an AgentMessage instance.
   * @param message agent message to validate
   */
  private async validateMessage(message: AgentMessage) {
    try {
      await MessageValidator.validate(message)
    } catch (error) {
      this.logger.error(`Error validating message ${message.type}`, {
        errors: error,
        message: message.toJSON(),
      })
      throw new ProblemReportError(`Error validating message ${message.type}`, {
        problemCode: ProblemReportReason.MessageParseFailure,
      })
    }
  }

  /**
   * Send the problem report message (https://didcomm.org/notification/1.0/problem-report) to the recipient.
   * @param message error message to send
   * @param connection connection to send the message to
   * @param plaintextMessage received inbound message
   */
  private async sendProblemReportMessage(
    message: string,
    connection: ConnectionRecord,
    plaintextMessage: PlaintextMessage
  ) {
    const messageType = parseMessageType(plaintextMessage['@type'])
    if (canHandleMessageType(ProblemReportMessage, messageType)) {
      throw new AriesFrameworkError(`Not sending problem report in response to problem report: {message}`)
    }
    const problemReportMessage = new ProblemReportMessage({
      description: {
        en: message,
        code: ProblemReportReason.MessageParseFailure,
      },
    })
    problemReportMessage.setThread({
      threadId: plaintextMessage['@id'],
    })
    const outboundMessage = createOutboundMessage(connection, problemReportMessage)
    if (outboundMessage) {
      await this.messageSender.sendMessage(outboundMessage)
    }
  }
}
