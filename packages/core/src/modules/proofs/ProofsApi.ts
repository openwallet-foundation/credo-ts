import type { DIDCommV1Message } from '../../agent/didcomm'
import type { Query } from '../../storage/StorageService'
import type { ProofService } from './ProofService'
import type {
  AcceptProofPresentationOptions,
  AcceptProofProposalOptions,
  CreateProofRequestOptions,
  FindProofPresentationMessageReturn,
  FindProofProposalMessageReturn,
  FindProofRequestMessageReturn,
  ProposeProofOptions,
  RequestProofOptions,
  ProofServiceMap,
} from './ProofsApiOptions'
import type { ProofFormat } from './formats/ProofFormat'
import type { IndyProofFormat } from './formats/indy/IndyProofFormat'
import type {
  AutoSelectCredentialsForProofRequestOptions,
  GetRequestedCredentialsForProofRequest,
} from './models/ModuleOptions'
import type {
  CreatePresentationOptions,
  CreateProposalOptions,
  CreateRequestOptions,
  CreateRequestAsResponseOptions,
  CreateProofRequestFromProposalOptions,
  FormatRequestedCredentialReturn,
  FormatRetrievedCredentialOptions,
  DeleteProofOptions,
  GetFormatDataReturn,
} from './models/ProofServiceOptions'
import type { ProofExchangeRecord } from './repository/ProofExchangeRecord'

import { inject, injectable } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { AgentContext } from '../../agent/context/AgentContext'
import { createOutboundDIDCommV1Message } from '../../agent/helpers'
import { InjectionSymbols } from '../../constants'
import { ServiceDecorator } from '../../decorators/service/ServiceDecorator'
import { AriesFrameworkError } from '../../error'
import { Logger } from '../../logger'
import { DidCommMessageRole } from '../../storage/didcomm/DidCommMessageRole'
import { ConnectionService } from '../connections/services/ConnectionService'
import { MediationRecipientService } from '../routing/services/MediationRecipientService'
import { RoutingService } from '../routing/services/RoutingService'

import { ProofResponseCoordinator } from './ProofResponseCoordinator'
import { ProofState } from './models/ProofState'
import { V1ProofService } from './protocol/v1/V1ProofService'
import { V2ProofService } from './protocol/v2/V2ProofService'
import { ProofRepository } from './repository/ProofRepository'

export interface ProofsApi<PFs extends ProofFormat[], PSs extends ProofService<PFs>[]> {
  // Proposal methods
  proposeProof(options: ProposeProofOptions<PFs, PSs>): Promise<ProofExchangeRecord>
  acceptProposal(options: AcceptProofProposalOptions): Promise<ProofExchangeRecord>

  // Request methods
  requestProof(options: RequestProofOptions<PFs, PSs>): Promise<ProofExchangeRecord>
  acceptRequest(options: AcceptProofPresentationOptions<PFs>): Promise<ProofExchangeRecord>
  declineRequest(proofRecordId: string): Promise<ProofExchangeRecord>

  // Present
  acceptPresentation(proofRecordId: string): Promise<ProofExchangeRecord>

  // out of band
  createRequest(options: CreateProofRequestOptions<PFs, PSs>): Promise<{
    message: DIDCommV1Message
    proofRecord: ProofExchangeRecord
  }>

  // Auto Select
  autoSelectCredentialsForProofRequest(
    options: AutoSelectCredentialsForProofRequestOptions
  ): Promise<FormatRequestedCredentialReturn<PFs>>

  // Get Requested Credentials
  getRequestedCredentialsForProofRequest(
    options: AutoSelectCredentialsForProofRequestOptions
  ): Promise<FormatRetrievedCredentialOptions<PFs>>

  sendProblemReport(proofRecordId: string, message: string): Promise<ProofExchangeRecord>

  // Record Methods
  getAll(): Promise<ProofExchangeRecord[]>
  findAllByQuery(query: Query<ProofExchangeRecord>): Promise<ProofExchangeRecord[]>
  getById(proofRecordId: string): Promise<ProofExchangeRecord>
  findById(proofRecordId: string): Promise<ProofExchangeRecord | null>
  deleteById(proofId: string, options?: DeleteProofOptions): Promise<void>
  update(proofRecord: ProofExchangeRecord): Promise<void>
  getFormatData(proofRecordId: string): Promise<GetFormatDataReturn<PFs>>

