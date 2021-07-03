import type { OfferCredentialMessage, ProposeCredentialMessageOptions } from './messages'
import type { CredentialRecord } from './repository/CredentialRecord'
import type { CredentialOfferTemplate } from './services'

import { Lifecycle, scoped } from 'tsyringe'

import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { AriesFrameworkError } from '../../error'
import { ConnectionService } from '../connections'

import {
  ProposeCredentialHandler,
  OfferCredentialHandler,
  RequestCredentialHandler,
  IssueCredentialHandler,
  CredentialAckHandler,
} from './handlers'
import { CredentialRepository } from './repository/CredentialRepository'
import { CredentialService } from './services'

@scoped(Lifecycle.ContainerScoped)
export class CredentialsModule {
  private connectionService: ConnectionService
  private credentialRepository: CredentialRepository
  private credentialService: CredentialService
  private messageSender: MessageSender

  public constructor(
    dispatcher: Dispatcher,
    connectionService: ConnectionService,
    credentialRepository: CredentialRepository,
    credentialService: CredentialService,
    messageSender: MessageSender
  ) {
    this.connectionService = connectionService
    this.credentialService = credentialService
    this.credentialRepository = credentialRepository
    this.messageSender = messageSender
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
  public async proposeCredential(connectionId: string, config?: Omit<ProposeCredentialMessageOptions, 'id'>) {
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
    }
  ) {
    const credentialRecord = await this.credentialService.getById(credentialRecordId)
    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support credential proposal or negotiation.`
      )
    }

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

    // TODO: check if it is possible to issue credential based on proposal filters
    const { message } = await this.credentialService.createOfferAsResponse(credentialRecord, {
      preview: credentialProposalMessage.credentialProposal,
      credentialDefinitionId,
      comment: config?.comment,
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

    const { message, credentialRecord } = await this.credentialService.createOffer(credentialTemplate, connection)

    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    return credentialRecord
  }

  /**
   * Initiate a new credential exchange as issuer by creating a credential offer
   * not bound to any connection. The offer must be delivered out-of-band to the holder
   *
   * @param credentialTemplate The credential template to use for the offer
   * @returns The credential record and credential offer message
   */
  public async createOutOfBandOffer(credentialTemplate: CredentialOfferTemplate): Promise<{
    offerMessage: OfferCredentialMessage
    credentialRecord: CredentialRecord
  }> {
    const { message, credentialRecord } = await this.credentialService.createOffer(credentialTemplate)

    // Create and set ~service decorator
    const ourService = await this.connectionService.createEphemeralService()
    message.service = ourService

    // Save ~service decorator to record (to remember our verkey)
    credentialRecord.offerMessage = message
    await this.credentialRepository.update(credentialRecord)

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
  public async acceptOffer(credentialRecordId: string, config?: { comment?: string }): Promise<CredentialRecord> {
    const record = await this.credentialService.getById(credentialRecordId)

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
    else if (record.offerMessage?.service) {
      // Create ~service decorator
      const ourService = await this.connectionService.createEphemeralService()
      const recipientService = record.offerMessage.service

      const { message, credentialRecord } = await this.credentialService.createRequest(record, {
        ...config,
        holderDid: ourService.recipientKeys[0],
      })

      // Set and save ~service decorator to record (to remember our verkey)
      message.service = ourService
      credentialRecord.requestMessage = message
      await this.credentialRepository.update(credentialRecord)

      await this.messageSender.sendMessageToService({
        message,
        service: recipientService.toDidCommService(),
        senderKey: ourService.recipientKeys[0],
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
   * Accept a credential request as issuer (by sending a credential message) to the connection
   * associated with the credential record.
   *
   * @param credentialRecordId The id of the credential record for which to accept the request
   * @param config Additional configuration to use for the credential
   * @returns Credential record associated with the sent presentation message
   *
   */
  public async acceptRequest(credentialRecordId: string, config?: { comment?: string }) {
    const record = await this.credentialService.getById(credentialRecordId)
    const { message, credentialRecord } = await this.credentialService.createCredential(record, config)

    // Use connection if present
    if (credentialRecord.connectionId) {
      const connection = await this.connectionService.getById(credentialRecord.connectionId)
      const outboundMessage = createOutboundMessage(connection, message)

      await this.messageSender.sendMessage(outboundMessage)
    }
    // Use ~service decorator otherwise
    else if (credentialRecord.requestMessage?.service && credentialRecord.offerMessage?.service) {
      const recipientService = credentialRecord.requestMessage.service
      const ourService = credentialRecord.offerMessage.service

      // Set ~service, update message in record (for later use)
      message.setService(ourService)
      credentialRecord.credentialMessage = message
      await this.credentialRepository.update(credentialRecord)

      await this.messageSender.sendMessageToService({
        message,
        service: recipientService.toDidCommService(),
        senderKey: ourService.recipientKeys[0],
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
  public async acceptCredential(credentialRecordId: string) {
    const record = await this.credentialService.getById(credentialRecordId)
    const { message, credentialRecord } = await this.credentialService.createAck(record)

    if (credentialRecord.connectionId) {
      const connection = await this.connectionService.getById(credentialRecord.connectionId)
      const outboundMessage = createOutboundMessage(connection, message)

      await this.messageSender.sendMessage(outboundMessage)
    }
    // Use ~service decorator otherwise
    else if (credentialRecord.credentialMessage?.service && credentialRecord.requestMessage?.service) {
      const recipientService = credentialRecord.credentialMessage.service
      const ourService = credentialRecord.requestMessage.service

      await this.messageSender.sendMessageToService({
        message,
        service: recipientService.toDidCommService(),
        senderKey: ourService.recipientKeys[0],
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

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new ProposeCredentialHandler(this.credentialService))
    dispatcher.registerHandler(new OfferCredentialHandler(this.credentialService))
    dispatcher.registerHandler(new RequestCredentialHandler(this.credentialService))
    dispatcher.registerHandler(new IssueCredentialHandler(this.credentialService))
    dispatcher.registerHandler(new CredentialAckHandler(this.credentialService))
  }
}
