import type { AgentMessage } from '../../agent/AgentMessage'
import type { DeleteCredentialOptions } from './CredentialServiceOptions'
import type {
  AcceptCredentialOptions,
  AcceptOfferOptions,
  AcceptProposalOptions,
  AcceptRequestOptions,
  CreateOfferOptions,
  FindCredentialMessageReturn,
  FindOfferMessageReturn,
  FindProposalMessageReturn,
  FindRequestMessageReturn,
  GetFormatDataReturn,
  NegotiateOfferOptions,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  SendProblemReportOptions,
  ServiceMap,
} from './CredentialsApiOptions'
import type { CredentialFormat } from './formats'
import type { IndyCredentialFormat } from './formats/indy/IndyCredentialFormat'
import type { CredentialExchangeRecord } from './repository/CredentialExchangeRecord'
import type { CredentialService } from './services/CredentialService'

import { AgentContext } from '../../agent'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { InjectionSymbols } from '../../constants'
import { ServiceDecorator } from '../../decorators/service/ServiceDecorator'
import { AriesFrameworkError } from '../../error'
import { Logger } from '../../logger'
import { inject, injectable } from '../../plugins'
import { DidCommMessageRole } from '../../storage'
import { DidCommMessageRepository } from '../../storage/didcomm/DidCommMessageRepository'
import { ConnectionService } from '../connections/services'
import { RoutingService } from '../routing/services/RoutingService'

import { CredentialsModuleConfig } from './CredentialsModuleConfig'
import { CredentialState } from './models/CredentialState'
import { RevocationNotificationService } from './protocol/revocation-notification/services'
import { V1CredentialService } from './protocol/v1/V1CredentialService'
import { V2CredentialService } from './protocol/v2/V2CredentialService'
import { CredentialRepository } from './repository/CredentialRepository'

export interface CredentialsApi<CFs extends CredentialFormat[], CSs extends CredentialService<CFs>[]> {
  // Proposal methods
  proposeCredential(options: ProposeCredentialOptions<CFs, CSs>): Promise<CredentialExchangeRecord>
  acceptProposal(options: AcceptProposalOptions<CFs>): Promise<CredentialExchangeRecord>
  negotiateProposal(options: NegotiateProposalOptions<CFs>): Promise<CredentialExchangeRecord>

  // Offer methods
  offerCredential(options: OfferCredentialOptions<CFs, CSs>): Promise<CredentialExchangeRecord>
  acceptOffer(options: AcceptOfferOptions<CFs>): Promise<CredentialExchangeRecord>
  declineOffer(credentialRecordId: string): Promise<CredentialExchangeRecord>
  negotiateOffer(options: NegotiateOfferOptions<CFs>): Promise<CredentialExchangeRecord>
  // out of band
  createOffer(options: CreateOfferOptions<CFs, CSs>): Promise<{
    message: AgentMessage
    credentialRecord: CredentialExchangeRecord
  }>
  // Request
  // This is for beginning the exchange with a request (no proposal or offer). Only possible
  // (currently) with W3C. We will not implement this in phase I
  // requestCredential(credentialOptions: RequestCredentialOptions): Promise<CredentialExchangeRecord>

  // when the issuer accepts the request he issues the credential to the holder
  acceptRequest(options: AcceptRequestOptions<CFs>): Promise<CredentialExchangeRecord>

  // Credential
  acceptCredential(options: AcceptCredentialOptions): Promise<CredentialExchangeRecord>
  sendProblemReport(options: SendProblemReportOptions): Promise<CredentialExchangeRecord>

  // Record Methods
  getAll(): Promise<CredentialExchangeRecord[]>
  getById(credentialRecordId: string): Promise<CredentialExchangeRecord>
  findById(credentialRecordId: string): Promise<CredentialExchangeRecord | null>
  deleteById(credentialRecordId: string, options?: DeleteCredentialOptions): Promise<void>
  getFormatData(credentialRecordId: string): Promise<GetFormatDataReturn<CFs>>