  // DidComm Message Records
  findProposalMessage(proofRecordId: string): Promise<FindProofProposalMessageReturn<PSs>>
  findRequestMessage(proofRecordId: string): Promise<FindProofRequestMessageReturn<PSs>>
  findPresentationMessage(proofRecordId: string): Promise<FindProofPresentationMessageReturn<PSs>>
}

@injectable()
export class ProofsApi<
  PFs extends ProofFormat[] = [IndyProofFormat],
  PSs extends ProofService<PFs>[] = [V1ProofService, V2ProofService<PFs>]
> implements ProofsApi<PFs, PSs>
{
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private routingService: RoutingService
  private proofRepository: ProofRepository
  private agentContext: AgentContext
  private agentConfig: AgentConfig
  private logger: Logger
  private serviceMap: ProofServiceMap<PFs, PSs>

  public constructor(
    dispatcher: Dispatcher,
    mediationRecipientService: MediationRecipientService,
    messageSender: MessageSender,
    connectionService: ConnectionService,
    agentContext: AgentContext,
    agentConfig: AgentConfig,
    routingService: RoutingService,
    @inject(InjectionSymbols.Logger) logger: Logger,
    proofRepository: ProofRepository,
    v1Service: V1ProofService,
    v2Service: V2ProofService<PFs>
  ) {
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.proofRepository = proofRepository
    this.agentContext = agentContext
    this.agentConfig = agentConfig
    this.routingService = routingService
    this.logger = logger
    // Dynamically build service map. This will be extracted once services are registered dynamically
    this.serviceMap = [v1Service, v2Service].reduce(
      (serviceMap, service) => ({
        ...serviceMap,
        [service.version]: service,
      }),
      {}
    ) as ProofServiceMap<PFs, PSs>

    this.logger.debug(`Initializing Proofs Module for agent ${this.agentContext.config.label}`)

    this.registerHandlers(dispatcher, mediationRecipientService)
  }

  public getService<PVT extends ProofService['version']>(protocolVersion: PVT): ProofService<PFs> {
    if (!this.serviceMap[protocolVersion]) {
      throw new AriesFrameworkError(`No proof service registered for protocol version ${protocolVersion}`)
    }

    return this.serviceMap[protocolVersion]
  }

  /**
   * Initiate a new presentation exchange as prover by sending a presentation proposal message
   * to the connection with the specified connection id.
   *
   * @param options multiple properties like protocol version, connection id, proof format (indy/ presentation exchange)
   * to include in the message
   * @returns Proof record associated with the sent proposal message
   */
  public async proposeProof(options: ProposeProofOptions<PFs, PSs>): Promise<ProofExchangeRecord> {
    const service = this.getService(options.protocolVersion)

    const { connectionId } = options

    const connection = await this.connectionService.getById(this.agentContext, connectionId)

    // Assert
    connection.assertReady()

    const proposalOptions: CreateProposalOptions<PFs> = {
      connectionRecord: connection,
      proofFormats: options.proofFormats,
      autoAcceptProof: options.autoAcceptProof,
      goalCode: options.goalCode,
      comment: options.comment,
      parentThreadId: options.parentThreadId,
    }

    const { message, proofRecord } = await service.createProposal(this.agentContext, proposalOptions)

    const outbound = createOutboundDIDCommV1Message(connection, message)
    await this.messageSender.sendMessage(this.agentContext, outbound)

    return proofRecord
  }

  /**
   * Accept a presentation proposal as verifier (by sending a presentation request message) to the connection
   * associated with the proof record.
   *
   * @param options multiple properties like proof record id, additional configuration for creating the request
   * @returns Proof record associated with the presentation request
   */
  public async acceptProposal(options: AcceptProofProposalOptions): Promise<ProofExchangeRecord> {
    const { proofRecordId } = options
    const proofRecord = await this.getById(proofRecordId)

    const service = this.getService(proofRecord.protocolVersion)

    if (!proofRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${proofRecord.id}'. Connection-less issuance does not support presentation proposal or negotiation.`
      )
    }

    const connection = await this.connectionService.getById(this.agentContext, proofRecord.connectionId)

    // Assert
    connection.assertReady()

    const proofRequestFromProposalOptions: CreateProofRequestFromProposalOptions = {
      proofRecord,
    }

    const proofRequest = await service.createProofRequestFromProposal(
      this.agentContext,
      proofRequestFromProposalOptions
    )

    const requestOptions: CreateRequestAsResponseOptions<PFs> = {
      proofRecord: proofRecord,
      proofFormats: proofRequest.proofFormats,
      goalCode: options.goalCode,
      willConfirm: options.willConfirm ?? true,
      comment: options.comment,
    }

    const { message } = await service.createRequestAsResponse(this.agentContext, requestOptions)

    const outboundMessage = createOutboundDIDCommV1Message(connection, message)
    await this.messageSender.sendMessage(this.agentContext, outboundMessage)

    return proofRecord
  }

  /**
   * Initiate a new presentation exchange as verifier by sending a presentation request message
   * to the connection with the specified connection id
   *
   * @param options multiple properties like connection id, protocol version, proof Formats to build the proof request
   * @returns Proof record associated with the sent request message
   */
  public async requestProof(options: RequestProofOptions<PFs, PSs>): Promise<ProofExchangeRecord> {
    const service = this.getService(options.protocolVersion)

    const connection = await this.connectionService.getById(this.agentContext, options.connectionId)

    // Assert
    connection.assertReady()

    const createProofRequest: CreateRequestOptions<PFs> = {
      connectionRecord: connection,
      proofFormats: options.proofFormats,
      autoAcceptProof: options.autoAcceptProof,
      parentThreadId: options.parentThreadId,
      comment: options.comment,
    }
    const { message, proofRecord } = await service.createRequest(this.agentContext, createProofRequest)

    const outboundMessage = createOutboundDIDCommV1Message(connection, message)
    await this.messageSender.sendMessage(this.agentContext, outboundMessage)

    return proofRecord
  }

  /**
   * Accept a presentation request as prover (by sending a presentation message) to the connection
   * associated with the proof record.
   *
   * @param options multiple properties like proof record id, proof formats to accept requested credentials object
   * specifying which credentials to use for the proof
   * @returns Proof record associated with the sent presentation message
   */
  public async acceptRequest(options: AcceptProofPresentationOptions<PFs>): Promise<ProofExchangeRecord> {
    const { proofRecordId, proofFormats, comment } = options

    const record = await this.getById(proofRecordId)

    const service = this.getService(record.protocolVersion)

    const presentationOptions: CreatePresentationOptions<PFs> = {
      proofFormats,
      proofRecord: record,
      comment,
    }
    const { message, proofRecord } = await service.createPresentation(this.agentContext, presentationOptions)

    const requestMessage = await service.findRequestMessage(this.agentContext, proofRecord.id)

    // Use connection if present
    if (proofRecord.connectionId) {
      const connection = await this.connectionService.getById(this.agentContext, proofRecord.connectionId)

      // Assert
      connection.assertReady()

      const outboundMessage = createOutboundDIDCommV1Message(connection, message)
      await this.messageSender.sendMessage(this.agentContext, outboundMessage)

      return proofRecord
    }

    // Use ~service decorator otherwise
    else if (requestMessage?.service) {
      // Create ~service decorator
      const routing = await this.routingService.getRouting(this.agentContext)
      message.service = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.recipientKey.publicKeyBase58],
        routingKeys: routing.routingKeys.map((key) => key.publicKeyBase58),
      })

      const recipientService = requestMessage.service

      // Set and save ~service decorator to record (to remember our verkey)

      await service.saveOrUpdatePresentationMessage(this.agentContext, {
        proofRecord: proofRecord,
        message: message,
        role: DidCommMessageRole.Sender,
      })

      await this.messageSender.sendMessageToService(this.agentContext, {
        message,
        service: recipientService.resolvedDidCommService,
        senderKey: message.service.resolvedDidCommService.recipientKeys[0],
        returnRoute: true,
      })

      return proofRecord
    }
    // Cannot send message without connectionId or ~service decorator
    else {
      throw new AriesFrameworkError(
        `Cannot accept presentation request without connectionId or ~service decorator on presentation request.`
      )
    }
  }

  /**
   * Initiate a new presentation exchange as verifier by sending an out of band presentation
   * request message
   *
   * @param options multiple properties like protocol version, proof Formats to build the proof request
   * @returns the message itself and the proof record associated with the sent request message
   */
  public async createRequest(options: CreateProofRequestOptions<PFs, PSs>): Promise<{
    message: DIDCommV1Message
    proofRecord: ProofExchangeRecord
  }> {
    const service = this.getService(options.protocolVersion)

    const createProofRequest: CreateRequestOptions<PFs> = {
      proofFormats: options.proofFormats,
      autoAcceptProof: options.autoAcceptProof,
      comment: options.comment,
      parentThreadId: options.parentThreadId,
    }

    return await service.createRequest(this.agentContext, createProofRequest)
  }

  public async declineRequest(proofRecordId: string): Promise<ProofExchangeRecord> {
    const proofRecord = await this.getById(proofRecordId)
    const service = this.getService(proofRecord.protocolVersion)

    proofRecord.assertState(ProofState.RequestReceived)

    await service.updateState(this.agentContext, proofRecord, ProofState.Declined)

    return proofRecord
  }

  /**
   * Accept a presentation as prover (by sending a presentation acknowledgement message) to the connection
   * associated with the proof record.
   *
   * @param proofRecordId The id of the proof exchange record for which to accept the presentation
   * @returns Proof record associated with the sent presentation acknowledgement message
   *
   */
  public async acceptPresentation(proofRecordId: string): Promise<ProofExchangeRecord> {
    const record = await this.getById(proofRecordId)
    const service = this.getService(record.protocolVersion)

    const { message, proofRecord } = await service.createAck(this.agentContext, {
      proofRecord: record,
    })

    const requestMessage = await service.findRequestMessage(this.agentContext, record.id)

    const presentationMessage = await service.findPresentationMessage(this.agentContext, record.id)

    // Use connection if present
    if (proofRecord.connectionId) {
      const connection = await this.connectionService.getById(this.agentContext, proofRecord.connectionId)

      // Assert
      connection.assertReady()

      const outboundMessage = createOutboundDIDCommV1Message(connection, message)
      await this.messageSender.sendMessage(this.agentContext, outboundMessage)
    }
    // Use ~service decorator otherwise
    else if (requestMessage?.service && presentationMessage?.service) {
      const recipientService = presentationMessage?.service
      const ourService = requestMessage.service

      await this.messageSender.sendMessageToService(this.agentContext, {
        message,
        service: recipientService.resolvedDidCommService,
        senderKey: ourService.resolvedDidCommService.recipientKeys[0],
        returnRoute: true,
      })
    }
    // Cannot send message without credentialId or ~service decorator
    else {
      throw new AriesFrameworkError(
        `Cannot accept presentation without connectionId or ~service decorator on presentation message.`
      )
    }

    return record
  }

  /**
   * Create a {@link RetrievedCredentials} object. Given input proof request and presentation proposal,
   * use credentials in the wallet to build indy requested credentials object for input to proof creation.
   * If restrictions allow, self attested attributes will be used.
   *
   * @param options multiple properties like proof record id and optional configuration
   * @returns RequestedCredentials
   */
  public async autoSelectCredentialsForProofRequest(
    options: AutoSelectCredentialsForProofRequestOptions
  ): Promise<FormatRequestedCredentialReturn<PFs>> {
    const proofRecord = await this.getById(options.proofRecordId)

    const service = this.getService(proofRecord.protocolVersion)

    const retrievedCredentials: FormatRetrievedCredentialOptions<PFs> =
      await service.getRequestedCredentialsForProofRequest(this.agentContext, {
        proofRecord: proofRecord,
        config: options.config,
      })
    return await service.autoSelectCredentialsForProofRequest(retrievedCredentials)
  }

  /**
   * Create a {@link RetrievedCredentials} object. Given input proof request and presentation proposal,
   * use credentials in the wallet to build indy requested credentials object for input to proof creation.
   *
   * If restrictions allow, self attested attributes will be used.
   *
   * @param options multiple properties like proof record id and optional configuration
   * @returns RetrievedCredentials object
   */
  public async getRequestedCredentialsForProofRequest(
    options: GetRequestedCredentialsForProofRequest
  ): Promise<FormatRetrievedCredentialOptions<PFs>> {
    const record = await this.getById(options.proofRecordId)
    const service = this.getService(record.protocolVersion)

    return await service.getRequestedCredentialsForProofRequest(this.agentContext, {
      proofRecord: record,
      config: options.config,
    })
  }

  /**
   * Send problem report message for a proof record
   *
   * @param proofRecordId  The id of the proof record for which to send problem report
   * @param message message to send
   * @returns proof record associated with the proof problem report message
   */
  public async sendProblemReport(proofRecordId: string, message: string): Promise<ProofExchangeRecord> {
    const record = await this.getById(proofRecordId)
    const service = this.getService(record.protocolVersion)
    if (!record.connectionId) {
      throw new AriesFrameworkError(`No connectionId found for proof record '${record.id}'.`)
    }
    const connection = await this.connectionService.getById(this.agentContext, record.connectionId)

    // Assert
    connection.assertReady()

    const { message: problemReport } = await service.createProblemReport(this.agentContext, {
      proofRecord: record,
      description: message,
    })

    const outboundMessage = createOutboundDIDCommV1Message(connection, problemReport)
    await this.messageSender.sendMessage(this.agentContext, outboundMessage)

    return record
  }

  public async getFormatData(proofRecordId: string): Promise<GetFormatDataReturn<PFs>> {
    const proofRecord = await this.getById(proofRecordId)
    const service = this.getService(proofRecord.protocolVersion)

    return service.getFormatData(this.agentContext, proofRecordId)
  }

  /**
   * Retrieve all proof records
   *
   * @returns List containing all proof records
   */
  public async getAll(): Promise<ProofExchangeRecord[]> {
    return this.proofRepository.getAll(this.agentContext)
  }

  /**
   * Retrieve all proof records by specified query params
   *
   * @returns List containing all proof records matching specified params
   */
  public findAllByQuery(query: Query<ProofExchangeRecord>): Promise<ProofExchangeRecord[]> {
    return this.proofRepository.findByQuery(this.agentContext, query)
  }

  /**
   * Retrieve a proof record by id
   *
   * @param proofRecordId The proof record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The proof record
   *
   */
  public async getById(proofRecordId: string): Promise<ProofExchangeRecord> {
    return await this.proofRepository.getById(this.agentContext, proofRecordId)
  }

  /**
   * Retrieve a proof record by id
   *
   * @param proofRecordId The proof record id
   * @return The proof record or null if not found
   *
   */
  public async findById(proofRecordId: string): Promise<ProofExchangeRecord | null> {
    return await this.proofRepository.findById(this.agentContext, proofRecordId)
  }

  /**
   * Delete a proof record by id
   *
   * @param proofId the proof record id
   */
  public async deleteById(proofId: string, options?: DeleteProofOptions) {
    const proofRecord = await this.getById(proofId)
    const service = this.getService(proofRecord.protocolVersion)
    return service.delete(this.agentContext, proofRecord, options)
  }

  /**
   * Retrieve a proof record by connection id and thread id
   *
   * @param connectionId The connection id
   * @param threadId The thread id
   * @throws {RecordNotFoundError} If no record is found
   * @throws {RecordDuplicateError} If multiple records are found
   * @returns The proof record
   */
  public async getByThreadAndConnectionId(threadId: string, connectionId?: string): Promise<ProofExchangeRecord> {
    return this.proofRepository.getByThreadAndConnectionId(this.agentContext, threadId, connectionId)
  }

  /**
   * Retrieve proof records by connection id and parent thread id
   *
   * @param connectionId The connection id
   * @param parentThreadId The parent thread id
   * @returns List containing all proof records matching the given query
   */
  public async getByParentThreadAndConnectionId(
    parentThreadId: string,
    connectionId?: string
  ): Promise<ProofExchangeRecord[]> {
    return this.proofRepository.getByParentThreadAndConnectionId(this.agentContext, parentThreadId, connectionId)
  }

  /**
   * Update a proof record by
   *
   * @param proofRecord the proof record
   */
  public async update(proofRecord: ProofExchangeRecord): Promise<void> {
    await this.proofRepository.update(this.agentContext, proofRecord)
  }

  public async findProposalMessage(proofRecordId: string): Promise<FindProofProposalMessageReturn<PSs>> {
    const record = await this.getById(proofRecordId)
    const service = this.getService(record.protocolVersion)
    return service.findProposalMessage(this.agentContext, proofRecordId)
  }

  public async findRequestMessage(proofRecordId: string): Promise<FindProofRequestMessageReturn<PSs>> {
    const record = await this.getById(proofRecordId)
    const service = this.getService(record.protocolVersion)
    return service.findRequestMessage(this.agentContext, proofRecordId)
  }

  public async findPresentationMessage(proofRecordId: string): Promise<FindProofPresentationMessageReturn<PSs>> {
    const record = await this.getById(proofRecordId)
    const service = this.getService(record.protocolVersion)
    return service.findPresentationMessage(this.agentContext, proofRecordId)
  }

  private registerHandlers(dispatcher: Dispatcher, mediationRecipientService: MediationRecipientService) {
    for (const service of Object.values(this.serviceMap)) {
      const proofService = service as ProofService
      proofService.registerHandlers(
        dispatcher,
        this.agentConfig,
        new ProofResponseCoordinator(proofService),
        mediationRecipientService,
        this.routingService
      )
    }
  }
}
