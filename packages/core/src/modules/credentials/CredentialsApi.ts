import type { AgentMessage } from '../../agent/AgentMessage'
import type { Query } from '../../storage/StorageService'
import type { DeleteCredentialOptions } from './CredentialProtocolOptions'
import type {
  AcceptCredentialOptions,
  AcceptCredentialOfferOptions,
  AcceptCredentialProposalOptions,
  AcceptCredentialRequestOptions,
  CreateOfferOptions,
  FindCredentialMessageReturn,
  FindCredentialOfferMessageReturn,
  FindCredentialProposalMessageReturn,
  FindCredentialRequestMessageReturn,
  GetFormatDataReturn,
  NegotiateCredentialOfferOptions,
  NegotiateCredentialProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  SendCredentialProblemReportOptions,
  CredentialProtocolMap,
} from './CredentialsApiOptions'
import type { CredentialProtocol } from './protocol/CredentialProtocol'
import type { CredentialExchangeRecord } from './repository/CredentialExchangeRecord'

import { AgentContext } from '../../agent'
import { MessageSender } from '../../agent/MessageSender'
import { OutboundMessageContext } from '../../agent/models'
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
import { CredentialRepository } from './repository/CredentialRepository'

export interface CredentialsApi<CPs extends CredentialProtocol[]> {
  // Propose Credential methods
  proposeCredential(options: ProposeCredentialOptions<CPs>): Promise<CredentialExchangeRecord>
  acceptProposal(options: AcceptCredentialProposalOptions<[]>): Promise<CredentialExchangeRecord>
  negotiateProposal(options: NegotiateCredentialProposalOptions<[]>): Promise<CredentialExchangeRecord>

  // Offer Credential Methods
  offerCredential(options: OfferCredentialOptions<CPs>): Promise<CredentialExchangeRecord>
  acceptOffer(options: AcceptCredentialOfferOptions<[]>): Promise<CredentialExchangeRecord>
  declineOffer(credentialRecordId: string): Promise<CredentialExchangeRecord>
  negotiateOffer(options: NegotiateCredentialOfferOptions<[]>): Promise<CredentialExchangeRecord>

  // Request Credential Methods
  // This is for beginning the exchange with a request (no proposal or offer). Only possible
  // (currently) with W3C. We will not implement this in phase I

  // when the issuer accepts the request he issues the credential to the holder
  acceptRequest(options: AcceptCredentialRequestOptions<[]>): Promise<CredentialExchangeRecord>

  // Issue Credential Methods
  acceptCredential(options: AcceptCredentialOptions): Promise<CredentialExchangeRecord>

  // out of band
  createOffer(options: CreateOfferOptions<CPs>): Promise<{
    message: AgentMessage
    credentialRecord: CredentialExchangeRecord
  }>

  sendProblemReport(options: SendCredentialProblemReportOptions): Promise<CredentialExchangeRecord>

  // Record Methods
  getAll(): Promise<CredentialExchangeRecord[]>
  findAllByQuery(query: Query<CredentialExchangeRecord>): Promise<CredentialExchangeRecord[]>
  getById(credentialRecordId: string): Promise<CredentialExchangeRecord>
  findById(credentialRecordId: string): Promise<CredentialExchangeRecord | null>
  deleteById(credentialRecordId: string, options?: DeleteCredentialOptions): Promise<void>
  update(credentialRecord: CredentialExchangeRecord): Promise<void>
  getFormatData(credentialRecordId: string): Promise<GetFormatDataReturn<[]>>

  // DidComm Message Records
  findProposalMessage(credentialExchangeId: string): Promise<FindCredentialProposalMessageReturn<CPs>>
  findOfferMessage(credentialExchangeId: string): Promise<FindCredentialOfferMessageReturn<CPs>>
  findRequestMessage(credentialExchangeId: string): Promise<FindCredentialRequestMessageReturn<CPs>>
  findCredentialMessage(credentialExchangeId: string): Promise<FindCredentialMessageReturn<CPs>>
}

