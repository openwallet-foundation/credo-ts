import type { AgentMessage } from '../../agent/AgentMessage'
import type { Logger } from '../../logger'
import type { DeleteCredentialOptions } from './CredentialServiceOptions'
import type {
  AcceptOfferOptions,
  AcceptProposalOptions,
  AcceptRequestOptions,
  NegotiateOfferOptions,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from './CredentialsModuleOptions'
import type { CredentialExchangeRecord } from './repository/CredentialExchangeRecord'
import type { CredentialService } from './services/CredentialService'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { ServiceDecorator } from '../../decorators/service/ServiceDecorator'
import { AriesFrameworkError } from '../../error'
import { DidCommMessageRole } from '../../storage'
import { DidCommMessageRepository } from '../../storage/didcomm/DidCommMessageRepository'
import { ConnectionService } from '../connections/services'
import { MediationRecipientService } from '../routing'

import { CredentialProtocolVersion } from './CredentialProtocolVersion'
import { CredentialState } from './CredentialState'
import { V1CredentialService } from './protocol/v1/V1CredentialService'
import { V2CredentialService } from './protocol/v2/V2CredentialService'
import { CredentialRepository } from './repository/CredentialRepository'

export interface CredentialsModule {
  // Proposal methods
  proposeCredential(options: ProposeCredentialOptions): Promise<CredentialExchangeRecord>
  acceptProposal(options: AcceptProposalOptions): Promise<CredentialExchangeRecord>
  negotiateProposal(options: NegotiateProposalOptions): Promise<CredentialExchangeRecord>

  // Offer methods
  offerCredential(options: OfferCredentialOptions): Promise<CredentialExchangeRecord>
  acceptOffer(options: AcceptOfferOptions): Promise<CredentialExchangeRecord>
  declineOffer(credentialRecordId: string): Promise<CredentialExchangeRecord>
  negotiateOffer(options: NegotiateOfferOptions): Promise<CredentialExchangeRecord>
  // out of band
  createOffer(options: OfferCredentialOptions): Promise<{
    message: AgentMessage
    credentialRecord: CredentialExchangeRecord
  }>
  // Request
  // This is for beginning the exchange with a request (no proposal or offer). Only possible
  // (currently) with W3C. We will not implement this in phase I
  // requestCredential(credentialOptions: RequestCredentialOptions): Promise<CredentialExchangeRecord>

  // when the issuer accepts the request he issues the credential to the holder
  acceptRequest(options: AcceptRequestOptions): Promise<CredentialExchangeRecord>

  // Credential
  acceptCredential(credentialRecordId: string): Promise<CredentialExchangeRecord>

  // Record Methods
  getAll(): Promise<CredentialExchangeRecord[]>
  getById(credentialRecordId: string): Promise<CredentialExchangeRecord>
  findById(credentialRecordId: string): Promise<CredentialExchangeRecord | null>
  deleteById(credentialRecordId: string, options?: DeleteCredentialOptions): Promise<void>
}

@scoped(Lifecycle.ContainerScoped)
export class CredentialsModule implements CredentialsModule {
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private credentialRepository: CredentialRepository
  private agentConfig: AgentConfig
  private didCommMessageRepo: DidCommMessageRepository
  private v1Service: V1CredentialService
  private v2Service: V2CredentialService
  private mediatorRecipientService: MediationRecipientService
  private logger: Logger
  private serviceMap: { [key in CredentialProtocolVersion]: CredentialService }

  // note some of the parameters passed in here are temporary, as we intend
  // to eventually remove CredentialsModule
  public constructor(
    messageSender: MessageSender,
    connectionService: ConnectionService,
    agentConfig: AgentConfig,
    credentialRepository: CredentialRepository,
    mediationRecipientService: MediationRecipientService,
    didCommMessageRepository: DidCommMessageRepository,
    v1Service: V1CredentialService,
    v2Service: V2CredentialService
  ) {
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.credentialRepository = credentialRepository
    this.agentConfig = agentConfig
    this.mediatorRecipientService = mediationRecipientService
    this.didCommMessageRepo = didCommMessageRepository
    this.logger = agentConfig.logger

    this.v1Service = v1Service
    this.v2Service = v2Service

    this.serviceMap = {
      [CredentialProtocolVersion.V1]: this.v1Service,
      [CredentialProtocolVersion.V2]: this.v2Service,
    }
    this.logger.debug(`Initializing Credentials Module for agent ${this.agentConfig.label}`)
  }

  public getService(protocolVersion: CredentialProtocolVersion): CredentialService {
    return this.serviceMap[protocolVersion]
  }

  public async declineOffer(credentialRecordId: string): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(credentialRecordId)
    credentialRecord.assertState(CredentialState.OfferReceived)

    // with version we can get the Service
    const service = this.getService(credentialRecord.protocolVersion)
    await service.updateState(credentialRecord, CredentialState.Declined)

    return credentialRecord
  }

  public async negotiateOffer(options: NegotiateOfferOptions): Promise<CredentialExchangeRecord> {
    if (!options.credentialRecordId) {
      throw new AriesFrameworkError(`No credential record id found in negotiateCredentialOffer`)
    }
    const credentialRecord = await this.getById(options.credentialRecordId)
    const version = credentialRecord.protocolVersion

    const service = this.getService(version)
    const { message } = await service.negotiateOffer(options, credentialRecord)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connection id for credential record ${credentialRecord.id} not found. Connection-less issuance does not support negotiation`
      )
    }
    const connection = await this.connectionService.getById(credentialRecord.connectionId)

    const outboundMessage = createOutboundMessage(connection, message)

    await this.messageSender.sendMessage(outboundMessage)

    return credentialRecord
  }

  /**
   * Initiate a new credential exchange as holder by sending a credential proposal message
   * to the connection with the specified credential options
   *
   * @param options configuration to use for the proposal
   * @returns Credential exchange record associated with the sent proposal message
   */

  public async proposeCredential(options: ProposeCredentialOptions): Promise<CredentialExchangeRecord> {
    // get the version
    const version = options.protocolVersion

    // with version we can get the Service
    if (!version) {
      throw new AriesFrameworkError('Missing Protocol Version')
    }
    const service = this.getService(version)

    this.logger.debug(`Got a CredentialService object for version ${version}`)

    const connection = await this.connectionService.getById(options.connectionId)

    // will get back a credential record -> map to Credential Exchange Record
    const { credentialRecord, message } = await service.createProposal(options)

    this.logger.debug('We have a message (sending outbound): ', message)

    // send the message here
    const outbound = createOutboundMessage(connection, message)

    this.logger.debug('In proposeCredential: Send Proposal to Issuer')
    await this.messageSender.sendMessage(outbound)
    return credentialRecord
  }

  /**
   * Accept a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param options config object for the proposal (and subsequent offer) which replaces previous named parameters
   * @returns Credential exchange record associated with the credential offer
   *
   */
  public async acceptProposal(options: AcceptProposalOptions): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(options.credentialRecordId)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError('Missing connection id in v2 acceptCredentialProposal')
    }
    const version = credentialRecord.protocolVersion

    // with version we can get the Service
    const service = this.getService(version)

    // will get back a credential record -> map to Credential Exchange Record
    const { message } = await service.acceptProposal(options, credentialRecord)

    const connection = await this.connectionService.getById(credentialRecord.connectionId)

    this.logger.debug('We have an offer message (sending outbound): ', message)

    // send the message here
    const outbound = createOutboundMessage(connection, message)

    this.logger.debug('In acceptCredentialProposal: Send Proposal to Issuer')
    await this.messageSender.sendMessage(outbound)

    return credentialRecord
  }

  /**
   * Accept a credential offer as holder (by sending a credential request message) to the connection
   * associated with the credential record.
   *
   * @param options The object containing config options of the offer to be accepted
   * @returns Object containing offer associated credential record
   */
  public async acceptOffer(options: AcceptOfferOptions): Promise<CredentialExchangeRecord> {
    const record = await this.getById(options.credentialRecordId)

    const service = this.getService(record.protocolVersion)

    this.logger.debug(`Got a CredentialService object for this version; version = ${service.getVersion()}`)

    const offerMessage = await service.getOfferMessage(record.id)

    // Use connection if present
    if (record.connectionId) {
      const connection = await this.connectionService.getById(record.connectionId)

      const requestOptions: RequestCredentialOptions = {
        comment: options.comment,
        autoAcceptCredential: options.autoAcceptCredential,
      }
      const { message, credentialRecord } = await service.createRequest(record, requestOptions, connection.did)

      await this.didCommMessageRepo.saveAgentMessage({
        agentMessage: message,
        role: DidCommMessageRole.Sender,
        associatedRecordId: credentialRecord.id,
      })
      this.logger.debug('We have sent a credential request')
      const outboundMessage = createOutboundMessage(connection, message)

      this.logger.debug('We have a proposal message (sending outbound): ', message)

      await this.messageSender.sendMessage(outboundMessage)
      await this.credentialRepository.update(credentialRecord)
      return credentialRecord
    }
    // Use ~service decorator otherwise
    else if (offerMessage?.service) {
      // Create ~service decorator
      const routing = await this.mediatorRecipientService.getRouting()
      const ourService = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.verkey],
        routingKeys: routing.routingKeys,
      })
      const recipientService = offerMessage.service

      const requestOptions: RequestCredentialOptions = {
        comment: options.comment,
        autoAcceptCredential: options.autoAcceptCredential,
      }
      const { message, credentialRecord } = await service.createRequest(
        record,
        requestOptions,
        ourService.recipientKeys[0]
      )

      // Set and save ~service decorator to record (to remember our verkey)
      message.service = ourService
      await this.didCommMessageRepo.saveAgentMessage({
        agentMessage: message,
        role: DidCommMessageRole.Sender,
        associatedRecordId: credentialRecord.id,
      })
      await this.credentialRepository.update(credentialRecord)

      await this.messageSender.sendMessageToService({
        message,
        service: recipientService.resolvedDidCommService,
        senderKey: ourService.resolvedDidCommService.recipientKeys[0],
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
   * Negotiate a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param options configuration for the offer see {@link NegotiateProposalOptions}
   * @returns Credential exchange record associated with the credential offer
   *
   */
  public async negotiateProposal(options: NegotiateProposalOptions): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(options.credentialRecordId)

    // get the version
    const version = credentialRecord.protocolVersion

    // with version we can get the Service
    const service = this.getService(version)
    const { message } = await service.negotiateProposal(options, credentialRecord)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connection id for credential record ${credentialRecord.id} not found. Connection-less issuance does not support negotiation`
      )
    }
    const connection = await this.connectionService.getById(credentialRecord.connectionId)
    // use record connection id to get the connection

    const outboundMessage = createOutboundMessage(connection, message)

    await this.messageSender.sendMessage(outboundMessage)

    return credentialRecord
  }

  /**
   * Initiate a new credential exchange as issuer by sending a credential offer message
   * to the connection with the specified connection id.
   *
   * @param options config options for the credential offer
   * @returns Credential exchange record associated with the sent credential offer message
   */
  public async offerCredential(options: OfferCredentialOptions): Promise<CredentialExchangeRecord> {
    if (!options.connectionId) {
      throw new AriesFrameworkError('Missing connectionId on offerCredential')
    }
    const connection = await this.connectionService.getById(options.connectionId)

    const service = this.getService(options.protocolVersion)

    this.logger.debug(`Got a CredentialService object for version ${options.protocolVersion}`)
    const { message, credentialRecord } = await service.createOffer(options)

    this.logger.debug('Offer Message successfully created; message= ', message)
    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)
    return credentialRecord
  }

  /**
   * Accept a credential request as holder (by sending a credential request message) to the connection
   * associated with the credential record.
   *
   * @param options The object containing config options of the request
   * @returns CredentialExchangeRecord updated with information pertaining to this request
   */
  public async acceptRequest(options: AcceptRequestOptions): Promise<CredentialExchangeRecord> {
    if (!options.credentialRecordId) {
      throw new AriesFrameworkError('Missing credential record id in acceptRequest')
    }
    const record = await this.getById(options.credentialRecordId)

    // with version we can get the Service
    const service = this.getService(record.protocolVersion)

    this.logger.debug(`Got a CredentialService object for version ${record.protocolVersion}`)

    const { message, credentialRecord } = await service.createCredential(record, options)
    this.logger.debug('We have a credential message (sending outbound): ', message)

    const requestMessage = await service.getRequestMessage(credentialRecord.id)
    const offerMessage = await service.getOfferMessage(credentialRecord.id)

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

      message.service = ourService
      await this.credentialRepository.update(credentialRecord)

      await this.messageSender.sendMessageToService({
        message,
        service: recipientService.resolvedDidCommService,
        senderKey: ourService.resolvedDidCommService.recipientKeys[0],
        returnRoute: true,
      })
    }
    // Cannot send message without connectionId or ~service decorator
    else {
      throw new AriesFrameworkError(
        `Cannot accept request for credential record without connectionId or ~service decorator on credential offer / request.`
      )
    }
    await this.didCommMessageRepo.saveAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

    return credentialRecord
  }

  /**
   * Accept a credential as holder (by sending a credential acknowledgement message) to the connection
   * associated with the credential record.
   *
   * @param credentialRecordId The id of the credential record for which to accept the credential
   * @returns credential exchange record associated with the sent credential acknowledgement message
   *
   */
  public async acceptCredential(credentialRecordId: string): Promise<CredentialExchangeRecord> {
    const record = await this.getById(credentialRecordId)

    // with version we can get the Service
    const service = this.getService(record.protocolVersion)

    this.logger.debug(`Got a CredentialService object for version ${record.protocolVersion}`)

    const { message, credentialRecord } = await service.createAck(record)

    const requestMessage = await service.getRequestMessage(credentialRecord.id)
    const credentialMessage = await service.getCredentialMessage(credentialRecord.id)

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
        service: recipientService.resolvedDidCommService,
        senderKey: ourService.resolvedDidCommService.recipientKeys[0],
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
   * Retrieve all credential records
   *
   * @returns List containing all credential records
   */
  public getAll(): Promise<CredentialExchangeRecord[]> {
    return this.credentialRepository.getAll()
  }

  /**
   * Find a credential record by id
   *
   * @param credentialRecordId the credential record id
   * @returns The credential record or null if not found
   */
  public findById(credentialRecordId: string): Promise<CredentialExchangeRecord | null> {
    return this.credentialRepository.findById(credentialRecordId)
  }

  /**
   * Delete a credential record by id, also calls service to delete from wallet
   *
   * @param credentialId the credential record id
   * @param options the delete credential options for the delete operation
   */
  public async deleteById(credentialId: string, options?: DeleteCredentialOptions) {
    const credentialRecord = await this.getById(credentialId)
    const service = this.getService(credentialRecord.protocolVersion)
    return service.deleteById(credentialId, options)
  }

  /**
   * Initiate a new credential exchange as issuer by creating a credential offer
   * not bound to any connection. The offer must be delivered out-of-band to the holder
   * @param options The credential options to use for the offer
   * @returns The credential record and credential offer message
   */
  public async createOffer(options: OfferCredentialOptions): Promise<{
    message: AgentMessage
    credentialRecord: CredentialExchangeRecord
  }> {
    const service = this.getService(options.protocolVersion)

    this.logger.debug(`Got a CredentialService object for version ${options.protocolVersion}`)
    const { message, credentialRecord } = await service.createOffer(options)

    this.logger.debug('Offer Message successfully created; message= ', message)

    return { message, credentialRecord }
  }
}
