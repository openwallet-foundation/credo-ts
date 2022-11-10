import type { ConnectionRecord } from '../modules/connections'
import type { InboundTransport } from '../transport'
import type { TransportSession } from './TransportService'
import type { AgentContext } from './context'
import type { DIDCommMessage, DIDCommV2Message, PlaintextMessage } from './didcomm'
import type { DecryptedMessageContext, ReceivedMessage, ReceivedPlainMessage } from './didcomm/types'

import { InjectionSymbols } from '../constants'
import { AriesFrameworkError } from '../error'
import { Logger } from '../logger'
import { ConnectionService } from '../modules/connections'
import { ProblemReportError, ProblemReportMessage, ProblemReportReason } from '../modules/problem-reports'
import { ProblemReportV2Message } from '../modules/problem-reports/messages/ProblemReportV2Message'
import { inject, injectable } from '../plugins'
import { JsonTransformer } from '../utils/JsonTransformer'
import { canHandleMessageType, parseMessageType, replaceLegacyDidSovPrefixOnMessage } from '../utils/messageType'

import { Dispatcher } from './Dispatcher'
import { MessageSender } from './MessageSender'
import { TransportService } from './TransportService'
import { AgentContextProvider } from './context'
import { EnvelopeService } from './didcomm/EnvelopeService'
import { getPlaintextMessageType, isEncryptedMessage, isPlaintextMessage, isSignedMessage } from './didcomm/helpers'
import { DIDCommMessageVersion, MessageType } from './didcomm/types'
import { createOutboundDIDCommV1Message } from './helpers'
import { InboundMessageContext } from './models/InboundMessageContext'

@injectable()
export class MessageReceiver {
  private envelopeService: EnvelopeService
  private transportService: TransportService
  private messageSender: MessageSender
  private dispatcher: Dispatcher
  private logger: Logger
  private connectionService: ConnectionService
  private agentContextProvider: AgentContextProvider
  public readonly inboundTransports: InboundTransport[] = []

  public constructor(
    envelopeService: EnvelopeService,
    transportService: TransportService,
    messageSender: MessageSender,
    connectionService: ConnectionService,
    dispatcher: Dispatcher,
    @inject(InjectionSymbols.AgentContextProvider) agentContextProvider: AgentContextProvider,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.envelopeService = envelopeService
    this.transportService = transportService
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.dispatcher = dispatcher
    this.agentContextProvider = agentContextProvider
    this.logger = logger
  }

  public registerInboundTransport(inboundTransport: InboundTransport) {
    this.inboundTransports.push(inboundTransport)
  }

  /**
   * Receive and handle an inbound DIDComm message. It will determine the agent context, decrypt the message, transform it
   * to it's corresponding message class and finally dispatch it to the dispatcher.
   *
   * @param inboundMessage the message to receive and handle
   */
  public async receiveMessage(
    inboundMessage: unknown,
    {
      session,
      connection,
      contextCorrelationId,
    }: { session?: TransportSession; connection?: ConnectionRecord; contextCorrelationId?: string } = {}
  ) {
    this.logger.debug(`Agent received message`)

    // Find agent context for the inbound message
    const agentContext = await this.agentContextProvider.getContextForInboundMessage(inboundMessage, {
      contextCorrelationId,
    })

    try {
      if (isEncryptedMessage(inboundMessage)) {
        return await this.receiveEncryptedMessage(
          agentContext,
          {
            type: MessageType.Encrypted,
            message: inboundMessage,
          },
          session
        )
      } else if (isSignedMessage(inboundMessage)) {
        return await this.receiveEncryptedMessage(
          agentContext,
          {
            type: MessageType.Signed,
            message: inboundMessage,
          },
          session
        )
      } else if (isPlaintextMessage(inboundMessage)) {
        await this.receivePlaintextMessage(
          agentContext,
          {
            type: MessageType.Plain,
            message: inboundMessage,
          },
          connection
        )
      } else {
        throw new AriesFrameworkError('Unable to parse incoming message: unrecognized format')
      }
    } finally {
      // Always end the session for the agent context after handling the message.
      await agentContext.endSession()
    }
  }

  private async receivePlaintextMessage(
    agentContext: AgentContext,
    plaintextMessage: ReceivedPlainMessage,
    connection?: ConnectionRecord
  ) {
    const message = await this.transformAndValidate(agentContext, plaintextMessage.message)
    const messageContext = new InboundMessageContext(message, { connection, agentContext })
    await this.dispatcher.dispatch(messageContext)
  }