@injectable()
export class CredentialsApi<CPs extends CredentialProtocol[]> implements CredentialsApi<CPs> {
  /**
   * Configuration for the connections module
   */
  public readonly config: CredentialsModuleConfig<CPs>

  private connectionService: ConnectionService
  private messageSender: MessageSender
  private credentialRepository: CredentialRepository
  private agentContext: AgentContext
  private didCommMessageRepository: DidCommMessageRepository
  private routingService: RoutingService
  private logger: Logger
  private credentialProtocolMap: CredentialProtocolMap<CPs>

  public constructor(
    messageSender: MessageSender,
    connectionService: ConnectionService,
    agentContext: AgentContext,
    @inject(InjectionSymbols.Logger) logger: Logger,
    credentialRepository: CredentialRepository,
    mediationRecipientService: RoutingService,
    didCommMessageRepository: DidCommMessageRepository,
    // only injected so the handlers will be registered
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _revocationNotificationService: RevocationNotificationService,
    config: CredentialsModuleConfig<CPs>
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
    this.credentialProtocolMap = config.credentialProtocols.reduce(
      (protocolMap, service) => ({
        ...protocolMap,
        [service.version]: service,
      }),
      {}
    ) as CredentialProtocolMap<CPs>
  }

  private getProtocol<PVT extends keyof CredentialProtocolMap<CPs>>(protocolVersion: PVT) {
    if (!this.credentialProtocolMap[protocolVersion]) {
      throw new AriesFrameworkError(`No credential protocol registered for protocol version ${protocolVersion}`)
    }

    return this.credentialProtocolMap[protocolVersion]
  }

  /**
   * Initiate a new credential exchange as holder by sending a credential proposal message
   * to the connection with the specified credential options
   *
   * @param options configuration to use for the proposal
   * @returns Credential exchange record associated with the sent proposal message
   */

