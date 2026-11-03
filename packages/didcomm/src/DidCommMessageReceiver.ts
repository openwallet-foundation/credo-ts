import type { AgentContext } from '@credo-ts/core'
import {
  type AgentContextProvider,
  CredoError,
  EventEmitter,
  InjectionSymbols,
  inject,
  injectable,
  JsonTransformer,
  type Logger,
} from '@credo-ts/core'
import { DidCommDispatcher } from './DidCommDispatcher'
import type { DecryptedDidCommMessageContext } from './DidCommEnvelopeService'
import { DidCommEnvelopeService } from './DidCommEnvelopeService'
import type { DidCommMessageProcessingFailedEvent } from './DidCommEvents'
import { DidCommEventTypes } from './DidCommEvents'
import { DidCommMessage } from './DidCommMessage'
import { DidCommMessageHandlerRegistry } from './DidCommMessageHandlerRegistry'
import { DidCommMessageSender } from './DidCommMessageSender'
import type { DidCommTransportSession } from './DidCommTransportService'
import { DidCommTransportService } from './DidCommTransportService'
import { DidCommProblemReportError } from './errors'
import { DidCommProblemReportMessage } from './messages'
import { DidCommInboundMessageContext, DidCommOutboundMessageContext, DidCommProblemReportReason } from './models'
import type { DidCommConnectionRecord } from './modules/connections/repository'
import { DidCommConnectionService } from './modules/connections/services'
import type { DidCommEncryptedMessage, DidCommPlaintextMessage } from './types'
import { isValidJweStructure } from './util/JWE'
import { canHandleMessageType, parseMessageType, replaceLegacyDidSovPrefixOnMessage } from './util/messageType'

export interface DidCommReceiveMessageOptions {
  session?: DidCommTransportSession
  connection?: DidCommConnectionRecord
  contextCorrelationId?: string
  receivedAt?: Date
}

@injectable()
export class DidCommMessageReceiver {
  private envelopeService: DidCommEnvelopeService
  private transportService: DidCommTransportService
  private messageSender: DidCommMessageSender
  private dispatcher: DidCommDispatcher
  private logger: Logger
  private connectionService: DidCommConnectionService
  private messageHandlerRegistry: DidCommMessageHandlerRegistry
  private agentContextProvider: AgentContextProvider
  private eventEmitter: EventEmitter

  public constructor(
    envelopeService: DidCommEnvelopeService,
    transportService: DidCommTransportService,
    messageSender: DidCommMessageSender,
    connectionService: DidCommConnectionService,
    dispatcher: DidCommDispatcher,
    messageHandlerRegistry: DidCommMessageHandlerRegistry,
    eventEmitter: EventEmitter,
    @inject(InjectionSymbols.AgentContextProvider) agentContextProvider: AgentContextProvider,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.envelopeService = envelopeService
    this.transportService = transportService
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.dispatcher = dispatcher
    this.messageHandlerRegistry = messageHandlerRegistry
    this.agentContextProvider = agentContextProvider
    this.eventEmitter = eventEmitter
    this.logger = logger
  }

  /**
   * Receive and handle an inbound DIDComm message. It will determine the agent context, decrypt the message, transform it
   * to it's corresponding message class and finally dispatch it to the dispatcher.
   *
   * @param inboundMessage the message to receive and handle
   */
  public async receiveMessage(
    inboundMessage: unknown,
    { session, connection, contextCorrelationId, receivedAt }: DidCommReceiveMessageOptions = {}
  ) {
    this.logger.debug('Agent received message')

    // Determined before any await, so concurrently processed messages can't change which one opened the session
    const isSessionOpeningMessage = session !== undefined && !session.hasReceivedMessage
    if (session) session.hasReceivedMessage = true

    // Find agent context for the inbound message
    const agentContext = await this.agentContextProvider.getContextForInboundMessage(inboundMessage, {
      contextCorrelationId,
    })

    try {
      if (this.isEncryptedMessage(inboundMessage)) {
        await this.receiveEncryptedMessage(agentContext, inboundMessage as DidCommEncryptedMessage, {
          session,
          isSessionOpeningMessage,
          receivedAt,
        })
      } else if (this.isPlaintextMessage(inboundMessage)) {
        await this.receivePlaintextMessage(agentContext, inboundMessage, connection, receivedAt)
      } else {
        throw new CredoError('Unable to parse incoming message: unrecognized format')
      }
    } finally {
      // Always end the session for the agent context after handling the message.
      await agentContext.endSession()
    }
  }

