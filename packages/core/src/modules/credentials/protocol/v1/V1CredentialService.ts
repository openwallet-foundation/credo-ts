/* eslint-disable @typescript-eslint/no-unused-vars */
import type { CredentialProtocolMsgReturnType, CredentialProposeOptions, CredentialOfferTemplate } from '.'
import type { AgentConfig } from '../../../../agent/AgentConfig'
import type { AgentMessage } from '../../../../agent/AgentMessage'
import type { Dispatcher } from '../../../../agent/Dispatcher'
import type { EventEmitter } from '../../../../agent/EventEmitter'
import type { HandlerInboundMessage } from '../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { DidCommMessageRepository } from '../../../../storage'
import type { ConnectionRecord } from '../../../connections'
import type { ConnectionService } from '../../../connections/services/ConnectionService'
import type { IndyHolderService, IndyIssuerService } from '../../../indy'
import type { IndyLedgerService } from '../../../ledger'
import type { MediationRecipientService } from '../../../routing'
import type { CredentialStateChangedEvent } from '../../CredentialEvents'
import type { CredentialResponseCoordinator } from '../../CredentialResponseCoordinator'
import type {
  CredProposeOfferRequestFormat,
  CredentialFormatService,
  CredPropose,
} from '../../formats/CredentialFormatService'
import type {
  AcceptProposalOptions,
  AcceptRequestOptions,
  CredentialFormatType,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../../interfaces'
import type { CredentialRepository } from '../../repository'
import type { CredOffer, CredReq } from 'indy-sdk'

import { ServiceDecorator } from '../../../../decorators/service/ServiceDecorator'
import { AriesFrameworkError } from '../../../../error'
import { ConsoleLogger, LogLevel } from '../../../../logger'
import { DidCommMessageRole } from '../../../../storage'
import { isLinkedAttachment } from '../../../../utils/attachment'
import { uuid } from '../../../../utils/uuid'
import { AckStatus } from '../../../common'
import { CredentialEventTypes } from '../../CredentialEvents'
import { CredentialProtocolVersion } from '../../CredentialProtocolVersion'
import { CredentialService } from '../../CredentialService'
import { CredentialState } from '../../CredentialState'
import { CredentialUtils } from '../../CredentialUtils'
import { CredentialProblemReportError, CredentialProblemReportReason } from '../../errors'
import { IndyCredentialFormatService } from '../../formats/indy/IndyCredentialFormatService'
import { CredentialMetadataKeys, CredentialExchangeRecord } from '../../repository'

import { V1CredentialPreview } from './V1CredentialPreview'
import {
  CredentialAckHandler,
  CredentialProblemReportHandler,
  IssueCredentialHandler,
  OfferCredentialHandler,
  ProposeCredentialHandler,
  RequestCredentialHandler,
} from './handlers'
import {
  INDY_CREDENTIAL_ATTACHMENT_ID,
  INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
  INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
  ProposeCredentialMessage,
  IssueCredentialMessage,
  RequestCredentialMessage,
  OfferCredentialMessage,
  CredentialAckMessage,
} from './messages'

const logger = new ConsoleLogger(LogLevel.debug)

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
    credentialResponseCoordinator: CredentialResponseCoordinator,
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
      credentialResponseCoordinator,
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
      didCommMessageRepository,
      indyIssuerService,
      indyLedgerService,
      indyHolderService
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
    options: RequestCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<RequestCredentialMessage>> {
    // Assert credential
    record.assertState(CredentialState.OfferReceived)

    const offerCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: record.id,
      messageClass: OfferCredentialMessage,
    })

    const credentialOffer: CredOffer | null = offerCredentialMessage?.indyCredentialOffer
    if (!offerCredentialMessage || !credentialOffer) {
      throw new CredentialProblemReportError(
        `Missing required base64 or json encoded attachment data for credential offer with thread id ${record.threadId}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }
    let offer: CredProposeOfferRequestFormat | undefined

    const attachment = offerCredentialMessage.getAttachmentIncludingFormatId('indy')

    if (attachment) {
      offer = this.formatService.getCredentialPayload(attachment)
    } else {
      throw Error(`Missing attachment in credential Record ${record.id}`)
    }

    options.offer = offer
    options.attachId = INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID
    const { requestAttach, credOfferRequest } = await this.formatService.createRequestAttachFormats(options, record)
    if (!requestAttach) {
      throw Error(`Failed to create attachment for request; credential record = ${record.id}`)
    }

    const requestMessage = new RequestCredentialMessage({
      comment: options?.comment,
      requestAttachments: [requestAttach],
      attachments: offerCredentialMessage?.messageAttachment?.filter((attachment) => isLinkedAttachment(attachment)),
    })
    requestMessage.setThread({ threadId: record.threadId })

    if (!credOfferRequest?.indy?.payload.requestMetaData) {
      throw Error(`Missing request metad data in request forcredential Record ${record.id}`)
    }
    record.metadata.set(CredentialMetadataKeys.IndyRequest, credOfferRequest?.indy?.payload.requestMetaData)
    record.autoAcceptCredential = options?.autoAcceptCredential ?? record.autoAcceptCredential

    record.linkedAttachments = offerCredentialMessage?.messageAttachment?.filter((attachment) =>
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
    messageContext: InboundMessageContext<IssueCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: issueMessage, connection } = messageContext

    logger.debug(`Processing credential with id ${issueMessage.id}`)

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

    const credentialDefinition = await this.indyLedgerService.getCredentialDefinition(indyCredential.cred_def_id)

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
    messageContext: InboundMessageContext<RequestCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: requestMessage, connection } = messageContext

    logger.debug(`Processing credential request with id ${requestMessage.id}`)

    const indyCredentialRequest = requestMessage?.indyCredentialRequest
    if (!indyCredentialRequest) {
      throw new CredentialProblemReportError(
        `Missing required base64 or json encoded attachment data for credential request with thread id ${requestMessage.threadId}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    const credentialRecord = await this.getByThreadAndConnectionId(requestMessage.threadId, connection?.id)
    let proposalMessage, offerMessage
    try {
      proposalMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: ProposeCredentialMessage,
      })
    } catch {
      // record not found - this can happen
    }
    try {
      offerMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: OfferCredentialMessage,
      })
    } catch (error) {
      // record not found - this can happen
    }

    // Assert
    credentialRecord.assertState(CredentialState.OfferSent)

    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: proposalMessage,
      previousSentMessage: offerMessage,
    })

    logger.debug('Credential record found when processing credential request', credentialRecord)
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
  ): Promise<CredentialProtocolMsgReturnType<ProposeCredentialMessage>> {
    // Assert
    credentialRecord.assertState(CredentialState.OfferReceived)

    // Create message
    const proposalMessage = new ProposeCredentialMessage(options ?? {})

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
    messageContext: HandlerInboundMessage<OfferCredentialHandler>
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
        // no record found
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

  private async createOfferProcessing(
    credentialTemplate: CredentialOfferTemplate,
    connectionRecord?: ConnectionRecord
  ): Promise<CredentialProtocolMsgReturnType<OfferCredentialMessage>> {
    // Assert
    connectionRecord?.assertReady()

    // Create message
    const { credentialDefinitionId, comment, preview, linkedAttachments } = credentialTemplate
    const credOffer = await this.indyIssuerService.createCredentialOffer(credentialDefinitionId)

    // use indy format service to create the attachment
    const offer: CredProposeOfferRequestFormat = {
      indy: {
        payload: {
          credentialPayload: credOffer,
        },
      },
    }
    const options: AcceptProposalOptions = {
      attachId: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
      connectionId: '',
      protocolVersion: CredentialProtocolVersion.V1_0,
      credentialRecordId: '',
      credentialFormats: {
        indy: undefined,
        w3c: undefined,
      },
    }
    const { offersAttach } = this.formatService.createOfferAttachFormats(options, offer)

    if (!offersAttach) {
      throw new AriesFrameworkError('Missing offers attach in Offer')
    }

    // Create and link credential to attacment
    const credentialPreview = linkedAttachments
      ? CredentialUtils.createAndLinkAttachmentsToPreview(linkedAttachments, preview)
      : preview

    // Construct offer message
    const offerMessage = new OfferCredentialMessage({
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
    })

    credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
      credentialDefinitionId: credOffer.cred_def_id,
      schemaId: credOffer.schema_id,
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
    options: AcceptRequestOptions
  ): Promise<CredentialProtocolMsgReturnType<IssueCredentialMessage>> {
    // Assert
    record.assertState(CredentialState.RequestReceived)
    const offerMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: record.id,
      messageClass: OfferCredentialMessage,
    })
    const requestMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: record.id,
      messageClass: RequestCredentialMessage,
    })
    // Assert offer message
    if (!offerMessage) {
      throw new AriesFrameworkError(
        `Missing credential offer for credential exchange with thread id ${record.threadId}`
      )
    }

    const credentialOffer: CredOffer | null = offerMessage?.indyCredentialOffer
    if (!offerMessage || !credentialOffer) {
      throw new CredentialProblemReportError(
        `Missing required base64 or json encoded attachment data for credential offer with thread id ${record.threadId}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }
    let offer: CredProposeOfferRequestFormat | undefined

    let attachment = offerMessage.getAttachmentIncludingFormatId('indy')

    if (attachment) {
      offer = this.formatService.getCredentialPayload(attachment)
    } else {
      throw Error(`Missing (offer) attachment in credential Record ${record.id}`)
    }
    const credentialRequest: CredReq | null = requestMessage?.indyCredentialRequest
    if (!requestMessage || !credentialRequest) {
      throw new CredentialProblemReportError(
        `Missing required base64 or json encoded attachment data for credential request with thread id ${record.threadId}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }
    let request: CredProposeOfferRequestFormat | undefined

    attachment = requestMessage.getAttachmentIncludingFormatId('indy')

    if (attachment) {
      request = this.formatService.getCredentialPayload(attachment)
    } else {
      throw Error(`Missing (request) attachment in credential Record ${record.id}`)
    }

    options.offer = offer
    options.request = request
    options.attachId = INDY_CREDENTIAL_ATTACHMENT_ID

    // Assert credential attributes
    const credentialAttributes = record.credentialAttributes
    if (!credentialAttributes) {
      throw new CredentialProblemReportError(
        `Missing required credential attribute values on credential record with id ${record.id}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    const { credentialsAttach } = await this.formatService.createIssueAttachFormats(options, record)
    if (!credentialsAttach) {
      throw Error(`Failed to create attachment for request; credential record = ${record.id}`)
    }

    const issueMessage = new IssueCredentialMessage({
      comment: options?.comment,
      credentialAttachments: [credentialsAttach],
      attachments:
        offerMessage?.messageAttachment?.filter((attachment) => isLinkedAttachment(attachment)) ||
        requestMessage?.messageAttachment?.filter((attachment: Attachment) => isLinkedAttachment(attachment)),
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
    messageContext: InboundMessageContext<CredentialAckMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: credentialAckMessage, connection } = messageContext

    logger.debug(`Processing credential ack with id ${credentialAckMessage.id}`)

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
    messageContext: InboundMessageContext<ProposeCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    let credentialRecord: CredentialExchangeRecord
    const { message: proposalMessage, connection } = messageContext

    logger.debug(`Processing credential proposal with id ${proposalMessage.id}`)

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
  ): Promise<CredentialProtocolMsgReturnType<OfferCredentialMessage>> {
    // Assert
    credentialRecord.assertState(CredentialState.ProposalReceived)

    // Create message
    const { credentialDefinitionId, comment, preview, attachments } = credentialTemplate

    const credOffer = await this.indyIssuerService.createCredentialOffer(credentialDefinitionId)
    const options: AcceptProposalOptions = {
      attachId: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
      connectionId: '',
      protocolVersion: CredentialProtocolVersion.V1_0,
      credentialRecordId: '',
      credentialFormats: {
        indy: undefined,
        w3c: undefined,
      },
    }
    const offer: CredProposeOfferRequestFormat = {
      indy: {
        payload: {
          credentialPayload: credOffer,
        },
      },
    }
    const { offersAttach } = this.formatService.createOfferAttachFormats(options, offer)

    if (!offersAttach) {
      throw new AriesFrameworkError('Missing offers attach in Offer')
    }

    const offerMessage = new OfferCredentialMessage({
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
      new ProposeCredentialHandler(
        this,
        this.agentConfig,
        this.credentialResponseCoordinator,
        this.didCommMessageRepository
      )
    )
    this.dispatcher.registerHandler(
      new OfferCredentialHandler(
        this,
        this.agentConfig,
        this.credentialResponseCoordinator,
        this.mediationRecipientService,
        this.didCommMessageRepository
      )
    )
    this.dispatcher.registerHandler(
      new RequestCredentialHandler(
        this,
        this.agentConfig,
        this.credentialResponseCoordinator,
        this.didCommMessageRepository
      )
    )
    this.dispatcher.registerHandler(
      new IssueCredentialHandler(
        this,
        this.agentConfig,
        this.credentialResponseCoordinator,
        this.didCommMessageRepository
      )
    )
    this.dispatcher.registerHandler(new CredentialAckHandler(this))
    this.dispatcher.registerHandler(new CredentialProblemReportHandler(this))
  }

  /**
   *
   * Get the version of Issue Credentials according to AIP1.0 or AIP2.0
   * @returns the version of this credential service
   */
  public getVersion(): CredentialProtocolVersion {
    return CredentialProtocolVersion.V1_0
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
    logger.debug('>> IN SERVICE V1 => createProposal')

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

    // Add the linked attachments to the credentialProposal
    if (config?.linkedAttachments) {
      options.credentialProposal = CredentialUtils.createAndLinkAttachmentsToPreview(
        config.linkedAttachments,
        config.credentialProposal ?? new V1CredentialPreview({ attributes: [] })
      )
      options.attachments = config.linkedAttachments.map((linkedAttachment) => linkedAttachment.attachment)
    }

    // MJR-TODO this creates the attachment array which we don't want for V1
    const { filtersAttach } = this.formatService.createProposalAttachFormats(proposal)

    if (!filtersAttach) {
      throw new AriesFrameworkError('Missing filters attach in Proposal')
    }
    options.attachments = []
    options.attachments?.push(filtersAttach)

    // Create message
    const message = new ProposeCredentialMessage(options ?? {})

    // Create record
    const credentialRecord = new CredentialExchangeRecord({
      connectionId: connection.id,
      threadId: message.threadId,
      state: CredentialState.ProposalSent,
      linkedAttachments: config?.linkedAttachments?.map((linkedAttachment) => linkedAttachment.attachment),
      credentialAttributes: message.credentialProposal?.attributes,
      autoAcceptCredential: config?.autoAcceptCredential,
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
   * @returns Object containing proposal message and associated credential record
   */
  public async acceptProposal(
    proposal: AcceptProposalOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    logger.debug('>> IN SERVICE V1 => acceptProposal')

    const credentialRecord = await this.getById(proposal.credentialRecordId)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support credential proposal or negotiation.`
      )
    }
    const proposalCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: ProposeCredentialMessage,
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
   * @returns Credential record associated with the credential offer and the corresponding new offer message
   *
   */
  public async negotiateProposal(
    credentialOptions: NegotiateProposalOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    const credentialRecord = await this.getById(credentialOptions.credentialRecordId)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support negotiation.`
      )
    }

    const credentialProposalMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: ProposeCredentialMessage,
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
      throw Error('No proposal attributes in the negotiation options!')
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
   * @returns Credential record associated with the credential offer and the corresponding new offer message
   *
   */
  public async negotiateOffer(
    credentialOptions: ProposeCredentialOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    if (!credentialOptions.credentialRecordId) {
      throw Error('No credential record id found in credential options')
    }
    const credentialRecord = await this.getById(credentialOptions.credentialRecordId)

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
    throw Error('Missing attributes in V1 Negotiate Offer Options')
  }

  public async createOutOfBandOffer(
    credentialOptions: OfferCredentialOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    if (!credentialOptions.credentialFormats.indy?.credentialDefinitionId) {
      throw Error('Missing credential definition id for out of band credential')
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
      throw Error('Connection id missing from offer credential options')
    }
    const connection = await this.connectionService.getById(credentialOptions.connectionId)

    if (
      credentialOptions?.credentialFormats.indy?.attributes &&
      credentialOptions?.credentialFormats.indy?.credentialDefinitionId
    ) {
      const credentialPreview: V1CredentialPreview = new V1CredentialPreview({
        attributes: credentialOptions.credentialFormats.indy?.attributes,
      })

      const template: CredentialOfferTemplate = {
        ...credentialOptions,
        preview: credentialPreview,
        credentialDefinitionId: credentialOptions?.credentialFormats.indy?.credentialDefinitionId,
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

    throw Error('Missing properties from OfferCredentialOptions object: cannot create Offer!')
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getFormats(credentialFormats: CredProposeOfferRequestFormat): CredentialFormatService[] {
    throw new Error('Method not implemented.')
  }

  public getFormatService(credentialFormatType?: CredentialFormatType): CredentialFormatService {
    return new IndyCredentialFormatService(
      this.credentialRepository,
      this.eventEmitter,
      this.didCommMessageRepository,
      this.indyIssuerService,
      this.indyLedgerService,
      this.indyHolderService
    )
  }
}
