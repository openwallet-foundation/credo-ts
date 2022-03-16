import type { AgentMessage } from '../../../../agent/AgentMessage'
import type { HandlerInboundMessage } from '../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { ConnectionRecord } from '../../../connections'
import type { CredentialStateChangedEvent } from '../../CredentialEvents'
import type {
  CredentialOfferTemplate,
  CredentialProposeOptions,
  CredentialProtocolMsgReturnType,
  ServiceAcceptOfferOptions,
  ServiceAcceptRequestOptions,
  ServiceRequestCredentialOptions,
} from '../../CredentialServiceOptions'
import type { CredentialFormatService } from '../../formats/CredentialFormatService'
import type { CredProposeOfferRequestFormat } from '../../formats/models/CredentialFormatServiceOptions'
import type {
  AcceptProposalOptions,
  CredentialFormatType,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
} from '../../interfaces'
import type { CredPropose } from './models/CredentialFormatOptions'
import type { CredOffer } from 'indy-sdk'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../../agent/AgentConfig'
import { Dispatcher } from '../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { ServiceDecorator } from '../../../../decorators/service/ServiceDecorator'
import { AriesFrameworkError } from '../../../../error'
import { ConsoleLogger, LogLevel } from '../../../../logger'
import { DidCommMessageRepository, DidCommMessageRole } from '../../../../storage'
import { isLinkedAttachment } from '../../../../utils/attachment'
import { uuid } from '../../../../utils/uuid'
import { AckStatus } from '../../../common'
import { ConnectionService } from '../../../connections/services/ConnectionService'
import { IndyHolderService, IndyIssuerService } from '../../../indy'
import { IndyLedgerService } from '../../../ledger'
import { MediationRecipientService } from '../../../routing'
import { CredentialEventTypes } from '../../CredentialEvents'
import { CredentialProtocolVersion } from '../../CredentialProtocolVersion'
import { CredentialService } from '../../CredentialService'
import { CredentialState } from '../../CredentialState'
import { CredentialUtils } from '../../CredentialUtils'
import { CredentialProblemReportError, CredentialProblemReportReason } from '../../errors'
import { IndyCredentialFormatService } from '../../formats/indy/IndyCredentialFormatService'
import { CredentialRecordType } from '../../interfaces'
import { CredentialRepository, CredentialMetadataKeys, CredentialExchangeRecord } from '../../repository'

import { V1CredentialPreview } from './V1CredentialPreview'
import {
  V1CredentialAckHandler,
  V1CredentialProblemReportHandler,
  V1IssueCredentialHandler,
  V1OfferCredentialHandler as V1OfferCredentialHandler,
  V1RequestCredentialHandler,
} from './handlers'
import { V1ProposeCredentialHandler } from './handlers/V1ProposeCredentialHandler'
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

const logger = new ConsoleLogger(LogLevel.info)

@scoped(Lifecycle.ContainerScoped)
export class V1CredentialService extends CredentialService {
  private connectionService: ConnectionService
  private indyIssuerService: IndyIssuerService
  private indyLedgerService: IndyLedgerService
  private indyHolderService: IndyHolderService
  private formatService: IndyCredentialFormatService

