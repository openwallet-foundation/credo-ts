import type { CredDefId } from 'indy-sdk'
import { v4 as uuid } from 'uuid'
import { EventEmitter } from 'events'

import { AgentMessage } from '../../../agent/AgentMessage'
import { LedgerService } from '../../ledger/services/LedgerService'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { ConnectionService, ConnectionRecord } from '../../connections'
import { CredentialRecord } from '../repository/CredentialRecord'
import { Repository } from '../../../storage/Repository'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { Wallet } from '../../../wallet/Wallet'
import { JsonTransformer } from '../../../utils/JsonTransformer'

import { CredentialState } from '../CredentialState'
import { CredentialUtils } from '../CredentialUtils'
import { CredentialInfo } from '../models'
import {
  OfferCredentialMessage,
  CredentialPreview,
  INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
  RequestCredentialMessage,
  IssueCredentialMessage,
  CredentialAckMessage,
  INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
  INDY_CREDENTIAL_ATTACHMENT_ID,
  ProposeCredentialMessage,
  ProposeCredentialMessageOptions,
} from '../messages'
import { AckStatus } from '../../common'
import { Logger } from '../../../logger'
import { AgentConfig } from '../../../agent/AgentConfig'

export enum CredentialEventType {
  StateChanged = 'stateChanged',
}

export interface CredentialStateChangedEvent {
  credentialRecord: CredentialRecord
  previousState: CredentialState
}

export interface CredentialProtocolMsgReturnType<MessageType extends AgentMessage> {
  message: MessageType
  credentialRecord: CredentialRecord
}

export class CredentialService extends EventEmitter {
  private wallet: Wallet
  private credentialRepository: Repository<CredentialRecord>
  private connectionService: ConnectionService
  private ledgerService: LedgerService
  private logger: Logger

  public constructor(
    wallet: Wallet,
    credentialRepository: Repository<CredentialRecord>,
    connectionService: ConnectionService,
    ledgerService: LedgerService,
    agentConfig: AgentConfig
  ) {
    super()
    this.wallet = wallet
    this.credentialRepository = credentialRepository
    this.connectionService = connectionService
    this.ledgerService = ledgerService
    this.logger = agentConfig.logger
  }

  /**
   * Create a {@link ProposeCredentialMessage} not bound to an existing credential exchange.
   * To create a proposal as response to an existing credential exchange, use {@link CredentialService#createProposalAsResponse}.
   *
   * @param connectionRecord The connection for which to create the credential proposal
   * @param config Additional configuration to use for the proposal
   * @returns Object containing proposal message and associated credential record
   *
   */
  public async createProposal(
    connectionRecord: ConnectionRecord,
    config?: Omit<ProposeCredentialMessageOptions, 'id'>
  ): Promise<CredentialProtocolMsgReturnType<ProposeCredentialMessage>> {
    // Assert
    connectionRecord.assertReady()

    // Create message
    const proposalMessage = new ProposeCredentialMessage(config ?? {})

    // Create record
    const credentialRecord = new CredentialRecord({
      connectionId: connectionRecord.id,
      state: CredentialState.ProposalSent,
      proposalMessage,
      tags: { threadId: proposalMessage.threadId },
    })
    await this.credentialRepository.save(credentialRecord)
    this.emit(CredentialEventType.StateChanged, {
      credentialRecord,
      previousState: null,
    })

    return { message: proposalMessage, credentialRecord }
  }

  /**
   * Create a {@link ProposePresentationMessage} as response to a received credential offer.
   * To create a proposal not bound to an existing credential exchange, use {@link CredentialService#createProposal}.
   *
   * @param credentialRecord The credential record for which to create the credential proposal
   * @param config Additional configuration to use for the proposal
   * @returns Object containing proposal message and associated credential record
   *
   */
  public async createProposalAsResponse(
    credentialRecord: CredentialRecord,
    config?: Omit<ProposeCredentialMessageOptions, 'id'>
  ): Promise<CredentialProtocolMsgReturnType<ProposeCredentialMessage>> {
    // Assert
    credentialRecord.assertState(CredentialState.OfferReceived)

    // Create message
    const proposalMessage = new ProposeCredentialMessage(config ?? {})
    proposalMessage.setThread({ threadId: credentialRecord.tags.threadId })

    // Update record
    credentialRecord.proposalMessage = proposalMessage
    this.updateState(credentialRecord, CredentialState.ProposalSent)

    return { message: proposalMessage, credentialRecord }
  }

