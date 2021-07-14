import type { AutoAcceptCredential } from './CredentialAutoAcceptType'
import type { CredentialPreview } from './messages'
import type { CredentialRecord } from './repository/CredentialRecord'
import type { CredentialOfferTemplate, CredentialProposeOptions } from './services'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { InjectionSymbols } from '../../constants'
import { AriesFrameworkError } from '../../error'
import { Logger } from '../../logger'
import { isLinkedAttachment } from '../../utils/attachment'
import { ConnectionService } from '../connections/services/ConnectionService'

import { CredentialResponseCoordinator } from './CredentialResponseCoordinator'
import {
  CredentialAckHandler,
  IssueCredentialHandler,
  OfferCredentialHandler,
  ProposeCredentialHandler,
  RequestCredentialHandler,
} from './handlers'
import { CredentialService } from './services'

@scoped(Lifecycle.ContainerScoped)
export class CredentialsModule {
  private connectionService: ConnectionService
  private credentialService: CredentialService
  private messageSender: MessageSender
  private agentConfig: AgentConfig
  private credentialResponseCoordinator: CredentialResponseCoordinator
  private logger: Logger

  public constructor(
    dispatcher: Dispatcher,
    connectionService: ConnectionService,
    credentialService: CredentialService,
    messageSender: MessageSender,
    agentConfig: AgentConfig,
    credentialResponseCoordinator: CredentialResponseCoordinator,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.connectionService = connectionService
    this.credentialService = credentialService
    this.messageSender = messageSender
    this.agentConfig = agentConfig
    this.credentialResponseCoordinator = credentialResponseCoordinator
    this.logger = logger
    this.registerHandlers(dispatcher)
  }

  /**
   * Initiate a new credential exchange as holder by sending a credential proposal message
   * to the connection with the specified connection id.
   *
   * @param connectionId The connection to send the credential proposal to
   * @param config Additional configuration to use for the proposal
   * @returns Credential record associated with the sent proposal message
   */
  public async proposeCredential(connectionId: string, config?: CredentialProposeOptions) {
    const connection = await this.connectionService.getById(connectionId)

    const { message, credentialRecord } = await this.credentialService.createProposal(connection, config)

    const outbound = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outbound)