  public async receiveMessageAndReportFailure(
    agentContext: AgentContext,
    inboundMessage: unknown,
    options: DidCommReceiveMessageOptions = {}
  ) {
    try {
      await this.receiveMessage(inboundMessage, options)
    } catch (error) {
      this.logger.error('Failed to process message', { error })
      const processingError =
        error instanceof Error
          ? error
          : new CredoError('Failed to process message', { cause: new Error(String(error)) })

      try {
        this.eventEmitter.emit<DidCommMessageProcessingFailedEvent>(agentContext, {
          type: DidCommEventTypes.DidCommMessageProcessingFailed,
          payload: {
            error: processingError,
            message: inboundMessage,
            connection: options.connection,
            contextCorrelationId: options.contextCorrelationId,
            receivedAt: options.receivedAt,
          },
        })
      } catch (eventError) {
        this.logger.error('Failed to emit message processing failure event', {
          error: eventError,
          processingError,
        })
      }
    }
  }

  private async receivePlaintextMessage(
    agentContext: AgentContext,
    plaintextMessage: DidCommPlaintextMessage,
    connection?: DidCommConnectionRecord,
    receivedAt?: Date
  ) {
    const message = await this.transformAndValidate(agentContext, plaintextMessage)
    const messageContext = new DidCommInboundMessageContext(message, { connection, agentContext, receivedAt })
    await this.dispatcher.dispatch(messageContext)
  }