  /**
   * Process a received {@link ProposeCredentialMessage}. This will not accept the credential proposal
   * or send a credential offer. It will only create a new, or update the existing credential record with
   * the information from the credential proposal message. Use {@link CredentialService#createOfferAsResponse}
   * after calling this method to create a credential offer.
   *
   * @param messageContext The message context containing a credential proposal message
   * @returns credential record associated with the credential proposal message
   *
   */
  public async processProposal(
    messageContext: InboundMessageContext<ProposeCredentialMessage>
  ): Promise<CredentialRecord> {
    let credentialRecord: CredentialRecord
    const { message: proposalMessage, connection } = messageContext

    // Assert connection
    connection?.assertReady()
    if (!connection) {
      throw new Error(
        `No connection associated with incoming credential proposal message with thread id ${proposalMessage.threadId}`
      )
    }

    try {
      // Credential record already exists
      credentialRecord = await this.getByThreadId(proposalMessage.threadId)

      // Assert
      credentialRecord.assertState(CredentialState.OfferSent)
      credentialRecord.assertConnection(connection.id)

      // Update record
      credentialRecord.proposalMessage = proposalMessage
      await this.updateState(credentialRecord, CredentialState.ProposalReceived)
    } catch {
      // No credential record exists with thread id
      credentialRecord = new CredentialRecord({
        connectionId: connection.id,
        proposalMessage,
        state: CredentialState.ProposalReceived,
        tags: { threadId: proposalMessage.threadId },
      })

      // Save record
      await this.credentialRepository.save(credentialRecord)
      this.emit(CredentialEventType.StateChanged, {
        credentialRecord,
        previousState: null,
      })
    }

    return credentialRecord
  }

