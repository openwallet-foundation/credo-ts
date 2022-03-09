import type { AgentMessage } from '../../agent/AgentMessage'
import type { CredentialService } from './CredentialService'
import type {
  AcceptOfferOptions,
  AcceptProposalOptions,
  AcceptRequestOptions,
  NegotiateOfferOptions,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from './interfaces'
import type { CredentialExchangeRecord } from './repository'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { ServiceDecorator } from '../../decorators/service/ServiceDecorator'
import { AriesFrameworkError } from '../../error'
import { ConsoleLogger, LogLevel } from '../../logger'
import { DidCommMessageRepository, DidCommMessageRole } from '../../storage'
import { ConnectionService } from '../connections/services/ConnectionService'
import { MediationRecipientService } from '../routing'

import { CredentialProtocolVersion } from './CredentialProtocolVersion'
import { CredentialState } from './CredentialState'
import { V1CredentialService } from './protocol/v1/V1CredentialService'
import { V1IssueCredentialMessage, V1OfferCredentialMessage, V1RequestCredentialMessage } from './protocol/v1/messages'
import { V2CredentialService } from './protocol/v2/V2CredentialService'
import { V2IssueCredentialMessage } from './protocol/v2/messages/V2IssueCredentialMessage'
import { V2OfferCredentialMessage } from './protocol/v2/messages/V2OfferCredentialMessage'
import { V2RequestCredentialMessage } from './protocol/v2/messages/V2RequestCredentialMessage'
import { CredentialRepository } from './repository'

export interface CredentialsModule {
  // Proposal methods
  proposeCredential(options: ProposeCredentialOptions): Promise<CredentialExchangeRecord>
  acceptCredentialProposal(options: AcceptProposalOptions): Promise<CredentialExchangeRecord>
  negotiateCredentialProposal(options: NegotiateProposalOptions): Promise<CredentialExchangeRecord>

  // Offer methods
  offerCredential(options: OfferCredentialOptions): Promise<CredentialExchangeRecord>
  acceptCredentialOffer(options: AcceptOfferOptions): Promise<CredentialExchangeRecord>
  declineCredentialOffer(
    credentialRecordId: string,
    version: CredentialProtocolVersion
  ): Promise<CredentialExchangeRecord>
  negotiateCredentialOffer(options: NegotiateOfferOptions): Promise<CredentialExchangeRecord>
  // out of band
  createOutOfBandOffer(options: OfferCredentialOptions): Promise<{
    message: AgentMessage
    credentialRecord: CredentialExchangeRecord
  }>
  // Request
  // This is for beginning the exchange with a request (no proposal or offer). Only possible
  // (currently) with W3C. We will not implement this in phase I
  // requestCredential(credentialOptions: RequestCredentialOptions): Promise<CredentialExchangeRecord>

  // when the issuer accepts the request he issues the credential to the holder
  acceptCredentialRequest(options: AcceptRequestOptions): Promise<CredentialExchangeRecord>

  // Credential
  acceptCredential(credentialRecordId: string, version: CredentialProtocolVersion): Promise<CredentialExchangeRecord>

  // Record Methods
  getAll(): Promise<CredentialExchangeRecord[]>
  getById(credentialRecordId: string): Promise<CredentialExchangeRecord>
  findById(credentialRecordId: string): Promise<CredentialExchangeRecord | null>
  deleteById(credentialRecordId: string): Promise<void>
}

const logger = new ConsoleLogger(LogLevel.info)

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

    this.v1Service = v1Service
    this.v2Service = v2Service

    this.serviceMap = {
      [CredentialProtocolVersion.V1]: this.v1Service,
      [CredentialProtocolVersion.V2]: this.v2Service,
    }
    logger.debug(`Initializing Credentials Module for agent ${this.agentConfig.label}`)
  }

  public getService(protocolVersion: CredentialProtocolVersion): CredentialService {
    return this.serviceMap[protocolVersion]
  }

  public async declineCredentialOffer(
    credentialRecordId: string,
    version: CredentialProtocolVersion
  ): Promise<CredentialExchangeRecord> {
    logger.trace(`version =${version}`)

    // with version we can get the Service
    const service = this.getService(version)

    const credentialRecord = await this.getById(credentialRecordId)

    credentialRecord.assertState(CredentialState.OfferReceived)

    await service.updateState(credentialRecord, CredentialState.Declined)

    credentialRecord.protocolVersion = version

    return credentialRecord
  }

  public async negotiateCredentialOffer(credentialOptions: NegotiateOfferOptions): Promise<CredentialExchangeRecord> {
    // get the version
    const version = credentialOptions.protocolVersion

    logger.debug(`version =${version}`)

    // with version we can get the Service
    const service = this.getService(version)

    if (!credentialOptions.credentialRecordId) {
      throw new AriesFrameworkError(`No credential record id found in negotiateCredentialOffer`)
    }
    const credentialRecord = await this.getById(credentialOptions.credentialRecordId)

    const { message } = await service.negotiateOffer(credentialOptions, credentialRecord)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connection id for credential record ${credentialRecord.credentialId} not found. Connection-less issuance does not support negotiation`
      )
    }
    const connection = await this.connectionService.getById(credentialRecord.connectionId)

    const outboundMessage = createOutboundMessage(connection, message)

    await this.messageSender.sendMessage(outboundMessage)

    credentialRecord.protocolVersion = version

    return credentialRecord
  }

  /**
   * Initiate a new credential exchange as holder by sending a credential proposal message
   * to the connection with the specified credential options
   *
   * @param credentialOptions configuration to use for the proposal
   * @returns Credential exchange record associated with the sent proposal message
   */

  public async proposeCredential(credentialOptions: ProposeCredentialOptions): Promise<CredentialExchangeRecord> {
    // get the version
    const version = credentialOptions.protocolVersion

    logger.debug(`version =${version}`)

    // with version we can get the Service
    const service = this.getService(version)

    logger.debug('Got a CredentialService object for this version')

    const connection = await this.connectionService.getById(credentialOptions.connectionId)

    // will get back a credential record -> map to Credential Exchange Record
    const { credentialRecord, message } = await service.createProposal(credentialOptions)

    logger.debug('We have a message (sending outbound): ', message)

    // send the message here
    const outbound = createOutboundMessage(connection, message)

    logger.debug('In proposeCredential: Send Proposal to Issuer')
    await this.messageSender.sendMessage(outbound)
    credentialRecord.protocolVersion = version
    return credentialRecord
  }

  /**
   * Accept a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param credentialOptions config object for the proposal (and subsequent offer) which replaces previous named parameters
   * @returns Credential exchange record associated with the credential offer
   *
   */
  public async acceptCredentialProposal(credentialOptions: AcceptProposalOptions): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(credentialOptions.credentialRecordId)
    const version = credentialRecord.protocolVersion

    // with version we can get the Service
    const service = this.getService(version)

    // will get back a credential record -> map to Credential Exchange Record
    const { message } = await service.acceptProposal(credentialOptions, credentialRecord)

    const connection = await this.connectionService.getById(credentialOptions.connectionId)

    logger.debug('We have an offer message (sending outbound): ', message)

    // send the message here
    const outbound = createOutboundMessage(connection, message)

    logger.debug('In acceptCredentialProposal: Send Proposal to Issuer')
    await this.messageSender.sendMessage(outbound)
    credentialRecord.protocolVersion = version

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
  public async acceptCredentialOffer(credentialOptions: AcceptOfferOptions): Promise<CredentialExchangeRecord> {
    // logger.info('>> IN CREDENTIAL API => acceptCredentialOffer')

    // will get back a credential record -> map to Credential Exchange Record
    const { credentialRecord } = await this.acceptOffer(credentialOptions)

    return credentialRecord
  }
  /**
   * Accept a credential offer as holder (by sending a credential request message) to the connection
   * associated with the credential record.
   *
   * @param offer The object containing config options of the offer to be accepted
   * @returns Object containing offer associated credential record
   */
  public async acceptOffer(
    offer: AcceptOfferOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    const record = await this.getById(offer.credentialRecordId)

    const service = this.getService(record.protocolVersion)

    logger.debug(`Got a CredentialService object for this version; version = ${service.getVersion()}`)

    // could move this into service classes
    const offerMessageClass =
      record.protocolVersion == CredentialProtocolVersion.V1 ? V1OfferCredentialMessage : V2OfferCredentialMessage
    const offerMessage = await this.didCommMessageRepo.findAgentMessage({
      associatedRecordId: record.id,
      messageClass: offerMessageClass,
    })

    // Use connection if present
    if (record.connectionId) {
      const connection = await this.connectionService.getById(record.connectionId)

      const requestOptions: RequestCredentialOptions = {
        comment: offer.comment,
        autoAcceptCredential: offer.autoAcceptCredential,
      }
      const { message, credentialRecord } = await service.createRequest(record, requestOptions)

      await this.didCommMessageRepo.saveAgentMessage({
        agentMessage: message,
        role: DidCommMessageRole.Sender,
        associatedRecordId: credentialRecord.id,
      })
      logger.debug('We have sent a credential request')
      const outboundMessage = createOutboundMessage(connection, message)

      logger.debug('We have a proposal message (sending outbound): ', message)

      await this.messageSender.sendMessage(outboundMessage)
      credentialRecord.protocolVersion = record.protocolVersion
      await this.credentialRepository.update(credentialRecord)
      return { credentialRecord, message }
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
        comment: offer.comment,
        autoAcceptCredential: offer.autoAcceptCredential,
      }
      const { message, credentialRecord } = await service.createRequest(
        record,
        requestOptions,
        ourService.recipientKeys[0]
      )

      credentialRecord.protocolVersion = record.protocolVersion

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
        service: recipientService.toDidCommService(),
        senderKey: ourService.recipientKeys[0],
        returnRoute: true,
      })

      return { credentialRecord, message }
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
   * @param credentialOptions configuration for the offer see {@link NegotiateProposalOptions}
   * @returns Credential exchange record associated with the credential offer
   *
   */
  public async negotiateCredentialProposal(
    credentialOptions: NegotiateProposalOptions
  ): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(credentialOptions.credentialRecordId)

    // get the version
    const version = credentialRecord.protocolVersion

    logger.debug(`version =${version}`)

    // with version we can get the Service
    const service = this.getService(version)
    const { message } = await service.negotiateProposal(credentialOptions, credentialRecord)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connection id for credential record ${credentialRecord.credentialId} not found. Connection-less issuance does not support negotiation`
      )
    }
    const connection = await this.connectionService.getById(credentialRecord.connectionId)
    // use record connection id to get the connection

    const outboundMessage = createOutboundMessage(connection, message)

    await this.messageSender.sendMessage(outboundMessage)
    credentialRecord.protocolVersion = version

    return credentialRecord
  }

  /**
   * Initiate a new credential exchange as issuer by sending a credential offer message
   * to the connection with the specified connection id.
   *
   * @param credentialOptions config options for the credential offer
   * @returns Credential exchange record associated with the sent credential offer message
   */
  public async offerCredential(credentialOptions: OfferCredentialOptions): Promise<CredentialExchangeRecord> {
    if (!credentialOptions.connectionId) {
      throw new AriesFrameworkError('Connection id missing from offer credential options')
    }
    const connection = await this.connectionService.getById(credentialOptions.connectionId)

    // with version we can get the Service
    if (!credentialOptions.protocolVersion) {
      credentialOptions.protocolVersion = CredentialProtocolVersion.V1 // default
    }
    const service = this.getService(credentialOptions.protocolVersion)

    logger.debug('Got a CredentialService object for this version')
    const { message, credentialRecord } = await service.createOffer(credentialOptions)

    await this.didCommMessageRepo.saveAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })
    logger.debug('Offer Message successfully created; message= ', message)
    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)
    credentialRecord.protocolVersion = credentialOptions.protocolVersion
    return credentialRecord
  }

  /**
   * Accept a credential request as holder (by sending a credential request message) to the connection
   * associated with the credential record.
   *
   * @param options The object containing config options of the request
   * @returns CredentialExchangeRecord updated with information pertaining to this request
   */
  public async acceptCredentialRequest(options: AcceptRequestOptions): Promise<CredentialExchangeRecord> {
    const record = await this.getById(options.credentialRecordId)

    // with version we can get the Service
    const service = this.getService(record.protocolVersion)

    logger.debug('Got a CredentialService object for this version')

    const { message, credentialRecord } = await service.createCredential(record, options)
    logger.debug('We have a credential message (sending outbound): ', message)

    // could move this into service classes
    const requestMessageClass =
      record.protocolVersion == CredentialProtocolVersion.V1 ? V1RequestCredentialMessage : V2RequestCredentialMessage
    const offerMessageClass =
      record.protocolVersion == CredentialProtocolVersion.V1 ? V1OfferCredentialMessage : V2OfferCredentialMessage
    const requestMessage = await this.didCommMessageRepo.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: requestMessageClass,
    })
    const offerMessage = await this.didCommMessageRepo.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: offerMessageClass,
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

      message.service = ourService
      await this.credentialRepository.update(credentialRecord)

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

    logger.debug('Got a CredentialService object for this version')

    const { message, credentialRecord } = await service.createAck(record)

    const requestMessageClass =
      record.protocolVersion == CredentialProtocolVersion.V1 ? V1RequestCredentialMessage : V2RequestCredentialMessage
    const credentialMessageClass =
      record.protocolVersion == CredentialProtocolVersion.V1 ? V1IssueCredentialMessage : V2IssueCredentialMessage
    const requestMessage = await this.didCommMessageRepo.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: requestMessageClass,
    })
    const credentialMessage = await this.didCommMessageRepo.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: credentialMessageClass,
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
   * Declines an offer as holder
   * @param credentialRecordId the id of the credential to be declined
   * @returns credential record that was declined
   */
  public async declineOffer(credentialRecordId: string): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(credentialRecordId)
    const service = this.getService(credentialRecord.protocolVersion)

    await service.declineOffer(credentialRecord)

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
   * Delete a credential record by id
   *
   * @param credentialId the credential record id
   */
  public async deleteById(credentialId: string) {
    const credentialRecord = await this.getById(credentialId)
    return this.credentialRepository.delete(credentialRecord)
  }

  /**
   * Initiate a new credential exchange as issuer by creating a credential offer
   * not bound to any connection. The offer must be delivered out-of-band to the holder
   * @param credentialOptions The credential options to use for the offer
   * @returns The credential record and credential offer message
   */
  public async createOutOfBandOffer(credentialOptions: OfferCredentialOptions): Promise<{
    message: AgentMessage
    credentialRecord: CredentialExchangeRecord
  }> {
    // with version we can get the Service
    if (!credentialOptions.protocolVersion) {
      credentialOptions.protocolVersion = CredentialProtocolVersion.V1 // default
    }
    const service = this.getService(credentialOptions.protocolVersion)

    logger.debug('Got a CredentialService object for this version')
    const { message, credentialRecord } = await service.createOutOfBandOffer(credentialOptions)

    logger.debug('Offer Message successfully created; message= ', message)

    return { message, credentialRecord }
  }
}