  public async proposeCredential(options: ProposeCredentialOptions<CPs>): Promise<CredentialExchangeRecord> {
    const service = this.getProtocol(options.protocolVersion)

    this.logger.debug(`Got a credentialProtocol object for version ${options.protocolVersion}`)

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
    const outboundMessageContext = new OutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection,
      associatedRecord: credentialRecord,
    })

    this.logger.debug('In proposeCredential: Send Proposal to Issuer')
    await this.messageSender.sendMessage(outboundMessageContext)
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
  public async acceptProposal(options: AcceptCredentialProposalOptions<[]>): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(options.credentialRecordId)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support credential proposal or negotiation.`
      )
    }

    // with version we can get the Service
    const service = this.getProtocol(credentialRecord.protocolVersion)

    // will get back a credential record -> map to Credential Exchange Record
    const { message } = await service.acceptProposal(this.agentContext, {
      credentialRecord,
      credentialFormats: options.credentialFormats,
      comment: options.comment,
      autoAcceptCredential: options.autoAcceptCredential,
    })

    // send the message
    const connection = await this.connectionService.getById(this.agentContext, credentialRecord.connectionId)
    const outboundMessageContext = new OutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection,
      associatedRecord: credentialRecord,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return credentialRecord
  }

  /**
   * Negotiate a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param options configuration for the offer see {@link NegotiateCredentialProposalOptions}
   * @returns Credential exchange record associated with the credential offer
   *
   */
  public async negotiateProposal(options: NegotiateCredentialProposalOptions<[]>): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(options.credentialRecordId)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connection id for credential record ${credentialRecord.id} not found. Connection-less issuance does not support negotiation`
      )
    }

    // with version we can get the Service
    const service = this.getProtocol(credentialRecord.protocolVersion)

    const { message } = await service.negotiateProposal(this.agentContext, {
      credentialRecord,
      credentialFormats: options.credentialFormats,
      comment: options.comment,
      autoAcceptCredential: options.autoAcceptCredential,
    })

    const connection = await this.connectionService.getById(this.agentContext, credentialRecord.connectionId)
    const outboundMessageContext = new OutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection,
      associatedRecord: credentialRecord,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return credentialRecord
  }

  /**
   * Initiate a new credential exchange as issuer by sending a credential offer message
   * to the connection with the specified connection id.
   *
   * @param options config options for the credential offer
   * @returns Credential exchange record associated with the sent credential offer message
   */
  public async offerCredential(options: OfferCredentialOptions<CPs>): Promise<CredentialExchangeRecord> {
    const connection = await this.connectionService.getById(this.agentContext, options.connectionId)
    const service = this.getProtocol(options.protocolVersion)

    this.logger.debug(`Got a credentialProtocol object for version ${options.protocolVersion}`)

    const { message, credentialRecord } = await service.createOffer(this.agentContext, {
      credentialFormats: options.credentialFormats,
      autoAcceptCredential: options.autoAcceptCredential,
      comment: options.comment,
      connection,
    })

    this.logger.debug('Offer Message successfully created; message= ', message)
    const outboundMessageContext = new OutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection,
      associatedRecord: credentialRecord,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return credentialRecord
  }

  /**
   * Accept a credential offer as holder (by sending a credential request message) to the connection
   * associated with the credential record.
   *
   * @param options The object containing config options of the offer to be accepted
   * @returns Object containing offer associated credential record
   */
  public async acceptOffer(options: AcceptCredentialOfferOptions<[]>): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(options.credentialRecordId)

    const service = this.getProtocol(credentialRecord.protocolVersion)

    this.logger.debug(`Got a credentialProtocol object for this version; version = ${service.version}`)
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

      const outboundMessageContext = new OutboundMessageContext(message, {
        agentContext: this.agentContext,
        connection,
        associatedRecord: credentialRecord,
      })
      await this.messageSender.sendMessage(outboundMessageContext)

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

      await this.messageSender.sendMessageToService(
        new OutboundMessageContext(message, {
          agentContext: this.agentContext,
          serviceParams: {
            service: recipientService.resolvedDidCommService,
            senderKey: ourService.resolvedDidCommService.recipientKeys[0],
            returnRoute: true,
          },
        })
      )

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
    const service = this.getProtocol(credentialRecord.protocolVersion)
    await service.updateState(this.agentContext, credentialRecord, CredentialState.Declined)

    return credentialRecord
  }

  public async negotiateOffer(options: NegotiateCredentialOfferOptions<[]>): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(options.credentialRecordId)

    const service = this.getProtocol(credentialRecord.protocolVersion)
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
    const outboundMessageContext = new OutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection,
      associatedRecord: credentialRecord,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return credentialRecord
  }

  /**
   * Initiate a new credential exchange as issuer by creating a credential offer
   * not bound to any connection. The offer must be delivered out-of-band to the holder
   * @param options The credential options to use for the offer
   * @returns The credential record and credential offer message
   */
  public async createOffer(options: CreateOfferOptions<CPs>): Promise<{
    message: AgentMessage
    credentialRecord: CredentialExchangeRecord
  }> {
    const service = this.getProtocol(options.protocolVersion)

    this.logger.debug(`Got a credentialProtocol object for version ${options.protocolVersion}`)
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
  public async acceptRequest(options: AcceptCredentialRequestOptions<[]>): Promise<CredentialExchangeRecord> {
    const credentialRecord = await this.getById(options.credentialRecordId)

    // with version we can get the Service
    const service = this.getProtocol(credentialRecord.protocolVersion)

    this.logger.debug(`Got a credentialProtocol object for version ${credentialRecord.protocolVersion}`)

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
      const outboundMessageContext = new OutboundMessageContext(message, {
        agentContext: this.agentContext,
        connection,
        associatedRecord: credentialRecord,
      })
      await this.messageSender.sendMessage(outboundMessageContext)

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

      await this.messageSender.sendMessageToService(
        new OutboundMessageContext(message, {
          agentContext: this.agentContext,
          serviceParams: {
            service: recipientService.resolvedDidCommService,
            senderKey: ourService.resolvedDidCommService.recipientKeys[0],
            returnRoute: true,
          },
        })
      )

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
    const service = this.getProtocol(credentialRecord.protocolVersion)

    this.logger.debug(`Got a credentialProtocol object for version ${credentialRecord.protocolVersion}`)

    const { message } = await service.acceptCredential(this.agentContext, {
      credentialRecord,
    })

    const requestMessage = await service.findRequestMessage(this.agentContext, credentialRecord.id)
    const credentialMessage = await service.findCredentialMessage(this.agentContext, credentialRecord.id)

    if (credentialRecord.connectionId) {
      const connection = await this.connectionService.getById(this.agentContext, credentialRecord.connectionId)
      const outboundMessageContext = new OutboundMessageContext(message, {
        agentContext: this.agentContext,
        connection,
        associatedRecord: credentialRecord,
      })

      await this.messageSender.sendMessage(outboundMessageContext)

      return credentialRecord
    }
    // Use ~service decorator otherwise
    else if (credentialMessage?.service && requestMessage?.service) {
      const recipientService = credentialMessage.service
      const ourService = requestMessage.service

      await this.messageSender.sendMessageToService(
        new OutboundMessageContext(message, {
          agentContext: this.agentContext,
          serviceParams: {
            service: recipientService.resolvedDidCommService,
            senderKey: ourService.resolvedDidCommService.recipientKeys[0],
            returnRoute: true,
          },
        })
      )

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
  public async sendProblemReport(options: SendCredentialProblemReportOptions) {
    const credentialRecord = await this.getById(options.credentialRecordId)
    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(`No connectionId found for credential record '${credentialRecord.id}'.`)
    }
    const connection = await this.connectionService.getById(this.agentContext, credentialRecord.connectionId)

    const service = this.getProtocol(credentialRecord.protocolVersion)
    const problemReportMessage = service.createProblemReport(this.agentContext, { message: options.message })
    problemReportMessage.setThread({
      threadId: credentialRecord.threadId,
    })
    const outboundMessageContext = new OutboundMessageContext(problemReportMessage, {
      agentContext: this.agentContext,
      connection,
      associatedRecord: credentialRecord,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return credentialRecord
  }

  public async getFormatData(credentialRecordId: string): Promise<GetFormatDataReturn<[]>> {
    const credentialRecord = await this.getById(credentialRecordId)
    const service = this.getProtocol(credentialRecord.protocolVersion)

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
   * Retrieve all credential records by specified query params
   *
   * @returns List containing all credential records matching specified query paramaters
   */
  public findAllByQuery(query: Query<CredentialExchangeRecord>) {
    return this.credentialRepository.findByQuery(this.agentContext, query)
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
    const service = this.getProtocol(credentialRecord.protocolVersion)
    return service.delete(this.agentContext, credentialRecord, options)
  }

  /**
   * Update a credential exchange record
   *
   * @param credentialRecord the credential exchange record
   */
  public async update(credentialRecord: CredentialExchangeRecord): Promise<void> {
    await this.credentialRepository.update(this.agentContext, credentialRecord)
  }

  public async findProposalMessage(credentialExchangeId: string): Promise<FindCredentialProposalMessageReturn<CPs>> {
    const service = await this.getServiceForCredentialExchangeId(credentialExchangeId)

    return service.findProposalMessage(this.agentContext, credentialExchangeId)
  }

  public async findOfferMessage(credentialExchangeId: string): Promise<FindCredentialOfferMessageReturn<CPs>> {
    const service = await this.getServiceForCredentialExchangeId(credentialExchangeId)

    return service.findOfferMessage(this.agentContext, credentialExchangeId)
  }

  public async findRequestMessage(credentialExchangeId: string): Promise<FindCredentialRequestMessageReturn<CPs>> {
    const service = await this.getServiceForCredentialExchangeId(credentialExchangeId)

    return service.findRequestMessage(this.agentContext, credentialExchangeId)
  }

  public async findCredentialMessage(credentialExchangeId: string): Promise<FindCredentialMessageReturn<CPs>> {
    const service = await this.getServiceForCredentialExchangeId(credentialExchangeId)

    return service.findCredentialMessage(this.agentContext, credentialExchangeId)
  }

  private async getServiceForCredentialExchangeId(credentialExchangeId: string) {
    const credentialExchangeRecord = await this.getById(credentialExchangeId)

    return this.getProtocol(credentialExchangeRecord.protocolVersion)
  }
}
