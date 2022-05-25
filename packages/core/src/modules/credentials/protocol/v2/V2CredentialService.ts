import type { AgentMessage } from '../../../../agent/AgentMessage'
import type { HandlerInboundMessage } from '../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { CredentialStateChangedEvent } from '../../CredentialEvents'
import type {
  ServiceAcceptCredentialOptions,
  CredentialProtocolMsgReturnType,
  ServiceAcceptProposalOptions,
  ServiceOfferCredentialOptions,
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
import type { CreateRequestOptions } from './CredentialMessageBuilder'

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
import { CredentialState } from '../../CredentialState'
import { CredentialFormatType } from '../../CredentialsModuleOptions'
import { CredentialProblemReportError, CredentialProblemReportReason } from '../../errors'
import { IndyCredentialFormatService } from '../../formats/indy/IndyCredentialFormatService'
import { FORMAT_KEYS } from '../../formats/models/CredentialFormatServiceOptions'
import { CredentialRepository, CredentialExchangeRecord } from '../../repository'
import { RevocationService } from '../../services'
import { CredentialService } from '../../services/CredentialService'

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
    indyCredentialFormatService: IndyCredentialFormatService,
    revocationService: RevocationService
  ) {
    super(
      credentialRepository,
      eventEmitter,
      dispatcher,
      agentConfig,
      mediationRecipientService,
      didCommMessageRepository,
      revocationService
    )
    this.connectionService = connectionService
    this.indyCredentialFormatService = indyCredentialFormatService
    this.credentialMessageBuilder = new CredentialMessageBuilder()
    this.serviceFormatMap = {
      [CredentialFormatType.Indy]: this.indyCredentialFormatService,
    }
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

    if (!formats || formats.length === 0) {
      throw new AriesFrameworkError(`Unable to create proposal. No supported formats`)
    }
    const { message: proposalMessage, credentialRecord } = await this.credentialMessageBuilder.createProposal(
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

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: proposalMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

    for (const format of formats) {
      const options: ServiceAcceptProposalOptions = {
        credentialRecordId: credentialRecord.id,
        credentialFormats: {},
      }
      options.proposalAttachment = format.getAttachment(proposalMessage.formats, proposalMessage.messageAttachment)
      await format.processProposal(options, credentialRecord)
    }
    return { credentialRecord, message: proposalMessage }
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

      // this may not be the first proposal message...
      // let proposalCredentialMessage, offerCredentialMessage
      // try {
      const proposalCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2ProposeCredentialMessage,
      })
      const offerCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2OfferCredentialMessage,
      })
      credentialRecord.assertState(CredentialState.OfferSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: proposalCredentialMessage ?? undefined,
        previousSentMessage: offerCredentialMessage ?? undefined,
      })

      // Update record
      await this.didCommMessageRepository.saveOrUpdateAgentMessage({
        agentMessage: proposalMessage,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialRecord.id,
      })
      await this.updateState(credentialRecord, CredentialState.ProposalReceived)
    } catch {
      // No credential record exists with thread id
      // get the format service objects for the formats found in the message

      credentialRecord = this.credentialMessageBuilder.processProposal(proposalMessage, connection?.id)

      // Save record and emit event
      this.connectionService.assertConnectionOrServiceDecorator(messageContext)

      await this.credentialRepository.save(credentialRecord)
      await this.didCommMessageRepository.saveOrUpdateAgentMessage({
        agentMessage: proposalMessage,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialRecord.id,
      })
      await this.emitEvent(credentialRecord)
    }
    return credentialRecord
  }

  public async acceptProposal(
    proposal: AcceptProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialProtocolMsgReturnType<V2OfferCredentialMessage>> {
    const options: ServiceOfferCredentialOptions = {
      credentialFormats: proposal.credentialFormats,
      comment: proposal.comment,
      protocolVersion: credentialRecord.protocolVersion,
    }
    const message = await this.createOfferAsResponse(credentialRecord, options)

    return { credentialRecord, message }
  }

  /**
   * Create a {@link AcceptProposalOptions} object used by handler
   *
   * @param credentialRecord {@link CredentialRecord} the record containing the proposal
   * @return options attributes of the proposal
   *
   */
  private async createAcceptProposalOptions(
    credentialRecord: CredentialExchangeRecord
  ): Promise<AcceptProposalOptions> {
    const proposalMessage: V2ProposeCredentialMessage | null = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2ProposeCredentialMessage,
    })

    if (!proposalMessage) {
      throw new AriesFrameworkError(`Missing proposal message for credential record ${credentialRecord.id}`)
    }
    const formats: CredentialFormatService[] = this.getFormatsFromMessage(proposalMessage.formats)

    if (!formats || formats.length === 0) {
      throw new AriesFrameworkError(`Unable to create accept proposal options. No supported formats`)
    }
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
   * Negotiate a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param options configuration for the offer see {@link NegotiateProposalOptions}
   * @returns Credential exchange record associated with the credential offer
   *
   */
  public async negotiateProposal(
    options: NegotiateProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialProtocolMsgReturnType<V2OfferCredentialMessage>> {
    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support negotiation.`
      )
    }

    const message = await this.createOfferAsResponse(credentialRecord, options)

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

    if (!formats || formats.length === 0) {
      throw new AriesFrameworkError(`Unable to negotiate offer. No supported formats`)
    }
    const { message: credentialProposalMessage } = await this.credentialMessageBuilder.createProposal(formats, options)
    credentialProposalMessage.setThread({ threadId: credentialRecord.threadId })

    // Update record
    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: credentialProposalMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })
    credentialRecord.credentialAttributes = credentialProposalMessage.credentialProposal?.attributes
    await this.updateState(credentialRecord, CredentialState.ProposalSent)

    return { message: credentialProposalMessage, credentialRecord }
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
    options: OfferCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<V2OfferCredentialMessage>> {
    if (!options.connectionId) {
      throw new AriesFrameworkError('Connection id missing from offer credential options')
    }
    const connection = await this.connectionService.getById(options.connectionId)

    connection?.assertReady()

    const formats: CredentialFormatService[] = this.getFormats(options.credentialFormats)

    if (!formats || formats.length === 0) {
      throw new AriesFrameworkError(`Unable to create offer. No supported formats`)
    }
    // Create message
    const { credentialRecord, message: credentialOfferMessage } = await this.credentialMessageBuilder.createOffer(
      formats,
      options
    )
    credentialRecord.connectionId = options.connectionId

    await this.credentialRepository.save(credentialRecord)
    await this.emitEvent(credentialRecord)

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: credentialOfferMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

    return { credentialRecord, message: credentialOfferMessage }
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

    if (!formats || formats.length === 0) {
      throw new AriesFrameworkError(`Unable to create out of band offer. No supported formats`)
    }
    // Create message
    const { credentialRecord, message: offerCredentialMessage } = await this.credentialMessageBuilder.createOffer(
      formats,
      credentialOptions
    )

    // Create and set ~service decorator
    const routing = await this.mediationRecipientService.getRouting()
    offerCredentialMessage.service = new ServiceDecorator({
      serviceEndpoint: routing.endpoints[0],
      recipientKeys: [routing.verkey],
      routingKeys: routing.routingKeys,
    })
    await this.credentialRepository.save(credentialRecord)
    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: offerCredentialMessage,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
    await this.emitEvent(credentialRecord)
    return { credentialRecord, message: offerCredentialMessage }
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
    proposal?: ServiceOfferCredentialOptions | NegotiateProposalOptions
  ): Promise<V2OfferCredentialMessage> {
    // Assert
    credentialRecord.assertState(CredentialState.ProposalReceived)

    let options: ServiceOfferCredentialOptions | undefined
    if (!proposal) {
      const acceptProposalOptions: AcceptProposalOptions = await this.createAcceptProposalOptions(credentialRecord)

      options = {
        credentialFormats: acceptProposalOptions.credentialFormats,
        protocolVersion: CredentialProtocolVersion.V2,
        comment: acceptProposalOptions.comment,
      }
    } else {
      options = proposal
    }
    const formats: CredentialFormatService[] = this.getFormats(options.credentialFormats as Record<string, unknown>)

    if (!formats || formats.length === 0) {
      throw new AriesFrameworkError(`Unable to create offer as response. No supported formats`)
    }
    // Create the offer message
    this.logger.debug(`Get the Format Service and Create Offer Message for credential record ${credentialRecord.id}`)

    const proposeCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2ProposeCredentialMessage,
    })

    const credentialOfferMessage = await this.credentialMessageBuilder.createOfferAsResponse(
      formats,
      credentialRecord,
      options
    )

    credentialOfferMessage.credentialPreview = proposeCredentialMessage?.credentialProposal
    credentialRecord.credentialAttributes = proposeCredentialMessage?.credentialProposal?.attributes

    await this.updateState(credentialRecord, CredentialState.OfferSent)
    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
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
    if (!formats || formats.length === 0) {
      throw new AriesFrameworkError(`Unable to create offer. No supported formats`)
    }
    try {
      // Credential record already exists
      credentialRecord = await this.getByThreadAndConnectionId(credentialOfferMessage.threadId, connection?.id)

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
        previousReceivedMessage: offerCredentialMessage ?? undefined,
        previousSentMessage: proposeCredentialMessage ?? undefined,
      })

      for (const format of formats) {
        const attachment = format.getAttachment(
          credentialOfferMessage.formats,
          credentialOfferMessage.messageAttachment
        )

        if (!attachment) {
          throw new AriesFrameworkError(`Missing offer attachment in credential offer message`)
        }
        await format.processOffer(attachment, credentialRecord)
      }
      await this.updateState(credentialRecord, CredentialState.OfferReceived)
      await this.didCommMessageRepository.saveOrUpdateAgentMessage({
        agentMessage: credentialOfferMessage,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialRecord.id,
      })
    } catch (error) {
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
        await format.processOffer(attachment, credentialRecord)
      }

      // Save in repository
      this.logger.debug('Saving credential record and emit offer-received event')
      await this.credentialRepository.save(credentialRecord)

      await this.didCommMessageRepository.saveOrUpdateAgentMessage({
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
    if (!formats || formats.length == 0) {
      throw new AriesFrameworkError('No format keys found on the RequestCredentialOptions object')
    }

    const optionsForRequest: CreateRequestOptions = {
      formatServices: formats,
      record,
      requestOptions: options,
      offerMessage,
      holderDid,
    }
    const { message, credentialRecord } = await this.credentialMessageBuilder.createRequest(optionsForRequest)

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
      previousReceivedMessage: proposalMessage ?? undefined,
      previousSentMessage: offerMessage ?? undefined,
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
    if (!offerMessage) {
      throw new AriesFrameworkError('Missing Offer Message in create credential')
    }
    const credentialFormats: CredentialFormatService[] = this.getFormatsFromMessage(requestMessage.formats)
    if (!credentialFormats || credentialFormats.length === 0) {
      throw new AriesFrameworkError(`Unable to create credential. No supported formats`)
    }
    const { message: issueCredentialMessage, credentialRecord } = await this.credentialMessageBuilder.createCredential(
      credentialFormats,
      record,
      options,
      requestMessage,
      offerMessage
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
      previousReceivedMessage: offerMessage ?? undefined,
      previousSentMessage: requestMessage ?? undefined,
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
      const options: ServiceAcceptCredentialOptions = {
        credentialAttachment: issueAttachment,
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
      previousReceivedMessage: requestMessage ?? undefined,
      previousSentMessage: credentialMessage ?? undefined,
    })

    // Update record
    await this.updateState(credentialRecord, CredentialState.Done)

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

  // AUTO ACCEPT METHODS
  public async shouldAutoRespondToProposal(options: HandlerAutoAcceptOptions): Promise<boolean> {
    if (this.agentConfig.autoAcceptCredentials === AutoAcceptCredential.Never) {
      return false
    }
    if (options.credentialRecord.autoAcceptCredential === AutoAcceptCredential.Never) {
      return false
    }
    const proposalMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: options.credentialRecord.id,
      messageClass: V2ProposeCredentialMessage,
    })
    if (!proposalMessage) {
      throw new AriesFrameworkError('Missing proposal message in V2ProposeCredentialHandler')
    }
    const formatServices: CredentialFormatService[] = this.getFormatsFromMessage(proposalMessage.formats)
    let shouldAutoRespond = true
    for (const formatService of formatServices) {
      const formatShouldAutoRespond =
        this.agentConfig.autoAcceptCredentials == AutoAcceptCredential.Always ||
        formatService.shouldAutoRespondToProposal(options)

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

  public update(credentialRecord: CredentialExchangeRecord) {
    return this.credentialRepository.update(credentialRecord)
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
}
