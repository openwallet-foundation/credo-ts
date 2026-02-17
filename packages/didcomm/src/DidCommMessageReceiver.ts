import type { AgentContext } from '@credo-ts/core'
import {
  type AgentContextProvider,
  CredoError,
  DidKey,
  InjectionSymbols,
  inject,
  injectable,
  JsonEncoder,
  JsonTransformer,
  Kms,
  type Logger,
} from '@credo-ts/core'
import { DidCommDispatcher } from './DidCommDispatcher'
import type { DecryptedDidCommMessageContext } from './DidCommEnvelopeService'
import { DidCommEnvelopeService } from './DidCommEnvelopeService'
import { DidCommMessage } from './DidCommMessage'
import { DidCommMessageHandlerRegistry } from './DidCommMessageHandlerRegistry'
import { DidCommMessageSender } from './DidCommMessageSender'
import type { DidCommTransportSession } from './DidCommTransportService'
import { DidCommTransportService } from './DidCommTransportService'
import { DidCommProblemReportError } from './errors'
import { DidCommProblemReportMessage } from './messages'
import { DidCommInboundMessageContext, DidCommOutboundMessageContext, DidCommProblemReportReason } from './models'
import {
  DidCommConnectionService,
  DidCommConnectionsModuleConfig,
  DidCommDidExchangeRole,
  DidCommDidExchangeState,
  DidCommHandshakeProtocol,
} from './modules/connections'
import type { DidCommConnectionRecord } from './modules/connections/repository'
import { DidCommOutOfBandService } from './modules/oob/DidCommOutOfBandService'
import type { EnvelopeKeys } from './DidCommEnvelopeService'
import type { DidCommEncryptedMessage, DidCommPlaintextMessage } from './types'
import { normalizeV2PlaintextToV1 } from './v2'
import { DidCommV2EnvelopeService } from './v2'
import { DidCommV2KeyResolver } from './v2'
import { isDidCommV2EncryptedMessage } from './util/didcommVersion'
import { isValidJweStructure } from './util/JWE'
import { DidCommModuleConfig } from './DidCommModuleConfig'
import { canHandleMessageType, parseMessageType, replaceLegacyDidSovPrefixOnMessage } from './util/messageType'

@injectable()
export class DidCommMessageReceiver {
  private envelopeService: DidCommEnvelopeService
  private v2EnvelopeService: DidCommV2EnvelopeService
  private v2KeyResolver: DidCommV2KeyResolver
  private config: DidCommModuleConfig
  private transportService: DidCommTransportService
  private messageSender: DidCommMessageSender
  private dispatcher: DidCommDispatcher
  private logger: Logger
  private connectionService: DidCommConnectionService
  private outOfBandService: DidCommOutOfBandService
  private connectionsModuleConfig: DidCommConnectionsModuleConfig
  private messageHandlerRegistry: DidCommMessageHandlerRegistry
  private agentContextProvider: AgentContextProvider

