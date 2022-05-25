import type { AgentMessage } from '../../../../agent/AgentMessage'
import type { HandlerInboundMessage } from '../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { ConnectionRecord } from '../../../connections'
import type { CredentialStateChangedEvent } from '../../CredentialEvents'
import type {
  ServiceAcceptCredentialOptions,
  CredentialOfferTemplate,
  CredentialProposeOptions,
  CredentialProtocolMsgReturnType,
  ServiceAcceptRequestOptions,
  ServiceRequestCredentialOptions,
  ServiceOfferCredentialOptions,
} from '../../CredentialServiceOptions'
import type {
  AcceptProposalOptions,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../../CredentialsModuleOptions'
import type { CredentialFormatService } from '../../formats/CredentialFormatService'
import type { HandlerAutoAcceptOptions } from '../../formats/models/CredentialFormatServiceOptions'
import type { CredentialPreviewAttribute } from '../../models/CredentialPreviewAttribute'
import type { CredOffer } from 'indy-sdk'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../../agent/AgentConfig'
import { Dispatcher } from '../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../../error'
import { DidCommMessageRepository, DidCommMessageRole } from '../../../../storage'
import { isLinkedAttachment } from '../../../../utils/attachment'
import { AckStatus } from '../../../common'
import { ConnectionService } from '../../../connections/services'
import { MediationRecipientService } from '../../../routing'
import { AutoAcceptCredential } from '../../CredentialAutoAcceptType'
import { CredentialEventTypes } from '../../CredentialEvents'
import { CredentialProtocolVersion } from '../../CredentialProtocolVersion'
import { CredentialState } from '../../CredentialState'
import { CredentialUtils } from '../../CredentialUtils'
import { composeAutoAccept } from '../../composeAutoAccept'
import { CredentialProblemReportError, CredentialProblemReportReason } from '../../errors'
import { IndyCredentialFormatService } from '../../formats/indy/IndyCredentialFormatService'
import { CredentialRepository, CredentialMetadataKeys, CredentialExchangeRecord } from '../../repository'
import { CredentialService, RevocationService } from '../../services'

import { V1CredentialPreview } from './V1CredentialPreview'
import {
  V1CredentialAckHandler,
  V1CredentialProblemReportHandler,
  V1IssueCredentialHandler,
  V1OfferCredentialHandler,
  V1ProposeCredentialHandler,
  V1RequestCredentialHandler,
  V1RevocationNotificationHandler,
} from './handlers'
import {
  INDY_CREDENTIAL_ATTACHMENT_ID,
  INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
  INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
  V1ProposeCredentialMessage,
  V1IssueCredentialMessage,
  V1RequestCredentialMessage,
  V1OfferCredentialMessage,
  V1CredentialAckMessage,
} from './messages'

@scoped(Lifecycle.ContainerScoped)
export class V1CredentialService extends CredentialService {
  private connectionService: ConnectionService
  private formatService: IndyCredentialFormatService

  public constructor(
    connectionService: ConnectionService,
    didCommMessageRepository: DidCommMessageRepository,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService,
    dispatcher: Dispatcher,
    eventEmitter: EventEmitter,
    credentialRepository: CredentialRepository,
    formatService: IndyCredentialFormatService,
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
    this.formatService = formatService
  }

  /**
   * Create a {@link ProposeCredentialMessage} not bound to an existing credential exchange.
   * To create a proposal as response to an existing credential exchange, use {@link createProposalAsResponse}.
   *
   * @param proposal The object containing config options
   * @returns Object containing proposal message and associated credential record
   *
   */
  public async createProposal(
    proposal: ProposeCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<V1ProposeCredentialMessage>> {
    const connection = await this.connectionService.getById(proposal.connectionId)
    connection.assertReady()
    if (!proposal.credentialFormats.indy || Object.keys(proposal.credentialFormats).length !== 1) {
      throw new AriesFrameworkError('Only indy proof format is supported for present proof protocol v1')
    }
    let credentialProposal: V1CredentialPreview | undefined

    const credPropose = proposal.credentialFormats.indy?.payload

    if (!credPropose) {
      throw new AriesFrameworkError('Missing credPropose data payload in createProposal')
    }
    if (proposal.credentialFormats.indy?.attributes) {
      credentialProposal = new V1CredentialPreview({ attributes: proposal.credentialFormats.indy?.attributes })
    }

    const config: CredentialProposeOptions = {
      ...credPropose,
      comment: proposal.comment,
      credentialProposal: credentialProposal,
      linkedAttachments: proposal.credentialFormats.indy?.linkedAttachments,
    }

    const options = { ...config }

    const { attachment: filtersAttach } = await this.formatService.createProposal(proposal)

    if (!filtersAttach) {
      throw new AriesFrameworkError('Missing filters attach in Proposal')
    }
    options.attachments = []
    options.attachments?.push(filtersAttach)

    // Create message
    const message = new V1ProposeCredentialMessage(options ?? {})

    // Create record
    const credentialRecord = new CredentialExchangeRecord({
      connectionId: connection.id,
      threadId: message.threadId,
      state: CredentialState.ProposalSent,
      linkedAttachments: config?.linkedAttachments?.map((linkedAttachment) => linkedAttachment.attachment),
      credentialAttributes: message.credentialProposal?.attributes,
      autoAcceptCredential: config?.autoAcceptCredential,
      protocolVersion: CredentialProtocolVersion.V1,
      credentials: [],
    })

    // Set the metadata
    credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
      schemaId: options.schemaId,
      credentialDefinitionId: options.credentialDefinitionId,
    })
    await this.credentialRepository.save(credentialRecord)

    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

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
   * Processing an incoming credential message and create a credential offer as a response
   * @param proposal The object containing config options
   * @param credentialRecord the credential exchange record for this proposal
   * @returns Object containing proposal message and associated credential record
   */
  public async acceptProposal(
    options: AcceptProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialProtocolMsgReturnType<V1OfferCredentialMessage>> {
    if (!options.credentialFormats.indy || Object.keys(options.credentialFormats).length !== 1) {
      throw new AriesFrameworkError('Only indy proof format is supported for present proof protocol v1')
    }
    const proposalCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1ProposeCredentialMessage,
    })

    if (!proposalCredentialMessage?.credentialProposal) {
      throw new AriesFrameworkError(
        `Credential record with id ${options.credentialRecordId} is missing required credential proposal`
      )
    }

    if (!options.credentialFormats) {
      throw new AriesFrameworkError('Missing credential formats in V1 acceptProposal')
    }

    const credentialDefinitionId =
      options.credentialFormats.indy?.credentialDefinitionId ?? proposalCredentialMessage.credentialDefinitionId

    if (!credentialDefinitionId) {
      throw new AriesFrameworkError(
        'Missing required credential definition id. If credential proposal message contains no credential definition id it must be passed to config.'
      )
    }
    const { message } = await this.createOfferAsResponse(credentialRecord, {
      preview: proposalCredentialMessage.credentialProposal,
      credentialDefinitionId,
      comment: options.comment,
      autoAcceptCredential: options.autoAcceptCredential,
      attachments: credentialRecord.linkedAttachments,
    })

    return { credentialRecord, message }
  }

  /**
   * Negotiate a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param credentialOptions configuration for the offer see {@link NegotiateProposalOptions}
   * @param credentialRecord the credential exchange record for this proposal
   * @returns Credential record associated with the credential offer and the corresponding new offer message
   *
   */
  public async negotiateProposal(
    credentialOptions: NegotiateProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialProtocolMsgReturnType<V1OfferCredentialMessage>> {
    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support negotiation.`
      )
    }
    if (!credentialOptions.credentialFormats.indy || Object.keys(credentialOptions.credentialFormats).length !== 1) {
      throw new AriesFrameworkError('Only indy proof format is supported for present proof protocol v1')
    }

    const credentialProposalMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1ProposeCredentialMessage,
    })

    if (!credentialProposalMessage?.credentialProposal) {
      throw new AriesFrameworkError(
        `Credential record with id ${credentialOptions.credentialRecordId} is missing required credential proposal`
      )
    }

    const credentialDefinitionId =
      credentialOptions.credentialFormats.indy?.credentialDefinitionId ??
      credentialProposalMessage.credentialDefinitionId

    if (!credentialDefinitionId) {
      throw new AriesFrameworkError(
        'Missing required credential definition id. If credential proposal message contains no credential definition id it must be passed to config.'
      )
    }

    if (!credentialOptions?.credentialFormats.indy?.attributes) {
      throw new AriesFrameworkError('No proposal attributes in the negotiation options!')
    }
    const newCredentialProposal = new V1CredentialPreview({
      attributes: credentialOptions?.credentialFormats.indy?.attributes,
    })

    const { message } = await this.createOfferAsResponse(credentialRecord, {
      preview: newCredentialProposal,
      credentialDefinitionId,
      comment: credentialOptions.comment,
      autoAcceptCredential: credentialOptions.autoAcceptCredential,
      attachments: credentialRecord.linkedAttachments,
    })
    return { credentialRecord, message }
  }
  /**
   * Process a received {@link ProposeCredentialMessage}. This will not accept the credential proposal
   * or send a credential offer. It will only create a new, or update the existing credential record with
   * the information from the credential proposal message. Use {@link createOfferAsResponse}
   * after calling this method to create a credential offer.
   *
   * @param messageContext The message context containing a credential proposal message
   * @returns credential record associated with the credential proposal message
   *
   */
  public async processProposal(
    messageContext: InboundMessageContext<V1ProposeCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    let credentialRecord: CredentialExchangeRecord
    const { message: proposalMessage, connection } = messageContext

    this.logger.debug(`Processing credential proposal with id ${proposalMessage.id}`)

    try {
      // Credential record already exists
      credentialRecord = await this.getByThreadAndConnectionId(proposalMessage.threadId, connection?.id)
      // Assert
      credentialRecord.assertState(CredentialState.OfferSent)

      const proposalCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V1ProposeCredentialMessage,
      })
      const offerCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V1OfferCredentialMessage,
      })

      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: proposalCredentialMessage ?? undefined,
        previousSentMessage: offerCredentialMessage ?? undefined,
      })

      // Update record
      await this.updateState(credentialRecord, CredentialState.ProposalReceived)
      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: proposalMessage,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialRecord.id,
      })
    } catch {
      // No credential record exists with thread id
      credentialRecord = new CredentialExchangeRecord({
        connectionId: connection?.id,
        threadId: proposalMessage.threadId,
        credentialAttributes: proposalMessage.credentialProposal?.attributes,
        state: CredentialState.ProposalReceived,
        protocolVersion: CredentialProtocolVersion.V1,
        credentials: [],
      })

      credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
        schemaId: proposalMessage.schemaId,
        credentialDefinitionId: proposalMessage.credentialDefinitionId,
      })

      // Assert
      this.connectionService.assertConnectionOrServiceDecorator(messageContext)

      // Save record
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
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialRecord.id,
      })
    }
    return credentialRecord
  }

  /**
   * Create a {@link OfferCredentialMessage} as response to a received credential proposal.
   * To create an offer not bound to an existing credential exchange, use {@link createOffer}.
   *
   * @param credentialRecord The credential record for which to create the credential offer
   * @param credentialTemplate The credential template to use for the offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOfferAsResponse(
    credentialRecord: CredentialExchangeRecord,
    credentialTemplate: CredentialOfferTemplate
  ): Promise<CredentialProtocolMsgReturnType<V1OfferCredentialMessage>> {
    // Assert
    credentialRecord.assertState(CredentialState.ProposalReceived)

    // Create message
    const { credentialDefinitionId, comment, preview, attachments } = credentialTemplate

    const options: ServiceOfferCredentialOptions = {
      attachId: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
      credentialFormats: {
        indy: {
          credentialDefinitionId,
          attributes: preview.attributes,
        },
      },
      protocolVersion: CredentialProtocolVersion.V1,
    }

    const { attachment: offersAttach } = await this.formatService.createOffer(options)

    if (!offersAttach) {
      throw new AriesFrameworkError('No offer attachment for credential')
    }

    const credOffer = offersAttach.getDataAsJson<CredOffer>()

    if (!offersAttach) {
      throw new AriesFrameworkError('Missing offers attach in Offer')
    }

    const offerMessage = new V1OfferCredentialMessage({
      comment,
      offerAttachments: [offersAttach],
      credentialPreview: preview,
      attachments,
    })

    offerMessage.setThread({
      threadId: credentialRecord.threadId,
    })

    credentialRecord.credentialAttributes = preview.attributes
    credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
      schemaId: credOffer.schema_id,
      credentialDefinitionId: credOffer.cred_def_id,
    })
    credentialRecord.linkedAttachments = attachments?.filter((attachment) => isLinkedAttachment(attachment))
    credentialRecord.autoAcceptCredential =
      credentialTemplate.autoAcceptCredential ?? credentialRecord.autoAcceptCredential

    await this.updateState(credentialRecord, CredentialState.OfferSent)

    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: offerMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })
    return { message: offerMessage, credentialRecord }
  }
  /**
   * Process a received {@link RequestCredentialMessage}. This will not accept the credential request
   * or send a credential. It will only update the existing credential record with
   * the information from the credential request message. Use {@link createCredential}
   * after calling this method to create a credential.
   *
   * @param messageContext The message context containing a credential request message
   * @returns credential record associated with the credential request message
   *
   */

  public async negotiateOffer(
    credentialOptions: ProposeCredentialOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialProtocolMsgReturnType<V1ProposeCredentialMessage>> {
    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support negotiation.`
      )
    }
    if (!credentialOptions.credentialFormats.indy || Object.keys(credentialOptions.credentialFormats).length !== 1) {
      throw new AriesFrameworkError('Only indy proof format is supported for present proof protocol v1')
    }

    if (!credentialOptions.credentialFormats.indy?.attributes) {
      throw new AriesFrameworkError('Missing attributes in V1 Negotiate Offer Options')
    }
    const credentialPreview = new V1CredentialPreview({
      attributes: credentialOptions.credentialFormats.indy?.attributes,
    })
    const options: CredentialProposeOptions = {
      credentialProposal: credentialPreview,
    }

    credentialRecord.assertState(CredentialState.OfferReceived)

    // Create message
    const message = new V1ProposeCredentialMessage(options ?? {})

    message.setThread({ threadId: credentialRecord.threadId })

    // Update record
    credentialRecord.credentialAttributes = message.credentialProposal?.attributes
    await this.updateState(credentialRecord, CredentialState.ProposalSent)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

    return { credentialRecord, message }
  }

  /**
   * Create a {@link OfferCredentialMessage} not bound to an existing credential exchange.
   * To create an offer as response to an existing credential exchange, use {@link V1CredentialService#createOfferAsResponse}.
   *
   * @param credentialOptions The options containing config params for creating the credential offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOffer(
    credentialOptions: OfferCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<V1OfferCredentialMessage>> {
    // connection id can be undefined in connection-less scenario
    const connection = credentialOptions.connectionId
      ? await this.connectionService.getById(credentialOptions.connectionId)
      : undefined

    const indy = credentialOptions.credentialFormats.indy

    if (!indy || Object.keys(credentialOptions.credentialFormats).length !== 1) {
      throw new AriesFrameworkError('Only indy proof format is supported for present proof protocol v1')
    }

    if (!indy.attributes || !indy.credentialDefinitionId) {
      throw new AriesFrameworkError('Missing properties from OfferCredentialOptions object: cannot create Offer!')
    }

    const preview: V1CredentialPreview = new V1CredentialPreview({
      attributes: indy.attributes,
    })

    const template: CredentialOfferTemplate = {
      ...credentialOptions,
      preview: preview,
      credentialDefinitionId: indy.credentialDefinitionId,
      linkedAttachments: indy.linkedAttachments,
    }

    const { credentialRecord, message } = await this.createOfferProcessing(template, connection)

    await this.credentialRepository.save(credentialRecord)
    this.eventEmitter.emit<CredentialStateChangedEvent>({
      type: CredentialEventTypes.CredentialStateChanged,
      payload: {
        credentialRecord,
        previousState: null,
      },
    })
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })
    return { credentialRecord, message }
  }

  /**
   * Process a received {@link OfferCredentialMessage}. This will not accept the credential offer
   * or send a credential request. It will only create a new credential record with
   * the information from the credential offer message. Use {@link createRequest}
   * after calling this method to create a credential request.
   *
   * @param messageContext The message context containing a credential request message
   * @returns credential record associated with the credential offer message
   *
   */
  public async processOffer(
    messageContext: HandlerInboundMessage<V1OfferCredentialHandler>
  ): Promise<CredentialExchangeRecord> {
    let credentialRecord: CredentialExchangeRecord
    const { message: offerMessage, connection } = messageContext

    this.logger.debug(`Processing credential offer with id ${offerMessage.id}`)

    const indyCredentialOffer = offerMessage.indyCredentialOffer

    if (!indyCredentialOffer) {
      throw new CredentialProblemReportError(
        `Missing required base64 or json encoded attachment data for credential offer with thread id ${offerMessage.threadId}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    try {
      // Credential record already exists
      credentialRecord = await this.getByThreadAndConnectionId(offerMessage.threadId, connection?.id)

      const proposalCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V1ProposeCredentialMessage,
      })
      const offerCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V1OfferCredentialMessage,
      })

      // Assert
      credentialRecord.assertState(CredentialState.ProposalSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: offerCredentialMessage ?? undefined,
        previousSentMessage: proposalCredentialMessage ?? undefined,
      })

      credentialRecord.linkedAttachments = offerMessage.appendedAttachments?.filter(isLinkedAttachment)

      const attachment = offerCredentialMessage
        ? offerCredentialMessage.getAttachmentById(INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)
        : undefined
      if (attachment) {
        await this.formatService.processOffer(attachment, credentialRecord)
      }

      credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
        schemaId: indyCredentialOffer.schema_id,
        credentialDefinitionId: indyCredentialOffer.cred_def_id,
      })

      await this.updateState(credentialRecord, CredentialState.OfferReceived)
      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: offerMessage,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialRecord.id,
      })
    } catch {
      // No credential record exists with thread id
      credentialRecord = new CredentialExchangeRecord({
        connectionId: connection?.id,
        threadId: offerMessage.id,
        credentialAttributes: offerMessage.credentialPreview.attributes,
        state: CredentialState.OfferReceived,
        protocolVersion: CredentialProtocolVersion.V1,
        credentials: [],
      })

      credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
        schemaId: indyCredentialOffer.schema_id,
        credentialDefinitionId: indyCredentialOffer.cred_def_id,
      })
      // Assert
      this.connectionService.assertConnectionOrServiceDecorator(messageContext)

      // Save in repository
      await this.credentialRepository.save(credentialRecord)
      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: offerMessage,
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

  private async createOfferProcessing(
    credentialTemplate: CredentialOfferTemplate,
    connectionRecord?: ConnectionRecord
  ): Promise<CredentialProtocolMsgReturnType<V1OfferCredentialMessage>> {
    // Assert
    connectionRecord?.assertReady()

    // Create message
    const { credentialDefinitionId, comment, preview, linkedAttachments } = credentialTemplate

    // Create and link credential to attachment
    const credentialPreview = linkedAttachments
      ? CredentialUtils.createAndLinkAttachmentsToPreview(linkedAttachments, preview)
      : preview

    const options: ServiceOfferCredentialOptions = {
      attachId: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
      credentialFormats: {
        indy: {
          credentialDefinitionId,
          attributes: credentialPreview.attributes,
        },
      },
      protocolVersion: CredentialProtocolVersion.V1,
    }

    const { attachment: offersAttach } = await this.formatService.createOffer(options)

    if (!offersAttach) {
      throw new AriesFrameworkError('Missing offers attach in Offer')
    }

    // Construct offer message
    const offerMessage = new V1OfferCredentialMessage({
      comment,
      offerAttachments: [offersAttach],
      credentialPreview,
      attachments: linkedAttachments?.map((linkedAttachment) => linkedAttachment.attachment),
    })

    // Create record
    const credentialRecord = new CredentialExchangeRecord({
      connectionId: connectionRecord?.id,
      threadId: offerMessage.id,
      credentialAttributes: credentialPreview.attributes,
      linkedAttachments: linkedAttachments?.map((linkedAttachments) => linkedAttachments.attachment),
      state: CredentialState.OfferSent,
      autoAcceptCredential: credentialTemplate.autoAcceptCredential,
      protocolVersion: CredentialProtocolVersion.V1,
      credentials: [],
    })

    const offer = offersAttach.getDataAsJson<CredOffer>()
    credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
      credentialDefinitionId: credentialDefinitionId,
      schemaId: offer.schema_id,
    })

    return { message: offerMessage, credentialRecord }
  }

  /**
   * Create a {@link RequestCredentialMessage} as response to a received credential offer.
   *
   * @param record The credential record for which to create the credential request
   * @param options Additional configuration to use for the credential request
   * @returns Object containing request message and associated credential record
   *
   */
  public async createRequest(
    record: CredentialExchangeRecord,
    options: ServiceRequestCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<V1RequestCredentialMessage>> {
    // Assert credential
    record.assertState(CredentialState.OfferReceived)

    const offerCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: record.id,
      messageClass: V1OfferCredentialMessage,
    })

    // remove
    if (!offerCredentialMessage) {
      throw new CredentialProblemReportError(`Missing required credential offer with thread id ${record.threadId}`, {
        problemCode: CredentialProblemReportReason.IssuanceAbandoned,
      })
    }

    const attachment = offerCredentialMessage.getAttachmentById(INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)
    if (attachment) {
      options.offerAttachment = attachment
    } else {
      throw new AriesFrameworkError(`Missing data payload in attachment in credential Record ${record.id}`)
    }
    options.attachId = INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID
    const { attachment: requestAttach } = await this.formatService.createRequest(options, record)
    if (!requestAttach) {
      throw new AriesFrameworkError(`Failed to create attachment for request; credential record = ${record.id}`)
    }

    const requestMessage = new V1RequestCredentialMessage({
      comment: options?.comment,
      requestAttachments: [requestAttach],
      attachments: offerCredentialMessage?.appendedAttachments?.filter((attachment) => isLinkedAttachment(attachment)),
    })
    requestMessage.setThread({ threadId: record.threadId })

    record.autoAcceptCredential = options?.autoAcceptCredential ?? record.autoAcceptCredential

    record.linkedAttachments = offerCredentialMessage?.appendedAttachments?.filter((attachment) =>
      isLinkedAttachment(attachment)
    )
    await this.updateState(record, CredentialState.RequestSent)

    return { message: requestMessage, credentialRecord: record }
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

  public async processRequest(
    messageContext: InboundMessageContext<V1RequestCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: requestMessage, connection } = messageContext

    this.logger.debug(`Processing credential request with id ${requestMessage.id}`)

    const credentialRecord = await this.getByThreadAndConnectionId(requestMessage.threadId, connection?.id)

    const proposalMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1ProposeCredentialMessage,
    })
    const offerMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1OfferCredentialMessage,
    })

    // Assert
    credentialRecord.assertState(CredentialState.OfferSent)

    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: proposalMessage ?? undefined,
      previousSentMessage: offerMessage ?? undefined,
    })

    const requestOptions: RequestCredentialOptions = {
      connectionId: messageContext.connection?.id,
    }
    await this.formatService.processRequest(requestOptions, credentialRecord)

    this.logger.trace('Credential record found when processing credential request', credentialRecord)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: requestMessage,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
    await this.updateState(credentialRecord, CredentialState.RequestReceived)
    return credentialRecord
  }
  /**
   * Create a {@link IssueCredentialMessage} as response to a received credential request.
   *
   * @param record The credential record for which to create the credential
   * @param options Additional configuration to use for the credential
   * @returns Object containing issue credential message and associated credential record
   *
   */
  public async createCredential(
    record: CredentialExchangeRecord,
    options: ServiceAcceptRequestOptions
  ): Promise<CredentialProtocolMsgReturnType<V1IssueCredentialMessage>> {
    // Assert
    record.assertState(CredentialState.RequestReceived)
    const offerMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: record.id,
      messageClass: V1OfferCredentialMessage,
    })
    const requestMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: record.id,
      messageClass: V1RequestCredentialMessage,
    })
    // Assert offer message
    if (!offerMessage) {
      throw new AriesFrameworkError(
        `Missing credential offer for credential exchange with thread id ${record.threadId}`
      )
    }

    if (!requestMessage) {
      throw new AriesFrameworkError(`Missing request message in credential Record ${record.id}`)
    }
    let offerAttachment: Attachment | undefined

    if (offerMessage) {
      offerAttachment = offerMessage.getAttachmentById(INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)
    } else {
      throw new AriesFrameworkError(`Missing data payload in attachment in credential Record ${record.id}`)
    }
    const requestAttachment = requestMessage.getAttachmentById(INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID)

    if (!requestAttachment) {
      throw new AriesFrameworkError('Missing requestAttachment in v1 createCredential')
    }
    options.attachId = INDY_CREDENTIAL_ATTACHMENT_ID

    // Assert credential attributes
    const credentialAttributes = record.credentialAttributes
    if (!credentialAttributes) {
      throw new CredentialProblemReportError(
        `Missing required credential attribute values on credential record with id ${record.id}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    const { attachment: credentialsAttach } = await this.formatService.createCredential(
      options,
      record,
      requestAttachment,
      offerAttachment
    )
    if (!credentialsAttach) {
      throw new AriesFrameworkError(`Failed to create attachment for request; credential record = ${record.id}`)
    }

    const issueMessage = new V1IssueCredentialMessage({
      comment: options?.comment,
      credentialAttachments: [credentialsAttach],
      attachments:
        offerMessage?.appendedAttachments?.filter((attachment) => isLinkedAttachment(attachment)) ||
        requestMessage?.appendedAttachments?.filter((attachment: Attachment) => isLinkedAttachment(attachment)),
    })
    issueMessage.setThread({
      threadId: record.threadId,
    })
    issueMessage.setPleaseAck()

    record.autoAcceptCredential = options?.autoAcceptCredential ?? record.autoAcceptCredential

    await this.updateState(record, CredentialState.CredentialIssued)
    return { message: issueMessage, credentialRecord: record }
  }

  /**
   * Process an incoming {@link IssueCredentialMessage}
   *
   * @param messageContext The message context containing a credential acknowledgement message
   * @returns credential record associated with the credential acknowledgement message
   *
   */
  public async processCredential(
    messageContext: InboundMessageContext<V1IssueCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: issueMessage, connection } = messageContext

    this.logger.debug(`Processing credential with id ${issueMessage.id}`)

    const credentialRecord = await this.getByThreadAndConnectionId(issueMessage.threadId, connection?.id)

    const requestCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1RequestCredentialMessage,
    })
    const offerCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1OfferCredentialMessage,
    })
    // Assert
    credentialRecord.assertState(CredentialState.RequestSent)

    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: offerCredentialMessage ?? undefined,
      previousSentMessage: requestCredentialMessage ?? undefined,
    })

    const credentialRequestMetadata = credentialRecord.metadata.get(CredentialMetadataKeys.IndyRequest)

    if (!credentialRequestMetadata) {
      throw new CredentialProblemReportError(
        `Missing required request metadata for credential with id ${credentialRecord.id}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    const indyCredential = issueMessage.indyCredential
    if (!indyCredential) {
      throw new CredentialProblemReportError(
        `Missing required base64 or json encoded attachment data for credential with thread id ${issueMessage.threadId}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    // get the revocation registry and pass it to the process (store) credential method
    const issueAttachment = issueMessage.getAttachmentById(INDY_CREDENTIAL_ATTACHMENT_ID)
    if (!issueAttachment) {
      throw new AriesFrameworkError('Missing credential attachment in processCredential')
    }
    const options: ServiceAcceptCredentialOptions = {
      credentialAttachment: issueAttachment,
    }

    await this.formatService.processCredential(options, credentialRecord)

    await this.updateState(credentialRecord, CredentialState.CredentialReceived)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: issueMessage,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
    return credentialRecord
  }
  /**
   * Process a received {@link CredentialAckMessage}.
   *
   * @param messageContext The message context containing a credential acknowledgement message
   * @returns credential record associated with the credential acknowledgement message
   *
   */

  /**
   * Create a {@link CredentialAckMessage} as response to a received credential.
   *
   * @param credentialRecord The credential record for which to create the credential acknowledgement
   * @returns Object containing credential acknowledgement message and associated credential record
   *
   */
  public async createAck(
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialProtocolMsgReturnType<V1CredentialAckMessage>> {
    credentialRecord.assertState(CredentialState.CredentialReceived)

    // Create message
    const ackMessage = new V1CredentialAckMessage({
      status: AckStatus.OK,
      threadId: credentialRecord.threadId,
    })

    await this.updateState(credentialRecord, CredentialState.Done)

    return { message: ackMessage, credentialRecord }
  }
  public async processAck(
    messageContext: InboundMessageContext<V1CredentialAckMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: credentialAckMessage, connection } = messageContext

    this.logger.debug(`Processing credential ack with id ${credentialAckMessage.id}`)

    const credentialRecord = await this.getByThreadAndConnectionId(credentialAckMessage.threadId, connection?.id)

    const requestCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1RequestCredentialMessage,
    })
    const issueCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1IssueCredentialMessage,
    })
    // Assert
    credentialRecord.assertState(CredentialState.CredentialIssued)
    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: requestCredentialMessage ?? undefined,
      previousSentMessage: issueCredentialMessage ?? undefined,
    })

    // Update record
    await this.updateState(credentialRecord, CredentialState.Done)

    return credentialRecord
  }

  public registerHandlers() {
    this.dispatcher.registerHandler(
      new V1ProposeCredentialHandler(this, this.agentConfig, this.didCommMessageRepository)
    )
    this.dispatcher.registerHandler(
      new V1OfferCredentialHandler(
        this,
        this.agentConfig,
        this.mediationRecipientService,
        this.didCommMessageRepository
      )
    )
    this.dispatcher.registerHandler(
      new V1RequestCredentialHandler(this, this.agentConfig, this.didCommMessageRepository)
    )
    this.dispatcher.registerHandler(new V1IssueCredentialHandler(this, this.agentConfig, this.didCommMessageRepository))
    this.dispatcher.registerHandler(new V1CredentialAckHandler(this))
    this.dispatcher.registerHandler(new V1CredentialProblemReportHandler(this))

    this.dispatcher.registerHandler(new V1RevocationNotificationHandler(this.revocationService))
  }

  /**
   *
   * Get the version of Issue Credentials according to AIP1.0 or AIP2.0
   * @returns the version of this credential service
   */
  public getVersion(): CredentialProtocolVersion {
    return CredentialProtocolVersion.V1
  }

  /**
   * Negotiate a credential offer as holder (by sending a credential proposal message) to the connection
   * associated with the credential record.
   *
   * @param credentialOptions configuration for the offer see {@link NegotiateProposalOptions}
   * @param credentialRecord the credential exchange record for this proposal
   * @returns Credential record associated with the credential offer and the corresponding new offer message
   *
   */

  // AUTO RESPOND METHODS
  public shouldAutoRespondToCredential(
    credentialRecord: CredentialExchangeRecord,
    credentialMessage: V1IssueCredentialMessage
  ): boolean {
    const formatService: CredentialFormatService = this.getFormatService()

    let credentialAttachment: Attachment | undefined
    if (credentialMessage) {
      credentialAttachment = credentialMessage.getAttachmentById(INDY_CREDENTIAL_ATTACHMENT_ID)
    }
    const handlerOptions: HandlerAutoAcceptOptions = {
      credentialRecord,
      autoAcceptType: this.agentConfig.autoAcceptCredentials,
      credentialAttachment,
    }

    const shouldAutoReturn =
      this.agentConfig.autoAcceptCredentials === AutoAcceptCredential.Always ||
      credentialRecord.autoAcceptCredential === AutoAcceptCredential.Always ||
      formatService.shouldAutoRespondToCredential(handlerOptions)

    return shouldAutoReturn
  }

  public async shouldAutoRespondToProposal(handlerOptions: HandlerAutoAcceptOptions): Promise<boolean> {
    const autoAccept = composeAutoAccept(
      handlerOptions.credentialRecord.autoAcceptCredential,
      handlerOptions.autoAcceptType
    )

    if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return (
        this.areProposalValuesValid(handlerOptions.credentialRecord, handlerOptions.messageAttributes) &&
        this.areProposalAndOfferDefinitionIdEqual(handlerOptions.credentialDefinitionId, handlerOptions.offerAttachment)
      )
    }
    return false
  }
  private areProposalValuesValid(
    credentialRecord: CredentialExchangeRecord,
    proposeMessageAttributes?: CredentialPreviewAttribute[]
  ) {
    const { credentialAttributes } = credentialRecord

    if (proposeMessageAttributes && credentialAttributes) {
      const proposeValues = CredentialUtils.convertAttributesToValues(proposeMessageAttributes)
      const defaultValues = CredentialUtils.convertAttributesToValues(credentialAttributes)
      if (CredentialUtils.checkValuesMatch(proposeValues, defaultValues)) {
        return true
      }
    }
    return false
  }
  private areProposalAndOfferDefinitionIdEqual(proposalCredentialDefinitionId?: string, offerAttachment?: Attachment) {
    let credOffer: CredOffer | undefined

    if (offerAttachment) {
      credOffer = offerAttachment.getDataAsJson<CredOffer>()
    }
    const offerCredentialDefinitionId = credOffer?.cred_def_id
    return proposalCredentialDefinitionId === offerCredentialDefinitionId
  }
  public shouldAutoRespondToRequest(
    credentialRecord: CredentialExchangeRecord,
    requestMessage: V1RequestCredentialMessage,
    proposeMessage?: V1ProposeCredentialMessage,
    offerMessage?: V1OfferCredentialMessage
  ): boolean {
    const formatService: CredentialFormatService = this.getFormatService()

    let proposalAttachment, offerAttachment, requestAttachment: Attachment | undefined

    if (offerMessage) {
      offerAttachment = offerMessage.getAttachmentById(INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)
    }
    if (requestMessage) {
      requestAttachment = requestMessage.getAttachmentById(INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID)
    }
    const handlerOptions: HandlerAutoAcceptOptions = {
      credentialRecord,
      autoAcceptType: this.agentConfig.autoAcceptCredentials,
      proposalAttachment,
      offerAttachment,
      requestAttachment,
    }
    const shouldAutoReturn =
      this.agentConfig.autoAcceptCredentials === AutoAcceptCredential.Always ||
      credentialRecord.autoAcceptCredential === AutoAcceptCredential.Always ||
      formatService.shouldAutoRespondToRequest(handlerOptions)

    return shouldAutoReturn
  }

  public shouldAutoRespondToOffer(
    credentialRecord: CredentialExchangeRecord,
    offerMessage: V1OfferCredentialMessage,
    proposeMessage?: V1ProposeCredentialMessage
  ): boolean {
    const formatService: CredentialFormatService = this.getFormatService()
    let proposalAttachment: Attachment | undefined

    const offerAttachment = offerMessage.getAttachmentById(INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)
    if (proposeMessage && proposeMessage.appendedAttachments) {
      proposalAttachment = proposeMessage.getAttachment()
    }
    const offerValues = offerMessage.credentialPreview?.attributes

    const handlerOptions: HandlerAutoAcceptOptions = {
      credentialRecord,
      autoAcceptType: this.agentConfig.autoAcceptCredentials,
      messageAttributes: offerValues,
      proposalAttachment,
      offerAttachment,
    }
    const shouldAutoReturn =
      this.agentConfig.autoAcceptCredentials === AutoAcceptCredential.Always ||
      credentialRecord.autoAcceptCredential === AutoAcceptCredential.Always ||
      formatService.shouldAutoRespondToProposal(handlerOptions)

    return shouldAutoReturn
  }

  // REPOSITORY METHODS

  public async getOfferMessage(id: string): Promise<AgentMessage | null> {
    return await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: id,
      messageClass: V1OfferCredentialMessage,
    })
  }

  public async getRequestMessage(id: string): Promise<AgentMessage | null> {
    return await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: id,
      messageClass: V1RequestCredentialMessage,
    })
  }

  public async getCredentialMessage(id: string): Promise<AgentMessage | null> {
    return await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: id,
      messageClass: V1IssueCredentialMessage,
    })
  }

  public getFormats(): CredentialFormatService[] {
    throw new Error('Method not implemented.')
  }

  public getFormatService(): CredentialFormatService {
    return this.formatService
  }
}
