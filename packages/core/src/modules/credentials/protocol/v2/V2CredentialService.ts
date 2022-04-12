import type { AgentMessage } from '../../../../agent/AgentMessage'
import type { HandlerInboundMessage } from '../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { CredentialStateChangedEvent } from '../../CredentialEvents'
import type {
  ServiceAcceptCredentialOptions,
  CredentialProtocolMsgReturnType,
  ServiceAcceptProposalOptions,
  DeleteCredentialOptions,
} from '../../CredentialServiceOptions'
import type {
  AcceptProposalOptions,
  AcceptRequestOptions,
  NegotiateOfferOptions,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../../CredentialsModuleOptions'
import type { CredentialFormatService } from '../../formats/CredentialFormatService'
import type {
  CredentialFormats,
  CredentialFormatSpec,
  HandlerAutoAcceptOptions,
} from '../../formats/models/CredentialFormatServiceOptions'
import type { CredentialPreviewAttribute } from '../../models/CredentialPreviewAttributes'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../../agent/AgentConfig'
import { Dispatcher } from '../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { ServiceDecorator } from '../../../../decorators/service/ServiceDecorator'
import { AriesFrameworkError } from '../../../../error'
import { DidCommMessageRepository, DidCommMessageRole } from '../../../../storage'
import { AckStatus } from '../../../common'
import { ConnectionService } from '../../../connections/services/ConnectionService'
import { MediationRecipientService } from '../../../routing'
import { AutoAcceptCredential } from '../../CredentialAutoAcceptType'
import { CredentialEventTypes } from '../../CredentialEvents'
import { CredentialProtocolVersion } from '../../CredentialProtocolVersion'
import { CredentialService } from '../../CredentialService'
import { CredentialState } from '../../CredentialState'
import { CredentialFormatType } from '../../CredentialsModuleOptions'
import { CredentialProblemReportError, CredentialProblemReportReason } from '../../errors'
import { IndyCredentialFormatService } from '../../formats/indy/IndyCredentialFormatService'
import { FORMAT_KEYS } from '../../formats/models/CredentialFormatServiceOptions'
import { CredentialRepository, CredentialExchangeRecord } from '../../repository'

import { CredentialMessageBuilder } from './CredentialMessageBuilder'
import { V2CredentialAckHandler } from './handlers/V2CredentialAckHandler'
import { V2CredentialProblemReportHandler } from './handlers/V2CredentialProblemReportHandler'
import { V2IssueCredentialHandler } from './handlers/V2IssueCredentialHandler'
import { V2OfferCredentialHandler } from './handlers/V2OfferCredentialHandler'
import { V2ProposeCredentialHandler } from './handlers/V2ProposeCredentialHandler'
import { V2RequestCredentialHandler } from './handlers/V2RequestCredentialHandler'
import { V2CredentialAckMessage } from './messages/V2CredentialAckMessage'
import { V2IssueCredentialMessage } from './messages/V2IssueCredentialMessage'
import { V2OfferCredentialMessage } from './messages/V2OfferCredentialMessage'
import { V2ProposeCredentialMessage } from './messages/V2ProposeCredentialMessage'
import { V2RequestCredentialMessage } from './messages/V2RequestCredentialMessage'

@scoped(Lifecycle.ContainerScoped)
export class V2CredentialService extends CredentialService {
  private connectionService: ConnectionService
  private credentialMessageBuilder: CredentialMessageBuilder
  private indyCredentialFormatService: IndyCredentialFormatService
  private serviceFormatMap: { Indy: IndyCredentialFormatService } // jsonld todo

  public constructor(
    connectionService: ConnectionService,
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService,
    didCommMessageRepository: DidCommMessageRepository,
    indyCredentialFormatService: IndyCredentialFormatService
  ) {
    super(
      credentialRepository,
      eventEmitter,
      dispatcher,
      agentConfig,
      mediationRecipientService,
      didCommMessageRepository
    )
    this.connectionService = connectionService
    this.indyCredentialFormatService = indyCredentialFormatService
    this.credentialMessageBuilder = new CredentialMessageBuilder()
    this.serviceFormatMap = {
      [CredentialFormatType.Indy]: this.indyCredentialFormatService,
    }
  }

  public shouldAutoRespondToProposal(
    credentialRecord: CredentialExchangeRecord,
    proposeMessage: V2ProposeCredentialMessage,
    offerMessage?: V2OfferCredentialMessage
  ): boolean {
    if (this.agentConfig.autoAcceptCredentials === AutoAcceptCredential.Never) {
      return false
    }
    const formatServices: CredentialFormatService[] = this.getFormatsFromMessage(proposeMessage.formats)
    let shouldAutoRespond = true
    let proposalValues: CredentialPreviewAttribute[] | undefined
    for (const formatService of formatServices) {
      let proposalAttachment, offerAttachment: Attachment | undefined
      if (proposeMessage && proposeMessage.appendedAttachments) {
        proposalAttachment = formatService.getAttachment(proposeMessage.formats, proposeMessage.messageAttachment)
        proposalValues = proposeMessage.credentialProposal?.attributes
      }
      if (offerMessage) {
        offerAttachment = formatService.getAttachment(offerMessage.formats, offerMessage.messageAttachment)
      }
      const handlerOptions: HandlerAutoAcceptOptions = {
        credentialRecord,
        autoAcceptType: this.agentConfig.autoAcceptCredentials,
        messageAttributes: proposalValues,
        proposalAttachment,
        offerAttachment,
      }
      const formatShouldAutoRespond =
        this.agentConfig.autoAcceptCredentials == AutoAcceptCredential.Always ||
        formatService.shouldAutoRespondToProposal(handlerOptions)

      shouldAutoRespond = shouldAutoRespond && formatShouldAutoRespond
    }
    return shouldAutoRespond
  }

  public shouldAutoRespondToOffer(
    credentialRecord: CredentialExchangeRecord,
    offerMessage: V2OfferCredentialMessage,
    proposeMessage?: V2ProposeCredentialMessage
  ): boolean {
    if (this.agentConfig.autoAcceptCredentials === AutoAcceptCredential.Never) {
      return false
    }
    let offerValues: CredentialPreviewAttribute[] | undefined
    let shouldAutoRespond = true
    const formatServices: CredentialFormatService[] = this.getFormatsFromMessage(offerMessage.formats)
    for (const formatService of formatServices) {
      let proposalAttachment: Attachment | undefined

      if (proposeMessage) {
        proposalAttachment = formatService.getAttachment(proposeMessage.formats, proposeMessage.messageAttachment)
      }
      const offerAttachment = formatService.getAttachment(offerMessage.formats, offerMessage.messageAttachment)

      offerValues = offerMessage.credentialPreview?.attributes

      const handlerOptions: HandlerAutoAcceptOptions = {
        credentialRecord,
        autoAcceptType: this.agentConfig.autoAcceptCredentials,
        messageAttributes: offerValues,
        proposalAttachment,
        offerAttachment,
      }
      const formatShouldAutoRespond =
        this.agentConfig.autoAcceptCredentials == AutoAcceptCredential.Always ||
        formatService.shouldAutoRespondToProposal(handlerOptions)

      shouldAutoRespond = shouldAutoRespond && formatShouldAutoRespond
    }

    return shouldAutoRespond
  }

  public shouldAutoRespondToRequest(
    credentialRecord: CredentialExchangeRecord,
    requestMessage: V2RequestCredentialMessage,
    proposeMessage?: V2ProposeCredentialMessage,
    offerMessage?: V2OfferCredentialMessage
  ): boolean {
    const formatServices: CredentialFormatService[] = this.getFormatsFromMessage(requestMessage.formats)
    let shouldAutoRespond = true

    for (const formatService of formatServices) {
      let proposalAttachment, offerAttachment, requestAttachment: Attachment | undefined
      if (proposeMessage) {
        proposalAttachment = formatService.getAttachment(proposeMessage.formats, proposeMessage.messageAttachment)
      }
      if (offerMessage) {
        offerAttachment = formatService.getAttachment(offerMessage.formats, offerMessage.messageAttachment)
      }
      if (requestMessage) {
        requestAttachment = formatService.getAttachment(requestMessage.formats, requestMessage.messageAttachment)
      }
      const handlerOptions: HandlerAutoAcceptOptions = {
        credentialRecord,
        autoAcceptType: this.agentConfig.autoAcceptCredentials,
        proposalAttachment,
        offerAttachment,
        requestAttachment,
      }
      const formatShouldAutoRespond =
        this.agentConfig.autoAcceptCredentials == AutoAcceptCredential.Always ||
        formatService.shouldAutoRespondToRequest(handlerOptions)

      shouldAutoRespond = shouldAutoRespond && formatShouldAutoRespond
    }
    return shouldAutoRespond
  }

  public shouldAutoRespondToCredential(
    credentialRecord: CredentialExchangeRecord,
    credentialMessage: V2IssueCredentialMessage
  ): boolean {
    // 1. Get all formats for this message
    const formatServices: CredentialFormatService[] = this.getFormatsFromMessage(credentialMessage.formats)

    // 2. loop through found formats
    let shouldAutoRespond = true
    let credentialAttachment: Attachment | undefined

    for (const formatService of formatServices) {
      if (credentialMessage) {
        credentialAttachment = formatService.getAttachment(
          credentialMessage.formats,
          credentialMessage.messageAttachment
        )
      }
      const handlerOptions: HandlerAutoAcceptOptions = {
        credentialRecord,
        autoAcceptType: this.agentConfig.autoAcceptCredentials,
        credentialAttachment,
      }
      // 3. Call format.shouldRespondToProposal for each one

      const formatShouldAutoRespond =
        this.agentConfig.autoAcceptCredentials == AutoAcceptCredential.Always ||
        formatService.shouldAutoRespondToCredential(handlerOptions)

      shouldAutoRespond = shouldAutoRespond && formatShouldAutoRespond
    }
    return shouldAutoRespond
  }
  /**
   * Returns the protocol version for this credential service
   * @returns v2 as this is the v2 service
   */
  public getVersion(): CredentialProtocolVersion {
    return CredentialProtocolVersion.V2
  }

  /**
   * Gets the correct formatting service for this credential record type, eg indy or jsonld. Others may be
   * added in the future.
   * Each formatting service knows how to format the message structure for the specific record type
   * @param credentialFormatType the format type, indy, jsonld, jwt etc.
   * @returns the formatting service.
   */
  public getFormatService(credentialFormatType: CredentialFormatType): CredentialFormatService {
    return this.serviceFormatMap[credentialFormatType]
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
  ): Promise<CredentialProtocolMsgReturnType<V2ProposeCredentialMessage>> {
    this.logger.debug('Get the Format Service and Create Proposal Message')

    const formats: CredentialFormatService[] = this.getFormats(proposal.credentialFormats)

    const { message: proposalMessage, credentialRecord } = this.credentialMessageBuilder.createProposal(
      formats,
      proposal
    )

    credentialRecord.credentialAttributes = proposalMessage.credentialProposal?.attributes
    credentialRecord.connectionId = proposal.connectionId

    this.logger.debug('Save meta data and emit state change event')

    await this.credentialRepository.save(credentialRecord)

    this.eventEmitter.emit<CredentialStateChangedEvent>({
      type: CredentialEventTypes.CredentialStateChanged,
      payload: {
        credentialRecord,
        previousState: null,
      },
    })

    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: proposalMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

    await this.setMetaDataFor(proposalMessage, credentialRecord, formats)

    return { credentialRecord, message: proposalMessage }
  }

  private async setMetaDataFor(
    proposalMessage: V2ProposeCredentialMessage,
    record: CredentialExchangeRecord,
    formats: CredentialFormatService[]
  ) {
    for (const format of formats) {
      const options: ServiceAcceptProposalOptions = {
        credentialRecordId: record.id,
        credentialFormats: {},
      }
      options.proposalAttachment = format.getAttachment(proposalMessage.formats, proposalMessage.messageAttachment)
      // used to set the meta data
      await format.processProposal(options, record)
    }
  }

  /**
   * Get all the format service objects for a given credential format from an incoming message
   * @param messageFormats the format objects containing the format name (eg indy)
   * @return the credential format service objects in an array - derived from format object keys
   */
  public getFormatsFromMessage(messageFormats: CredentialFormatSpec[]): CredentialFormatService[] {
    const formats: CredentialFormatService[] = []

    for (const msg of messageFormats) {
      if (msg.format.includes('indy')) {
        formats.push(this.getFormatService(CredentialFormatType.Indy))
      } else if (msg.format.includes('aries')) {
        // todo
      } else {
        throw new AriesFrameworkError(`Unknown Message Format: ${msg.format}`)
      }
    }
    return formats
  }
  /**
   * Get all the format service objects for a given credential format
   * @param credentialFormats the format object containing various optional parameters
   * @return the credential format service objects in an array - derived from format object keys
   */
  public getFormats(credentialFormats: CredentialFormats): CredentialFormatService[] {
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
   * We do the necessary processing here to accept the proposal and do the state change, emit event etc.
   * @param messageContext the inbound propose credential message
   * @returns credential record appropriate for this incoming message (once accepted)
   */
  public async processProposal(
    messageContext: HandlerInboundMessage<V2ProposeCredentialHandler>
  ): Promise<CredentialExchangeRecord> {
    let credentialRecord: CredentialExchangeRecord
    const { message: proposalMessage, connection } = messageContext

    this.logger.debug(`Processing credential proposal with id ${proposalMessage.id}`)

    try {
      // Credential record already exists
      credentialRecord = await this.getByThreadAndConnectionId(proposalMessage.threadId, connection?.id)
      credentialRecord.connectionId = connection?.id

      // this may not be the first proposal message...
      let proposalCredentialMessage, offerCredentialMessage
      try {
        proposalCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
          associatedRecordId: credentialRecord.id,
          messageClass: V2ProposeCredentialMessage,
        })
        offerCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
          associatedRecordId: credentialRecord.id,
          messageClass: V2OfferCredentialMessage,
        })
      } catch (RecordNotFoundError) {
        // record not found - expected (sometimes)
      }
      credentialRecord.assertState(CredentialState.OfferSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: proposalCredentialMessage ? proposalCredentialMessage : undefined,
        previousSentMessage: offerCredentialMessage ? offerCredentialMessage : undefined,
      })

      // Update record
      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: proposalMessage,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialRecord.id,
      })
      await this.updateState(credentialRecord, CredentialState.ProposalReceived)
    } catch {
      // No credential record exists with thread id
      // get the format service objects for the formats found in the message
      const formats: CredentialFormatService[] = this.getFormatsFromMessage(proposalMessage.formats)

      credentialRecord = this.credentialMessageBuilder.acceptProposal(proposalMessage, connection?.id)

      // Save record and emit event
      this.connectionService.assertConnectionOrServiceDecorator(messageContext)

      await this.credentialRepository.save(credentialRecord)
      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: proposalMessage,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialRecord.id,
      })
      await this.setMetaDataFor(proposalMessage, credentialRecord, formats)

      await this.emitEvent(credentialRecord)
    }
    return credentialRecord
  }

  private async emitEvent(credentialRecord: CredentialExchangeRecord) {
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
  public getByThreadAndConnectionId(threadId: string, connectionId?: string): Promise<CredentialExchangeRecord> {
    return this.credentialRepository.getSingleByQuery({
      connectionId,
      threadId,
    })
  }

  public async acceptProposal(
    proposal: AcceptProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialProtocolMsgReturnType<V2OfferCredentialMessage>> {
    const message = await this.createOfferAsResponse(credentialRecord, proposal)

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
    credentialRecord: CredentialExchangeRecord,
    proposal: AcceptProposalOptions | NegotiateProposalOptions
  ): Promise<V2OfferCredentialMessage> {
    // Assert
    credentialRecord.assertState(CredentialState.ProposalReceived)

    const formats: CredentialFormatService[] = this.getFormats(proposal.credentialFormats as Record<string, unknown>)

    // Create the offer message
    this.logger.debug(`Get the Format Service and Create Offer Message for credential record ${credentialRecord.id}`)
    const credentialOfferMessage = await this.credentialMessageBuilder.createOfferAsResponse(
      formats,
      credentialRecord,
      proposal
    )
    await this.updateState(credentialRecord, CredentialState.OfferSent)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: credentialOfferMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

    return credentialOfferMessage
  }

  /**
   * Method called by {@link V2OfferCredentialHandler} on reception of a offer credential message
   * We do the necessary processing here to accept the offer and do the state change, emit event etc.
   * @param messageContext the inbound offer credential message
   * @returns credential record appropriate for this incoming message (once accepted)
   */
  public async processOffer(
    messageContext: HandlerInboundMessage<V2OfferCredentialHandler>
  ): Promise<CredentialExchangeRecord> {
    let credentialRecord: CredentialExchangeRecord
    const { message: credentialOfferMessage, connection } = messageContext

    this.logger.debug(`Processing credential offer with id ${credentialOfferMessage.id}`)

    const formats: CredentialFormatService[] = this.getFormatsFromMessage(credentialOfferMessage.formats)
    try {
      // Credential record already exists
      credentialRecord = await this.getByThreadAndConnectionId(credentialOfferMessage.threadId, connection?.id)
      credentialRecord.connectionId = connection?.id

      const proposeCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2ProposeCredentialMessage,
      })
      const offerCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2OfferCredentialMessage,
      })

      credentialRecord.assertState(CredentialState.ProposalSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: offerCredentialMessage ? offerCredentialMessage : undefined,
        previousSentMessage: proposeCredentialMessage ? proposeCredentialMessage : undefined,
      })

      for (const format of formats) {
        const attachment = format.getAttachment(
          credentialOfferMessage.formats,
          credentialOfferMessage.messageAttachment
        )

        if (!attachment) {
          throw new AriesFrameworkError(`Missing offer attachment in credential offer message`)
        }
        this.logger.debug('Save metadata for offer')
        format.processOffer(attachment, credentialRecord)
      }
      await this.updateState(credentialRecord, CredentialState.OfferReceived)
      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: credentialOfferMessage,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialRecord.id,
      })
    } catch {
      // No credential record exists with thread id

      this.logger.debug('No credential record found for this offer - create a new one')

      credentialRecord = new CredentialExchangeRecord({
        connectionId: connection?.id,
        threadId: credentialOfferMessage.id,
        credentialAttributes: credentialOfferMessage.credentialPreview?.attributes,
        state: CredentialState.OfferReceived,
        protocolVersion: CredentialProtocolVersion.V2,
        credentials: [],
      })

      for (const format of formats) {
        const attachment = format.getAttachment(
          credentialOfferMessage.formats,
          credentialOfferMessage.messageAttachment
        )

        if (!attachment) {
          throw new AriesFrameworkError(`Missing offer attachment in credential offer message`)
        }
        this.logger.debug('Save metadata for offer')
        format.processOffer(attachment, credentialRecord)
      }

      // Save in repository
      this.logger.debug('Saving credential record and emit offer-received event')
      await this.credentialRepository.save(credentialRecord)

      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: credentialOfferMessage,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialRecord.id,
      })
      this.eventEmitter.emit<CredentialStateChangedEvent>({
        type: CredentialEventTypes.CredentialStateChanged,
        payload: {
          credentialRecord,
          previousState: null,
        },
      })
    }

    return credentialRecord
  }

  /**
   * Register the v2 handlers. These handlers supplement, ie are created in addition to, the existing
   * v1 handlers.
   */
  public registerHandlers() {
    this.logger.debug('Registering V2 handlers')

    this.dispatcher.registerHandler(
      new V2ProposeCredentialHandler(this, this.agentConfig, this.didCommMessageRepository)
    )

    this.dispatcher.registerHandler(
      new V2OfferCredentialHandler(
        this,
        this.agentConfig,
        this.mediationRecipientService,
        this.didCommMessageRepository
      )
    )

    this.dispatcher.registerHandler(
      new V2RequestCredentialHandler(this, this.agentConfig, this.didCommMessageRepository)
    )

    this.dispatcher.registerHandler(new V2IssueCredentialHandler(this, this.agentConfig, this.didCommMessageRepository))
    this.dispatcher.registerHandler(new V2CredentialAckHandler(this))
    this.dispatcher.registerHandler(new V2CredentialProblemReportHandler(this))
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
    record: CredentialExchangeRecord,
    options: RequestCredentialOptions,
    holderDid?: string // temporary workaround
  ): Promise<CredentialProtocolMsgReturnType<V2RequestCredentialMessage>> {
    this.logger.debug('Get the Format Service and Create Request Message')

    record.assertState(CredentialState.OfferReceived)

    const offerMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: record.id,
      messageClass: V2OfferCredentialMessage,
    })

    if (!offerMessage) {
      throw new CredentialProblemReportError(
        `Missing required base64 or json encoded attachment data for credential offer with thread id ${record.threadId}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }
    const formats: CredentialFormatService[] = this.getFormatsFromMessage(offerMessage.formats)
    if (!formats) {
      throw new AriesFrameworkError('No format keys found on the RequestCredentialOptions object')
    }
    const { message, credentialRecord } = await this.credentialMessageBuilder.createRequest(
      formats,
      record,
      options,
      offerMessage,
      holderDid
    )

    await this.updateState(credentialRecord, CredentialState.RequestSent)
    return { message, credentialRecord }
  }

  /**
   * Process a received {@link RequestCredentialMessage}. This will not accept the credential request
   * or send a credential. It will only update the existing credential record with
   * the information from the credential request message. Use {@link createCredential}
   * after calling this method to create a credential.
   *
   * @param messageContext The message context containing a v2 credential request message
   * @returns credential record associated with the credential request message
   *
   */
  public async processRequest(
    messageContext: InboundMessageContext<V2RequestCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: credentialRequestMessage, connection } = messageContext

    const credentialRecord = await this.getByThreadAndConnectionId(credentialRequestMessage.threadId, connection?.id)
    credentialRecord.connectionId = connection?.id

    const proposalMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2ProposeCredentialMessage,
    })

    const offerMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2OfferCredentialMessage,
    })

    // Assert
    credentialRecord.assertState(CredentialState.OfferSent)
    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: proposalMessage ? proposalMessage : undefined,
      previousSentMessage: offerMessage ? offerMessage : undefined,
    })

    this.logger.debug('Credential record found when processing credential request', credentialRecord)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: credentialRequestMessage,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
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
    credentialOptions: NegotiateProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialProtocolMsgReturnType<V2OfferCredentialMessage>> {
    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support negotiation.`
      )
    }

    const message = await this.createOfferAsResponse(credentialRecord, credentialOptions)

    return { credentialRecord, message }
  }

  /**
   * Create a {@link ProposePresentationMessage} as response to a received credential offer.
   * To create a proposal not bound to an existing credential exchange, use {@link createProposal}.
   *
   * @param credentialRecord The credential record for which to create the credential proposal
   * @param config Additional configuration to use for the proposal
   * @returns Object containing proposal message and associated credential record
   *
   */
  public async negotiateOffer(
    options: NegotiateOfferOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialProtocolMsgReturnType<V2ProposeCredentialMessage>> {
    // Assert
    credentialRecord.assertState(CredentialState.OfferReceived)

    // Create message

    const formats: CredentialFormatService[] = this.getFormats(options.credentialFormats)

    const { message: proposalMessage } = this.credentialMessageBuilder.createProposal(formats, options)
    proposalMessage.setThread({ threadId: credentialRecord.threadId })

    // Update record
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: proposalMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })
    credentialRecord.credentialAttributes = proposalMessage.credentialProposal?.attributes
    this.updateState(credentialRecord, CredentialState.ProposalSent)

    return { message: proposalMessage, credentialRecord }
  }
  /**
   * Create a {@link V2OfferCredentialMessage} as beginning of protocol process.
   *
   * @param formatService {@link CredentialFormatService} the format service object containing format-specific logic
   * @param options attributes of the original offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOffer(
    credentialOptions: OfferCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<V2OfferCredentialMessage>> {
    if (!credentialOptions.connectionId) {
      throw new AriesFrameworkError('Connection id missing from offer credential options')
    }
    const connection = await this.connectionService.getById(credentialOptions.connectionId)

    connection?.assertReady()

    const formats: CredentialFormatService[] = this.getFormats(credentialOptions.credentialFormats)

    // Create message
    const { credentialRecord, message } = await this.credentialMessageBuilder.createOffer(formats, credentialOptions)
    credentialRecord.connectionId = credentialOptions.connectionId

    for (const format of formats) {
      const attachment = format.getAttachment(message.formats, message.messageAttachment)

      if (!attachment) {
        throw new AriesFrameworkError(`Missing offer attachment in credential offer message`)
      }
      format.processOffer(attachment, credentialRecord)
    }
    await this.credentialRepository.save(credentialRecord)
    await this.emitEvent(credentialRecord)

    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

    return { credentialRecord, message }
  }

  /**
   * Create a {@link AcceptProposalOptions} object used by handler
   *
   * @param credentialRecord {@link CredentialRecord} the record containing the proposal
   * @return options attributes of the proposal
   *
   */
  public async createAcceptProposalOptions(credentialRecord: CredentialExchangeRecord): Promise<AcceptProposalOptions> {
    const proposalMessage: V2ProposeCredentialMessage | null = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2ProposeCredentialMessage,
    })

    if (!proposalMessage) {
      throw new AriesFrameworkError(`Missing proposal message for credential record ${credentialRecord.id}`)
    }
    const formats: CredentialFormatService[] = this.getFormatsFromMessage(proposalMessage.formats)

    const options: ServiceAcceptProposalOptions = {
      credentialRecordId: credentialRecord.id,
      credentialFormats: {},
    }

    for (const formatService of formats) {
      options.proposalAttachment = formatService.getAttachment(
        proposalMessage.formats,
        proposalMessage.messageAttachment
      )
      // should fill in the credential formats
      await formatService.processProposal(options, credentialRecord)
    }
    return options
  }

  /**
   * Create a {@link IssueCredentialMessage} as response to a received credential request.
   *
   * @param credentialRecord The credential record for which to create the credential
   * @param options Additional configuration to use for the credential
   * @returns Object containing issue credential message and associated credential record
   *
   */
  public async createCredential(
    record: CredentialExchangeRecord,
    options: AcceptRequestOptions
  ): Promise<CredentialProtocolMsgReturnType<V2IssueCredentialMessage>> {
    record.assertState(CredentialState.RequestReceived)

    const requestMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: record.id,
      messageClass: V2RequestCredentialMessage,
    })

    if (!requestMessage) {
      throw new AriesFrameworkError(
        `Missing credential request for credential exchange with thread id ${record.threadId}`
      )
    }
    const offerMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: record.id,
      messageClass: V2OfferCredentialMessage,
    })
    const credentialFormats: CredentialFormatService[] = this.getFormatsFromMessage(requestMessage.formats)
    const { message: issueCredentialMessage, credentialRecord } = await this.credentialMessageBuilder.createCredential(
      credentialFormats,
      record,
      options,
      requestMessage,
      offerMessage ? offerMessage : undefined
    )

    issueCredentialMessage.setThread({
      threadId: credentialRecord.threadId,
    })
    issueCredentialMessage.setPleaseAck()

    credentialRecord.autoAcceptCredential = options?.autoAcceptCredential ?? credentialRecord.autoAcceptCredential

    await this.updateState(credentialRecord, CredentialState.CredentialIssued)

    return { message: issueCredentialMessage, credentialRecord }
  }

  /**
   * Process a received {@link IssueCredentialMessage}. This will not accept the credential
   * or send a credential acknowledgement. It will only update the existing credential record with
   * the information from the issue credential message. Use {@link createAck}
   * after calling this method to create a credential acknowledgement.
   *
   * @param messageContext The message context containing an issue credential message
   *
   * @returns credential record associated with the issue credential message
   *
   */
  public async processCredential(
    messageContext: InboundMessageContext<V2IssueCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: issueCredentialMessage, connection } = messageContext

    this.logger.debug(`Processing credential with id ${issueCredentialMessage.id}`)

    const credentialRecord = await this.getByThreadAndConnectionId(issueCredentialMessage.threadId, connection?.id)

    credentialRecord.connectionId = connection?.id

    const requestMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2RequestCredentialMessage,
    })
    const offerMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2OfferCredentialMessage,
    })

    // Assert
    credentialRecord.assertState(CredentialState.RequestSent)
    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: offerMessage ? offerMessage : undefined,
      previousSentMessage: requestMessage ? requestMessage : undefined,
    })

    const formatServices: CredentialFormatService[] = this.getFormatsFromMessage(issueCredentialMessage.formats)

    for (const formatService of formatServices) {
      // get the revocation registry and pass it to the process (store) credential method
      const issueAttachment = formatService.getAttachment(
        issueCredentialMessage.formats,
        issueCredentialMessage.messageAttachment
      )

      if (!issueAttachment) {
        throw new AriesFrameworkError('Missing credential attachment in processCredential')
      }
      const revocationRegistry = await formatService.getRevocationRegistry(issueAttachment)

      const options: ServiceAcceptCredentialOptions = {
        credentialAttachment: issueAttachment,
        revocationRegistry,
      }
      await formatService.processCredential(options, credentialRecord)
    }

    await this.updateState(credentialRecord, CredentialState.CredentialReceived)

    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: issueCredentialMessage,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
    return credentialRecord
  }

  public async deleteById(credentialId: string, options?: DeleteCredentialOptions): Promise<void> {
    const credentialRecord = await this.getById(credentialId)

    await this.credentialRepository.delete(credentialRecord)

    if (options?.deleteAssociatedCredential && credentialRecord) {
      for (const credential of credentialRecord.credentials) {
        const formatService: CredentialFormatService = this.getFormatService(credential.credentialRecordType)
        await formatService.deleteCredentialById(credentialRecord, options)
      }
    }
  }
  /**
   * Create a {@link V2CredentialAckMessage} as response to a received credential.
   *
   * @param credentialRecord The credential record for which to create the credential acknowledgement
   * @returns Object containing credential acknowledgement message and associated credential record
   *
   */
  public async createAck(
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialProtocolMsgReturnType<V2CredentialAckMessage>> {
    credentialRecord.assertState(CredentialState.CredentialReceived)

    // Create message
    const ackMessage = new V2CredentialAckMessage({
      status: AckStatus.OK,
      threadId: credentialRecord.threadId,
    })

    await this.updateState(credentialRecord, CredentialState.Done)

    return { message: ackMessage, credentialRecord }
  }

  /**
   * Process a received {@link CredentialAckMessage}.
   *
   * @param messageContext The message context containing a credential acknowledgement message
   * @returns credential record associated with the credential acknowledgement message
   *
   */
  public async processAck(
    messageContext: InboundMessageContext<V2CredentialAckMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: credentialAckMessage, connection } = messageContext

    this.logger.debug(`Processing credential ack with id ${credentialAckMessage.id}`)

    const credentialRecord = await this.getByThreadAndConnectionId(credentialAckMessage.threadId, connection?.id)
    credentialRecord.connectionId = connection?.id

    const requestMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2RequestCredentialMessage,
    })

    const credentialMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2IssueCredentialMessage,
    })

    // Assert
    credentialRecord.assertState(CredentialState.CredentialIssued)
    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: requestMessage ? requestMessage : undefined,
      previousSentMessage: credentialMessage ? credentialMessage : undefined,
    })

    // Update record
    await this.updateState(credentialRecord, CredentialState.Done)

    return credentialRecord
  }

  public async getOfferMessage(id: string): Promise<AgentMessage | null> {
    return await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: id,
      messageClass: V2OfferCredentialMessage,
    })
  }
  public async getRequestMessage(id: string): Promise<AgentMessage | null> {
    return await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: id,
      messageClass: V2RequestCredentialMessage,
    })
  }

  public async getCredentialMessage(id: string): Promise<AgentMessage | null> {
    return await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: id,
      messageClass: V2IssueCredentialMessage,
    })
  }
  /**
   * Create an offer message for an out-of-band (connectionless) credential
   * @param credentialOptions the options (parameters) object for the offer
   * @returns the credential record and the offer message
   */
  public async createOutOfBandOffer(
    credentialOptions: OfferCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<V2OfferCredentialMessage>> {
    const formats: CredentialFormatService[] = this.getFormats(credentialOptions.credentialFormats)

    // Create message
    const { credentialRecord, message: offerCredentialMessage } = await this.credentialMessageBuilder.createOffer(
      formats,
      credentialOptions
    )

    for (const format of formats) {
      const attachment = format.getAttachment(offerCredentialMessage.formats, offerCredentialMessage.messageAttachment)

      if (!attachment) {
        throw new AriesFrameworkError(`Missing offer attachment in credential offer message`)
      }
      this.logger.debug('Save metadata for offer')
      format.processOffer(attachment, credentialRecord)
    }

    // Create and set ~service decorator
    const routing = await this.mediationRecipientService.getRouting()
    offerCredentialMessage.service = new ServiceDecorator({
      serviceEndpoint: routing.endpoints[0],
      recipientKeys: [routing.verkey],
      routingKeys: routing.routingKeys,
    })
    await this.credentialRepository.save(credentialRecord)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: offerCredentialMessage,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
    await this.emitEvent(credentialRecord)
    return { credentialRecord, message: offerCredentialMessage }
  }

  public update(credentialRecord: CredentialExchangeRecord) {
    return this.credentialRepository.update(credentialRecord)
  }
}