  private async receiveEncryptedMessage(
    agentContext: AgentContext,
    encryptedMessage: DidCommEncryptedMessage,
    {
      session,
      isSessionOpeningMessage,
      receivedAt,
    }: { session?: DidCommTransportSession; isSessionOpeningMessage: boolean; receivedAt?: Date }
  ) {
    const decryptedMessage = await this.decryptMessage(agentContext, encryptedMessage)
    const { plaintextMessage, senderKey, recipientKey } = decryptedMessage

    this.logger.info(
      `Received message with type '${plaintextMessage['@type']}', recipient key ${recipientKey?.fingerprint} and sender key ${senderKey?.fingerprint}`,
      plaintextMessage
    )

    const connection = await this.findConnectionByMessageKeys(agentContext, decryptedMessage)

    const message = await this.transformAndValidate(agentContext, plaintextMessage, connection)

    const messageContext = new DidCommInboundMessageContext(message, {
      // Only make the connection available in message context if the connection is ready
      // To prevent unwanted usage of unready connections. Connections can still be retrieved from
      // Storage if the specific protocol allows an unready connection to be used.
      connection: connection?.isReady ? connection : undefined,
      senderKey,
      recipientKey,
      agentContext,
      receivedAt,
      encryptedMessage,
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
      session.connectionId = connection?.id
      messageContext.sessionId = session.id
      this.transportService.saveSession(session)
    }
    // No need to keep the session open if we're not going to respond to the message. Only the message
    // that opened the session closes it, as the other agent may already have sent messages over it that
    // do expect a response.
    else if (session && isSessionOpeningMessage) {
      await session.close()
    }

    await this.dispatcher.dispatch(messageContext)
  }

  /**
   * Decrypt a message using the envelope service.
   *
   * @param message the received inbound message to decrypt
   */
  private async decryptMessage(
    agentContext: AgentContext,
    message: DidCommEncryptedMessage
  ): Promise<DecryptedDidCommMessageContext> {
    try {
      return await this.envelopeService.unpackMessage(agentContext, message)
    } catch (error) {
      this.logger.error('Error while decrypting message', {
        error,
        encryptedMessage: message,
        errorMessage: error instanceof Error ? error.message : error,
      })
      throw error
    }
  }

  private isPlaintextMessage(message: unknown): message is DidCommPlaintextMessage {
    if (typeof message !== 'object' || message == null) {
      return false
    }
    // If the message has a @type field we assume the message is in plaintext and it is not encrypted.
    return '@type' in message
  }

  private isEncryptedMessage(message: unknown): message is DidCommEncryptedMessage {
    // If the message does has valid JWE structure, we can assume the message is encrypted.
    return isValidJweStructure(message)
  }

  private async transformAndValidate(
    agentContext: AgentContext,
    plaintextMessage: DidCommPlaintextMessage,
    connection?: DidCommConnectionRecord | null
  ): Promise<DidCommMessage> {
    let message: DidCommMessage
    try {
      message = await this.transformMessage(plaintextMessage)
    } catch (error) {
      if (connection) await this.sendProblemReportMessage(agentContext, error.message, connection, plaintextMessage)
      throw error
    }
    return message
  }

  private async findConnectionByMessageKeys(
    agentContext: AgentContext,
    { recipientKey, senderKey }: DecryptedDidCommMessageContext
  ): Promise<DidCommConnectionRecord | null> {
    // We only fetch connections that are sent in AuthCrypt mode
    if (!recipientKey || !senderKey) return null

    // Try to find the did records that holds the sender and recipient keys
    return this.connectionService.findByKeys(agentContext, {
      senderKey,
      recipientKey,
    })
  }

  /**
   * Transform an plaintext DIDComm message into it's corresponding message class. Will look at all message types in the registered handlers.
   *
   * @param message the plaintext message for which to transform the message in to a class instance
   */
  private async transformMessage(message: DidCommPlaintextMessage): Promise<DidCommMessage> {
    // replace did:sov:BzCbsNYhMrjHiqZDTUASHg;spec prefix for message type with https://didcomm.org
    replaceLegacyDidSovPrefixOnMessage(message)

    const messageType = message['@type']
    const MessageClass = this.messageHandlerRegistry.getMessageClassForMessageType(messageType) ?? DidCommMessage

    // Cast the plain JSON object to specific instance of Message extended from DidCommMessage
    let messageTransformed: DidCommMessage
    try {
      messageTransformed = JsonTransformer.fromJSON(message, MessageClass)
    } catch (error) {
      this.logger.error(`Error validating message ${message['@type']}`, {
        errors: error,
        message: JSON.stringify(message),
      })
      throw new DidCommProblemReportError(`Error validating message ${message['@type']}`, {
        problemCode: DidCommProblemReportReason.MessageParseFailure,
      })
    }
    return messageTransformed
  }

  /**
   * Send the problem report message (https://didcomm.org/notification/1.0/problem-report) to the recipient.
   * @param message error message to send
   * @param connection connection to send the message to
   * @param plaintextMessage received inbound message
   */
  private async sendProblemReportMessage(
    agentContext: AgentContext,
    message: string,
    connection: DidCommConnectionRecord,
    plaintextMessage: DidCommPlaintextMessage
  ) {
    const messageType = parseMessageType(plaintextMessage['@type'])
    if (canHandleMessageType(DidCommProblemReportMessage, messageType)) {
      throw new CredoError(`Not sending problem report in response to problem report: ${message}`)
    }
    const problemReportMessage = new DidCommProblemReportMessage({
      description: {
        en: message,
        code: DidCommProblemReportReason.MessageParseFailure,
      },
    })
    problemReportMessage.setThread({
      parentThreadId: plaintextMessage['@id'],
    })
    const outboundMessageContext = new DidCommOutboundMessageContext(problemReportMessage, { agentContext, connection })
    if (outboundMessageContext) {
      await this.messageSender.sendMessage(outboundMessageContext)
    }
  }
}
