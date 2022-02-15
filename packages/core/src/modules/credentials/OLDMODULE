import type { AutoAcceptCredential } from './CredentialAutoAcceptType'
import type { CredentialExchangeRecord } from './repository/CredentialRecord'
import type { CredentialOfferTemplate, CredentialProposeOptions } from './v1'
import type { V1CredentialPreview } from './v1/V1CredentialPreview'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { ServiceDecorator } from '../../decorators/service/ServiceDecorator'
import { AriesFrameworkError } from '../../error'
import { DidCommMessageRepository, DidCommMessageRole } from '../../storage'
import { isLinkedAttachment } from '../../utils/attachment'
import { ConnectionService } from '../connections/services/ConnectionService'
import { MediationRecipientService } from '../routing'

import { CredentialResponseCoordinator } from './CredentialResponseCoordinator'
import { CredentialProblemReportReason } from './errors'
import { V1LegacyCredentialService } from './v1/V1LegacyCredentialService'
import {
  CredentialAckHandler,
  IssueCredentialHandler,
  OfferCredentialHandler,
  ProposeCredentialHandler,
  RequestCredentialHandler,
  CredentialProblemReportHandler,
} from './v1/handlers'
import {
  RequestCredentialMessage,
  OfferCredentialMessage,
  CredentialProblemReportMessage,
  ProposeCredentialMessage,
  IssueCredentialMessage,
} from './v1/messages'

@scoped(Lifecycle.ContainerScoped)
export class CredentialsModule {
  private connectionService: ConnectionService
  private credentialService: V1LegacyCredentialService
  private messageSender: MessageSender
  private agentConfig: AgentConfig
  private credentialResponseCoordinator: CredentialResponseCoordinator
  private mediationRecipientService: MediationRecipientService
  private didCommMessageRepository: DidCommMessageRepository

