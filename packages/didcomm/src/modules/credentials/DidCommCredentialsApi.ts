import type { Query, QueryOptions } from '@credo-ts/core'
import type {
  AcceptCredentialOfferOptions,
  AcceptCredentialOptions,
  AcceptCredentialProposalOptions,
  AcceptCredentialRequestOptions,
  CreateCredentialOfferOptions,
  DeclineCredentialOfferOptions,
  DeleteCredentialOptions,
  FindCredentialMessageReturn,
  FindCredentialOfferMessageReturn,
  FindCredentialProposalMessageReturn,
  FindCredentialRequestMessageReturn,
  GetCredentialFormatDataReturn,
  NegotiateCredentialOfferOptions,
  NegotiateCredentialProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  SendCredentialProblemReportOptions,
  SendRevocationNotificationOptions,
} from './DidCommCredentialsApiOptions'
import type { DidCommCredentialProtocol } from './protocol/DidCommCredentialProtocol'
import type { CredentialFormatsFromProtocols } from './protocol/DidCommCredentialProtocolOptions'
import type { DidCommCredentialExchangeRecord } from './repository/DidCommCredentialExchangeRecord'

import { AgentContext, CredoError, InjectionSymbols, type Logger, inject, injectable } from '@credo-ts/core'

import { DidCommMessage } from '../../DidCommMessage'
import { DidCommMessageSender } from '../../DidCommMessageSender'
import { getOutboundDidCommMessageContext } from '../../getDidCommOutboundMessageContext'
import { DidCommConnectionService } from '../connections'

import { DidCommCredentialsModuleConfig } from './DidCommCredentialsModuleConfig'
import { DidCommCredentialState } from './models/DidCommCredentialState'
import { DidCommRevocationNotificationService } from './protocol/revocation-notification/services'
import { DidCommCredentialExchangeRepository } from './repository/DidCommCredentialExchangeRepository'

export interface DidCommCredentialsApi<CPs extends DidCommCredentialProtocol[]> {
  // Propose Credential methods
  proposeCredential(options: ProposeCredentialOptions<CPs>): Promise<DidCommCredentialExchangeRecord>
  acceptProposal(options: AcceptCredentialProposalOptions<CPs>): Promise<DidCommCredentialExchangeRecord>
  negotiateProposal(options: NegotiateCredentialProposalOptions<CPs>): Promise<DidCommCredentialExchangeRecord>

  // Offer Credential Methods
  offerCredential(options: OfferCredentialOptions<CPs>): Promise<DidCommCredentialExchangeRecord>
  acceptOffer(options: AcceptCredentialOfferOptions<CPs>): Promise<DidCommCredentialExchangeRecord>
  declineOffer(options: DeclineCredentialOfferOptions): Promise<DidCommCredentialExchangeRecord>
  negotiateOffer(options: NegotiateCredentialOfferOptions<CPs>): Promise<DidCommCredentialExchangeRecord>

  // Request Credential Methods
  // This is for beginning the exchange with a request (no proposal or offer). Only possible
  // (currently) with W3C. We will not implement this in phase I

  // when the issuer accepts the request he issues the credential to the holder
  acceptRequest(options: AcceptCredentialRequestOptions<CPs>): Promise<DidCommCredentialExchangeRecord>

  // Issue Credential Methods
  acceptCredential(options: AcceptCredentialOptions): Promise<DidCommCredentialExchangeRecord>

  // Revoke Credential Methods
  sendRevocationNotification(options: SendRevocationNotificationOptions): Promise<void>

  // out of band
  createOffer(options: CreateCredentialOfferOptions<CPs>): Promise<{
    message: DidCommMessage
    credentialExchangeRecord: DidCommCredentialExchangeRecord
  }>

  sendProblemReport(options: SendCredentialProblemReportOptions): Promise<DidCommCredentialExchangeRecord>

  // Record Methods
  getAll(): Promise<DidCommCredentialExchangeRecord[]>
  findAllByQuery(
    query: Query<DidCommCredentialExchangeRecord>,
    queryOptions?: QueryOptions
  ): Promise<DidCommCredentialExchangeRecord[]>
  getById(credentialExchangeRecordId: string): Promise<DidCommCredentialExchangeRecord>
  findById(credentialExchangeRecordId: string): Promise<DidCommCredentialExchangeRecord | null>
  deleteById(credentialExchangeRecordId: string, options?: DeleteCredentialOptions): Promise<void>
  update(credentialExchangeRecordId: DidCommCredentialExchangeRecord): Promise<void>
  getFormatData(
    credentialExchangeRecordId: string
  ): Promise<GetCredentialFormatDataReturn<CredentialFormatsFromProtocols<CPs>>>

