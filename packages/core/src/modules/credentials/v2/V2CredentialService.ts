/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import type { AgentConfig } from '../../../agent/AgentConfig'
import type { AgentMessage } from '../../../agent/AgentMessage'
import type { Dispatcher } from '../../../agent/Dispatcher'
import type { EventEmitter } from '../../../agent/EventEmitter'
import type { HandlerInboundMessage } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../logger'
import type { ConnectionService } from '../../connections/services/ConnectionService'
import type { IndyHolderService, IndyIssuerService } from '../../indy'
import type { IndyLedgerService } from '../../ledger'
import type { MediationRecipientService } from '../../routing'
import type { CredentialStateChangedEvent } from '../CredentialEvents'
import type { CredentialResponseCoordinator } from '../CredentialResponseCoordinator'
import type {
  AcceptProposalOptions,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../interfaces'
import type { CredentialRepository } from '../repository'
import type { V1LegacyCredentialService } from '../v1/V1LegacyCredentialService' // tmp
import type { CredentialProtocolMsgReturnType } from './CredentialMessageBuilder'
import type { CredentialFormatService, V2CredProposeOfferRequestFormat } from './formats/CredentialFormatService'
import type { V2CredentialFormatSpec } from './formats/V2CredentialFormat'
import type { V2OfferCredentialMessage } from './messages/V2OfferCredentialMessage'
import type { V2ProposeCredentialMessage } from './messages/V2ProposeCredentialMessage'
import type { V2RequestCredentialMessage } from './messages/V2RequestCredentialMessage'

import { AriesFrameworkError } from '../../../error'
import { unitTestLogger } from '../../../logger'
import { isLinkedAttachment } from '../../../utils/attachment'
import { CredentialEventTypes } from '../CredentialEvents'
import { CredentialProtocolVersion } from '../CredentialProtocolVersion'
import { CredentialService } from '../CredentialService'
import { CredentialState } from '../CredentialState'
import { CredentialProblemReportError, CredentialProblemReportReason } from '../errors'
import { CredentialRecord } from '../repository'

import { CredentialFormatType } from './CredentialExchangeRecord'
import { CredentialMessageBuilder } from './CredentialMessageBuilder'
import { FORMAT_KEYS } from './formats/CredentialFormatService'
import { IndyCredentialFormatService } from './formats/indy/IndyCredentialFormatService'
import { JsonLdCredentialFormatService } from './formats/jsonld/JsonLdCredentialFormatService'
import { V2OfferCredentialHandler } from './handlers/V2OfferCredentialHandler'
import { V2ProposeCredentialHandler } from './handlers/V2ProposeCredentialHandler'
import { V2RequestCredentialHandler } from './handlers/V2RequestCredentialHandler'

export class V2CredentialService extends CredentialService {
  private credentialService: V1LegacyCredentialService // Temporary while v1 constructor needs this
  private connectionService: ConnectionService
  private credentialRepository: CredentialRepository
  private eventEmitter: EventEmitter
  private agentConfig: AgentConfig
  private credentialResponseCoordinator: CredentialResponseCoordinator
  private dispatcher: Dispatcher
  private logger: Logger
  private indyIssuerService: IndyIssuerService
  private indyLedgerService: IndyLedgerService
  private indyHolderService: IndyHolderService
  private mediationRecipientService: MediationRecipientService
  private credentialMessageBuilder: CredentialMessageBuilder

  public constructor(
    connectionService: ConnectionService,
    credentialService: V1LegacyCredentialService,
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    msgSender: MessageSender,
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    credentialResponseCoordinator: CredentialResponseCoordinator,
    indyIssuerService: IndyIssuerService,
    mediationRecipientService: MediationRecipientService,
    indyLedgerService: IndyLedgerService,
    indyHolderService: IndyHolderService
  ) {
    super()
    this.credentialRepository = credentialRepository
    this.eventEmitter = eventEmitter
    this.credentialService = credentialService
    this.connectionService = connectionService
    this.agentConfig = agentConfig
    this.credentialResponseCoordinator = credentialResponseCoordinator
    this.dispatcher = dispatcher
    this.logger = agentConfig.logger
    this.indyIssuerService = indyIssuerService
    this.mediationRecipientService = mediationRecipientService
    this.indyLedgerService = indyLedgerService
    this.indyHolderService = indyHolderService
    this.credentialMessageBuilder = new CredentialMessageBuilder()
  }
  /**
   * Returns the protocol version for this credential service
   * @returns v2 as this is the v2 service
   */
  public getVersion(): CredentialProtocolVersion {
    return CredentialProtocolVersion.V2_0
  }

  /**
   * Gets the correct formatting service for this credential record type, eg indy or jsonld. Others may be
   * added in the future.
   * Each formatting service knows how to format the message structure for the specific record type
   * @param credentialFormatType the format type, indy, jsonld, jwt etc.
   * @returns the formatting service.
   */
  public getFormatService(credentialFormatType: CredentialFormatType): CredentialFormatService {
    const serviceFormatMap = {
      [CredentialFormatType.Indy]: IndyCredentialFormatService,
      [CredentialFormatType.JsonLd]: JsonLdCredentialFormatService,
    }
    return new serviceFormatMap[credentialFormatType](
      this.credentialRepository,
      this.eventEmitter,
      this.indyIssuerService,
      this.indyLedgerService,
      this.indyHolderService
    )
  }

  /**
   * Create a {@link V2ProposeCredentialMessage} not bound to an existing credential exchange.
   *
   * @param proposal The ProposeCredentialOptions object containing the important fields for the credential message
   * @returns Object containing proposal message and associated credential record
   *
   */
  public async createProposal(
    proposal: ProposeCredentialOptions
  ): Promise<{ credentialRecord: CredentialRecord; message: AgentMessage }> {
    // should handle all formats in proposal.credentialFormats by querying and calling
    // its corresponding handler classes.
    unitTestLogger('>> IN SERVICE V2 createProposal')

    unitTestLogger('Get the Format Service and Create Proposal Message')

    const formats: CredentialFormatService[] = this.getFormats(proposal.credentialFormats as Record<string, unknown>)

    const { message, credentialRecord } = this.credentialMessageBuilder.createProposal(formats, proposal)

    unitTestLogger('Save meta data and emit state change event')

    // Q: How do we set the meta data when there are multiple formats?
    for (const format of formats) {
      await format.getMetaDataService().setMetaDataForProposal(proposal.credentialFormats, credentialRecord)
    }
    await this.credentialRepository.save(credentialRecord)
    this.eventEmitter.emit<CredentialStateChangedEvent>({
      type: CredentialEventTypes.CredentialStateChanged,
      payload: {
        credentialRecord,
        previousState: null,
      },
    })

    return { credentialRecord, message }
  }

  /**
   * Get all the format service objects for a given credential format from an incoming message
   * @param messageFormats the format objects containing the format name (eg indy)
   * @return the credential format service objects in an array - derived from format object keys
   */
  public getFormatsFromMessage(messageFormats: V2CredentialFormatSpec[]): CredentialFormatService[] {
    const formats: CredentialFormatService[] = []

    for (const msg of messageFormats) {
      if (msg.format.includes('indy')) {
        formats.push(this.getFormatService(CredentialFormatType.Indy))
      } else if (msg.format.includes('aries')) {
        formats.push(this.getFormatService(CredentialFormatType.JsonLd))
      } else {
        throw Error(`Unknown Message Format: ${msg.format}`)
      }
    }
    return formats
  }
  /**
   * Get all the format service objects for a given credential format
   * @param credentialFormats the format object containing various optional parameters
   * @return the credential format service objects in an array - derived from format object keys
   */
  public getFormats(credentialFormats: Record<string, unknown>): CredentialFormatService[] {
    const formats: CredentialFormatService[] = []
    const formatKeys = Object.keys(credentialFormats)
    for (const key of formatKeys) {
      const credentialFormatType: CredentialFormatType = FORMAT_KEYS[key]
      const formatService: CredentialFormatService = this.getFormatService(credentialFormatType)
      formats.push(formatService)
    }
    return formats
  }
  /**
   * Method called by {@link V2ProposeCredentialHandler} on reception of a propose credential message
   * We do the necessary processin here to accept the proposal and do the state change, emit event etc.
   * @param messageContext the inbound propose credential message
   * @returns credential record appropriate for this incoming message (once accepted)
   */
  public async processProposal(
    messageContext: HandlerInboundMessage<V2ProposeCredentialHandler>
  ): Promise<CredentialRecord> {
    let credentialRecord: CredentialRecord
    const { message: proposalMessage, connection } = messageContext

    this.logger.debug(`Processing credential proposal with id ${proposalMessage.id}`)

    // get the format service here to format correctly...

    try {
      // Credential record already exists
      credentialRecord = await this.getByThreadAndConnectionId(proposalMessage.threadId, connection?.id)
      // Assert

      credentialRecord.assertState(CredentialState.OfferSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: credentialRecord.proposalMessage,
        previousSentMessage: credentialRecord.offerMessage,
      })

      // Update record
      credentialRecord.proposalMessage = proposalMessage
      await this.updateState(credentialRecord, CredentialState.ProposalReceived)
    } catch {
      //   // No credential record exists with thread id

      unitTestLogger('TEST-DEBUG No credential record exists')

      // get the format service objects for the formats found in the message
      const formats: CredentialFormatService[] = this.getFormatsFromMessage(proposalMessage.formats)

      credentialRecord = this.credentialMessageBuilder.acceptProposal(proposalMessage, connection?.id)

      // Save record and emit event
      this.connectionService.assertConnectionOrServiceDecorator(messageContext)

      // use the attach id in the formats object to find the correct attachment
      for (const format of formats) {
        const attachment = format.getAttachment(proposalMessage)
        if (attachment) {
          const credProposal: V2CredProposeOfferRequestFormat | undefined = format.getCredentialPayload(attachment.data)
          if (credProposal) {
            format.getMetaDataService().setMetaDataForProposal(credProposal, credentialRecord)
          }
        }
      }
    }
    await this.credentialRepository.save(credentialRecord)
    await this.emitEvent(credentialRecord)
    return credentialRecord
  }

  private async emitEvent(credentialRecord: CredentialRecord) {
    this.eventEmitter.emit<CredentialStateChangedEvent>({
      type: CredentialEventTypes.CredentialStateChanged,
      payload: {
        credentialRecord,
        previousState: null,
      },
    })
  }
  /**
   * Retrieve a credential record by connection id and thread id
   *
   * @param connectionId The connection id
   * @param threadId The thread id
   * @throws {RecordNotFoundError} If no record is found
   * @throws {RecordDuplicateError} If multiple records are found
   * @returns The credential record
   */
  public getByThreadAndConnectionId(threadId: string, connectionId?: string): Promise<CredentialRecord> {
    return this.credentialRepository.getSingleByQuery({
      connectionId,
      threadId,
    })
  }

  public async acceptProposal(
    proposal: AcceptProposalOptions
  ): Promise<{ credentialRecord: CredentialRecord; message: AgentMessage }> {
    this.logger.debug('>> IN SERVICE V2 => acceptProposal')

    const credentialRecord = await this.credentialService.getById(proposal.credentialRecordId)
    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support credential proposal or negotiation.`
      )
    }
    const credentialProposalMessage: V2ProposeCredentialMessage =
      credentialRecord.proposalMessage as V2ProposeCredentialMessage
    if (!credentialProposalMessage?.credentialProposal) {
      throw new AriesFrameworkError(
        `Credential record with id ${proposal.credentialRecordId} is missing required credential proposal`
      )
    }

    // only do this if Indy format present in the message
    // credential preview is Indy specific

    // MJR-TODO not sure we need this; is this done inside createOfferAsResponse anyway??
    for (const msg of credentialProposalMessage.formats) {
      if (msg.format.includes('indy')) {
        const formatService: CredentialFormatService = this.getFormatService(CredentialFormatType.Indy)

        this.credentialMessageBuilder.setPreview(
          formatService,
          proposal,
          credentialRecord.proposalMessage?.credentialProposal
        )
      }
    }

    const message = await this.createOfferAsResponse(credentialRecord, proposal)

    await this.updateState(credentialRecord, CredentialState.OfferSent)

    return { credentialRecord, message }
  }

  /**
   * Create a {@link OfferCredentialMessage} as response to a received credential proposal.
   * To create an offer not bound to an existing credential exchange, use {@link V2CredentialService#createOffer}.
   *
   * @param credentialRecord The credential record for which to create the credential offer
   * @param credentialTemplate The credential template to use for the offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOfferAsResponse(
    credentialRecord: CredentialRecord,
    proposal: AcceptProposalOptions | NegotiateProposalOptions
  ): Promise<V2OfferCredentialMessage> {
    // Assert
    credentialRecord.assertState(CredentialState.ProposalReceived)

    const formats: CredentialFormatService[] = this.getFormats(proposal.credentialFormats as Record<string, unknown>)

    // Create the offer message
    unitTestLogger('Get the Format Service and Create Offer Message')
    return await this.credentialMessageBuilder.createOfferAsResponse(formats, credentialRecord, proposal)
  }

  /**
   * Method called by {@link V2OfferCredentialHandler} on reception of a offer credential message
   * We do the necessary processing here to accept the offer and do the state change, emit event etc.
   * @param messageContext the inbound offer credential message
   * @returns credential record appropriate for this incoming message (once accepted)
   */
  public async processOffer(
    messageContext: HandlerInboundMessage<V2OfferCredentialHandler>
  ): Promise<CredentialRecord> {
    let credentialRecord: CredentialRecord
    const { message: credentialOfferMessage, connection } = messageContext

    unitTestLogger(`Processing credential offer with id ${credentialOfferMessage.id}`)

    const formats: CredentialFormatService[] = this.getFormatsFromMessage(credentialOfferMessage.formats)
    let credOffer: V2CredProposeOfferRequestFormat | undefined

    try {
      // Credential record already exists
      credentialRecord = await this.getByThreadAndConnectionId(credentialOfferMessage.threadId, connection?.id)

      // Assert
      credentialRecord.assertState(CredentialState.ProposalSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: credentialRecord.offerMessage,
        previousSentMessage: credentialRecord.proposalMessage,
      })

      credentialRecord.offerMessage = credentialOfferMessage

      credentialRecord.linkedAttachments = credentialOfferMessage.attachments?.filter(isLinkedAttachment)

      for (const format of formats) {
        const attachment = format.getAttachment(credentialOfferMessage)
        if (attachment) {
          credOffer = format.getCredentialPayload(attachment.data)

          if (!credOffer) {
            throw new CredentialProblemReportError(
              `Missing required base64 or json encoded attachment data for credential offer with thread id ${credentialOfferMessage.threadId}`,
              { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
            )
          }
        } else {
          throw new CredentialProblemReportError(
            `Missing required attachment for credential offer with thread id ${credentialOfferMessage.threadId}`,
            { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
          )
        }
        unitTestLogger('Save metadata for offer')
        if (credOffer) {
          format.getMetaDataService().setMetaDataForOffer(credOffer, credentialRecord)
          await this.updateState(credentialRecord, CredentialState.OfferReceived)
        }
      }
    } catch {
      // No credential record exists with thread id

      unitTestLogger('No credential record found for this offer - create a new one')

      credentialRecord = new CredentialRecord({
        connectionId: connection?.id,
        threadId: credentialOfferMessage.id,
        offerMessage: credentialOfferMessage,
        credentialAttributes: credentialOfferMessage.credentialPreview?.attributes,
        state: CredentialState.OfferReceived,
      })

      for (const format of formats) {
        const attachment = format.getAttachment(credentialOfferMessage)
        if (attachment) {
          credOffer = format.getCredentialPayload(attachment.data)

          if (!credOffer) {
            throw new CredentialProblemReportError(
              `Missing required base64 or json encoded attachment data for credential offer with thread id ${credentialOfferMessage.threadId}`,
              { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
            )
          }
        } else {
          throw new CredentialProblemReportError(
            `Missing required attachment for credential offer with thread id ${credentialOfferMessage.threadId}`,
            { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
          )
        }
        if (credOffer) {
          format.getMetaDataService().setMetaDataForOffer(credOffer, credentialRecord)
        }
      }
    }

    return credentialRecord
  }

  /**
   * Register the v2 handlers. These handlers supplement, ie are created in addition to, the existing
   * v1 handlers.
   */
  public registerHandlers() {
    unitTestLogger('Registering V2 handlers...')
    unitTestLogger('  => V2ProposeCredentialHandler')

    this.dispatcher.registerHandler(
      new V2ProposeCredentialHandler(this, this.agentConfig, this.credentialResponseCoordinator)
    )

    unitTestLogger('  => V2OfferCredentialHandler')
    this.dispatcher.registerHandler(
      new V2OfferCredentialHandler(
        this,
        this.agentConfig,
        this.credentialResponseCoordinator,
        this.mediationRecipientService
      )
    )

    unitTestLogger('  => V2RequestCredentialHandler')
    this.dispatcher.registerHandler(
      new V2RequestCredentialHandler(this, this.agentConfig, this.credentialResponseCoordinator)
    )
    // Others to follow...
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param credentialRecord The credential record to update the state for
   * @param newState The state to update to
   *
   */
  private async updateState(credentialRecord: CredentialRecord, newState: CredentialState) {
    const previousState = credentialRecord.state
    credentialRecord.state = newState
    await this.credentialRepository.update(credentialRecord)

    this.eventEmitter.emit<CredentialStateChangedEvent>({
      type: CredentialEventTypes.CredentialStateChanged,
      payload: {
        credentialRecord,
        previousState: previousState,
      },
    })
  }

  /**
   * Create a {@link V2RequestCredentialMessage}
   *
   * @param credentialRecord The credential record for which to create the credential request
   * @param options request options for creating this request
   * @returns Object containing request message and associated credential record
   *
   */
  public async createRequest(
    record: CredentialRecord,
    options: RequestCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<V2RequestCredentialMessage>> {
    unitTestLogger('>> IN SERVICE V2 createRequest')

    unitTestLogger('Get the Format Service and Create Request Message')

    if (options.credentialFormats) {
      const formats: CredentialFormatService[] = this.getFormats(options.credentialFormats as Record<string, unknown>)

      const { message, credentialRecord } = await this.credentialMessageBuilder.createRequest(formats, record, options)

      await this.updateState(credentialRecord, CredentialState.RequestSent)
      return { message, credentialRecord }
    } else {
      throw Error('No format keys found on the RequestCredentialOptions object')
    }
  }

  /**
   * Process a received {@link RequestCredentialMessage}. This will not accept the credential request
   * or send a credential. It will only update the existing credential record with
   * the information from the credential request message. Use {@link V1LegacyCredentialService#createCredential}
   * after calling this method to create a credential.
   *
   * @param messageContext The message context containing a v2 credential request message
   * @returns credential record associated with the credential request message
   *
   */
  public async processRequest(
    messageContext: InboundMessageContext<V2RequestCredentialMessage>
  ): Promise<CredentialRecord> {
    const { message: credentialRequestMessage, connection } = messageContext

    unitTestLogger('>> IN SERVICE V2 processRequest')

    // get the formaat-specific payload from the message
    // const credentialFormatType: CredentialFormatType = credentialRequestMessage.formats.format.includes('indy')
    //   ? CredentialFormatType.Indy
    //   : CredentialFormatType.JsonLd
    // const formatService: CredentialFormatService = this.getFormatService(credentialFormatType)

    // this.logger.debug(`Processing credential request with id ${credentialRequestMessage.id}`)
    // const v2credentialRequestPayload: V2CredProposeOfferRequestFormat | undefined =
    //   this.credentialMessageBuilder.getCredentialRequestFromMessage(formatService, credentialRequestMessage)

    // unitTestLogger(`v2credentialRequestPayload = ${v2credentialRequestPayload}`)

    // if (!v2credentialRequestPayload) {
    //   throw new CredentialProblemReportError(
    //     `Missing required base64 or json encoded attachment data for credential request with thread id ${credentialRequestMessage.threadId}`,
    //     { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
    //   )
    // }
    unitTestLogger('Looking for a credential record')

    const credentialRecord = await this.getByThreadAndConnectionId(credentialRequestMessage.threadId, connection?.id)
    unitTestLogger('Got a credential record!')

    // Assert
    credentialRecord.assertState(CredentialState.OfferSent)
    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: credentialRecord.proposalMessage,
      previousSentMessage: credentialRecord.offerMessage,
    })

    // this.logger.debug('Credential record found when processing credential request', credentialRecord)

    credentialRecord.requestMessage = credentialRequestMessage

    unitTestLogger('-----> UPDATING STATE TO REQUEST RECEIVED')
    await this.updateState(credentialRecord, CredentialState.RequestReceived)

    return credentialRecord
  }

  /**
   * Negotiate a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param credentialOptions configuration for the offer see {@link NegotiateProposalOptions}
   * @returns Credential exchange record associated with the credential offer
   *
   */
  public async negotiateProposal(
    credentialOptions: NegotiateProposalOptions
  ): Promise<{ credentialRecord: CredentialRecord; message: AgentMessage }> {
    const credentialRecord = await this.credentialService.getById(credentialOptions.credentialRecordId)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support negotiation.`
      )
    }

    const credentialProposalMessage = credentialRecord.proposalMessage

    if (!credentialProposalMessage?.credentialProposal) {
      throw new AriesFrameworkError(
        `Credential record with id ${credentialOptions.credentialRecordId} is missing required credential proposal`
      )
    }

    const message = await this.createOfferAsResponse(credentialRecord, credentialOptions)

    return { credentialRecord, message }
  }

  /**
   * Create a {@link V2OfferCredentialMessage} as begonning of protocol process.
   *
   * @param formatService {@link CredentialFormatService} the format service object containing format-specific logic
   * @param options attributes of the original offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOffer(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    credentialOptions: OfferCredentialOptions
  ): Promise<{ credentialRecord: CredentialRecord; message: V2OfferCredentialMessage }> {
    const connection = await this.connectionService.getById(credentialOptions.connectionId)

    connection?.assertReady()

    const formats: CredentialFormatService[] = this.getFormats(
      credentialOptions.credentialFormats as Record<string, unknown>
    )

    // Create message
    const { credentialRecord, message } = await this.credentialMessageBuilder.createOffer(formats, credentialOptions)

    return { credentialRecord, message }
  }

  public createAcceptProposalOptions(credentialRecord: CredentialRecord): AcceptProposalOptions {
    if (credentialRecord.proposalMessage && credentialRecord.proposalMessage.credentialProposal?.attributes) {
      const msg: V2ProposeCredentialMessage = credentialRecord.proposalMessage as V2ProposeCredentialMessage
      const formats: CredentialFormatService[] = this.getFormatsFromMessage(msg.formats)

      let options: AcceptProposalOptions = {
        connectionId: '',
        protocolVersion: CredentialProtocolVersion.V2_0,
        credentialRecordId: credentialRecord.id,
        credentialFormats: {},
      }

      for (const formatService of formats) {
        options = formatService.processProposal(options, credentialRecord)
      }

      const proposeMessage: V2ProposeCredentialMessage = credentialRecord.proposalMessage as V2ProposeCredentialMessage
      if (proposeMessage && proposeMessage.credentialProposal) {
        const options: AcceptProposalOptions = {
          connectionId: '',
          protocolVersion: CredentialProtocolVersion.V2_0,
          credentialRecordId: credentialRecord.id,
          credentialFormats: {
            indy: {
              attributes: proposeMessage.credentialProposal.attributes,
            },
          },
        }

        return options
      }
    }
    throw Error('Unable to create accept proposal options object')
  }
}
