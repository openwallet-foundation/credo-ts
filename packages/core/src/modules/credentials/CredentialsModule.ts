import type { AgentMessage } from '../../agent/AgentMessage'
import type { CredentialService } from './CredentialService'
import type {
  AcceptOfferOptions,
  AcceptProposalOptions,
  AcceptRequestOptions,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from './interfaces'
import type { CredentialExchangeRecord } from './repository'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { ServiceDecorator } from '../../decorators/service/ServiceDecorator'
import { AriesFrameworkError } from '../../error'
import { ConsoleLogger, LogLevel } from '../../logger'
import { DidCommMessageRepository, DidCommMessageRole } from '../../storage'
import { ConnectionService } from '../connections/services/ConnectionService'
import { IndyHolderService, IndyIssuerService } from '../indy'
import { IndyLedgerService } from '../ledger'
import { MediationRecipientService } from '../routing'

import { CredentialProtocolVersion } from './CredentialProtocolVersion'
import { CredentialResponseCoordinator } from './CredentialResponseCoordinator'
import { CredentialState } from './CredentialState'
import { V1CredentialService } from './protocol/v1/V1CredentialService'
import { V2CredentialService } from './protocol/v2/V2CredentialService'
import { V2IssueCredentialMessage } from './protocol/v2/messages/V2IssueCredentialMessage'
import { V2OfferCredentialMessage } from './protocol/v2/messages/V2OfferCredentialMessage'
import { V2RequestCredentialMessage } from './protocol/v2/messages/V2RequestCredentialMessage'
import { CredentialRepository } from './repository'

import { IssueCredentialMessage, OfferCredentialMessage, RequestCredentialMessage } from '.'

export interface CredentialsModule {
  // Proposal methods
  proposeCredential(credentialOptions: ProposeCredentialOptions): Promise<CredentialExchangeRecord>
  acceptCredentialProposal(credentialOptions: AcceptProposalOptions): Promise<CredentialExchangeRecord>
  negotiateCredentialProposal(credentialOptions: NegotiateProposalOptions): Promise<CredentialExchangeRecord>

  // Offer methods
  offerCredential(credentialOptions: OfferCredentialOptions): Promise<CredentialExchangeRecord>
  acceptCredentialOffer(credentialOptions: AcceptOfferOptions): Promise<CredentialExchangeRecord>
  declineCredentialOffer(
    credentialRecordId: string,
    version: CredentialProtocolVersion
  ): Promise<CredentialExchangeRecord>
  negotiateCredentialOffer(credentialOptions: ProposeCredentialOptions): Promise<CredentialExchangeRecord>
  // out of band
  createOutOfBandOffer(credentialOptions: OfferCredentialOptions): Promise<{
    message: AgentMessage
    credentialRecord: CredentialExchangeRecord
  }>
  // // Request
  // This is for beginning the exchange with a request (no proposal or offer). Only possible
  // (currently) with W3C. We will not implement this in phase I
  // requestCredential(credentialOptions: RequestCredentialOptions): Promise<CredentialExchangeRecord>

  // when the issuer accepts the request he issues the credential to the holder
  acceptCredentialRequest(credentialOptions: AcceptRequestOptions): Promise<CredentialExchangeRecord>

  // // Credential

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
  private eventEmitter: EventEmitter
  private dispatcher: Dispatcher
  private agConfig: AgentConfig
  private credentialResponseCoord: CredentialResponseCoordinator
  private didCommMessageRepo: DidCommMessageRepository
  private v1Service: V1CredentialService
  private v2Service: V2CredentialService
  private indyIssuerService: IndyIssuerService
  private mediatorRecipientService: MediationRecipientService
  private indyLedgerService: IndyLedgerService
  private indyHolderService: IndyHolderService
  private serviceMap: { [key in CredentialProtocolVersion]: CredentialService }

  // note some of the parameters passed in here are temporary, as we intend
  // to eventually remove CredentialsModule
  public constructor(
    dispatcher: Dispatcher,
    messageSender: MessageSender,
    connectionService: ConnectionService,
    agentConfig: AgentConfig,
    credentialResponseCoordinator: CredentialResponseCoordinator,
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    indyIssuerService: IndyIssuerService,
    mediationRecipientService: MediationRecipientService,
    indyLedgerService: IndyLedgerService,
    indyHolderService: IndyHolderService,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.credentialRepository = credentialRepository
    this.eventEmitter = eventEmitter
    this.dispatcher = dispatcher
    this.agConfig = agentConfig
    this.credentialResponseCoord = credentialResponseCoordinator
    this.indyIssuerService = indyIssuerService
    this.mediatorRecipientService = mediationRecipientService
    this.indyLedgerService = indyLedgerService
    this.indyHolderService = indyHolderService
    this.didCommMessageRepo = didCommMessageRepository

    this.v1Service = new V1CredentialService(
      this.connectionService,
      this.didCommMessageRepo,
      this.agConfig,
      this.credentialResponseCoord,
      this.mediatorRecipientService,
      this.dispatcher,
      this.eventEmitter,
      this.credentialRepository,
      this.indyIssuerService,
      this.indyLedgerService,
      this.indyHolderService
    )

    this.v2Service = new V2CredentialService(
      this.connectionService,
      this.credentialRepository,
      this.eventEmitter,
      this.messageSender,
      this.dispatcher,
      this.agConfig,
      this.credentialResponseCoord,
      this.indyIssuerService,
      this.mediatorRecipientService,
      this.indyLedgerService,
      this.indyHolderService,
      this.didCommMessageRepo
    )

    this.serviceMap = {
      [CredentialProtocolVersion.V1_0]: this.v1Service,
      [CredentialProtocolVersion.V2_0]: this.v2Service,
    }
    logger.debug(
      `+++++++++++++++++++++ CREATE CREDENTIALS API (AIP2.0) FOR ${this.agConfig.label} +++++++++++++++++++++++++++`
    )

    // register handlers here
    // this.v1Service.registerHandlers()
    // this.v2Service.registerHandlers()
  }

  public getService(protocolVersion: CredentialProtocolVersion): CredentialService {
    return this.serviceMap[protocolVersion]
  }

  public async declineCredentialOffer(
    credentialRecordId: string,
    version: CredentialProtocolVersion
  ): Promise<CredentialExchangeRecord> {
    logger.trace('>> IN CREDENTIAL API => declineCredentialOffer')

    logger.trace(`version =${version}`)

    // with version we can get the Service
    const service: CredentialService = this.getService(version)

    const credentialRecord: CredentialExchangeRecord = await this.getById(credentialRecordId)

    credentialRecord.assertState(CredentialState.OfferReceived)

    await service.updateState(credentialRecord, CredentialState.Declined)

    credentialRecord.protocolVersion = version

    return credentialRecord
  }

  public async negotiateCredentialOffer(
    credentialOptions: ProposeCredentialOptions
  ): Promise<CredentialExchangeRecord> {
    // logger.info('>> IN CREDENTIAL API => negotiateCredentialOffer')

    // get the version
    const version: CredentialProtocolVersion = credentialOptions.protocolVersion

    logger.debug(`version =${version}`)

    // with version we can get the Service
    const service: CredentialService = this.getService(version)

    const { credentialRecord, message } = await service.negotiateOffer(credentialOptions)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(`Connection id for credential record ${credentialRecord.credentialId} not found!`)
    }
    const connection = await this.connectionService.getById(credentialRecord.connectionId)
    if (!connection) {
      throw new AriesFrameworkError(`Connection for ${credentialRecord.connectionId} not found!`)
    }

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
    // logger.info('>> IN CREDENTIAL API => proposeCredential')

    // get the version
    const version: CredentialProtocolVersion = credentialOptions.protocolVersion

    logger.debug(`version =${version}`)

    // with version we can get the Service
    const service: CredentialService = this.getService(version)

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
    // logger.info('>> IN CREDENTIAL API => acceptCredentialProposal')

    // get the version
    const version: CredentialProtocolVersion = credentialOptions.protocolVersion

    // with version we can get the Service
    const service: CredentialService = this.getService(version)

    // will get back a credential record -> map to Credential Exchange Record
    const { credentialRecord, message } = await service.acceptProposal(credentialOptions)

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
    // logger.info('>> IN CREDENTIAL API => acceptOffer')

    const service: CredentialService = this.getService(offer.protocolVersion)

    logger.debug(`Got a CredentialService object for this version; version = ${service.getVersion()}`)

    const record: CredentialExchangeRecord = await this.getById(offer.credentialRecordId)

    // could move this into service classes
    const offerMessageClass =
      offer.protocolVersion == CredentialProtocolVersion.V1_0 ? OfferCredentialMessage : V2OfferCredentialMessage
    const offerMessage = await this.didCommMessageRepo.getAgentMessage({
      associatedRecordId: record.id,
      messageClass: offerMessageClass,
    })

    // Use connection if present
    if (record.connectionId) {
      const connection = await this.connectionService.getById(record.connectionId)

      const requestOptions: RequestCredentialOptions = {
        holderDid: connection.did,
        comment: offer.comment,
        autoAcceptCredential: offer.autoAcceptCredential,
        credentialFormats: {}, // this gets filled in later
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
      credentialRecord.protocolVersion = offer.protocolVersion

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
        holderDid: ourService.recipientKeys[0],
        comment: offer.comment,
        autoAcceptCredential: offer.autoAcceptCredential,
        credentialFormats: {}, // this gets filled in later
      }
      const { message, credentialRecord } = await service.createRequest(record, requestOptions)

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
    // logger.info('>> IN CREDENTIAL API => negotiateCredentialProposal')

    // get the version
    const version: CredentialProtocolVersion = credentialOptions.protocolVersion

    logger.debug(`version =${version}`)

    // with version we can get the Service
    const service: CredentialService = this.getService(version)

    const { credentialRecord, message } = await service.negotiateProposal(credentialOptions)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(`Connection id for credential record ${credentialRecord.credentialId} not found!`)
    }
    const connection = await this.connectionService.getById(credentialRecord.connectionId)
    if (!connection) {
      throw new AriesFrameworkError(`Connection for ${credentialRecord.connectionId} not found!`)
    }
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
    // logger.info('>> IN CREDENTIAL API => offerCredential')

    if (!credentialOptions.connectionId) {
      throw Error('Connection id missing from offer credential options')
    }
    const connection = await this.connectionService.getById(credentialOptions.connectionId)

    // with version we can get the Service
    const service: CredentialService = this.getService(credentialOptions.protocolVersion)

    logger.debug('Got a CredentialService object for this version')
    const { message, credentialRecord } = await service.createOffer(credentialOptions)

    await this.didCommMessageRepo.saveAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })
    logger.debug('V2 Offer Message successfully created; message= ', message)
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
    // logger.info('>> IN CREDENTIAL API => acceptCredentialRequest')

    const record: CredentialExchangeRecord = await this.getById(options.credentialRecordId)

    // with version we can get the Service
    const service: CredentialService = this.getService(options.protocolVersion)

    logger.debug('Got a CredentialService object for this version')

    const { message, credentialRecord } = await service.createCredential(record, options)
    logger.debug('We have a CREDENTIAL message (sending outbound): ', message)

    // could move this into service classes
    const requestMessageClass =
      options.protocolVersion == CredentialProtocolVersion.V1_0 ? RequestCredentialMessage : V2RequestCredentialMessage
    const offerMessageClass =
      options.protocolVersion == CredentialProtocolVersion.V1_0 ? OfferCredentialMessage : V2OfferCredentialMessage
    const requestMessage = await this.didCommMessageRepo.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: requestMessageClass,
    })
    const offerMessage = await this.didCommMessageRepo.getAgentMessage({
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

      // Set ~service, update message in record (for later use)
      message.setService(ourService)
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
    }
    // Cannot send message without connectionId or ~service decorator
    else {
      throw new AriesFrameworkError(
        `Cannot accept request for credential record without connectionId or ~service decorator on credential offer / request.`
      )
    }
    credentialRecord.protocolVersion = options.protocolVersion

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
  public async acceptCredential(
    credentialRecordId: string,
    version: CredentialProtocolVersion
  ): Promise<CredentialExchangeRecord> {
    // logger.info('>> IN CREDENTIAL API => acceptCredential')

    const record: CredentialExchangeRecord = await this.getById(credentialRecordId)

    // with version we can get the Service
    const service: CredentialService = this.getService(version)

    logger.debug('Got a CredentialService object for this version')

    const { message, credentialRecord } = await service.createAck(record)

    const requestMessageClass =
      version == CredentialProtocolVersion.V1_0 ? RequestCredentialMessage : V2RequestCredentialMessage
    const credentialMessageClass =
      version == CredentialProtocolVersion.V1_0 ? IssueCredentialMessage : V2IssueCredentialMessage
    const requestMessage = await this.didCommMessageRepo.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: requestMessageClass,
    })
    const credentialMessage = await this.didCommMessageRepo.getAgentMessage({
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
    credentialRecord.protocolVersion = version

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
    // logger.info('>> IN CREDENTIAL API => createOutOfBandOffer')

    // with version we can get the Service
    const service: CredentialService = this.getService(credentialOptions.protocolVersion)

    logger.debug('Got a CredentialService object for this version')
    const { message, credentialRecord } = await service.createOutOfBandOffer(credentialOptions)

    logger.debug('V2 Offer Message successfully created; message= ', message)

    credentialRecord.protocolVersion = credentialOptions.protocolVersion

    return { message, credentialRecord }
  }
}
