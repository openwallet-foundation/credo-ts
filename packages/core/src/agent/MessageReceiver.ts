import type { Logger } from '../logger'
import type { ConnectionRecord } from '../modules/connections'
import type { InboundTransport } from '../transport'
import type { EncryptedMessage } from '../types'
import type { TransportSession } from './TransportService'
import type { DIDCommMessage, SignedMessage, DIDCommV2Message } from './didcomm'
import type { DecryptedMessageContext, PackedMessage, PlaintextMessage } from './didcomm/types'

import { AriesFrameworkError } from '../error'
import { ConnectionsModule } from '../modules/connections/ConnectionsModule'
import { ConnectionRepository } from '../modules/connections/repository/ConnectionRepository'
import { DidDocument } from '../modules/dids/domain/DidDocument'
import { KeyRepository } from '../modules/keys/repository'
import {
  ProblemReportError,
  ProblemReportMessage,
  ProblemReportReason,
  ProblemReportV2Message,
} from '../modules/problem-reports'
import { injectable } from '../plugins'
import { ReceivedMessageIdRecord, ReceivedMessageIdsRepository } from '../storage/ReceivedMessageIdsRepository'
import { isValidJweStructure } from '../utils/JWE'
import { isValidJwsStructure } from '../utils/JWS'
import { JsonTransformer } from '../utils/JsonTransformer'
import { replaceLegacyDidSovPrefixOnMessage } from '../utils/messageType'

import { AgentConfig } from './AgentConfig'
import { Dispatcher } from './Dispatcher'
import { MessageSender } from './MessageSender'
import { TransportService } from './TransportService'
import { EnvelopeService } from './didcomm/EnvelopeService'
import { DIDCommVersion, SendingMessageType } from './didcomm/types'
import { createOutboundMessage } from './helpers'
import { InboundMessageContext } from './models/InboundMessageContext'

@injectable()
export class MessageReceiver {
  private config: AgentConfig
  private envelopeService: EnvelopeService
  private transportService: TransportService
  private messageSender: MessageSender
  private dispatcher: Dispatcher
  private logger: Logger
  private keyRepository: KeyRepository
  private connectionsModule: ConnectionsModule
  private receivedMessageIdsRepository: ReceivedMessageIdsRepository
  public readonly inboundTransports: InboundTransport[] = []

  public constructor(
    config: AgentConfig,
    envelopeService: EnvelopeService,
    transportService: TransportService,
    messageSender: MessageSender,
    connectionRepository: ConnectionRepository,
    dispatcher: Dispatcher,
    keyRepository: KeyRepository,
    connectionsModule: ConnectionsModule,
    receivedMessageIdsRepository: ReceivedMessageIdsRepository
  ) {
    this.config = config
    this.envelopeService = envelopeService
    this.transportService = transportService
    this.messageSender = messageSender
    this.connectionsModule = connectionsModule
    this.dispatcher = dispatcher
    this.keyRepository = keyRepository
    this.logger = this.config.logger
    this.receivedMessageIdsRepository = receivedMessageIdsRepository
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
    { session }: { session?: TransportSession; connection?: ConnectionRecord }
  ) {
    this.logger.debug(`Agent ${this.config.label} received message`)
    try {
      if (this.isEncryptedMessage(inboundMessage)) {
        return await this.receivePackedMessage(
          {
            type: SendingMessageType.Encrypted,
            message: inboundMessage as EncryptedMessage,
          },
          session
        )
      }
      if (this.isSignedMessage(inboundMessage)) {
        return await this.receivePackedMessage(
          {
            type: SendingMessageType.Signed,
            message: inboundMessage as SignedMessage,
          },
          session
        )
      }
      if (this.isPlaintextMessage(inboundMessage)) {
        return await this.receivePlaintextMessage({
          type: SendingMessageType.Plain,
          message: inboundMessage as PlaintextMessage,
        })
      }

      this.logger.error('Unable to parse incoming message: unrecognized format')
    } catch (e) {
      this.logger.error(`Unable to process received message!. Error: ${e.message}`)
    }
  }