  // DidComm Message Records
  findProposalMessage(credentialExchangeId: string): Promise<FindProposalMessageReturn<CSs>>
  findOfferMessage(credentialExchangeId: string): Promise<FindOfferMessageReturn<CSs>>
  findRequestMessage(credentialExchangeId: string): Promise<FindRequestMessageReturn<CSs>>
  findCredentialMessage(credentialExchangeId: string): Promise<FindCredentialMessageReturn<CSs>>
}

@injectable()
export class CredentialsApi<
  CFs extends CredentialFormat[] = [IndyCredentialFormat],
  CSs extends CredentialService<CFs>[] = [V1CredentialService, V2CredentialService<CFs>]
> implements CredentialsApi<CFs, CSs>
{
  /**
   * Configuration for the connections module
   */
  public readonly config: CredentialsModuleConfig

  private connectionService: ConnectionService
  private messageSender: MessageSender
  private credentialRepository: CredentialRepository
  private agentContext: AgentContext
  private didCommMessageRepository: DidCommMessageRepository
  private routingService: RoutingService
  private logger: Logger
  private serviceMap: ServiceMap<CFs, CSs>

  public constructor(
    messageSender: MessageSender,
    connectionService: ConnectionService,
    agentContext: AgentContext,
    @inject(InjectionSymbols.Logger) logger: Logger,
    credentialRepository: CredentialRepository,
    mediationRecipientService: RoutingService,
    didCommMessageRepository: DidCommMessageRepository,
    v1Service: V1CredentialService,
    v2Service: V2CredentialService<CFs>,
    // only injected so the handlers will be registered
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _revocationNotificationService: RevocationNotificationService,
    config: CredentialsModuleConfig
  ) {
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.credentialRepository = credentialRepository
    this.routingService = mediationRecipientService
    this.agentContext = agentContext
    this.didCommMessageRepository = didCommMessageRepository
    this.logger = logger
    this.config = config

    // Dynamically build service map. This will be extracted once services are registered dynamically
    this.serviceMap = [v1Service, v2Service].reduce(
      (serviceMap, service) => ({
        ...serviceMap,
        [service.version]: service,
      }),
      {}
    ) as ServiceMap<CFs, CSs>

    this.logger.debug(`Initializing Credentials Module for agent ${this.agentContext.config.label}`)
  }

  public getService<PVT extends CredentialService['version']>(protocolVersion: PVT): CredentialService<CFs> {
    if (!this.serviceMap[protocolVersion]) {
      throw new AriesFrameworkError(`No credential service registered for protocol version ${protocolVersion}`)
    }

    return this.serviceMap[protocolVersion]
  }

  /**
   * Initiate a new credential exchange as holder by sending a credential proposal message
   * to the connection with the specified credential options
   *
   * @param options configuration to use for the proposal
   * @returns Credential exchange record associated with the sent proposal message
   */

  public async proposeCredential(options: ProposeCredentialOptions<CFs, CSs>): Promise<CredentialExchangeRecord> {
    const service = this.getService(options.protocolVersion)

    this.logger.debug(`Got a CredentialService object for version ${options.protocolVersion}`)

    const connection = await this.connectionService.getById(this.agentContext, options.connectionId)

    // will get back a credential record -> map to Credential Exchange Record
    const { credentialRecord, message } = await service.createProposal(this.agentContext, {
      connection,
      credentialFormats: options.credentialFormats,
      comment: options.comment,
      autoAcceptCredential: options.autoAcceptCredential,
    })

    this.logger.debug('We have a message (sending outbound): ', message)

    // send the message here
    const outbound = createOutboundMessage(connection, message)

    this.logger.debug('In proposeCredential: Send Proposal to Issuer')
    await this.messageSender.sendMessage(this.agentContext, outbound)
    return credentialRecord
  }

  /**
   * Accept a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param options config object for accepting the proposal
   * @returns Credential exchange record associated with the credential offer
   *
   */
  public async acceptProposal(options: AcceptProposalOptions<CFs>): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(options.credentialRecordId)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support credential proposal or negotiation.`
      )
    }

    // with version we can get the Service
    const service = this.getService(credentialRecord.protocolVersion)

    // will get back a credential record -> map to Credential Exchange Record
    const { message } = await service.acceptProposal(this.agentContext, {
      credentialRecord,
      credentialFormats: options.credentialFormats,
      comment: options.comment,
      autoAcceptCredential: options.autoAcceptCredential,
    })

    // send the message
    const connection = await this.connectionService.getById(this.agentContext, credentialRecord.connectionId)
    const outbound = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(this.agentContext, outbound)

    return credentialRecord
  }

  /**
   * Negotiate a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param options configuration for the offer see {@link NegotiateProposalOptions}
   * @returns Credential exchange record associated with the credential offer
   *
   */
  public async negotiateProposal(options: NegotiateProposalOptions<CFs>): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(options.credentialRecordId)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connection id for credential record ${credentialRecord.id} not found. Connection-less issuance does not support negotiation`
      )
    }

    // with version we can get the Service
    const service = this.getService(credentialRecord.protocolVersion)

    const { message } = await service.negotiateProposal(this.agentContext, {
      credentialRecord,
      credentialFormats: options.credentialFormats,
      comment: options.comment,
      autoAcceptCredential: options.autoAcceptCredential,
    })

    const connection = await this.connectionService.getById(this.agentContext, credentialRecord.connectionId)
    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(this.agentContext, outboundMessage)

    return credentialRecord
  }

  /**
   * Initiate a new credential exchange as issuer by sending a credential offer message
   * to the connection with the specified connection id.
   *
   * @param options config options for the credential offer
   * @returns Credential exchange record associated with the sent credential offer message
   */
  public async offerCredential(options: OfferCredentialOptions<CFs, CSs>): Promise<CredentialExchangeRecord> {
    const connection = await this.connectionService.getById(this.agentContext, options.connectionId)
    const service = this.getService(options.protocolVersion)

    this.logger.debug(`Got a CredentialService object for version ${options.protocolVersion}`)

    const { message, credentialRecord } = await service.createOffer(this.agentContext, {
      credentialFormats: options.credentialFormats,
      autoAcceptCredential: options.autoAcceptCredential,
      comment: options.comment,
      connection,
    })

    this.logger.debug('Offer Message successfully created; message= ', message)
    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(this.agentContext, outboundMessage)

    return credentialRecord
  }

  /**
   * Accept a credential offer as holder (by sending a credential request message) to the connection
   * associated with the credential record.
   *
   * @param options The object containing config options of the offer to be accepted
   * @returns Object containing offer associated credential record
   */
  public async acceptOffer(options: AcceptOfferOptions<CFs>): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(options.credentialRecordId)

    const service = this.getService(credentialRecord.protocolVersion)

    this.logger.debug(`Got a CredentialService object for this version; version = ${service.version}`)
    const offerMessage = await service.findOfferMessage(this.agentContext, credentialRecord.id)

    // Use connection if present
    if (credentialRecord.connectionId) {
      const connection = await this.connectionService.getById(this.agentContext, credentialRecord.connectionId)

      const { message } = await service.acceptOffer(this.agentContext, {
        credentialRecord,
        credentialFormats: options.credentialFormats,
        comment: options.comment,
        autoAcceptCredential: options.autoAcceptCredential,
      })

      const outboundMessage = createOutboundMessage(connection, message)
      await this.messageSender.sendMessage(this.agentContext, outboundMessage)

      return credentialRecord
    }
    // Use ~service decorator otherwise
    else if (offerMessage?.service) {
      // Create ~service decorator
      const routing = await this.routingService.getRouting(this.agentContext)
      const ourService = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.recipientKey.publicKeyBase58],
        routingKeys: routing.routingKeys.map((key) => key.publicKeyBase58),
      })
      const recipientService = offerMessage.service

      const { message } = await service.acceptOffer(this.agentContext, {
        credentialRecord,
        credentialFormats: options.credentialFormats,
        comment: options.comment,
        autoAcceptCredential: options.autoAcceptCredential,
      })

      // Set and save ~service decorator to record (to remember our verkey)
      message.service = ourService
      await this.didCommMessageRepository.saveOrUpdateAgentMessage(this.agentContext, {
        agentMessage: message,
        role: DidCommMessageRole.Sender,
        associatedRecordId: credentialRecord.id,
      })

      await this.messageSender.sendMessageToService(this.agentContext, {
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

  public async declineOffer(credentialRecordId: string): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(credentialRecordId)
    credentialRecord.assertState(CredentialState.OfferReceived)

    // with version we can get the Service
    const service = this.getService(credentialRecord.protocolVersion)
    await service.updateState(this.agentContext, credentialRecord, CredentialState.Declined)

    return credentialRecord
  }

  public async negotiateOffer(options: NegotiateOfferOptions<CFs>): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(options.credentialRecordId)

    const service = this.getService(credentialRecord.protocolVersion)
    const { message } = await service.negotiateOffer(this.agentContext, {
      credentialFormats: options.credentialFormats,
      credentialRecord,
      comment: options.comment,
      autoAcceptCredential: options.autoAcceptCredential,
    })

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connection id for credential record ${credentialRecord.id} not found. Connection-less issuance does not support negotiation`
      )
    }

    const connection = await this.connectionService.getById(this.agentContext, credentialRecord.connectionId)
    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(this.agentContext, outboundMessage)

    return credentialRecord
  }

  /**
   * Initiate a new credential exchange as issuer by creating a credential offer
   * not bound to any connection. The offer must be delivered out-of-band to the holder
   * @param options The credential options to use for the offer
   * @returns The credential record and credential offer message
   */
  public async createOffer(options: CreateOfferOptions<CFs>): Promise<{
    message: AgentMessage
    credentialRecord: CredentialExchangeRecord
  }> {
    const service = this.getService(options.protocolVersion)

    this.logger.debug(`Got a CredentialService object for version ${options.protocolVersion}`)
    const { message, credentialRecord } = await service.createOffer(this.agentContext, {
      credentialFormats: options.credentialFormats,
      comment: options.comment,
      autoAcceptCredential: options.autoAcceptCredential,
    })

    this.logger.debug('Offer Message successfully created; message= ', message)

    return { message, credentialRecord }
  }

  /**
   * Accept a credential request as holder (by sending a credential request message) to the connection
   * associated with the credential record.
   *
   * @param options The object containing config options of the request
   * @returns CredentialExchangeRecord updated with information pertaining to this request
   */
  public async acceptRequest(options: AcceptRequestOptions<CFs>): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(options.credentialRecordId)

    // with version we can get the Service
    const service = this.getService(credentialRecord.protocolVersion)

    this.logger.debug(`Got a CredentialService object for version ${credentialRecord.protocolVersion}`)

    const { message } = await service.acceptRequest(this.agentContext, {
      credentialRecord,
      credentialFormats: options.credentialFormats,
      comment: options.comment,
      autoAcceptCredential: options.autoAcceptCredential,
    })
    this.logger.debug('We have a credential message (sending outbound): ', message)

    const requestMessage = await service.findRequestMessage(this.agentContext, credentialRecord.id)
    const offerMessage = await service.findOfferMessage(this.agentContext, credentialRecord.id)

    // Use connection if present
    if (credentialRecord.connectionId) {
      const connection = await this.connectionService.getById(this.agentContext, credentialRecord.connectionId)
      const outboundMessage = createOutboundMessage(connection, message)
      await this.messageSender.sendMessage(this.agentContext, outboundMessage)

      return credentialRecord
    }
    // Use ~service decorator otherwise
    else if (requestMessage?.service && offerMessage?.service) {
      const recipientService = requestMessage.service
      const ourService = offerMessage.service

      message.service = ourService
      await this.didCommMessageRepository.saveOrUpdateAgentMessage(this.agentContext, {
        agentMessage: message,
        role: DidCommMessageRole.Sender,
        associatedRecordId: credentialRecord.id,
      })

      await this.messageSender.sendMessageToService(this.agentContext, {
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
        `Cannot accept request for credential record without connectionId or ~service decorator on credential offer / request.`
      )
    }
  }

  /**
   * Accept a credential as holder (by sending a credential acknowledgement message) to the connection
   * associated with the credential record.
   *
   * @param credentialRecordId The id of the credential record for which to accept the credential
   * @returns credential exchange record associated with the sent credential acknowledgement message
   *
   */
  public async acceptCredential(options: AcceptCredentialOptions): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(options.credentialRecordId)

    // with version we can get the Service
    const service = this.getService(credentialRecord.protocolVersion)

    this.logger.debug(`Got a CredentialService object for version ${credentialRecord.protocolVersion}`)

    const { message } = await service.acceptCredential(this.agentContext, {
      credentialRecord,
    })

    const requestMessage = await service.findRequestMessage(this.agentContext, credentialRecord.id)
    const credentialMessage = await service.findCredentialMessage(this.agentContext, credentialRecord.id)

    if (credentialRecord.connectionId) {
      const connection = await this.connectionService.getById(this.agentContext, credentialRecord.connectionId)
      const outboundMessage = createOutboundMessage(connection, message)

      await this.messageSender.sendMessage(this.agentContext, outboundMessage)

      return credentialRecord
    }
    // Use ~service decorator otherwise
    else if (credentialMessage?.service && requestMessage?.service) {
      const recipientService = credentialMessage.service
      const ourService = requestMessage.service

      await this.messageSender.sendMessageToService(this.agentContext, {
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
        `Cannot accept credential without connectionId or ~service decorator on credential message.`
      )
    }
  }

  /**
   * Send problem report message for a credential record
   * @param credentialRecordId The id of the credential record for which to send problem report
   * @param message message to send
   * @returns credential record associated with the credential problem report message
   */
  public async sendProblemReport(options: SendProblemReportOptions) {
    const credentialRecord = await this.getById(options.credentialRecordId)
    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(`No connectionId found for credential record '${credentialRecord.id}'.`)
    }
    const connection = await this.connectionService.getById(this.agentContext, credentialRecord.connectionId)

    const service = this.getService(credentialRecord.protocolVersion)
    const problemReportMessage = service.createProblemReport(this.agentContext, { message: options.message })
    problemReportMessage.setThread({
      threadId: credentialRecord.threadId,
    })
    const outboundMessage = createOutboundMessage(connection, problemReportMessage)
    await this.messageSender.sendMessage(this.agentContext, outboundMessage)

    return credentialRecord
  }

  public async getFormatData(credentialRecordId: string): Promise<GetFormatDataReturn<CFs>> {
    const credentialRecord = await this.getById(credentialRecordId)
    const service = this.getService(credentialRecord.protocolVersion)

    return service.getFormatData(this.agentContext, credentialRecordId)
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
    return this.credentialRepository.getById(this.agentContext, credentialRecordId)
  }

  /**
   * Retrieve all credential records
   *
   * @returns List containing all credential records
   */
  public getAll(): Promise<CredentialExchangeRecord[]> {
    return this.credentialRepository.getAll(this.agentContext)
  }

  /**
   * Find a credential record by id
   *
   * @param credentialRecordId the credential record id
   * @returns The credential record or null if not found
   */
  public findById(credentialRecordId: string): Promise<CredentialExchangeRecord | null> {
    return this.credentialRepository.findById(this.agentContext, credentialRecordId)
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
    return service.delete(this.agentContext, credentialRecord, options)
  }

  public async findProposalMessage(credentialExchangeId: string): Promise<FindProposalMessageReturn<CSs>> {
    const service = await this.getServiceForCredentialExchangeId(credentialExchangeId)

    return service.findProposalMessage(this.agentContext, credentialExchangeId)
  }

  public async findOfferMessage(credentialExchangeId: string): Promise<FindOfferMessageReturn<CSs>> {
    const service = await this.getServiceForCredentialExchangeId(credentialExchangeId)

    return service.findOfferMessage(this.agentContext, credentialExchangeId)
  }

  public async findRequestMessage(credentialExchangeId: string): Promise<FindRequestMessageReturn<CSs>> {
    const service = await this.getServiceForCredentialExchangeId(credentialExchangeId)

    return service.findRequestMessage(this.agentContext, credentialExchangeId)
  }

  public async findCredentialMessage(credentialExchangeId: string): Promise<FindCredentialMessageReturn<CSs>> {
    const service = await this.getServiceForCredentialExchangeId(credentialExchangeId)

    return service.findCredentialMessage(this.agentContext, credentialExchangeId)
  }

  private async getServiceForCredentialExchangeId(credentialExchangeId: string) {
    const credentialExchangeRecord = await this.getById(credentialExchangeId)

    return this.getService(credentialExchangeRecord.protocolVersion)
  }
}