  public constructor(
    envelopeService: DidCommEnvelopeService,
    v2EnvelopeService: DidCommV2EnvelopeService,
    v2KeyResolver: DidCommV2KeyResolver,
    config: DidCommModuleConfig,
    transportService: DidCommTransportService,
    messageSender: DidCommMessageSender,
    connectionService: DidCommConnectionService,
    outOfBandService: DidCommOutOfBandService,
    connectionsModuleConfig: DidCommConnectionsModuleConfig,
    dispatcher: DidCommDispatcher,
    messageHandlerRegistry: DidCommMessageHandlerRegistry,
    @inject(InjectionSymbols.AgentContextProvider) agentContextProvider: AgentContextProvider,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.envelopeService = envelopeService
    this.v2EnvelopeService = v2EnvelopeService
    this.v2KeyResolver = v2KeyResolver
    this.config = config
    this.transportService = transportService
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.outOfBandService = outOfBandService
    this.connectionsModuleConfig = connectionsModuleConfig
    this.dispatcher = dispatcher
    this.messageHandlerRegistry = messageHandlerRegistry
    this.agentContextProvider = agentContextProvider
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
    {
      session,
      connection,
      contextCorrelationId,
      receivedAt,
    }: {
      session?: DidCommTransportSession
      connection?: DidCommConnectionRecord
      contextCorrelationId?: string
      receivedAt?: Date
    } = {}
  ) {
    this.logger.debug('Agent received message')

    // Find agent context for the inbound message
    const agentContext = await this.agentContextProvider.getContextForInboundMessage(inboundMessage, {
      contextCorrelationId,
    })

    try {
      if (this.isEncryptedMessage(inboundMessage)) {
        await this.receiveEncryptedMessage(agentContext, inboundMessage as DidCommEncryptedMessage, session, receivedAt)
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
    session?: DidCommTransportSession,
    receivedAt?: Date
  ) {
    const decryptedMessage = await this.decryptMessage(agentContext, encryptedMessage)
    const { plaintextMessage, senderKey, recipientKey } = decryptedMessage

    this.logger.info(
      `Received message with type '${plaintextMessage['@type']}', recipient key ${recipientKey?.fingerprint} and sender key ${senderKey?.fingerprint}`,
      plaintextMessage
    )

    const connection = await this.findConnection(agentContext, decryptedMessage)

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
        routingKeys: [] as Kms.PublicJwk<Kms.Ed25519PublicJwk>[],
        senderKey: recipientKey,
        senderKeySkid: undefined as string | undefined,
      }
      // For v2: skid must be resolvable so recipient can resolve sender key.
      if (isDidCommV2EncryptedMessage(encryptedMessage)) {
        if (connection) {
          const to = Array.isArray(plaintextMessage.to) ? plaintextMessage.to : undefined
          const ourDid = to?.[0] ?? connection.did
          if (ourDid) {
            const keyRef = recipientKey.is(Kms.X25519PublicJwk) ? '#key-2' : '#key-1'
            keys.senderKeySkid = `${ourDid}${keyRef}`
          }
        } else {
          // Connectionless: use did:key so recipient can resolve via tryParseKidAsPublicJwk
          keys.senderKeySkid = new DidKey(recipientKey).did
        }
      }
      session.keys = keys as EnvelopeKeys
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

  /**
   * Decrypt a message using the envelope service. Supports DIDComm v1 and v2 (when enabled).
   *
   * @param message the received inbound message to decrypt
   */
  private async decryptMessage(
    agentContext: AgentContext,
    message: DidCommEncryptedMessage
  ): Promise<DecryptedDidCommMessageContext> {
    try {
      if (isDidCommV2EncryptedMessage(message)) {
        if (!this.config.acceptDidCommV2) {
          throw new CredoError(
            'Received DIDComm v2 encrypted message but acceptDidCommV2 is disabled. Enable acceptDidCommV2 in DidCommModuleConfig to accept v2 messages.'
          )
        }
        const resolved = await this.v2KeyResolver.resolveRecipientKey(agentContext, message)
        if (!resolved) {
          throw new CredoError('No matching recipient key found for DIDComm v2 message')
        }
        const { recipientKey, matchedKid } = resolved
        const protectedJson = JsonEncoder.fromBase64(message.protected) as { skid?: string }
        const skid = protectedJson.skid
        if (!skid) {
          throw new CredoError('DIDComm v2 authcrypt requires skid in protected header')
        }
        const { plaintext, senderKey } = await this.v2EnvelopeService.unpack(agentContext, message, {
          recipientKey,
          matchedKid,
          resolveSenderKey: (sid) => this.v2KeyResolver.resolveSenderKey(agentContext, sid),
        })
        this.logger.debug('Raw DIDComm v2 plaintext (on-wire format, before normalization)', {
          id: plaintext.id,
          type: plaintext.type,
          from: plaintext.from,
          to: plaintext.to,
          thid: plaintext.thid,
          bodyKeys: plaintext.body ? Object.keys(plaintext.body) : undefined,
        })
        const plaintextMessage = normalizeV2PlaintextToV1(plaintext)
        this.logger.debug('Unpacked DIDComm v2 message', { type: plaintext.type })
        return {
          plaintextMessage,
          senderKey: senderKey as unknown as DecryptedDidCommMessageContext['senderKey'],
          recipientKey: recipientKey as unknown as DecryptedDidCommMessageContext['recipientKey'],
        }
      }
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

  private async findConnection(
    agentContext: AgentContext,
    decryptedMessage: DecryptedDidCommMessageContext
  ): Promise<DidCommConnectionRecord | null> {
    const { plaintextMessage, recipientKey, senderKey } = decryptedMessage

    // DIDComm v2: plaintext has from/to (normalized from v2 shape). Try findByTheirDid first.
    const from = plaintextMessage.from as string | undefined
    const to = Array.isArray(plaintextMessage.to) ? plaintextMessage.to : undefined

    if (from !== undefined) {
      let connection = await this.connectionService.findByTheirDid(agentContext, from)
      if (connection) return connection

      if (to?.length && this.connectionsModuleConfig.autoCreateConnectionOnFirstMessage) {
        const recipient = to[0]
        const outOfBandRecord = await this.outOfBandService.findCreatedByRecipientDid(agentContext, recipient)
        if (outOfBandRecord) {
          // Inviter receives first message → Responder (so retrieveServicesByConnection uses theirDid parse fallback)
          connection = await this.connectionService.createConnection(
            agentContext,
            {
              protocol: DidCommHandshakeProtocol.None,
              role: DidCommDidExchangeRole.Responder,
              state: DidCommDidExchangeState.Completed,
              theirDid: from,
              did: recipient,
              outOfBandId: outOfBandRecord.id,
            },
            true
          )
          return connection
        }
      }

      return null
    }

    // v1: use sender/recipient keys
    if (!recipientKey || !senderKey) return null
    return this.connectionService.findByKeys(agentContext, { senderKey, recipientKey })
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
