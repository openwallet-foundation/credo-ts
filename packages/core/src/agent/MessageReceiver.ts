import type { AgentBaseMessage } from './AgentBaseMessage'
import type { TransportSession } from './TransportService'
import type { AgentContext } from './context'
import type { EncryptedMessage, PlaintextMessage } from '../didcomm'
import type { DecryptedMessageContext } from '../didcomm/types'
import type { ConnectionRecord } from '../modules/connections'
import type { InboundTransport } from '../transport'

import { InjectionSymbols } from '../constants'
import { isPlaintextMessageV1, isPlaintextMessageV2 } from '../didcomm'
import { getPlaintextMessageType, isEncryptedMessage, isPlaintextMessage } from '../didcomm/helpers'
import { AriesFrameworkError } from '../error'
import { Logger } from '../logger'
import {
  ConnectionService,
  ConnectionsModuleConfig,
  DidExchangeRole,
  DidExchangeState,
  HandshakeProtocol,
} from '../modules/connections'
import { OutOfBandService } from '../modules/oob'
import {
  buildProblemReportV1Message,
  buildProblemReportV2Message,
  ProblemReportMessage,
  V2ProblemReportMessage,
} from '../modules/problem-reports'
import { ProblemReportError } from '../modules/problem-reports/errors'
import { ProblemReportReason } from '../modules/problem-reports/models'
import { inject, injectable } from '../plugins'
import { JsonTransformer } from '../utils/JsonTransformer'
import { parseMessageType, replaceLegacyDidSovPrefixOnMessage } from '../utils/messageType'

import { Dispatcher } from './Dispatcher'
import { EnvelopeService } from './EnvelopeService'
import { MessageHandlerRegistry } from './MessageHandlerRegistry'
import { MessageSender } from './MessageSender'
import { TransportService } from './TransportService'
import { AgentContextProvider } from './context'
import { InboundMessageContext, OutboundMessageContext } from './models'

@injectable()
export class MessageReceiver {
  private envelopeService: EnvelopeService
  private transportService: TransportService
  private messageSender: MessageSender
  private dispatcher: Dispatcher
  private logger: Logger
  private connectionService: ConnectionService
  private outOfBandService: OutOfBandService
  private messageHandlerRegistry: MessageHandlerRegistry
  private agentContextProvider: AgentContextProvider
  private connectionsModuleConfig: ConnectionsModuleConfig
  private _inboundTransports: InboundTransport[] = []

  public constructor(
    envelopeService: EnvelopeService,
    transportService: TransportService,
    messageSender: MessageSender,
    connectionService: ConnectionService,
    outOfBandService: OutOfBandService,
    dispatcher: Dispatcher,
    messageHandlerRegistry: MessageHandlerRegistry,
    @inject(InjectionSymbols.AgentContextProvider) agentContextProvider: AgentContextProvider,
    @inject(InjectionSymbols.Logger) logger: Logger,
    connectionsModuleConfig: ConnectionsModuleConfig
  ) {
    this.envelopeService = envelopeService
    this.transportService = transportService
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.outOfBandService = outOfBandService
    this.dispatcher = dispatcher
    this.messageHandlerRegistry = messageHandlerRegistry
    this.agentContextProvider = agentContextProvider
    this.logger = logger
    this.connectionsModuleConfig = connectionsModuleConfig
    this._inboundTransports = []
  }

  public get inboundTransports() {
    return this._inboundTransports
  }

  public registerInboundTransport(inboundTransport: InboundTransport) {
    this._inboundTransports.push(inboundTransport)
  }

  public async unregisterInboundTransport(inboundTransport: InboundTransport) {
    this._inboundTransports = this._inboundTransports.filter((transport) => transport !== inboundTransport)
    await inboundTransport.stop()
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
        return await this.receiveEncryptedMessage(agentContext, inboundMessage, session)
      } else if (isPlaintextMessage(inboundMessage)) {
        await this.receivePlaintextMessage(agentContext, inboundMessage, connection)
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
    plaintextMessage: PlaintextMessage,
    connection?: ConnectionRecord
  ) {
    const message = await this.transformAndValidate(agentContext, plaintextMessage)
    const messageContext = new InboundMessageContext(message, { connection, agentContext })
    await this.dispatcher.dispatch(messageContext)
  }

  private async receiveEncryptedMessage(
    agentContext: AgentContext,
    packedMessage: EncryptedMessage,
    session?: TransportSession
  ) {
    const unpackedMessage = await this.envelopeService.unpackMessage(agentContext, packedMessage)
    return this.processUnpackedMessage(agentContext, unpackedMessage, session)
  }