  private async receiveEncryptedMessage(
    agentContext: AgentContext,
    packedMessage: ReceivedMessage,
    session?: TransportSession
  ) {
    const decryptedMessage = await this.decryptMessage(agentContext, packedMessage)
    const { plaintextMessage, senderKey, recipientKey, version } = decryptedMessage

    this.logger.info(
      `Received message with type '${plaintextMessage['@type']}', recipient key ${recipientKey?.fingerprint} and sender key ${senderKey?.fingerprint}`,
      plaintextMessage
    )

    // DIDComm V2 messaging doesn't require connection
    const connection =
      version === DIDCommMessageVersion.V1
        ? await this.findConnectionByMessageKeys(agentContext, decryptedMessage)
        : undefined

    const message = await this.transformAndValidate(agentContext, plaintextMessage, connection)

    const messageContext = new InboundMessageContext(message, {
      // Only make the connection available in message context if the connection is ready
      // To prevent unwanted usage of unready connections. Connections can still be retrieved from
      // Storage if the specific protocol allows an unready connection to be used.
      connection: connection?.isReady ? connection : undefined,
      senderKey,
      recipientKey,
      agentContext,
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
  private async decryptMessage(agentContext: AgentContext, message: ReceivedMessage): Promise<DecryptedMessageContext> {
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

  private async transformAndValidate(
    agentContext: AgentContext,
    plaintextMessage: PlaintextMessage,
    connection?: ConnectionRecord | null
  ): Promise<DIDCommMessage> {
    let message: DIDCommMessage
    try {
      message = await this.transformMessage(plaintextMessage)
    } catch (error) {
      if (plaintextMessage['@id'] && connection) {
        await this.sendProblemReportMessage(agentContext, error.message, connection, plaintextMessage)
      } else if (plaintextMessage.id) {
        await this.sendProblemReportMessageV2(agentContext, error.message, plaintextMessage)
      }
      throw error
    }
    return message
  }

  private async findConnectionByMessageKeys(
    agentContext: AgentContext,
    { recipientKey, senderKey }: DecryptedMessageContext
  ): Promise<ConnectionRecord | null> {
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
  private async transformMessage(message: PlaintextMessage): Promise<DIDCommMessage> {
    // replace did:sov:BzCbsNYhMrjHiqZDTUASHg;spec prefix for message type with https://didcomm.org
    if (message['@type']) {
      // replace did:sov:BzCbsNYhMrjHiqZDTUASHg;spec prefix for record type with https://didcomm.org
      replaceLegacyDidSovPrefixOnMessage(message)
    }

    const messageType = getPlaintextMessageType(message)
    if (!messageType) {
      throw new AriesFrameworkError(`No type found in the message: ${message}`)
    }

    const MessageClass = this.dispatcher.getMessageClassForType(messageType)

    if (!MessageClass) {
      throw new ProblemReportError(`No message class found for message type "${messageType}"`, {
        problemCode: ProblemReportReason.MessageParseFailure,
      })
    }

    // Cast the plain JSON object to specific instance of Message extended from DIDCommMessage
    let messageTransformed: DIDCommMessage
    try {
      messageTransformed = JsonTransformer.fromJSON(message, MessageClass)
    } catch (error) {
      this.logger.error(`Error validating message ${message.type}`, {
        errors: error,
        message: JSON.stringify(message),
      })
      throw new ProblemReportError(`Error validating message ${message.type}`, {
        problemCode: ProblemReportReason.MessageParseFailure,
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
    connection: ConnectionRecord,
    plaintextMessage: PlaintextMessage
  ) {
    const type = getPlaintextMessageType(message)
    if (!type) return

    const messageType = parseMessageType(type)
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
      threadId: plaintextMessage['@id'] as string,
    })
    const outboundMessage = createOutboundDIDCommV1Message(connection, problemReportMessage)
    if (outboundMessage) {
      await this.messageSender.sendDIDCommV1Message(agentContext, outboundMessage)
    }
  }

  private async sendProblemReportMessageV2(
    agentContext: AgentContext,
    message: string,
    plaintextMessage: PlaintextMessage
  ) {
    const plainTextMessageV2 = plaintextMessage as unknown as DIDCommV2Message

    // Cannot send problem report for message with unknown sender or recipient
    if (!plainTextMessageV2.from || !plainTextMessageV2.to?.length) return

    const problemReportMessage = new ProblemReportV2Message({
      pthid: plainTextMessageV2.id,
      from: plainTextMessageV2.recipient(),
      to: plainTextMessageV2.from,
      body: {
        code: ProblemReportReason.MessageParseFailure,
        comment: message,
      },
    })

    await this.messageSender.sendDIDCommV2Message(agentContext, { payload: problemReportMessage })
  }
}
