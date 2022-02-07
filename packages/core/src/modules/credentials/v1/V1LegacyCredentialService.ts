import type { AgentMessage } from '../../../agent/AgentMessage'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../logger'
import type { LinkedAttachment } from '../../../utils/LinkedAttachment'
import type { ConnectionRecord } from '../../connections'
import type { AutoAcceptCredential } from '../CredentialAutoAcceptType'
import type { CredentialStateChangedEvent } from '../CredentialEvents'
import type { CredentialProblemReportMessage, ProposeCredentialMessageOptions } from './messages'
import type { CredOffer } from 'indy-sdk'

import { Lifecycle, scoped } from 'tsyringe'

import { DidCommMessageRepository, DidCommMessageRole } from '../../../../src/storage'
import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../error'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { isLinkedAttachment } from '../../../utils/attachment'
import { uuid } from '../../../utils/uuid'
import { AckStatus } from '../../common'
import { ConnectionService } from '../../connections/services/ConnectionService'
import { IndyHolderService, IndyIssuerService } from '../../indy'
import { IndyLedgerService } from '../../ledger/services/IndyLedgerService'
import { CredentialEventTypes } from '../CredentialEvents'
import { CredentialState } from '../CredentialState'
import { CredentialUtils } from '../CredentialUtils'
import { CredentialProblemReportError, CredentialProblemReportReason } from '../errors'
import { CredentialRepository } from '../repository'
import { CredentialExchangeRecord } from '../repository/CredentialRecord'
import { CredentialMetadataKeys } from '../repository/credentialMetadataTypes'

import { V1CredentialPreview } from './V1CredentialPreview'
import {
  CredentialAckMessage,
  INDY_CREDENTIAL_ATTACHMENT_ID,
  INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
  INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
  IssueCredentialMessage,
  OfferCredentialMessage,
  ProposeCredentialMessage,
  RequestCredentialMessage,
} from './messages'

@scoped(Lifecycle.ContainerScoped)
export class V1LegacyCredentialService {
  private credentialRepository: CredentialRepository
  private connectionService: ConnectionService
  private ledgerService: IndyLedgerService
  private logger: Logger
  private indyIssuerService: IndyIssuerService
  private indyHolderService: IndyHolderService
  private eventEmitter: EventEmitter
  private didCommMessageRepository: DidCommMessageRepository

  public constructor(
    credentialRepository: CredentialRepository,
    connectionService: ConnectionService,
    ledgerService: IndyLedgerService,
    agentConfig: AgentConfig,
    indyIssuerService: IndyIssuerService,
    indyHolderService: IndyHolderService,
    eventEmitter: EventEmitter,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialRepository = credentialRepository
    this.connectionService = connectionService
    this.ledgerService = ledgerService
    this.logger = agentConfig.logger
    this.indyIssuerService = indyIssuerService
    this.indyHolderService = indyHolderService
    this.eventEmitter = eventEmitter
    this.didCommMessageRepository = didCommMessageRepository
  }

