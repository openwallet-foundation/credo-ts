import type { AgentMessage } from '../../agent/AgentMessage'
import type { ProofService } from './ProofService'
import type {
  AcceptProposalOptions,
  OutOfBandRequestOptions,
  ProposeProofOptions,
  RequestProofOptions,
  ServiceMap,
} from './ProofsApiOptions'
import type { ProofFormat } from './formats/ProofFormat'
import type { IndyProofFormat } from './formats/indy/IndyProofFormat'
import type {
  CreateOutOfBandRequestOptions,
  CreateProposalOptions,
  CreateRequestOptions,
  ProofRequestFromProposalOptions,
} from './models/ProofServiceOptions'
import type { ProofRecord } from './repository/ProofRecord'

import { inject, injectable } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { AgentContext } from '../../agent/context/AgentContext'
import { createOutboundMessage } from '../../agent/helpers'
import { InjectionSymbols } from '../../constants'
import { ServiceDecorator } from '../../decorators/service/ServiceDecorator'
import { AriesFrameworkError } from '../../error'
import { Logger } from '../../logger'
import { DidCommMessageRole } from '../../storage/didcomm/DidCommMessageRole'
import { ConnectionService } from '../connections/services/ConnectionService'
import { RevocationNotificationService } from '../credentials/protocol/revocation-notification/services/RevocationNotificationService'
import { MediationRecipientService } from '../routing/services/MediationRecipientService'
import { RoutingService } from '../routing/services/RoutingService'

import { ProofResponseCoordinator } from './ProofResponseCoordinator'
import { ProofsModuleConfig } from './ProofsModuleConfig'
import { V1ProofService } from './protocol/v1/V1ProofService'
import { V2ProofService } from './protocol/v2/V2ProofService'
import { ProofRepository } from './repository/ProofRepository'

export interface ProofsApi<PFs extends ProofFormat[], PSs extends ProofService<PFs>[]> {
  // Proposal methods
  proposeProof(options: ProposeProofOptions<PFs, PSs>): Promise<ProofRecord>
  acceptProposal(options: AcceptProposalOptions): Promise<ProofRecord>

  // Request methods
  requestProof(options: RequestProofOptions<PFs, PSs>): Promise<ProofRecord>

  // out of band
  createOutOfBandRequest(options: OutOfBandRequestOptions<PFs, PSs>): Promise<{
    message: AgentMessage
    proofRecord: ProofRecord
  }>

  // Present

  // Record Methods
  getAll(agentContext: AgentContext): Promise<ProofRecord[]>
  getById(agentContext: AgentContext, proofRecordId: string): Promise<ProofRecord>
  deleteById(agentContext: AgentContext, proofId: string): Promise<void>
  findById(agentContext: AgentContext, proofRecordId: string): Promise<ProofRecord | null>
  update(agentContext: AgentContext, proofRecord: ProofRecord): Promise<void>
}

@injectable()
export class ProofsApi<
  PFs extends ProofFormat[] = [IndyProofFormat],
  PSs extends ProofService<PFs>[] = [V1ProofService, V2ProofService<PFs>]
