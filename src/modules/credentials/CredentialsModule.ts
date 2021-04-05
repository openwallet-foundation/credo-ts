import { CredentialRecord } from './repository/CredentialRecord'
import { createOutboundMessage } from '../../agent/helpers'
import { MessageSender } from '../../agent/MessageSender'
import { ConnectionService } from '../connections'
import { EventEmitter } from 'events'
import { CredentialOfferTemplate, CredentialService } from './services'
import { ProposeCredentialMessage, ProposeCredentialMessageOptions } from './messages'
import { JsonTransformer } from '../../utils/JsonTransformer'
import { CredentialInfo } from './models'
import { Dispatcher } from '../../agent/Dispatcher'
import {
  ProposeCredentialHandler,
  OfferCredentialHandler,
  RequestCredentialHandler,
  IssueCredentialHandler,
  CredentialAckHandler,
} from './handlers'

export class CredentialsModule {
  private connectionService: ConnectionService
  private credentialService: CredentialService
  private messageSender: MessageSender

  public constructor(
    dispatcher: Dispatcher,
    connectionService: ConnectionService,
    credentialService: CredentialService,
    messageSender: MessageSender
  ) {
    this.connectionService = connectionService
    this.credentialService = credentialService
    this.messageSender = messageSender
    this.registerHandlers(dispatcher)
  }

  /**
   * Get the event emitter for the credential service. Will emit state changed events
   * when the state of credential records changes.
   *
   * @returns event emitter for credential related state changes
   */
  public get events(): EventEmitter {
    return this.credentialService
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
    const connection = await this.connectionService.getById(credentialRecord.connectionId)

    // FIXME: transformation should be handled by record class
    const credentialProposalMessage = JsonTransformer.fromJSON(
      credentialRecord.proposalMessage,
      ProposeCredentialMessage
    )

    if (!credentialProposalMessage.credentialProposal) {
      throw new Error(`Credential record with id ${credentialRecordId} is missing required credential proposal`)
    }

    const credentialDefinitionId = config?.credentialDefinitionId ?? credentialProposalMessage.credentialDefinitionId

    if (!credentialDefinitionId) {
      throw new Error(
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
  public async acceptOffer(credentialRecordId: string, config?: { comment?: string }) {
    const credentialRecord = await this.credentialService.getById(credentialRecordId)
    const connection = await this.connectionService.getById(credentialRecord.connectionId)

    const { message } = await this.credentialService.createRequest(credentialRecord, config)

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
  public async acceptRequest(credentialRecordId: string, config?: { comment?: string }) {
    const credentialRecord = await this.credentialService.getById(credentialRecordId)
    const connection = await this.connectionService.getById(credentialRecord.connectionId)

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
  public async getAll(): Promise<CredentialRecord[]> {
    return this.credentialService.getAll()
  }

  /**
   * Retrieve a credential record by id
   *
   * @param credentialRecordId The credential record id
   * @throws {Error} If no record is found
   * @return The credential record
   *
   */
  public async getById(credentialRecordId: string) {
    return this.credentialService.getById(credentialRecordId)
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
    return this.credentialService.getByThreadId(threadId)
  }

  /**
   * Retrieve an indy credential by credential id (referent)
   *
   * @param credentialId the id (referent) of the indy credential
   * @returns Indy credential info object
   */
  public async getIndyCredential(credentialId: string): Promise<CredentialInfo> {
    return this.credentialService.getIndyCredential(credentialId)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new ProposeCredentialHandler(this.credentialService))
    dispatcher.registerHandler(new OfferCredentialHandler(this.credentialService))
    dispatcher.registerHandler(new RequestCredentialHandler(this.credentialService))
    dispatcher.registerHandler(new IssueCredentialHandler(this.credentialService))
    dispatcher.registerHandler(new CredentialAckHandler(this.credentialService))
  }
}