  /**
   * Create a {@link ProposeCredentialMessage} not bound to an existing credential exchange.
   * To create a proposal as response to an existing credential exchange, use {@link V1LegacyCredentialService#createProposalAsResponse}.
   *
   * @param connectionRecord The connection for which to create the credential proposal
   * @param config Additional configuration to use for the proposal
   * @returns Object containing proposal message and associated credential record
   *
   */
  public async createProposal(
    connectionRecord: ConnectionRecord,
    config?: CredentialProposeOptions
  ): Promise<CredentialProtocolMsgReturnType<ProposeCredentialMessage>> {
    // Assert
    connectionRecord.assertReady()

    const options = { ...config }

    // Add the linked attachments to the credentialProposal
    if (config?.linkedAttachments) {
      options.credentialProposal = CredentialUtils.createAndLinkAttachmentsToPreview(
        config.linkedAttachments,
        config.credentialProposal ?? new V1CredentialPreview({ attributes: [] })
      )
      options.attachments = config.linkedAttachments.map((linkedAttachment) => linkedAttachment.attachment)
    }

    // Create message
    const proposalMessage = new ProposeCredentialMessage(options ?? {})

    // Create record
    const credentialRecord = new CredentialExchangeRecord({
      connectionId: connectionRecord.id,
      threadId: proposalMessage.threadId,
      state: CredentialState.ProposalSent,
      linkedAttachments: config?.linkedAttachments?.map((linkedAttachment) => linkedAttachment.attachment),
      credentialAttributes: proposalMessage.credentialProposal?.attributes,
      autoAcceptCredential: config?.autoAcceptCredential,
    })

    // Set the metadata
    credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
      schemaId: options.schemaId,
      credentialDefinitionId: options.credentialDefinitionId,
    })
    await this.credentialRepository.save(credentialRecord)

    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: proposalMessage,
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

    return { message: proposalMessage, credentialRecord }
  }

  /**
   * Create a {@link ProposePresentationMessage} as response to a received credential offer.
   * To create a proposal not bound to an existing credential exchange, use {@link V1LegacyCredentialService#createProposal}.
   *
   * @param credentialRecord The credential record for which to create the credential proposal
   * @param config Additional configuration to use for the proposal
   * @returns Object containing proposal message and associated credential record
   *
   */
  public async createProposalAsResponse(
    credentialRecord: CredentialExchangeRecord,
    config?: CredentialProposeOptions
  ): Promise<CredentialProtocolMsgReturnType<ProposeCredentialMessage>> {
    // Assert
    credentialRecord.assertState(CredentialState.OfferReceived)

    // Create message
    const proposalMessage = new ProposeCredentialMessage(config ?? {})

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
   * Process a received {@link ProposeCredentialMessage}. This will not accept the credential proposal
   * or send a credential offer. It will only create a new, or update the existing credential record with
   * the information from the credential proposal message. Use {@link V1LegacyCredentialService#createOfferAsResponse}
   * after calling this method to create a credential offer.
   *
   * @param messageContext The message context containing a credential proposal message
   * @returns credential record associated with the credential proposal message
   *
   */
  public async processProposal(
    messageContext: InboundMessageContext<ProposeCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    let credentialRecord: CredentialExchangeRecord
    const { message: proposalMessage, connection } = messageContext

    this.logger.debug(`Processing credential proposal with id ${proposalMessage.id}`)

    try {
      // Credential record already exists
      credentialRecord = await this.getByThreadAndConnectionId(proposalMessage.threadId, connection?.id)
      // Assert
      credentialRecord.assertState(CredentialState.OfferSent)

      let proposalCredentialMessage, offerCredentialMessage
      try {
        proposalCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
          associatedRecordId: credentialRecord.id,
          messageClass: ProposeCredentialMessage,
        })
        offerCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
          associatedRecordId: credentialRecord.id,
          messageClass: OfferCredentialMessage,
        })
      } catch (RecordNotFoundError) {
        // record not found - expected (sometimes)
      }
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: proposalCredentialMessage,
        previousSentMessage: offerCredentialMessage,
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
   * To create an offer not bound to an existing credential exchange, use {@link V1LegacyCredentialService#createOffer}.
   *
   * @param credentialRecord The credential record for which to create the credential offer
   * @param credentialTemplate The credential template to use for the offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOfferAsResponse(
    credentialRecord: CredentialExchangeRecord,
    credentialTemplate: CredentialOfferTemplate
  ): Promise<CredentialProtocolMsgReturnType<OfferCredentialMessage>> {
    // Assert
    credentialRecord.assertState(CredentialState.ProposalReceived)

    // Create message
    const { credentialDefinitionId, comment, preview, attachments } = credentialTemplate

    const credOffer = await this.indyIssuerService.createCredentialOffer(credentialDefinitionId)
    const offerAttachment = new Attachment({
      id: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(credOffer),
      }),
    })

    const offerMessage = new OfferCredentialMessage({
      comment,
      offerAttachments: [offerAttachment],
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
   * Create a {@link OfferCredentialMessage} not bound to an existing credential exchange.
   * To create an offer as response to an existing credential exchange, use {@link V1LegacyCredentialService#createOfferAsResponse}.
   *
   * @param connectionRecord The connection for which to create the credential offer
   * @param credentialTemplate The credential template to use for the offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOffer(
    credentialTemplate: CredentialOfferTemplate,
    connectionRecord?: ConnectionRecord
  ): Promise<CredentialProtocolMsgReturnType<OfferCredentialMessage>> {
    // Assert
    connectionRecord?.assertReady()

    // Create message
    const { credentialDefinitionId, comment, preview, linkedAttachments } = credentialTemplate
    const credOffer = await this.indyIssuerService.createCredentialOffer(credentialDefinitionId)
    const offerAttachment = new Attachment({
      id: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(credOffer),
      }),
    })

    // Create and link credential to attacment
    const credentialPreview = linkedAttachments
      ? CredentialUtils.createAndLinkAttachmentsToPreview(linkedAttachments, preview)
      : preview

    // Construct offer message
    const offerMessage = new OfferCredentialMessage({
      comment,
      offerAttachments: [offerAttachment],
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
    })

    credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
      credentialDefinitionId: credOffer.cred_def_id,
      schemaId: credOffer.schema_id,
    })

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

    return { message: offerMessage, credentialRecord }
  }

  /**
   * Process a received {@link OfferCredentialMessage}. This will not accept the credential offer
   * or send a credential request. It will only create a new credential record with
   * the information from the credential offer message. Use {@link V1LegacyCredentialService#createRequest}
   * after calling this method to create a credential request.
   *
   * @param messageContext The message context containing a credential request message
   * @returns credential record associated with the credential offer message
   *
   */
  public async processOffer(
    messageContext: InboundMessageContext<OfferCredentialMessage>
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

      let proposalCredentialMessage, offerCredentialMessage

      try {
        proposalCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
          associatedRecordId: credentialRecord.id,
          messageClass: ProposeCredentialMessage,
        })
        offerCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
          associatedRecordId: credentialRecord.id,
          messageClass: OfferCredentialMessage,
        })
      } catch (error) {
        // record not found error - MJR-TODO is this ok?
      }

      // Assert
      credentialRecord.assertState(CredentialState.ProposalSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: offerCredentialMessage,
        previousSentMessage: proposalCredentialMessage,
      })

      credentialRecord.linkedAttachments = offerMessage.messageAttachment?.filter(isLinkedAttachment)

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

  /**
   * Create a {@link RequestCredentialMessage} as response to a received credential offer.
   *
   * @param credentialRecord The credential record for which to create the credential request
   * @param options Additional configuration to use for the credential request
   * @returns Object containing request message and associated credential record
   *
   */
  public async createRequest(
    credentialRecord: CredentialExchangeRecord,
    options: CredentialRequestOptions
  ): Promise<CredentialProtocolMsgReturnType<RequestCredentialMessage>> {
    // Assert credential
    credentialRecord.assertState(CredentialState.OfferReceived)

    const offerCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: OfferCredentialMessage,
    })

    const credentialOffer: CredOffer | null = offerCredentialMessage?.indyCredentialOffer
    if (!offerCredentialMessage || !credentialOffer) {
      throw new CredentialProblemReportError(
        `Missing required base64 or json encoded attachment data for credential offer with thread id ${credentialRecord.threadId}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }
    const credentialDefinition = await this.ledgerService.getCredentialDefinition(credentialOffer.cred_def_id)

    const [credReq, credReqMetadata] = await this.indyHolderService.createCredentialRequest({
      holderDid: options.holderDid,
      credentialOffer,
      credentialDefinition,
    })

    const requestAttachment = new Attachment({
      id: INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(credReq),
      }),
    })

    const requestMessage = new RequestCredentialMessage({
      comment: options?.comment,
      requestAttachments: [requestAttachment],
      attachments: offerCredentialMessage?.messageAttachment?.filter((attachment) => isLinkedAttachment(attachment)),
    })
    requestMessage.setThread({ threadId: credentialRecord.threadId })

    credentialRecord.metadata.set(CredentialMetadataKeys.IndyRequest, credReqMetadata)
    credentialRecord.autoAcceptCredential = options?.autoAcceptCredential ?? credentialRecord.autoAcceptCredential

    credentialRecord.linkedAttachments = offerCredentialMessage?.messageAttachment?.filter((attachment) =>
      isLinkedAttachment(attachment)
    )
    await this.updateState(credentialRecord, CredentialState.RequestSent)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: requestMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

    return { message: requestMessage, credentialRecord }
  }

  /**
   * Process a received {@link RequestCredentialMessage}. This will not accept the credential request
   * or send a credential. It will only update the existing credential record with
   * the information from the credential request message. Use {@link V1LegacyCredentialService#createCredential}
   * after calling this method to create a credential.
   *
   * @param messageContext The message context containing a credential request message
   * @returns credential record associated with the credential request message
   *
   */
  public async processRequest(
    messageContext: InboundMessageContext<RequestCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: requestMessage, connection } = messageContext

    this.logger.debug(`Processing credential request with id ${requestMessage.id}`)

    const indyCredentialRequest = requestMessage?.indyCredentialRequest

    if (!indyCredentialRequest) {
      throw new CredentialProblemReportError(
        `Missing required base64 or json encoded attachment data for credential request with thread id ${requestMessage.threadId}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    const credentialRecord = await this.getByThreadAndConnectionId(requestMessage.threadId, connection?.id)
    let proposalCredentialMessage, offerCredentialMessage
    try {
      proposalCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: ProposeCredentialMessage,
      })
    } catch {
      // record not found - this can happen
    }
    try {
      offerCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: OfferCredentialMessage,
      })
    } catch (error) {
      // record not found - this can happen
    }
    // Assert
    credentialRecord.assertState(CredentialState.OfferSent)
    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: proposalCredentialMessage,
      previousSentMessage: offerCredentialMessage,
    })

    this.logger.debug('Credential record found when processing credential request', credentialRecord)
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
   * @param credentialRecord The credential record for which to create the credential
   * @param options Additional configuration to use for the credential
   * @returns Object containing issue credential message and associated credential record
   *
   */
  public async createCredential(
    credentialRecord: CredentialExchangeRecord,
    options?: CredentialResponseOptions
  ): Promise<CredentialProtocolMsgReturnType<IssueCredentialMessage>> {
    // Assert
    credentialRecord.assertState(CredentialState.RequestReceived)
    const offerMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: OfferCredentialMessage,
    })
    const requestMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: RequestCredentialMessage,
    })
    // Assert offer message
    if (!offerMessage) {
      throw new AriesFrameworkError(
        `Missing credential offer for credential exchange with thread id ${credentialRecord.threadId}`
      )
    }

    // Assert credential attributes
    const credentialAttributes = credentialRecord.credentialAttributes
    if (!credentialAttributes) {
      throw new CredentialProblemReportError(
        `Missing required credential attribute values on credential record with id ${credentialRecord.id}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    // Assert Indy offer
    const indyCredentialOffer = offerMessage?.indyCredentialOffer
    if (!indyCredentialOffer) {
      throw new CredentialProblemReportError(
        `Missing required base64 or json encoded attachment data for credential offer with thread id ${credentialRecord.threadId}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    // Assert Indy request
    const indyCredentialRequest = requestMessage?.indyCredentialRequest
    if (!indyCredentialRequest) {
      throw new CredentialProblemReportError(
        `Missing required base64 or json encoded attachment data for credential request with thread id ${credentialRecord.threadId}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    const [credential] = await this.indyIssuerService.createCredential({
      credentialOffer: indyCredentialOffer,
      credentialRequest: indyCredentialRequest,
      credentialValues: CredentialUtils.convertAttributesToValues(credentialAttributes),
    })

    const credentialAttachment = new Attachment({
      id: INDY_CREDENTIAL_ATTACHMENT_ID,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(credential),
      }),
    })

    const issueMessage = new IssueCredentialMessage({
      comment: options?.comment,
      credentialAttachments: [credentialAttachment],
      attachments:
        offerMessage?.messageAttachment?.filter((attachment) => isLinkedAttachment(attachment)) ||
        requestMessage?.messageAttachment?.filter((attachment: Attachment) => isLinkedAttachment(attachment)),
    })
    issueMessage.setThread({
      threadId: credentialRecord.threadId,
    })
    issueMessage.setPleaseAck()

    credentialRecord.autoAcceptCredential = options?.autoAcceptCredential ?? credentialRecord.autoAcceptCredential

    await this.updateState(credentialRecord, CredentialState.CredentialIssued)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: issueMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })
    return { message: issueMessage, credentialRecord }
  }

  /**
   * Process a received {@link IssueCredentialMessage}. This will not accept the credential
   * or send a credential acknowledgement. It will only update the existing credential record with
   * the information from the issue credential message. Use {@link V1LegacyCredentialService#createAck}
   * after calling this method to create a credential acknowledgement.
   *
   * @param messageContext The message context containing an issue credential message
   *
   * @returns credential record associated with the issue credential message
   *
   */
  public async processCredential(
    messageContext: InboundMessageContext<IssueCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: issueMessage, connection } = messageContext

    this.logger.debug(`Processing credential with id ${issueMessage.id}`)

    const credentialRecord = await this.getByThreadAndConnectionId(issueMessage.threadId, connection?.id)

    const requestCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: RequestCredentialMessage,
    })
    const offerCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: OfferCredentialMessage,
    })
    // Assert
    credentialRecord.assertState(CredentialState.RequestSent)
    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: offerCredentialMessage,
      previousSentMessage: requestCredentialMessage,
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

    const credentialDefinition = await this.ledgerService.getCredentialDefinition(indyCredential.cred_def_id)

    const credentialId = await this.indyHolderService.storeCredential({
      credentialId: uuid(),
      credentialRequestMetadata,
      credential: indyCredential,
      credentialDefinition,
    })
    credentialRecord.credentialId = credentialId
    await this.updateState(credentialRecord, CredentialState.CredentialReceived)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: issueMessage,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
    return credentialRecord
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
  ): Promise<CredentialProtocolMsgReturnType<CredentialAckMessage>> {
    credentialRecord.assertState(CredentialState.CredentialReceived)

    // Create message
    const ackMessage = new CredentialAckMessage({
      status: AckStatus.OK,
      threadId: credentialRecord.threadId,
    })

    await this.updateState(credentialRecord, CredentialState.Done)

    return { message: ackMessage, credentialRecord }
  }

  /**
   * Decline a credential offer
   * @param credentialRecord The credential to be declined
   */
  public async declineOffer(credentialRecord: CredentialExchangeRecord): Promise<CredentialExchangeRecord> {
    credentialRecord.assertState(CredentialState.OfferReceived)

    await this.updateState(credentialRecord, CredentialState.Declined)

    return credentialRecord
  }

  /**
   * Process a received {@link CredentialAckMessage}.
   *
   * @param messageContext The message context containing a credential acknowledgement message
   * @returns credential record associated with the credential acknowledgement message
   *
   */
  public async processAck(
    messageContext: InboundMessageContext<CredentialAckMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: credentialAckMessage, connection } = messageContext

    this.logger.debug(`Processing credential ack with id ${credentialAckMessage.id}`)

    const credentialRecord = await this.getByThreadAndConnectionId(credentialAckMessage.threadId, connection?.id)

    const requestCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: RequestCredentialMessage,
    })
    const issueCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: IssueCredentialMessage,
    })
    // Assert
    credentialRecord.assertState(CredentialState.CredentialIssued)
    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: requestCredentialMessage,
      previousSentMessage: issueCredentialMessage,
    })

    // Update record
    await this.updateState(credentialRecord, CredentialState.Done)

    return credentialRecord
  }

  /**
   * Process a received {@link ProblemReportMessage}.
   *
   * @param messageContext The message context containing a credential problem report message
   * @returns credential record associated with the credential problem report message
   *
   */
  public async processProblemReport(
    messageContext: InboundMessageContext<CredentialProblemReportMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: credentialProblemReportMessage } = messageContext

    const connection = messageContext.assertReadyConnection()

    this.logger.debug(`Processing problem report with id ${credentialProblemReportMessage.id}`)

    const credentialRecord = await this.getByThreadAndConnectionId(
      credentialProblemReportMessage.threadId,
      connection?.id
    )

    // Update record
    credentialRecord.errorMessage = `${credentialProblemReportMessage.description.code}: ${credentialProblemReportMessage.description.en}`
    await this.update(credentialRecord)
    return credentialRecord
  }

  /**
   * Retrieve all credential records
   *
   * @returns List containing all credential records
   */
  public getAll(): Promise<CredentialExchangeRecord[]> {
    return this.credentialRepository.getAll()
  }

  /**
   * Retrieve a credential record by id
   *
   * @param credentialRecordId The credential record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The credential record
   *
   */
  public getById(credentialRecordId: string): Promise<CredentialExchangeRecord> {
    return this.credentialRepository.getById(credentialRecordId)
  }

  /**
   * Find a credential record by id
   *
   * @param credentialRecordId the credential record id
   * @returns The credential record or null if not found
   */
  public findById(connectionId: string): Promise<CredentialExchangeRecord | null> {
    return this.credentialRepository.findById(connectionId)
  }

  /**
   * Delete a credential record by id
   *
   * @param credentialId the credential record id
   */
  public async deleteById(credentialId: string) {
    const credentialRecord = await this.getById(credentialId)
    return this.credentialRepository.delete(credentialRecord)
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

  public update(credentialRecord: CredentialExchangeRecord) {
    return this.credentialRepository.update(credentialRecord)
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param credentialRecord The credential record to update the state for
   * @param newState The state to update to
   *
   */
  private async updateState(credentialRecord: CredentialExchangeRecord, newState: CredentialState) {
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
}

export interface CredentialProtocolMsgReturnType<MessageType extends AgentMessage> {
  message: MessageType
  credentialRecord: CredentialExchangeRecord
}

export interface CredentialOfferTemplate {
  credentialDefinitionId: string
  comment?: string
  preview: V1CredentialPreview
  autoAcceptCredential?: AutoAcceptCredential
  attachments?: Attachment[]
  linkedAttachments?: LinkedAttachment[]
}

export interface CredentialRequestOptions {
  holderDid: string
  comment?: string
  autoAcceptCredential?: AutoAcceptCredential
}

export interface CredentialResponseOptions {
  comment?: string
  autoAcceptCredential?: AutoAcceptCredential
}

export type CredentialProposeOptions = Omit<ProposeCredentialMessageOptions, 'id'> & {
  linkedAttachments?: LinkedAttachment[]
  autoAcceptCredential?: AutoAcceptCredential
}