  private async processUnpackedMessage(
    agentContext: AgentContext,
    unpackedMessage: DecryptedMessageContext,
    session?: TransportSession
  ) {
    const { plaintextMessage, senderKey, recipientKey } = unpackedMessage

    this.logger.info(
      `Received message with type '${plaintextMessage['@type']}', recipient key ${recipientKey?.fingerprint} and sender key ${senderKey?.fingerprint}`,
      plaintextMessage
    )

    const connection = await this.findConnection(agentContext, unpackedMessage)

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
    // If `return_route` defines just `thread`, we decide later whether to use session according to outbound message `thid`.
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
    } else if (session) {
      // No need to wait for session to stay open if we're not actually going to respond to the message.
      await session.close()
    }

    await this.dispatcher.dispatch(messageContext)
  }

  private async transformAndValidate(
    agentContext: AgentContext,
    plaintextMessage: PlaintextMessage,
    connection?: ConnectionRecord | null
  ): Promise<AgentBaseMessage> {
    let message: AgentBaseMessage
    try {
      message = await this.transformMessage(plaintextMessage)
    } catch (error) {
      const messageType = parseMessageType(getPlaintextMessageType(plaintextMessage))
      if (ProblemReportMessage.type === messageType || V2ProblemReportMessage.type === messageType) {
        throw new AriesFrameworkError(`Not sending problem report in response to problem report: ${error.message}`)
      }

      const problemReportMessage: AgentBaseMessage | undefined = isPlaintextMessageV1(plaintextMessage)
        ? buildProblemReportV1Message(plaintextMessage, error.message)
        : buildProblemReportV2Message(plaintextMessage, error.message)

      if (problemReportMessage) {
        const outboundMessageContext = new OutboundMessageContext(problemReportMessage, {
          agentContext,
          connection: connection || undefined,
        })
        await this.messageSender.sendMessage(outboundMessageContext)
      }

      throw error
    }
    return message
  }

  private async findConnection(
    agentContext: AgentContext,
    decryptedMessageContext: DecryptedMessageContext
  ): Promise<ConnectionRecord | null> {
    if (isPlaintextMessageV1(decryptedMessageContext.plaintextMessage)) {
      const { recipientKey, senderKey } = decryptedMessageContext
      // We only fetch connections that are sent in AuthCrypt mode
      if (!recipientKey || !senderKey) return null

      // Try to find the did records that holds the sender and recipient keys
      return this.connectionService.findByKeys(agentContext, {
        senderKey,
        recipientKey,
      })
    }
    if (isPlaintextMessageV2(decryptedMessageContext.plaintextMessage)) {
      // Try to find the did records that hold the sender and recipient did's
      const { from, to } = decryptedMessageContext.plaintextMessage

      if (to && to.length > 1) {
        throw new AriesFrameworkError(
          `The capability of multiple message recipients is not currently supported: ${decryptedMessageContext.plaintextMessage}`
        )
      }

      if (!from) return null
      let connection = await this.connectionService.findByTheirDid(agentContext, from)
      if (connection) return connection

      if (!to?.length) return null
      const recipient = to[0]

      // If we received a message for nonexisting connection record,
      // create a connection record when the corresponding option is set in the config
      if (this.connectionsModuleConfig.autoCreateConnectionOnFirstMessage) {
        // Get related out of band record
        const outOfBandRecord = await this.outOfBandService.findCreatedByRecipientDid(agentContext, recipient)
        if (!outOfBandRecord) throw new AriesFrameworkError(`No OOB record found for recipient did: ${recipient}`)

        connection = await this.connectionService.createConnection(agentContext, {
          protocol: HandshakeProtocol.None,
          role: DidExchangeRole.Requester,
          state: DidExchangeState.Completed,
          theirDid: from,
          did: recipient,
          outOfBandId: outOfBandRecord.id,
        })
      }

      return connection
    }

    return null
  }

  /**
   * Transform an plaintext DIDComm message into it's corresponding message class. Will look at all message types in the registered handlers.
   *
   * @param message the plaintext message for which to transform the message in to a class instance
   */
  private async transformMessage(message: PlaintextMessage): Promise<AgentBaseMessage> {
    // replace did:sov:BzCbsNYhMrjHiqZDTUASHg;spec prefix for message type with https://didcomm.org
    if (message['@type']) {
      // replace did:sov:BzCbsNYhMrjHiqZDTUASHg;spec prefix for record type with https://didcomm.org
      replaceLegacyDidSovPrefixOnMessage(message)
    }

    const messageType = getPlaintextMessageType(message)
    if (!messageType) {
      throw new AriesFrameworkError(`No type found in the message: ${message}`)
    }

    const MessageClass = this.messageHandlerRegistry.getMessageClassForMessageType(messageType)

    if (!MessageClass) {
      throw new ProblemReportError(`No message class found for message type "${messageType}"`, {
        problemCode: ProblemReportReason.MessageParseFailure,
      })
    }

    // Cast the plain JSON object to specific instance of Message extended from AgentMessage
    let messageTransformed: AgentBaseMessage
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
}