> implements ProofsApi<PFs, PSs>
{
  public readonly config: ProofsModuleConfig

  private connectionService: ConnectionService
  private messageSender: MessageSender
  private mediationRecipientService: MediationRecipientService
  private routingService: RoutingService
  private proofRepository: ProofRepository
  private agentContext: AgentContext
  private agentConfig: AgentConfig
  private logger: Logger
  private serviceMap: ServiceMap<PFs, PSs>

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
    v2Service: V2ProofService<PFs>,
    // only injected so the handlers will be registered
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _revocationNotificationService: RevocationNotificationService,
    config: ProofsModuleConfig
  ) {
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.proofRepository = proofRepository
    this.agentContext = agentContext
    this.agentConfig = agentConfig
    this.routingService = routingService
    this.mediationRecipientService = mediationRecipientService
    this.logger = logger
    this.config = config

    // Dynamically build service map. This will be extracted once services are registered dynamically
    this.serviceMap = [v1Service, v2Service].reduce(
      (serviceMap, service) => ({
        ...serviceMap,
        [service.version]: service,
      }),
      {}
    ) as ServiceMap<PFs, PSs>

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
  public async proposeProof(options: ProposeProofOptions): Promise<ProofRecord> {
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
    }

    const { message, proofRecord } = await service.createProposal(this.agentContext, proposalOptions)

    const outbound = createOutboundMessage(connection, message)
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
  public async acceptProposal(options: AcceptProposalOptions): Promise<ProofRecord> {
    const { proofRecordId } = options
    const proofRecord = await this.getById(this.agentContext, proofRecordId)

    const service = this.getService(proofRecord.protocolVersion)

    if (!proofRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${proofRecord.id}'. Connection-less issuance does not support presentation proposal or negotiation.`
      )
    }

    const connection = await this.connectionService.getById(this.agentContext, proofRecord.connectionId)

    // Assert
    connection.assertReady()

    const proofRequestFromProposalOptions: ProofRequestFromProposalOptions = {
      proofRecord,
    }

    const proofRequest = await service.createProofRequestFromProposal(
      this.agentContext,
      proofRequestFromProposalOptions
    )

    const { message } = await service.createRequestAsResponse(this.agentContext, {
      proofRecord: proofRecord,
      proofFormats: proofRequest,
      goalCode: options.goalCode,
      willConfirm: options.willConfirm ?? true,
      comment: options.comment,
    })

    const outboundMessage = createOutboundMessage(connection, message)
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
  public async requestProof(options: RequestProofOptions): Promise<ProofRecord> {
    const service = this.getService(options.protocolVersion)

    const connection = await this.connectionService.getById(this.agentContext, options.connectionId)

    // Assert
    connection.assertReady()

    const createProofRequest: CreateRequestOptions<PFs> = {
      connectionRecord: connection,
      proofFormats: options.proofFormats,
      autoAcceptProof: options.autoAcceptProof,
      comment: options.comment,
    }
    const { message, proofRecord } = await service.createRequest(this.agentContext, createProofRequest)

    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(this.agentContext, outboundMessage)

    return proofRecord
  }

  public async createOutOfBandRequest(options: OutOfBandRequestOptions<PFs, PSs>): Promise<{
    message: AgentMessage
    proofRecord: ProofRecord
  }> {
    const service = this.getService(options.protocolVersion)

    const createProofRequest: CreateOutOfBandRequestOptions<PFs> = {
      proofFormats: options.proofFormats,
      autoAcceptProof: options.autoAcceptProof,
      comment: options.comment,
    }

    const { message, proofRecord } = await service.createRequest(this.agentContext, createProofRequest)

    // Create and set ~service decorator

    const routing = await this.routingService.getRouting(this.agentContext)
    message.service = new ServiceDecorator({
      serviceEndpoint: routing.endpoints[0],
      recipientKeys: [routing.recipientKey.publicKeyBase58],
      routingKeys: routing.routingKeys.map((key) => key.publicKeyBase58),
    })
    // Save ~service decorator to record (to remember our verkey)

    await service.saveOrUpdatePresentationMessage(this.agentContext, {
      message,
      proofRecord: proofRecord,
      role: DidCommMessageRole.Sender,
    })

    await service.update(this.agentContext, proofRecord)

    return { proofRecord, message }
  }

  /**
   * Retrieve all proof records
   *
   * @returns List containing all proof records
   */
  public async getAll(agentContext: AgentContext): Promise<ProofRecord[]> {
    return this.proofRepository.getAll(agentContext)
  }

  /**
   * Retrieve a proof record by id
   *
   * @param proofRecordId The proof record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The proof record
   *
   */
  public async getById(agentContext: AgentContext, proofRecordId: string): Promise<ProofRecord> {
    return await this.proofRepository.getById(agentContext, proofRecordId)
  }

  /**
   * Retrieve a proof record by id
   *
   * @param proofRecordId The proof record id
   * @return The proof record or null if not found
   *
   */
  public async findById(agentContext: AgentContext, proofRecordId: string): Promise<ProofRecord | null> {
    return await this.proofRepository.findById(agentContext, proofRecordId)
  }

  /**
   * Delete a proof record by id
   *
   * @param proofId the proof record id
   */
  public async deleteById(agentContext: AgentContext, proofId: string) {
    const proofRecord = await this.getById(agentContext, proofId)
    return await this.proofRepository.delete(agentContext, proofRecord)
  }

  /**
   * Update a proof record by
   *
   * @param proofRecord the proof record
   */
  public async update(agentContext: AgentContext, proofRecord: ProofRecord) {
    await this.proofRepository.update(agentContext, proofRecord)
  }

  private registerHandlers(dispatcher: Dispatcher, mediationRecipientService: MediationRecipientService) {
    for (const service of Object.values(this.serviceMap)) {
      const proofService = service as ProofService
      proofService.registerHandlers(
        dispatcher,
        this.agentConfig,
        new ProofResponseCoordinator(this.agentConfig, proofService, this.config),
        mediationRecipientService
      )
    }
  }
}