  // DidComm Message Records
  findProposalMessage(credentialExchangeRecordId: string): Promise<FindCredentialProposalMessageReturn<CPs>>
  findOfferMessage(credentialExchangeRecordId: string): Promise<FindCredentialOfferMessageReturn<CPs>>
  findRequestMessage(credentialExchangeRecordId: string): Promise<FindCredentialRequestMessageReturn<CPs>>
  findCredentialMessage(credentialExchangeRecordId: string): Promise<FindCredentialMessageReturn<CPs>>
}

@injectable()
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: <explanation>
export class DidCommCredentialsApi<CPs extends DidCommCredentialProtocol[]> implements DidCommCredentialsApi<CPs> {
  /**
   * Configuration for the credentials module
   */
  public readonly config: DidCommCredentialsModuleConfig<CPs>

  private connectionService: DidCommConnectionService
  private messageSender: DidCommMessageSender
  private credentialExchangeRepository: DidCommCredentialExchangeRepository
  private agentContext: AgentContext
  private revocationNotificationService: DidCommRevocationNotificationService
  private logger: Logger

  public constructor(
    messageSender: DidCommMessageSender,
    connectionService: DidCommConnectionService,
    agentContext: AgentContext,
    @inject(InjectionSymbols.Logger) logger: Logger,
    credentialExchangeRepository: DidCommCredentialExchangeRepository,
    revocationNotificationService: DidCommRevocationNotificationService,
    config: DidCommCredentialsModuleConfig<CPs>
  ) {
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.credentialExchangeRepository = credentialExchangeRepository
    this.agentContext = agentContext
    this.revocationNotificationService = revocationNotificationService
    this.logger = logger
    this.config = config
  }

  private getProtocol<PVT extends CPs[number]['version']>(protocolVersion: PVT): DidCommCredentialProtocol {
    const credentialProtocol = this.config.credentialProtocols.find((protocol) => protocol.version === protocolVersion)

    if (!credentialProtocol) {
      throw new CredoError(`No credential protocol registered for protocol version ${protocolVersion}`)
    }

    return credentialProtocol
  }

  /**
   * Initiate a new credential exchange as holder by sending a credential proposal message
   * to the connection with the specified connection id.
   *
   * @param options configuration to use for the proposal
   * @returns Credential exchange record associated with the sent proposal message
   */