  private async isDuplicateMessage(message: DIDCommMessage) {
    if (await this.receivedMessageIdsRepository.findById(message.id)) return true
    await this.receivedMessageIdsRepository.save(new ReceivedMessageIdRecord({ id: message.id }))
    return false
  }

  private async receivePlaintextMessage(plaintextMessage: PackedMessage) {
    const message = await this.transformAndValidate(plaintextMessage.message)
    if (await this.isDuplicateMessage(message)) return
    const messageContext = new InboundMessageContext(message, {})
    await this.dispatcher.dispatch(messageContext)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async receivePackedMessage(packedMessage: PackedMessage, session?: TransportSession) {
    if (packedMessage.type === SendingMessageType.Encrypted) {
      const isMessageRecipientExists = await this.checkMessageRecipientExists(packedMessage)
      if (!isMessageRecipientExists) {
        this.logger.info('Recipient key does not exist in the wallet -> Handle the message as Relay')
        await this.handleMessageAsRelay(packedMessage)
        return
      }
    }

    const decryptedMessage = await this.decryptMessage(packedMessage)
    const { plaintextMessage, sender, recipient, version } = decryptedMessage

    // DIDComm V2 messaging doesn't require connection
    const connection =
      version === DIDCommVersion.V1 ? await this.findConnectionByMessageKeys(decryptedMessage) : undefined

    this.logger.info(
      `Received message with type '${plaintextMessage['type']}' from DID ${connection?.did}`,
      plaintextMessage
    )

    const message = await this.transformAndValidate(plaintextMessage, connection)
    if (await this.isDuplicateMessage(message)) return
    const messageContext = new InboundMessageContext(message, {
      // Only make the connection available in message context if the connection is ready
      // To prevent unwanted usage of unready connections. Connections can still be retrieved from
      // Storage if the specific protocol allows an unready connection to be used.
      connection: connection?.isReady ? connection : undefined,
      senderKey: sender,
      recipientKey: recipient,
    })
    await this.dispatcher.dispatch(messageContext)
  }

  /**
   * Decrypt a message using the envelope service.
   *
   * @param message the received inbound message to decrypt
   */
  private async decryptMessage(message: PackedMessage): Promise<DecryptedMessageContext> {
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

  private async checkMessageRecipientExists(message: PackedMessage): Promise<boolean> {
    const recipients = this.getMessageRecipients(message)
    if (!recipients) {
      this.logger.error('JWE message does not contain any recipient kid')
      throw new AriesFrameworkError('Invalid JWE message. Message does not contain any recipient!')
    }
    for (const recipient of recipients) {
      const keyRecord = await this.keyRepository.findByKid(recipient)
      if (keyRecord) return true
    }
    this.logger.info('JWE message does not contain any known key to unpack it')
    return false
  }

  private getMessageRecipients(message: PackedMessage): string[] {
    if (message.type === SendingMessageType.Encrypted) {
      return message.message.recipients.map((recipient) => recipient.header.kid)
    } else {
      return []
    }
  }

  private getFirstValidRecipientDid(recipients: string[]): string | undefined {
    for (const recipient of recipients) {
      const did = DidDocument.extractDidFromKid(recipient)
      if (did) return did
    }
    return undefined
  }

  private async handleMessageAsRelay(message: PackedMessage): Promise<void> {
    this.logger.info('> Handle message as relay')

    if (message.type !== SendingMessageType.Encrypted) {
      this.logger.warn('Message cannot handled as relay because it is not JWE.')
      return
    }

    const recipients = this.getMessageRecipients(message)
    if (!recipients.length) {
      this.logger.warn('Message cannot handled as relay because it does not contain any recipient kid')
      return
    }
    const did = this.getFirstValidRecipientDid(recipients)
    if (!did) {
      this.logger.warn(
        'Message cannot handled as relay because its header does not contain any recipient kid containing DID'
      )
      return
    }

    const services = await this.messageSender.findCommonSupportedServices(undefined, did)
    if (!services?.length) {
      // if service not found - log error and return
      this.logger.warn('Message cannot handled as relay because there is not supported transport to deliver it.')
      return
    }

    await this.messageSender.sendPackedMessage(message.message, services, did)

    this.logger.info('> Handle message as relay completed!')
    return
  }

  private isPlaintextMessage(message: unknown): message is PlaintextMessage {
    if (typeof message !== 'object' || message == null) {
      return false
    }
    // If the message has either @type or type field we assume the message is in plaintext and it is not encrypted.
    return '@type' in message || 'type' in message
  }

  private isEncryptedMessage(message: unknown): message is EncryptedMessage {
    // If the message does has valid JWE structure, we can assume the message is encrypted.
    return isValidJweStructure(message)
  }

  private isSignedMessage(message: unknown): message is SignedMessage {
    // If the message does has valid JWS structure, we can assume the message is signed.
    return isValidJwsStructure(message)
  }

  private async transformAndValidate(
    plaintextMessage: PlaintextMessage,
    connection?: ConnectionRecord | null
  ): Promise<DIDCommMessage> {
    let message: DIDCommMessage
    try {
      message = await this.transformMessage(plaintextMessage)
    } catch (error) {
      if (plaintextMessage['@id'] && connection) {
        await this.sendProblemReportMessage(error.message, connection, plaintextMessage)
      } else if (plaintextMessage.id) {
        await this.sendProblemReportMessageV2(error.message, plaintextMessage)
      }
      throw error
    }
    return message
  }

  private async findConnectionByMessageKeys({
    recipient,
    sender,
  }: DecryptedMessageContext): Promise<ConnectionRecord | null> {
    // We only fetch connections that are sent in AuthCrypt mode
    if (!recipient || !sender) return null

    // Try to find the did records that holds the sender and recipient keys
    return this.connectionsModule.findByKeys({
      senderKey: sender,
      recipientKey: recipient,
    })
  }

  /**
   * Transform an plaintext DIDComm message into it's corresponding message class. Will look at all message types in the registered handlers.
   *
   * @param message the plaintext message for which to transform the message in to a class instance
   */
  private async transformMessage(message: PlaintextMessage): Promise<DIDCommMessage> {
    if (message['@type']) {
      // replace did:sov:BzCbsNYhMrjHiqZDTUASHg;spec prefix for record type with https://didcomm.org
      replaceLegacyDidSovPrefixOnMessage(message)
    }

    const messageType = message['@type'] || message['type'] || ''
    if (!messageType) {
      throw new AriesFrameworkError(`No type found in the message: ${message}`)
    }

    const messageClass = this.dispatcher.getMessageClassForType(messageType)

    // Cast the plain JSON object to specific instance of Message extended from DIDCommMessages
    if (messageClass) return JsonTransformer.fromJSON<DIDCommMessage>(message, messageClass)

    throw new ProblemReportError(`No message class found for message type "${messageType}"`, {
      problemCode: ProblemReportReason.MessageParseFailure,
    })
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
    const problemReportMessage = new ProblemReportMessage({
      description: {
        en: message,
        code: ProblemReportReason.MessageParseFailure,
      },
    })
    problemReportMessage.setThread({
      threadId: plaintextMessage['@id'] as string,
    })
    const outboundMessage = createOutboundMessage(connection, problemReportMessage)
    if (outboundMessage) {
      await this.messageSender.sendDIDCommV1Message(outboundMessage)
    }
  }

  private async sendProblemReportMessageV2(message: string, plaintextMessage: PlaintextMessage) {
    const plainTextMessageV2 = plaintextMessage as unknown as DIDCommV2Message

    // Cannot send problem report for message with unknown sender or recipient
    if (!plainTextMessageV2.from || !plainTextMessageV2.to?.length) return

    const problemReportMessage = new ProblemReportV2Message({
      pthid: plainTextMessageV2.id,
      // FIXME Consider adding validation for 'plainTextMessageV2.to' value
      from: plainTextMessageV2.to[0],
      to: plainTextMessageV2.from,
      body: {
        code: ProblemReportReason.MessageParseFailure,
        comment: message,
      },
    })

    await this.messageSender.sendDIDCommV2Message(problemReportMessage)
  }
}