  /**
   * Create a {@link OfferCredentialMessage} as response to a received credential proposal.
   * To create an offer not bound to an existing credential exchange, use {@link CredentialService#createOffer}.
   *
   * @param credentialRecord The credential record for which to create the credential offer
   * @param credentialTemplate The credential template to use for the offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOfferAsResponse(
    credentialRecord: CredentialRecord,
    credentialTemplate: CredentialOfferTemplate
  ): Promise<CredentialProtocolMsgReturnType<OfferCredentialMessage>> {
    // Assert
    credentialRecord.assertState(CredentialState.ProposalReceived)

    // Create message
    const { credentialDefinitionId, comment, preview } = credentialTemplate
    const credOffer = await this.wallet.createCredentialOffer(credentialDefinitionId)
    const attachment = new Attachment({
      id: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(credOffer),
      }),
    })
    const credentialOfferMessage = new OfferCredentialMessage({
      comment,
      attachments: [attachment],
      credentialPreview: preview,
    })
    credentialOfferMessage.setThread({
      threadId: credentialRecord.tags.threadId,
    })

    credentialRecord.offerMessage = credentialOfferMessage
    await this.updateState(credentialRecord, CredentialState.OfferSent)

    return { message: credentialOfferMessage, credentialRecord }
  }

  /**
   * Create a {@link OfferCredentialMessage} not bound to an existing credential exchange.
   * To create an offer as response to an existing credential exchange, use {@link ProofService#createOfferAsResponse}.
   *
   * @param connectionRecord The connection for which to create the credential offer
   * @param credentialTemplate The credential template to use for the offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOffer(
    connectionRecord: ConnectionRecord,
    credentialTemplate: CredentialOfferTemplate
  ): Promise<CredentialProtocolMsgReturnType<OfferCredentialMessage>> {
    // Assert
    connectionRecord.assertReady()

    // Create message
    const { credentialDefinitionId, comment, preview } = credentialTemplate
    const credOffer = await this.wallet.createCredentialOffer(credentialDefinitionId)
    const attachment = new Attachment({
      id: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(credOffer),
      }),
    })
    const credentialOfferMessage = new OfferCredentialMessage({
      comment,
      attachments: [attachment],
      credentialPreview: preview,
    })

    // Create record
    const credentialRecord = new CredentialRecord({
      connectionId: connectionRecord.id,
      offerMessage: credentialOfferMessage,
      state: CredentialState.OfferSent,
      tags: { threadId: credentialOfferMessage.id },
    })

    await this.credentialRepository.save(credentialRecord)
    this.emit(CredentialEventType.StateChanged, {
      credentialRecord,
      previousState: null,
    })

    return { message: credentialOfferMessage, credentialRecord }
  }

  /**
   * Process a received {@link OfferCredentialMessage}. This will not accept the credential offer
   * or send a credential request. It will only create a new credential record with
   * the information from the credential offer message. Use {@link CredentialService#createRequest}
   * after calling this method to create a credential request.
   *
   * @param messageContext The message context containing a credential request message
   * @returns credential record associated with the credential offer message
   *
   */
  public async processOffer(messageContext: InboundMessageContext<OfferCredentialMessage>): Promise<CredentialRecord> {
    let credentialRecord: CredentialRecord
    const { message: credentialOfferMessage, connection } = messageContext

    // Assert connection
    connection?.assertReady()
    if (!connection) {
      throw new Error(
        `No connection associated with incoming credential offer message with thread id ${credentialOfferMessage.threadId}`
      )
    }

    const indyCredentialOffer = credentialOfferMessage.indyCredentialOffer

    if (!indyCredentialOffer) {
      throw new Error(
        `Missing required base64 encoded attachment data for credential offer with thread id ${credentialOfferMessage.threadId}`
      )
    }

    try {
      // Credential record already exists
      credentialRecord = await this.getByThreadId(credentialOfferMessage.threadId)

      // Assert
      credentialRecord.assertState(CredentialState.ProposalSent)
      credentialRecord.assertConnection(connection.id)

      credentialRecord.offerMessage = credentialOfferMessage
      await this.updateState(credentialRecord, CredentialState.OfferReceived)
    } catch {
      // No credential record exists with thread id
      credentialRecord = new CredentialRecord({
        connectionId: connection.id,
        offerMessage: credentialOfferMessage,
        state: CredentialState.OfferReceived,
        tags: { threadId: credentialOfferMessage.id },
      })

      // Save in repository
      await this.credentialRepository.save(credentialRecord)
      this.emit(CredentialEventType.StateChanged, {
        credentialRecord,
        previousState: null,
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
    credentialRecord: CredentialRecord,
    options: CredentialRequestOptions = {}
  ): Promise<CredentialProtocolMsgReturnType<RequestCredentialMessage>> {
    // Assert credential
    credentialRecord.assertState(CredentialState.OfferReceived)

    const connection = await this.connectionService.getById(credentialRecord.connectionId)
    const proverDid = connection.did

    // FIXME: transformation should be handled by credential record
    const offer =
      credentialRecord.offerMessage instanceof OfferCredentialMessage
        ? credentialRecord.offerMessage
        : JsonTransformer.fromJSON(credentialRecord.offerMessage, OfferCredentialMessage)

    const credOffer = offer?.indyCredentialOffer

    if (!credOffer) {
      throw new Error(
        `Missing required base64 encoded attachment data for credential offer with thread id ${credentialRecord.tags.threadId}`
      )
    }

    const credentialDefinition = await this.ledgerService.getCredentialDefinition(credOffer.cred_def_id)

    const [credReq, credReqMetadata] = await this.wallet.createCredentialRequest(
      proverDid,
      credOffer,
      credentialDefinition
    )
    const attachment = new Attachment({
      id: INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(credReq),
      }),
    })

    const { comment } = options
    const credentialRequest = new RequestCredentialMessage({
      comment,
      attachments: [attachment],
    })
    credentialRequest.setThread({ threadId: credentialRecord.tags.threadId })

    credentialRecord.requestMetadata = credReqMetadata
    credentialRecord.requestMessage = credentialRequest
    await this.updateState(credentialRecord, CredentialState.RequestSent)

    return { message: credentialRequest, credentialRecord }
  }

  /**
   * Process a received {@link RequestCredentialMessage}. This will not accept the credential request
   * or send a credential. It will only update the existing credential record with
   * the information from the credential request message. Use {@link CredentialService#createCredential}
   * after calling this method to create a credential.
   *
   * @param messageContext The message context containing a credential request message
   * @returns credential record associated with the credential request message
   *
   */
  public async processRequest(
    messageContext: InboundMessageContext<RequestCredentialMessage>
  ): Promise<CredentialRecord> {
    const { message: credentialRequestMessage, connection } = messageContext

    // Assert connection
    connection?.assertReady()
    if (!connection) {
      throw new Error(
        `No connection associated with incoming credential request message with thread id ${credentialRequestMessage.threadId}`
      )
    }

    const indyCredentialRequest = credentialRequestMessage?.indyCredentialRequest

    if (!indyCredentialRequest) {
      throw new Error(
        `Missing required base64 encoded attachment data for credential request with thread id ${credentialRequestMessage.threadId}`
      )
    }

    const credentialRecord = await this.getByThreadId(credentialRequestMessage.threadId)
    credentialRecord.assertState(CredentialState.OfferSent)
    credentialRecord.assertConnection(connection.id)

    this.logger.debug('Credential record found when processing credential request', credentialRecord)

    credentialRecord.requestMessage = credentialRequestMessage
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
    credentialRecord: CredentialRecord,
    options: CredentialResponseOptions = {}
  ): Promise<CredentialProtocolMsgReturnType<IssueCredentialMessage>> {
    // Assert
    credentialRecord.assertState(CredentialState.RequestReceived)

    // Transform credential request to class instance if this is not already the case
    // FIXME: credential record should handle transformation
    const requestMessage =
      credentialRecord.requestMessage instanceof RequestCredentialMessage
        ? credentialRecord.requestMessage
        : JsonTransformer.fromJSON(credentialRecord.requestMessage, RequestCredentialMessage)

    // FIXME: transformation should be handled by credential record
    const offerMessage =
      credentialRecord.offerMessage instanceof OfferCredentialMessage
        ? credentialRecord.offerMessage
        : JsonTransformer.fromJSON(credentialRecord.offerMessage, OfferCredentialMessage)

    const indyCredentialOffer = offerMessage?.indyCredentialOffer
    const indyCredentialRequest = requestMessage?.indyCredentialRequest
    const indyCredentialValues = CredentialUtils.convertPreviewToValues(offerMessage.credentialPreview)

    if (!indyCredentialOffer) {
      throw new Error(
        `Missing required base64 encoded attachment data for credential offer with thread id ${credentialRecord.tags.threadId}`
      )
    }

    if (!indyCredentialRequest) {
      throw new Error(
        `Missing required base64 encoded attachment data for credential request with thread id ${credentialRecord.tags.threadId}`
      )
    }

    const [credential] = await this.wallet.createCredential(
      indyCredentialOffer,
      indyCredentialRequest,
      indyCredentialValues
    )

    const credentialAttachment = new Attachment({
      id: INDY_CREDENTIAL_ATTACHMENT_ID,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(credential),
      }),
    })