  public constructor(
    connectionService: ConnectionService,
    didCommMessageRepository: DidCommMessageRepository,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService,
    dispatcher: Dispatcher,
    eventEmitter: EventEmitter,
    credentialRepository: CredentialRepository,
    indyIssuerService: IndyIssuerService,
    indyLedgerService: IndyLedgerService,
    indyHolderService: IndyHolderService
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
    this.indyIssuerService = indyIssuerService
    this.indyLedgerService = indyLedgerService
    this.indyHolderService = indyHolderService
    this.formatService = new IndyCredentialFormatService(
      credentialRepository,
      eventEmitter,
      indyIssuerService,
      indyLedgerService,
      indyHolderService,
      connectionService
    )
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
  public async processCredential(
    messageContext: InboundMessageContext<V1IssueCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: issueMessage, connection } = messageContext

    logger.debug(`Processing credential with id ${issueMessage.id}`)

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
      previousReceivedMessage: offerCredentialMessage ? offerCredentialMessage : undefined,
      previousSentMessage: requestCredentialMessage ? requestCredentialMessage : undefined,
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

    const credentialDefinition = await this.indyLedgerService.getCredentialDefinition(indyCredential.cred_def_id)

    const credentialId = await this.indyHolderService.storeCredential({
      credentialId: uuid(),
      credentialRequestMetadata,
      credential: indyCredential,
      credentialDefinition,
    })
    credentialRecord.credentials.push({
      credentialRecordType: CredentialRecordType.Indy,
      credentialRecordId: credentialId,
    })
    await this.updateState(credentialRecord, CredentialState.CredentialReceived)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: issueMessage,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
    return credentialRecord
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
  public async processRequest(
    messageContext: InboundMessageContext<V1RequestCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: requestMessage, connection } = messageContext

    logger.debug(`Processing credential request with id ${requestMessage.id}`)

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
      previousReceivedMessage: proposalMessage ? proposalMessage : undefined,
      previousSentMessage: offerMessage ? offerMessage : undefined,
    })

    logger.trace('Credential record found when processing credential request', credentialRecord)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: requestMessage,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
    await this.updateState(credentialRecord, CredentialState.RequestReceived)

    return credentialRecord
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
  public async createProposalAsResponse(
    credentialRecord: CredentialExchangeRecord,
    options: CredentialProposeOptions
  ): Promise<CredentialProtocolMsgReturnType<V1ProposeCredentialMessage>> {
    // Assert
    credentialRecord.assertState(CredentialState.OfferReceived)

    // Create message
    const proposalMessage = new V1ProposeCredentialMessage(options ?? {})

    proposalMessage.setThread({ threadId: credentialRecord.threadId })

    // Update record
    credentialRecord.credentialAttributes = proposalMessage.credentialProposal?.attributes
    this.updateState(credentialRecord, CredentialState.ProposalSent)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: proposalMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

    return { message: proposalMessage, credentialRecord }
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

    logger.debug(`Processing credential offer with id ${offerMessage.id}`)

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
        previousReceivedMessage: offerCredentialMessage ? offerCredentialMessage : undefined,
        previousSentMessage: proposalCredentialMessage ? proposalCredentialMessage : undefined,
      })

      credentialRecord.linkedAttachments = offerMessage.appendedAttachments?.filter(isLinkedAttachment)

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
    const options: ServiceAcceptOfferOptions = {
      attachId: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
      credentialRecordId: '',
      credentialFormats: {
        indy: {
          credentialDefinitionId,
        },
        w3c: undefined,
      },
    }
    const { attachment: offersAttach } = await this.formatService.createOffer(options)

    if (!offersAttach) {
      throw new AriesFrameworkError('Missing offers attach in Offer')
    }

    // Create and link credential to attacment
    const credentialPreview = linkedAttachments
      ? CredentialUtils.createAndLinkAttachmentsToPreview(linkedAttachments, preview)
      : preview

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
    })

    const offer = offersAttach.getDataAsJson<CredOffer>()
    credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
      credentialDefinitionId: credentialDefinitionId,
      schemaId: offer.schema_id,
    })

    return { message: offerMessage, credentialRecord }
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
    if (offerMessage) {
      options.offerAttachment = offerMessage.getAttachmentById(INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)
    } else {
      throw new AriesFrameworkError(`Missing data payload in attachment in credential Record ${record.id}`)
    }
    options.requestAttachment = requestMessage.getAttachmentIncludingFormatId(INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID)
    options.attachId = INDY_CREDENTIAL_ATTACHMENT_ID

    // Assert credential attributes
    const credentialAttributes = record.credentialAttributes
    if (!credentialAttributes) {
      throw new CredentialProblemReportError(
        `Missing required credential attribute values on credential record with id ${record.id}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    const { attachment: credentialsAttach } = await this.formatService.createCredential(options, record)
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
   * Process a received {@link CredentialAckMessage}.
   *
   * @param messageContext The message context containing a credential acknowledgement message
   * @returns credential record associated with the credential acknowledgement message
   *
   */
  public async processAck(
    messageContext: InboundMessageContext<V1CredentialAckMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: credentialAckMessage, connection } = messageContext

    logger.debug(`Processing credential ack with id ${credentialAckMessage.id}`)

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
      previousReceivedMessage: requestCredentialMessage ? requestCredentialMessage : undefined,
      previousSentMessage: issueCredentialMessage ? issueCredentialMessage : undefined,
    })

    // Update record
    await this.updateState(credentialRecord, CredentialState.Done)

    return credentialRecord
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

    logger.debug(`Processing credential proposal with id ${proposalMessage.id}`)

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
        previousReceivedMessage: proposalCredentialMessage ? proposalCredentialMessage : undefined,
        previousSentMessage: offerCredentialMessage ? offerCredentialMessage : undefined,
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

    const credOffer = await this.indyIssuerService.createCredentialOffer(credentialDefinitionId)
    const options: ServiceAcceptOfferOptions = {
      attachId: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
      credentialRecordId: '',
      credentialFormats: {
        indy: {
          credentialDefinitionId,
        },
        w3c: undefined,
      },
    }

    const { attachment: offersAttach } = await this.formatService.createOffer(options)

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
   * Create a {@link ProposeCredentialMessage} not bound to an existing credential exchange.
   * To create a proposal as response to an existing credential exchange, use {@link createProposalAsResponse}.
   *
   * @param proposal The object containing config options
   * @returns Object containing proposal message and associated credential record
   *
   */
  public async createProposal(
    proposal: ProposeCredentialOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    const connection = await this.connectionService.getById(proposal.connectionId)
    connection.assertReady()

    let credentialProposal: V1CredentialPreview | undefined

    const credPropose: CredPropose = proposal.credentialFormats.indy?.payload.credentialPayload as CredPropose

    if (credPropose.attributes) {
      credentialProposal = new V1CredentialPreview({ attributes: credPropose.attributes })
    }

    const config: CredentialProposeOptions = {
      credentialProposal: credentialProposal,
      credentialDefinitionId: credPropose.credentialDefinitionId,
      linkedAttachments: credPropose.linkedAttachments,
      schemaId: credPropose.schemaId,
    }

    // MJR-TODO flip these params around to save a line of code

    const options = { ...config }

    const { attachment: filtersAttach } = this.formatService.createProposal(proposal)

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
    proposal: AcceptProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support credential proposal or negotiation.`
      )
    }
    const proposalCredentialMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1ProposeCredentialMessage,
    })

    if (!proposalCredentialMessage?.credentialProposal) {
      throw new AriesFrameworkError(
        `Credential record with id ${proposal.credentialRecordId} is missing required credential proposal`
      )
    }

    const credentialDefinitionId =
      proposal.credentialFormats.indy?.credentialDefinitionId ?? proposalCredentialMessage.credentialDefinitionId

    if (!credentialDefinitionId) {
      throw new AriesFrameworkError(
        'Missing required credential definition id. If credential proposal message contains no credential definition id it must be passed to config.'
      )
    }
    const { message } = await this.createOfferAsResponse(credentialRecord, {
      preview: proposalCredentialMessage.credentialProposal,
      credentialDefinitionId,
      comment: proposal.comment,
      autoAcceptCredential: proposal.autoAcceptCredential,
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
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support negotiation.`
      )
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

    let newCredentialProposal: V1CredentialPreview
    if (credentialOptions?.credentialFormats.indy?.attributes) {
      newCredentialProposal = new V1CredentialPreview({
        attributes: credentialOptions?.credentialFormats.indy?.attributes,
      })
    } else {
      throw new AriesFrameworkError('No proposal attributes in the negotiation options!')
    }

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
   * Negotiate a credential offer as holder (by sending a credential proposal message) to the connection
   * associated with the credential record.
   *
   * @param credentialOptions configuration for the offer see {@link NegotiateProposalOptions}
   * @param credentialRecord the credential exchange record for this proposal
   * @returns Credential record associated with the credential offer and the corresponding new offer message
   *
   */
  public async negotiateOffer(
    credentialOptions: ProposeCredentialOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support negotiation.`
      )
    }
    let credentialPreview: V1CredentialPreview
    const proposal: CredPropose = credentialOptions.credentialFormats.indy?.payload.credentialPayload as CredPropose
    if (proposal.attributes) {
      credentialPreview = new V1CredentialPreview({
        attributes: proposal.attributes,
      })
      const options: CredentialProposeOptions = {
        credentialProposal: credentialPreview,
      }
      const { message } = await this.createProposalAsResponse(credentialRecord, options)
      return { credentialRecord, message }
    }
    throw new AriesFrameworkError('Missing attributes in V1 Negotiate Offer Options')
  }

  public async createOutOfBandOffer(
    credentialOptions: OfferCredentialOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    if (!credentialOptions.credentialFormats.indy?.credentialDefinitionId) {
      throw new AriesFrameworkError('Missing credential definition id for out of band credential')
    }
    const v1Preview = new V1CredentialPreview({
      attributes: credentialOptions.credentialFormats.indy?.attributes,
    })
    const template: CredentialOfferTemplate = {
      credentialDefinitionId: credentialOptions.credentialFormats.indy?.credentialDefinitionId,
      comment: credentialOptions.comment,
      preview: v1Preview,
      autoAcceptCredential: credentialOptions.autoAcceptCredential,
    }

    const { credentialRecord, message } = await this.createOfferProcessing(template)

    // Create and set ~service decorator
    const routing = await this.mediationRecipientService.getRouting()
    message.service = new ServiceDecorator({
      serviceEndpoint: routing.endpoints[0],
      recipientKeys: [routing.verkey],
      routingKeys: routing.routingKeys,
    })
    await this.credentialRepository.save(credentialRecord)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: message,
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
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    if (!credentialOptions.connectionId) {
      throw new AriesFrameworkError('Connection id missing from offer credential options')
    }
    const connection = await this.connectionService.getById(credentialOptions.connectionId)

    if (
      credentialOptions?.credentialFormats.indy?.attributes &&
      credentialOptions?.credentialFormats.indy?.credentialDefinitionId
    ) {
      const preview: V1CredentialPreview = new V1CredentialPreview({
        attributes: credentialOptions.credentialFormats.indy?.attributes,
      })

      const linkedAttachments = credentialOptions.credentialFormats.indy?.linkedAttachments

      const template: CredentialOfferTemplate = {
        ...credentialOptions,
        preview: preview,
        credentialDefinitionId: credentialOptions?.credentialFormats.indy?.credentialDefinitionId,
        linkedAttachments,
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
      return { credentialRecord, message }
    }

    throw new AriesFrameworkError('Missing properties from OfferCredentialOptions object: cannot create Offer!')
  }

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getFormats(credentialFormats: CredProposeOfferRequestFormat): CredentialFormatService[] {
    throw new Error('Method not implemented.')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getFormatService(credentialFormatType?: CredentialFormatType): CredentialFormatService {
    return new IndyCredentialFormatService(
      this.credentialRepository,
      this.eventEmitter,
      this.indyIssuerService,
      this.indyLedgerService,
      this.indyHolderService,
      this.connectionService
    )
  }
}