  public constructor(
    dispatcher: Dispatcher,
    connectionService: ConnectionService,
    credentialService: V1LegacyCredentialService,
    messageSender: MessageSender,
    agentConfig: AgentConfig,
    credentialResponseCoordinator: CredentialResponseCoordinator,
    mediationRecipientService: MediationRecipientService,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.connectionService = connectionService
    this.credentialService = credentialService
    this.messageSender = messageSender
    this.agentConfig = agentConfig
    this.credentialResponseCoordinator = credentialResponseCoordinator
    this.mediationRecipientService = mediationRecipientService
    this.didCommMessageRepository = didCommMessageRepository
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

  // MOVED INTO V1CredentialService.createProposal
  // MJR-TODO
  // leave here until the auto accept v2 stuff is done then remove
  public async OLDproposeCredential(connectionId: string, config?: CredentialProposeOptions) {
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
  public async OLDacceptProposal(
    credentialRecordId: string,
    config?: {
      comment?: string
      credentialDefinitionId?: string
      autoAcceptCredential?: AutoAcceptCredential
    }
  ) {
    const credentialRecord = await this.credentialService.getById(credentialRecordId)
    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support credential proposal or negotiation.`
      )
    }

    const connection = await this.connectionService.getById(credentialRecord.connectionId)

    const proposalMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: ProposeCredentialMessage,
    })
    if (!proposalMessage?.credentialProposal) {
      throw new AriesFrameworkError(
        `Credential record with id ${credentialRecordId} is missing required credential proposal`
      )
    }

    const credentialDefinitionId = config?.credentialDefinitionId ?? proposalMessage.credentialDefinitionId

    credentialRecord.linkedAttachments = proposalMessage.messageAttachment?.filter((attachment) =>
      isLinkedAttachment(attachment)
    )

    if (!credentialDefinitionId) {
      throw new AriesFrameworkError(
        'Missing required credential definition id. If credential proposal message contains no credential definition id it must be passed to config.'
      )
    }

    // TODO: check if it is possible to issue credential based on proposal filters
    const { message } = await this.credentialService.createOfferAsResponse(credentialRecord, {
      preview: proposalMessage.credentialProposal,
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
  public async OLDnegotiateProposal(
    credentialRecordId: string,
    preview: V1CredentialPreview,
    config?: {
      comment?: string
      credentialDefinitionId?: string
      autoAcceptCredential?: AutoAcceptCredential
    }
  ) {
    const credentialRecord = await this.credentialService.getById(credentialRecordId)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support negotiation.`
      )
    }
    const connection = await this.connectionService.getById(credentialRecord.connectionId)

    const proposalMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: ProposeCredentialMessage,
    })

    if (!proposalMessage?.credentialProposal) {
      throw new AriesFrameworkError(
        `Credential record with id ${credentialRecordId} is missing required credential proposal`
      )
    }

    const credentialDefinitionId = config?.credentialDefinitionId ?? proposalMessage.credentialDefinitionId

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
  public async OLDofferCredential(
    connectionId: string,
    credentialTemplate: CredentialOfferTemplate
  ): Promise<CredentialExchangeRecord> {
    const connection = await this.connectionService.getById(connectionId)

    const { message, credentialRecord } = await this.credentialService.createOffer(credentialTemplate, connection)

    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    return credentialRecord
  }

  // MJR-TODO move this into CredentialsAPI
  /**
   * Initiate a new credential exchange as issuer by creating a credential offer
   * not bound to any connection. The offer must be delivered out-of-band to the holder
   *
   * @param credentialTemplate The credential template to use for the offer
   * @returns The credential record and credential offer message
   */
  public async createOutOfBandOffer(credentialTemplate: CredentialOfferTemplate): Promise<{
    offerMessage: OfferCredentialMessage
    credentialRecord: CredentialExchangeRecord
  }> {
    const { message, credentialRecord } = await this.credentialService.createOffer(credentialTemplate)

    // Create and set ~service decorator
    const routing = await this.mediationRecipientService.getRouting()
    message.service = new ServiceDecorator({
      serviceEndpoint: routing.endpoints[0],
      recipientKeys: [routing.verkey],
      routingKeys: routing.routingKeys,
    })

    // Save ~service decorator to record (to remember our verkey)
    await this.credentialService.update(credentialRecord)

    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
    return { credentialRecord, offerMessage: message }
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

  // MOVED INTO V1CredentialService.acceptOffer
  // MJR-TODO
  // leave here until the auto accept v2 accept offer is done (incl. tests) then remove
  public async OLDacceptOffer(
    credentialRecordId: string,
    config?: { comment?: string; autoAcceptCredential?: AutoAcceptCredential }
  ): Promise<CredentialExchangeRecord> {
    const record = await this.credentialService.getById(credentialRecordId)

    const offerMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: record.id,
      messageClass: OfferCredentialMessage,
    })
    const requestMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: record.id,
      messageClass: RequestCredentialMessage,
    })
    // Use connection if present
    if (record.connectionId) {
      const connection = await this.connectionService.getById(record.connectionId)

      const { message, credentialRecord } = await this.credentialService.createRequest(record, {
        ...config,
        holderDid: connection.did,
      })
      const outboundMessage = createOutboundMessage(connection, message)

      await this.messageSender.sendMessage(outboundMessage)
      return credentialRecord
    }
    // Use ~service decorator otherwise
    else if (offerMessage?.service) {
      // Create ~service decorator
      const routing = await this.mediationRecipientService.getRouting()
      const ourService = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.verkey],
        routingKeys: routing.routingKeys,
      })
      const recipientService = offerMessage.service

      const { message, credentialRecord } = await this.credentialService.createRequest(record, {
        ...config,
        holderDid: ourService.recipientKeys[0],
      })

      // Set and save ~service decorator to record (to remember our verkey)
      message.service = ourService
      await this.credentialService.update(credentialRecord)
      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: requestMessage,
        role: DidCommMessageRole.Sender,
        associatedRecordId: credentialRecord.id,
      })
      await this.messageSender.sendMessageToService({
        message,
        service: recipientService.toDidCommService(),
        senderKey: ourService.recipientKeys[0],
        returnRoute: true,
      })

      return credentialRecord
    }
    // Cannot send message without connectionId or ~service decorator
    else {
      throw new AriesFrameworkError(
        `Cannot accept offer for credential record without connectionId or ~service decorator on credential offer.`
      )
    }
  }

  /**
   * Declines an offer as holder
   * @param credentialRecordId the id of the credential to be declined
   * @returns credential record that was declined
   */
  public async OLDdeclineOffer(credentialRecordId: string) {
    const credentialRecord = await this.credentialService.getById(credentialRecordId)
    await this.credentialService.declineOffer(credentialRecord)
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
  public async OLDnegotiateOffer(
    credentialRecordId: string,
    preview: V1CredentialPreview,
    config?: { comment?: string; autoAcceptCredential?: AutoAcceptCredential }
  ) {
    const credentialRecord = await this.credentialService.getById(credentialRecordId)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support negotiation.`
      )
    }
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
  public async OLDacceptRequest(
    credentialRecordId: string,
    config?: { comment?: string; autoAcceptCredential?: AutoAcceptCredential }
  ) {
    const record = await this.credentialService.getById(credentialRecordId)
    const { message, credentialRecord } = await this.credentialService.createCredential(record, config)

    const requestMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: RequestCredentialMessage,
    })
    const offerMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: OfferCredentialMessage,
    })
    // Use connection if present
    if (credentialRecord.connectionId) {
      const connection = await this.connectionService.getById(credentialRecord.connectionId)
      const outboundMessage = createOutboundMessage(connection, message)

      await this.messageSender.sendMessage(outboundMessage)
    }
    // Use ~service decorator otherwise
    else if (requestMessage?.service && offerMessage?.service) {
      const recipientService = requestMessage.service
      const ourService = offerMessage.service

      // Set ~service, update message in record (for later use)
      message.setService(ourService)
      await this.credentialService.update(credentialRecord)
      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: message,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialRecord.id,
      })
      await this.messageSender.sendMessageToService({
        message,
        service: recipientService.toDidCommService(),
        senderKey: ourService.recipientKeys[0],
        returnRoute: true,
      })
    }
    // Cannot send message without connectionId or ~service decorator
    else {
      throw new AriesFrameworkError(
        `Cannot accept request for credential record without connectionId or ~service decorator on credential offer / request.`
      )
    }

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
  public async OLDacceptCredential(credentialRecordId: string) {
    const record = await this.credentialService.getById(credentialRecordId)
    const { message, credentialRecord } = await this.credentialService.createAck(record)

    const credentialMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: record.id,
      messageClass: IssueCredentialMessage,
    })
    const requestMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: record.id,
      messageClass: RequestCredentialMessage,
    })
    if (credentialRecord.connectionId) {
      const connection = await this.connectionService.getById(credentialRecord.connectionId)
      const outboundMessage = createOutboundMessage(connection, message)

      await this.messageSender.sendMessage(outboundMessage)
    }
    // Use ~service decorator otherwise
    else if (credentialMessage?.service && requestMessage?.service) {
      const recipientService = credentialMessage.service
      const ourService = requestMessage.service

      await this.messageSender.sendMessageToService({
        message,
        service: recipientService.toDidCommService(),
        senderKey: ourService.recipientKeys[0],
        returnRoute: true,
      })
    }
    // Cannot send message without connectionId or ~service decorator
    else {
      throw new AriesFrameworkError(
        `Cannot accept credential without connectionId or ~service decorator on credential message.`
      )
    }

    return credentialRecord
  }

  /**
   * Send problem report message for a credential record
   * @param credentialRecordId  The id of the credential record for which to send problem report
   * @param message message to send
   * @returns credential record associated with credential problem report message
   */
  public async sendProblemReport(credentialRecordId: string, message: string) {
    const record = await this.credentialService.getById(credentialRecordId)
    if (!record.connectionId) {
      throw new AriesFrameworkError(`No connectionId found for credential record '${record.id}'.`)
    }
    const connection = await this.connectionService.getById(record.connectionId)
    const credentialProblemReportMessage = new CredentialProblemReportMessage({
      description: {
        en: message,
        code: CredentialProblemReportReason.IssuanceAbandoned,
      },
    })
    credentialProblemReportMessage.setThread({
      threadId: record.threadId,
    })
    const outboundMessage = createOutboundMessage(connection, credentialProblemReportMessage)
    await this.messageSender.sendMessage(outboundMessage)

    return record
  }

  /**
   * Retrieve all credential records
   *
   * @returns List containing all credential records
   */
  public OLDgetAll(): Promise<CredentialExchangeRecord[]> {
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
  public OLDgetById(credentialRecordId: string) {
    return this.credentialService.getById(credentialRecordId)
  }

  /**
   * Find a credential record by id
   *
   * @param credentialRecordId the credential record id
   * @returns The credential record or null if not found
   */
  public OLDfindById(connectionId: string): Promise<CredentialExchangeRecord | null> {
    return this.credentialService.findById(connectionId)
  }

  /**
   * Delete a credential record by id
   *
   * @param credentialId the credential record id
   */
  public async OLDdeleteById(credentialId: string) {
    return this.credentialService.deleteById(credentialId)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(
      new ProposeCredentialHandler(
        this.credentialService,
        this.agentConfig,
        this.credentialResponseCoordinator,
        this.didCommMessageRepository
      )
    )
    dispatcher.registerHandler(
      new OfferCredentialHandler(
        this.credentialService,
        this.agentConfig,
        this.credentialResponseCoordinator,
        this.mediationRecipientService,
        this.didCommMessageRepository
      )
    )
    dispatcher.registerHandler(
      new RequestCredentialHandler(
        this.credentialService,
        this.agentConfig,
        this.credentialResponseCoordinator,
        this.didCommMessageRepository
      )
    )
    dispatcher.registerHandler(
      new IssueCredentialHandler(
        this.credentialService,
        this.agentConfig,
        this.credentialResponseCoordinator,
        this.didCommMessageRepository
      )
    )
    dispatcher.registerHandler(new CredentialAckHandler(this.credentialService))
    dispatcher.registerHandler(new CredentialProblemReportHandler(this.credentialService))
  }
}