    const { comment } = options
    const issueCredentialMessage = new IssueCredentialMessage({
      comment,
      attachments: [credentialAttachment],
    })
    issueCredentialMessage.setThread({
      threadId: credentialRecord.tags.threadId,
    })
    issueCredentialMessage.setPleaseAck()

    credentialRecord.credentialMessage = issueCredentialMessage

    await this.updateState(credentialRecord, CredentialState.CredentialIssued)

    return { message: issueCredentialMessage, credentialRecord }
  }

  /**
   * Process a received {@link IssueCredentialMessage}. This will not accept the credential
   * or send a credential acknowledgement. It will only update the existing credential record with
   * the information from the issue credential message. Use {@link CredentialService#createAck}
   * after calling this method to create a credential acknowledgement.
   *
   * @param messageContext The message context containing an issue credential message
   *
   * @returns credential record associated with the issue credential message
   *
   */
  public async processCredential(
    messageContext: InboundMessageContext<IssueCredentialMessage>
  ): Promise<CredentialRecord> {
    const { message: issueCredentialMessage, connection } = messageContext

    // Assert connection
    connection?.assertReady()
    if (!connection) {
      throw new Error(
        `No connection associated with incoming presentation message with thread id ${issueCredentialMessage.threadId}`
      )
    }

    // Assert credential record
    const credentialRecord = await this.getByThreadId(issueCredentialMessage.threadId)
    credentialRecord.assertState(CredentialState.RequestSent)

    if (!credentialRecord.requestMetadata) {
      throw new Error(`Missing required request metadata for credential with id ${credentialRecord.id}`)
    }

    const indyCredential = issueCredentialMessage.indyCredential
    if (!indyCredential) {
      throw new Error(
        `Missing required base64 encoded attachment data for credential with thread id ${issueCredentialMessage.threadId}`
      )
    }

    const credentialDefinition = await this.ledgerService.getCredentialDefinition(indyCredential.cred_def_id)

    const credentialId = await this.wallet.storeCredential(
      uuid(),
      credentialRecord.requestMetadata,
      indyCredential,
      credentialDefinition
    )

    credentialRecord.credentialId = credentialId
    credentialRecord.credentialMessage = issueCredentialMessage
    await this.updateState(credentialRecord, CredentialState.CredentialReceived)

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
    credentialRecord: CredentialRecord
  ): Promise<CredentialProtocolMsgReturnType<CredentialAckMessage>> {
    credentialRecord.assertState(CredentialState.CredentialReceived)

    // Create message
    const ackMessage = new CredentialAckMessage({
      status: AckStatus.OK,
      threadId: credentialRecord.tags.threadId!,
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
  public async processAck(messageContext: InboundMessageContext<CredentialAckMessage>): Promise<CredentialRecord> {
    const { message: credentialAckMessage, connection } = messageContext

    // Assert connection
    connection?.assertReady()
    if (!connection) {
      throw new Error(
        `No connection associated with incoming presentation acknowledgement message with thread id ${credentialAckMessage.threadId}`
      )
    }

    // Assert credential record
    const credentialRecord = await this.getByThreadId(credentialAckMessage.threadId)
    credentialRecord.assertState(CredentialState.CredentialIssued)

    // Update record
    await this.updateState(credentialRecord, CredentialState.Done)

    return credentialRecord
  }

  /**
   * Retrieve all credential records
   *
   * @returns List containing all credential records
   */
  public async getAll(): Promise<CredentialRecord[]> {
    return this.credentialRepository.findAll()
  }

  /**
   * Retrieve a credential record by id
   *
   * @param credentialRecordId The credential record id
   * @throws {Error} If no record is found
   * @return The credential record
   *
   */
  public async getById(credentialRecordId: string): Promise<CredentialRecord> {
    return this.credentialRepository.find(credentialRecordId)
  }

  /**
   * Retrieve a credential record by thread id
   *
   * @param threadId The thread id
   * @throws {Error} If no record is found
   * @throws {Error} If multiple records are found
   * @returns The credential record
   */
  public async getByThreadId(threadId: string): Promise<CredentialRecord> {
    const credentialRecords = await this.credentialRepository.findByQuery({
      threadId,
    })

    if (credentialRecords.length === 0) {
      throw new Error(`Credential record not found by thread id ${threadId}`)
    }

    if (credentialRecords.length > 1) {
      throw new Error(`Multiple credential records found by thread id ${threadId}`)
    }

    return credentialRecords[0]
  }

  /**
   * Retrieve an indy credential by credential id (referent)
   *
   * @param credentialId the id (referent) of the indy credential
   * @returns Indy credential info object
   */
  public async getIndyCredential(credentialId: string): Promise<CredentialInfo> {
    const indyCredential = await this.wallet.getCredential(credentialId)

    return JsonTransformer.fromJSON(indyCredential, CredentialInfo)
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

    const event: CredentialStateChangedEvent = {
      credentialRecord,
      previousState: previousState,
    }

    this.emit(CredentialEventType.StateChanged, event)
  }
}

export interface CredentialOfferTemplate {
  credentialDefinitionId: CredDefId
  comment?: string
  preview: CredentialPreview
}

interface CredentialRequestOptions {
  comment?: string
}

interface CredentialResponseOptions {
  comment?: string
}