    return credentialRecord
  }

  /**
   * Accept a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param credentialRecordId The id of the credential record for which to accept the proposal
   * @param config Additional configuration to use for the offer
   * @returns Credential record associated with the credential offer
   *
   */
  public async acceptProposal(
    credentialRecordId: string,
    config?: {
      comment?: string
      credentialDefinitionId?: string
      autoAcceptCredential?: AutoAcceptCredential
    }
  ) {
    const credentialRecord = await this.credentialService.getById(credentialRecordId)
    const connection = await this.connectionService.getById(credentialRecord.connectionId)

    const credentialProposalMessage = credentialRecord.proposalMessage

    if (!credentialProposalMessage?.credentialProposal) {
      throw new AriesFrameworkError(
        `Credential record with id ${credentialRecordId} is missing required credential proposal`
      )
    }

    const credentialDefinitionId = config?.credentialDefinitionId ?? credentialProposalMessage.credentialDefinitionId

    credentialRecord.linkedAttachments = credentialProposalMessage.attachments?.filter((attachment) =>
      isLinkedAttachment(attachment)
    )

    if (!credentialDefinitionId) {
      throw new AriesFrameworkError(
        'Missing required credential definition id. If credential proposal message contains no credential definition id it must be passed to config.'
      )
    }

    // TODO: check if it is possible to issue credential based on proposal filters
    const { message } = await this.credentialService.createOfferAsResponse(credentialRecord, {
      preview: credentialProposalMessage.credentialProposal,
      credentialDefinitionId,
      comment: config?.comment,
      autoAcceptCredential: config?.autoAcceptCredential,
      attachments: credentialRecord.linkedAttachments,
    })

    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    return credentialRecord
  }

  /**
   * Negotiate a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param credentialRecordId The id of the credential record for which to accept the proposal
   * @param preview The new preview for negotiation
   * @param config Additional configuration to use for the offer
   * @returns Credential record associated with the credential offer
   *
   */
  public async negotiateProposal(
    credentialRecordId: string,
    preview: CredentialPreview,
    config?: {
      comment?: string
      credentialDefinitionId?: string
      autoAcceptCredential?: AutoAcceptCredential
    }
  ) {
    const credentialRecord = await this.credentialService.getById(credentialRecordId)
    const connection = await this.connectionService.getById(credentialRecord.connectionId)

    const credentialProposalMessage = credentialRecord.proposalMessage

    if (!credentialProposalMessage?.credentialProposal) {
      throw new AriesFrameworkError(
        `Credential record with id ${credentialRecordId} is missing required credential proposal`
      )
    }

    const credentialDefinitionId = config?.credentialDefinitionId ?? credentialProposalMessage.credentialDefinitionId

    if (!credentialDefinitionId) {
      throw new AriesFrameworkError(
        'Missing required credential definition id. If credential proposal message contains no credential definition id it must be passed to config.'
      )
    }

    const { message } = await this.credentialService.createOfferAsResponse(credentialRecord, {
      preview,
      credentialDefinitionId,
      comment: config?.comment,
      autoAcceptCredential: config?.autoAcceptCredential,
      attachments: credentialRecord.linkedAttachments,
    })

    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    return credentialRecord
  }

  /**
   * Initiate a new credential exchange as issuer by sending a credential offer message
   * to the connection with the specified connection id.
   *
   * @param connectionId The connection to send the credential offer to
   * @param credentialTemplate The credential template to use for the offer
   * @returns Credential record associated with the sent credential offer message
   */
  public async offerCredential(
    connectionId: string,
    credentialTemplate: CredentialOfferTemplate
  ): Promise<CredentialRecord> {
    const connection = await this.connectionService.getById(connectionId)

    const { message, credentialRecord } = await this.credentialService.createOffer(connection, credentialTemplate)

    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    return credentialRecord
  }

  /**
   * Accept a credential offer as holder (by sending a credential request message) to the connection
   * associated with the credential record.
   *
   * @param credentialRecordId The id of the credential record for which to accept the offer
   * @param config Additional configuration to use for the request
   * @returns Credential record associated with the sent credential request message
   *
   */
  public async acceptOffer(
    credentialRecordId: string,
    config?: { comment?: string; autoAcceptCredential?: AutoAcceptCredential }
  ) {
    const credentialRecord = await this.credentialService.getById(credentialRecordId)
    const connection = await this.connectionService.getById(credentialRecord.connectionId)

    const { message } = await this.credentialService.createRequest(credentialRecord, config)

    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    return credentialRecord
  }

  /**
   * Negotiate a credential offer as holder (by sending a credential proposal message) to the connection
   * associated with the credential record.
   *
   * @param credentialRecordId The id of the credential record for which to accept the offer
   * @param preview The new preview for negotiation
   * @param config Additional configuration to use for the request
   * @returns Credential record associated with the sent credential request message
   *
   */
  public async negotiateOffer(
    credentialRecordId: string,
    preview: CredentialPreview,
    config?: { comment?: string; autoAcceptCredential?: AutoAcceptCredential }
  ) {
    const credentialRecord = await this.credentialService.getById(credentialRecordId)
    const connection = await this.connectionService.getById(credentialRecord.connectionId)

    const { message } = await this.credentialService.createProposalAsResponse(credentialRecord, {
      ...config,
      credentialProposal: preview,
    })

    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    return credentialRecord
  }

  /**
   * Accept a credential request as issuer (by sending a credential message) to the connection
   * associated with the credential record.
   *
   * @param credentialRecordId The id of the credential record for which to accept the request
   * @param config Additional configuration to use for the credential
   * @returns Credential record associated with the sent presentation message
   *
   */
  public async acceptRequest(
    credentialRecordId: string,
    config?: { comment?: string; autoAcceptCredential?: AutoAcceptCredential }
  ) {
    const credentialRecord = await this.credentialService.getById(credentialRecordId)
    const connection = await this.connectionService.getById(credentialRecord.connectionId)

    this.logger.info(`Accepting request for credential record ${credentialRecordId}`)

    const { message } = await this.credentialService.createCredential(credentialRecord, config)
    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    return credentialRecord
  }

  /**
   * Accept a credential as holder (by sending a credential acknowledgement message) to the connection
   * associated with the credential record.
   *
   * @param credentialRecordId The id of the credential record for which to accept the credential
   * @returns credential record associated with the sent credential acknowledgement message
   *
   */
  public async acceptCredential(credentialRecordId: string) {
    const credentialRecord = await this.credentialService.getById(credentialRecordId)
    const connection = await this.connectionService.getById(credentialRecord.connectionId)

    const { message } = await this.credentialService.createAck(credentialRecord)
    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    return credentialRecord
  }

  /**
   * Retrieve all credential records
   *
   * @returns List containing all credential records
   */
  public getAll(): Promise<CredentialRecord[]> {
    return this.credentialService.getAll()
  }

  /**
   * Retrieve a credential record by id
   *
   * @param credentialRecordId The credential record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The credential record
   *
   */
  public getById(credentialRecordId: string) {
    return this.credentialService.getById(credentialRecordId)
  }

  /**
   * Find a credential record by id
   *
   * @param credentialRecordId the credential record id
   * @returns The credential record or null if not found
   */
  public findById(connectionId: string): Promise<CredentialRecord | null> {
    return this.credentialService.findById(connectionId)
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
  public getByConnectionAndThreadId(connectionId: string, threadId: string): Promise<CredentialRecord> {
    return this.credentialService.getByConnectionAndThreadId(connectionId, threadId)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(
      new ProposeCredentialHandler(this.credentialService, this.agentConfig, this.credentialResponseCoordinator)
    )
    dispatcher.registerHandler(
      new OfferCredentialHandler(this.credentialService, this.agentConfig, this.credentialResponseCoordinator)
    )
    dispatcher.registerHandler(
      new RequestCredentialHandler(this.credentialService, this.agentConfig, this.credentialResponseCoordinator)
    )
    dispatcher.registerHandler(
      new IssueCredentialHandler(this.credentialService, this.agentConfig, this.credentialResponseCoordinator)
    )
    dispatcher.registerHandler(new CredentialAckHandler(this.credentialService))
  }
}