  public async proposeCredential(options: ProposeCredentialOptions<CPs>): Promise<DidCommCredentialExchangeRecord> {
    const protocol = this.getProtocol(options.protocolVersion)

    const connectionRecord = await this.connectionService.getById(this.agentContext, options.connectionId)

    // Assert
    connectionRecord.assertReady()

    // will get back a credential record -> map to Credential Exchange Record
    const { credentialExchangeRecord, message } = await protocol.createProposal(this.agentContext, {
      connectionRecord,
      credentialFormats: options.credentialFormats,
      comment: options.comment,
      autoAcceptCredential: options.autoAcceptCredential,
      goalCode: options.goalCode,
      goal: options.goal,
    })

    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message,
      associatedRecord: credentialExchangeRecord,
      connectionRecord,
    })

    await this.messageSender.sendMessage(outboundMessageContext)
    return credentialExchangeRecord
  }

  /**
   * Accept a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param options config object for accepting the proposal
   * @returns Credential exchange record associated with the credential offer
   *
   */
  public async acceptProposal(options: AcceptCredentialProposalOptions<CPs>): Promise<DidCommCredentialExchangeRecord> {
    const credentialExchangeRecord = await this.getById(options.credentialExchangeRecordId)

    if (!credentialExchangeRecord.connectionId) {
      throw new CredoError(
        `No connectionId found for credential exchange record '${credentialExchangeRecord.id}'. Connection-less issuance does not support credential proposal or negotiation.`
      )
    }

    // with version we can get the protocol
    const protocol = this.getProtocol(credentialExchangeRecord.protocolVersion)
    const connectionRecord = await this.connectionService.getById(
      this.agentContext,
      credentialExchangeRecord.connectionId
    )

    // Assert
    connectionRecord.assertReady()

    // will get back a credential record -> map to Credential Exchange Record
    const { message } = await protocol.acceptProposal(this.agentContext, {
      credentialExchangeRecord,
      credentialFormats: options.credentialFormats,
      comment: options.comment,
      autoAcceptCredential: options.autoAcceptCredential,
      goalCode: options.goalCode,
      goal: options.goal,
    })

    // send the message
    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message,
      associatedRecord: credentialExchangeRecord,
      connectionRecord,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return credentialExchangeRecord
  }

  /**
   * Negotiate a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param options configuration for the offer see {@link NegotiateCredentialProposalOptions}
   * @returns Credential exchange record associated with the credential offer
   *
   */
  public async negotiateProposal(
    options: NegotiateCredentialProposalOptions<CPs>
  ): Promise<DidCommCredentialExchangeRecord> {
    const credentialExchangeRecord = await this.getById(options.credentialExchangeRecordId)

    if (!credentialExchangeRecord.connectionId) {
      throw new CredoError(
        `No connection id for credential record ${credentialExchangeRecord.id} not found. Connection-less issuance does not support negotiation`
      )
    }

    // with version we can get the Service
    const protocol = this.getProtocol(credentialExchangeRecord.protocolVersion)

    const { message } = await protocol.negotiateProposal(this.agentContext, {
      credentialExchangeRecord,
      credentialFormats: options.credentialFormats,
      comment: options.comment,
      autoAcceptCredential: options.autoAcceptCredential,
      goalCode: options.goalCode,
      goal: options.goal,
    })

    const connectionRecord = await this.connectionService.getById(
      this.agentContext,
      credentialExchangeRecord.connectionId
    )
    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message,
      associatedRecord: credentialExchangeRecord,
      connectionRecord,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return credentialExchangeRecord
  }

  /**
   * Initiate a new credential exchange as issuer by sending a credential offer message
   * to the connection with the specified connection id.
   *
   * @param options config options for the credential offer
   * @returns Credential exchange record associated with the sent credential offer message
   */
  public async offerCredential(options: OfferCredentialOptions<CPs>): Promise<DidCommCredentialExchangeRecord> {
    const connectionRecord = await this.connectionService.getById(this.agentContext, options.connectionId)
    const protocol = this.getProtocol(options.protocolVersion)

    this.logger.debug(`Got a credentialProtocol object for version ${options.protocolVersion}`)

    const { message, credentialExchangeRecord } = await protocol.createOffer(this.agentContext, {
      credentialFormats: options.credentialFormats,
      autoAcceptCredential: options.autoAcceptCredential,
      comment: options.comment,
      connectionRecord,
      goalCode: options.goalCode,
      goal: options.goal,
    })

    this.logger.debug('Offer Message successfully created; message= ', message)
    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message,
      associatedRecord: credentialExchangeRecord,
      connectionRecord,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return credentialExchangeRecord
  }

  /**
   * Accept a credential offer as holder (by sending a credential request message) to the connection
   * associated with the credential record.
   *
   * @param options The object containing config options of the offer to be accepted
   * @returns Object containing offer associated credential record
   */
  public async acceptOffer(options: AcceptCredentialOfferOptions<CPs>): Promise<DidCommCredentialExchangeRecord> {
    const credentialExchangeRecord = await this.getById(options.credentialExchangeRecordId)

    const protocol = this.getProtocol(credentialExchangeRecord.protocolVersion)

    this.logger.debug(`Got a credentialProtocol object for this version; version = ${protocol.version}`)
    const offerMessage = await protocol.findOfferMessage(this.agentContext, credentialExchangeRecord.id)
    if (!offerMessage) {
      throw new CredoError(`No offer message found for credential record with id '${credentialExchangeRecord.id}'`)
    }

    // Use connection if present
    const connectionRecord = credentialExchangeRecord.connectionId
      ? await this.connectionService.getById(this.agentContext, credentialExchangeRecord.connectionId)
      : undefined
    connectionRecord?.assertReady()

    const { message } = await protocol.acceptOffer(this.agentContext, {
      credentialExchangeRecord,
      credentialFormats: options.credentialFormats,
      comment: options.comment,
      autoAcceptCredential: options.autoAcceptCredential,
      goalCode: options.goalCode,
      goal: options.goal,
    })

    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message,
      connectionRecord,
      associatedRecord: credentialExchangeRecord,
      lastReceivedMessage: offerMessage,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return credentialExchangeRecord
  }

  public async declineOffer(options: DeclineCredentialOfferOptions): Promise<DidCommCredentialExchangeRecord> {
    const credentialExchangeRecord = await this.getById(options.credentialExchangeRecordId)
    credentialExchangeRecord.assertState(DidCommCredentialState.OfferReceived)

    // with version we can get the Service
    const protocol = this.getProtocol(credentialExchangeRecord.protocolVersion)
    if (options.sendProblemReport) {
      await this.sendProblemReport({
        credentialExchangeRecordId: options.credentialExchangeRecordId,
        description: options.problemReportDescription ?? 'Offer declined',
      })
    }

    await protocol.updateState(this.agentContext, credentialExchangeRecord, DidCommCredentialState.Declined)

    return credentialExchangeRecord
  }

  public async negotiateOffer(options: NegotiateCredentialOfferOptions<CPs>): Promise<DidCommCredentialExchangeRecord> {
    const credentialExchangeRecord = await this.getById(options.credentialExchangeRecordId)

    if (!credentialExchangeRecord.connectionId) {
      throw new CredoError(
        `No connection id for credential record ${credentialExchangeRecord.id} not found. Connection-less issuance does not support negotiation`
      )
    }

    const connectionRecord = await this.connectionService.getById(
      this.agentContext,
      credentialExchangeRecord.connectionId
    )

    // Assert
    connectionRecord.assertReady()

    const protocol = this.getProtocol(credentialExchangeRecord.protocolVersion)
    const { message } = await protocol.negotiateOffer(this.agentContext, {
      credentialFormats: options.credentialFormats,
      credentialExchangeRecord,
      comment: options.comment,
      autoAcceptCredential: options.autoAcceptCredential,
      goalCode: options.goalCode,
      goal: options.goal,
    })

    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message,
      associatedRecord: credentialExchangeRecord,
      connectionRecord,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return credentialExchangeRecord
  }

  /**
   * Initiate a new credential exchange as issuer by creating a credential offer
   * not bound to any connection. The offer must be delivered out-of-band to the holder
   * @param options The credential options to use for the offer
   * @returns The credential record and credential offer message
   */
  public async createOffer(options: CreateCredentialOfferOptions<CPs>): Promise<{
    message: DidCommMessage
    credentialExchangeRecord: DidCommCredentialExchangeRecord
  }> {
    const protocol = this.getProtocol(options.protocolVersion)

    this.logger.debug(`Got a credentialProtocol object for version ${options.protocolVersion}`)
    const { message, credentialExchangeRecord } = await protocol.createOffer(this.agentContext, {
      credentialFormats: options.credentialFormats,
      comment: options.comment,
      autoAcceptCredential: options.autoAcceptCredential,
      goalCode: options.goalCode,
      goal: options.goal,
    })

    this.logger.debug('Offer Message successfully created', { message })

    return { message, credentialExchangeRecord }
  }

  /**
   * Accept a credential request as holder (by sending a credential request message) to the connection
   * associated with the credential record.
   *
   * @param options The object containing config options of the request
   * @returns DidCommCredentialExchangeRecord updated with information pertaining to this request
   */
  public async acceptRequest(options: AcceptCredentialRequestOptions<CPs>): Promise<DidCommCredentialExchangeRecord> {
    const credentialExchangeRecord = await this.getById(options.credentialExchangeRecordId)

    // with version we can get the Service
    const protocol = this.getProtocol(credentialExchangeRecord.protocolVersion)

    this.logger.debug(`Got a credentialProtocol object for version ${credentialExchangeRecord.protocolVersion}`)

    // Use connection if present
    const connectionRecord = credentialExchangeRecord.connectionId
      ? await this.connectionService.getById(this.agentContext, credentialExchangeRecord.connectionId)
      : undefined
    connectionRecord?.assertReady()

    const requestMessage = await protocol.findRequestMessage(this.agentContext, credentialExchangeRecord.id)
    if (!requestMessage) {
      throw new CredoError(`No request message found for credential record with id '${credentialExchangeRecord.id}'`)
    }
    const offerMessage = await protocol.findOfferMessage(this.agentContext, credentialExchangeRecord.id)
    if (!offerMessage) {
      throw new CredoError(`No offer message found for credential record with id '${credentialExchangeRecord.id}'`)
    }

    const { message } = await protocol.acceptRequest(this.agentContext, {
      credentialExchangeRecord,
      credentialFormats: options.credentialFormats,
      comment: options.comment,
      autoAcceptCredential: options.autoAcceptCredential,
    })
    this.logger.debug('We have a credential message (sending outbound): ', message)

    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message,
      connectionRecord,
      associatedRecord: credentialExchangeRecord,
      lastReceivedMessage: requestMessage,
      lastSentMessage: offerMessage,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return credentialExchangeRecord
  }

  /**
   * Accept a credential as holder (by sending a credential acknowledgement message) to the connection
   * associated with the credential record.
   *
   * @param credentialExchangeRecordId The id of the credential exchange record for which to accept the credential
   * @returns credential exchange record associated with the sent credential acknowledgement message
   *
   */
  public async acceptCredential(options: AcceptCredentialOptions): Promise<DidCommCredentialExchangeRecord> {
    const credentialExchangeRecord = await this.getById(options.credentialExchangeRecordId)

    // with version we can get the Service
    const protocol = this.getProtocol(credentialExchangeRecord.protocolVersion)

    this.logger.debug(`Got a credentialProtocol object for version ${credentialExchangeRecord.protocolVersion}`)

    // Use connection if present
    const connectionRecord = credentialExchangeRecord.connectionId
      ? await this.connectionService.getById(this.agentContext, credentialExchangeRecord.connectionId)
      : undefined
    connectionRecord?.assertReady()

    const requestMessage = await protocol.findRequestMessage(this.agentContext, credentialExchangeRecord.id)
    if (!requestMessage) {
      throw new CredoError(`No request message found for credential record with id '${credentialExchangeRecord.id}'`)
    }
    const credentialMessage = await protocol.findCredentialMessage(this.agentContext, credentialExchangeRecord.id)
    if (!credentialMessage) {
      throw new CredoError(`No credential message found for credential record with id '${credentialExchangeRecord.id}'`)
    }

    const { message } = await protocol.acceptCredential(this.agentContext, {
      credentialExchangeRecord,
    })

    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message,
      connectionRecord,
      associatedRecord: credentialExchangeRecord,
      lastReceivedMessage: credentialMessage,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return credentialExchangeRecord
  }

  /**
   * Send a revocation notification for a credential exchange record. Currently Revocation Notification V2 protocol is supported
   *
   * @param credentialExchangeRecordId The id of the credential record for which to send revocation notification
   */
  public async sendRevocationNotification(options: SendRevocationNotificationOptions): Promise<void> {
    const { credentialExchangeRecordId, revocationId, revocationFormat, comment, requestAck } = options

    const credentialExchangeRecord = await this.getById(credentialExchangeRecordId)

    const { message } = await this.revocationNotificationService.v2CreateRevocationNotification({
      credentialId: revocationId,
      revocationFormat,
      comment,
      requestAck,
    })
    const protocol = this.getProtocol(credentialExchangeRecord.protocolVersion)

    const requestMessage = await protocol.findRequestMessage(this.agentContext, credentialExchangeRecord.id)
    if (!requestMessage) {
      throw new CredoError(`No request message found for credential record with id '${credentialExchangeRecord.id}'`)
    }

    const offerMessage = await protocol.findOfferMessage(this.agentContext, credentialExchangeRecord.id)
    if (!offerMessage) {
      throw new CredoError(`No offer message found for credential record with id '${credentialExchangeRecord.id}'`)
    }

    // Use connection if present
    const connectionRecord = credentialExchangeRecord.connectionId
      ? await this.connectionService.getById(this.agentContext, credentialExchangeRecord.connectionId)
      : undefined
    connectionRecord?.assertReady()

    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message,
      connectionRecord,
      associatedRecord: credentialExchangeRecord,
    })
    await this.messageSender.sendMessage(outboundMessageContext)
  }

  /**
   * Send problem report message for a credential record
   * @param credentialExchangeRecordId The id of the credential exchange record for which to send problem report
   * @returns credential record associated with the credential problem report message
   */
  public async sendProblemReport(options: SendCredentialProblemReportOptions) {
    const credentialExchangeRecord = await this.getById(options.credentialExchangeRecordId)

    const protocol = this.getProtocol(credentialExchangeRecord.protocolVersion)

    const offerMessage = await protocol.findOfferMessage(this.agentContext, credentialExchangeRecord.id)

    const { message: problemReport } = await protocol.createProblemReport(this.agentContext, {
      description: options.description,
      credentialExchangeRecord,
    })

    // Use connection if present
    const connectionRecord = credentialExchangeRecord.connectionId
      ? await this.connectionService.getById(this.agentContext, credentialExchangeRecord.connectionId)
      : undefined
    connectionRecord?.assertReady()

    // If there's no connection (so connection-less, we require the state to be offer received)
    if (!connectionRecord) {
      credentialExchangeRecord.assertState(DidCommCredentialState.OfferReceived)

      if (!offerMessage) {
        throw new CredoError(`No offer message found for credential record with id '${credentialExchangeRecord.id}'`)
      }
    }

    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message: problemReport,
      connectionRecord,
      associatedRecord: credentialExchangeRecord,
      lastReceivedMessage: offerMessage ?? undefined,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return credentialExchangeRecord
  }

  public async getFormatData(
    credentialRecordId: string
  ): Promise<GetCredentialFormatDataReturn<CredentialFormatsFromProtocols<CPs>>> {
    const credentialExchangeRecord = await this.getById(credentialRecordId)
    const protocol = this.getProtocol(credentialExchangeRecord.protocolVersion)

    return protocol.getFormatData(this.agentContext, credentialRecordId)
  }

  /**
   * Retrieve a credential record by id
   *
   * @param credentialRecordId The credential record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The credential record
   *
   */
  public getById(credentialRecordId: string): Promise<DidCommCredentialExchangeRecord> {
    return this.credentialExchangeRepository.getById(this.agentContext, credentialRecordId)
  }

  /**
   * Retrieve all credential records
   *
   * @returns List containing all credential records
   */
  public getAll(): Promise<DidCommCredentialExchangeRecord[]> {
    return this.credentialExchangeRepository.getAll(this.agentContext)
  }

  /**
   * Retrieve all credential records by specified query params
   *
   * @returns List containing all credential records matching specified query paramaters
   */
  public findAllByQuery(query: Query<DidCommCredentialExchangeRecord>, queryOptions?: QueryOptions) {
    return this.credentialExchangeRepository.findByQuery(this.agentContext, query, queryOptions)
  }

  /**
   * Find a credential record by id
   *
   * @param credentialRecordId the credential record id
   * @returns The credential record or null if not found
   */
  public findById(credentialRecordId: string): Promise<DidCommCredentialExchangeRecord | null> {
    return this.credentialExchangeRepository.findById(this.agentContext, credentialRecordId)
  }

  /**
   * Delete a credential record by id, also calls service to delete from wallet
   *
   * @param credentialId the credential record id
   * @param options the delete credential options for the delete operation
   */
  public async deleteById(credentialId: string, options?: DeleteCredentialOptions) {
    const credentialExchangeRecord = await this.getById(credentialId)
    const protocol = this.getProtocol(credentialExchangeRecord.protocolVersion)
    return protocol.delete(this.agentContext, credentialExchangeRecord, options)
  }

  /**
   * Update a credential exchange record
   *
   * @param credentialExchangeRecord the credential exchange record
   */
  public async update(credentialExchangeRecord: DidCommCredentialExchangeRecord): Promise<void> {
    await this.credentialExchangeRepository.update(this.agentContext, credentialExchangeRecord)
  }

  public async findProposalMessage(credentialExchangeId: string): Promise<FindCredentialProposalMessageReturn<CPs>> {
    const protocol = await this.getServiceForCredentialExchangeId(credentialExchangeId)

    return protocol.findProposalMessage(
      this.agentContext,
      credentialExchangeId
    ) as FindCredentialProposalMessageReturn<CPs>
  }

  public async findOfferMessage(credentialExchangeId: string): Promise<FindCredentialOfferMessageReturn<CPs>> {
    const protocol = await this.getServiceForCredentialExchangeId(credentialExchangeId)

    return protocol.findOfferMessage(this.agentContext, credentialExchangeId) as FindCredentialOfferMessageReturn<CPs>
  }

  public async findRequestMessage(credentialExchangeId: string): Promise<FindCredentialRequestMessageReturn<CPs>> {
    const protocol = await this.getServiceForCredentialExchangeId(credentialExchangeId)

    return protocol.findRequestMessage(
      this.agentContext,
      credentialExchangeId
    ) as FindCredentialRequestMessageReturn<CPs>
  }

  public async findCredentialMessage(credentialExchangeId: string): Promise<FindCredentialMessageReturn<CPs>> {
    const protocol = await this.getServiceForCredentialExchangeId(credentialExchangeId)

    return protocol.findCredentialMessage(this.agentContext, credentialExchangeId) as FindCredentialMessageReturn<CPs>
  }

  private async getServiceForCredentialExchangeId(credentialExchangeId: string) {
    const credentialExchangeRecord = await this.getById(credentialExchangeId)

    return this.getProtocol(credentialExchangeRecord.protocolVersion)
  }
}
