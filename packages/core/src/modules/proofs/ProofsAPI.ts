import type { PresentationExchangeRecord, PresentationRecordBinding } from './PresentationExchangeRecord'
import type { ProofService } from './ProofService'
import type { ProofRecord } from './repository'
import type { RetrievedCredentials } from './v1/models'
import type {
  AcceptProposalOptions,
  ProofRequestAsResponse,
  ProofRequestsOptions,
  ProposeProofOptions,
} from './v2/interface'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { AriesFrameworkError } from '../../error/AriesFrameworkError'
import { ConnectionService } from '../connections/services/ConnectionService'
import { IndyHolderService } from '../indy'
import { MediationRecipientService } from '../routing'

import { PresentationRecordType } from './PresentationExchangeRecord'
import { ProofProtocolVersion } from './ProofProtocolVersion'
import { ProofResponseCoordinator } from './ProofResponseCoordinator'
import { ProofState } from './ProofState'
import { ProofsModule } from './ProofsModule'
import { ProofRepository } from './repository'
import { V1LegacyProofService } from './v1/V1LegacyProofService'
import { V1ProofService } from './v1/V1ProofService'
import { ProofRole } from './v2/ProofRole'
import { V2ProofService } from './v2/V2ProofService'

export interface ProofsAPI {
  proposeProof(proofOptions: ProposeProofOptions): Promise<PresentationExchangeRecord>
  getById(proofRecordId: string): Promise<ProofRecord>
}

@scoped(Lifecycle.ContainerScoped)
export class ProofsAPI extends ProofsModule implements ProofsAPI {
  private connService: ConnectionService
  private msgSender: MessageSender
  private v1ProofService: V1LegacyProofService
  private proofRepository: ProofRepository
  private eventEmitter: EventEmitter
  private dispatcher: Dispatcher
  private agntConfig: AgentConfig
  private proofResponseCoord: ProofResponseCoordinator
  private v1Service: V1ProofService
  private v2Service: V2ProofService
  private serviceMap: { '1.0': V1ProofService; '2.0': V2ProofService }
  private indyHolderService: IndyHolderService

  public constructor(
    dispatcher: Dispatcher,
    messageSender: MessageSender,
    connectionService: ConnectionService,
    agentConfig: AgentConfig,
    proofResponseCoordinator: ProofResponseCoordinator,
    mediationRecipientService: MediationRecipientService,
    v1ProofService: V1LegacyProofService,
    proofRepository: ProofRepository,
    eventEmitter: EventEmitter,
    indyHolderService: IndyHolderService
  ) {
    super(
      dispatcher,
      connectionService,
      v1ProofService,
      messageSender,
      agentConfig,
      proofResponseCoordinator,
      mediationRecipientService
    )
    this.msgSender = messageSender
    this.v1ProofService = v1ProofService
    this.connService = connectionService
    this.proofRepository = proofRepository
    this.eventEmitter = eventEmitter
    this.dispatcher = dispatcher
    this.agntConfig = agentConfig
    this.proofResponseCoord = proofResponseCoordinator
    this.indyHolderService = indyHolderService
    this.v1Service = new V1ProofService(this.v1ProofService, this.connService)
    this.v2Service = new V2ProofService(
      this.proofRepository,
      this.connService,
      this.eventEmitter,
      this.agntConfig,
      this.dispatcher,
      this.proofResponseCoord,
      this.indyHolderService
    )

    this.serviceMap = {
      [ProofProtocolVersion.V1_0]: this.v1Service,
      [ProofProtocolVersion.V2_0]: this.v2Service,
    }

    this.v2Service.registerHandlers()
  }

  public getService(protocolVersion: ProofProtocolVersion) {
    return this.serviceMap[protocolVersion]
  }

  public async proposeProof(proofOptions: ProposeProofOptions): Promise<PresentationExchangeRecord> {
    const version: ProofProtocolVersion = proofOptions.protocolVersion

    const service: ProofService = this.getService(version)

    const connection = await this.connService.getById(proofOptions.connectionId)

    const { proofRecord, message } = await service.createProposal(proofOptions)

    const outbound = createOutboundMessage(connection, message)

    await this.msgSender.sendMessage(outbound)

    const recordBinding: PresentationRecordBinding = {
      presentationRecordType: proofOptions.proofFormats?.indy
        ? PresentationRecordType.INDY
        : PresentationRecordType.W3C,
      presentationRecordId: proofRecord.id,
    }

    const bindings: PresentationRecordBinding[] = []
    bindings.push(recordBinding)

    const presentationExchangeRecord: PresentationExchangeRecord = {
      ...proofRecord,
      protocolVersion: version,
      state: ProofState.ProposalSent,
      role: ProofRole.Prover,
      presentation: bindings,
    }

    return presentationExchangeRecord
  }

  public async acceptProof(acceptProposalOptions: AcceptProposalOptions): Promise<ProofRecord> {
    const version: ProofProtocolVersion = acceptProposalOptions.protocolVersion

    const service: ProofService = this.getService(version)

    const proofRecord = await service.getById(acceptProposalOptions.proofRecordId)

    if (!proofRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${proofRecord.id}'. Connection-less issuance does not support presentation proposal or negotiation.`
      )
    }

    const connection = await this.connService.getById(proofRecord.connectionId)

    const presentationProposal = proofRecord.proposalMessage?.presentationProposal
    if (!presentationProposal) {
      throw new AriesFrameworkError(
        `Proof record with id ${acceptProposalOptions.proofRecordId} is missing required presentation proposal`
      )
    }

    const config: ProofRequestsOptions = {
      name: acceptProposalOptions.request?.name ?? 'proof-request',
      version: acceptProposalOptions?.request?.version ?? '1.0',
      nonce: acceptProposalOptions?.request?.nonce,
    }

    const proofRequest = await service.createProofRequestFromProposal(presentationProposal, config)

    const proofRequestAsResponse: ProofRequestAsResponse = {
      proofRecord,
      proofRequest,
      comment: acceptProposalOptions?.comment,
    }
    const { message } = await service.createRequestAsResponse(proofRequestAsResponse)

    const outboundMessage = createOutboundMessage(connection, message)
    await this.msgSender.sendMessage(outboundMessage)

    return proofRecord
  }

  // get protocol version to get the credentials for proof request
  // check the version received and call the appropriate service to get the credentials

  public async getRequestedCredentialsForProofRequest(
    protocolVersion: ProofProtocolVersion,
    proofRecordId: string,
    config?: GetRequestedCredentialsConfig
  ): Promise<RetrievedCredentials> {
    const version: ProofProtocolVersion = protocolVersion

    const service: ProofService = this.getService(version)
    const proofRecord = await service.getById(proofRecordId)
    const indyProofRequest = proofRecord.requestMessage?.indyProofRequest
    const presentationPreview = config?.filterByPresentationPreview
      ? proofRecord.proposalMessage?.presentationProposal
      : undefined

    if (!indyProofRequest) {
      throw new AriesFrameworkError(
        'Unable to get requested credentials for proof request. No proof request message was found or the proof request message does not contain an indy proof request.'
      )
    }

    return service.getRequestedCredentialsForProofRequest(indyProofRequest, presentationPreview)
  }

  /**
   * Retrieve a proof record by id
   *
   * @param proofRecordId The proof record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The proof record
   *
   */
  public async getById(proofRecordId: string): Promise<ProofRecord> {
    return this.proofRepository.getById(proofRecordId)
  }
}

export interface GetRequestedCredentialsConfig {
  /**
   * Whether to filter the retrieved credentials using the presentation preview.
   * This configuration will only have effect if a presentation proposal message is available
   * containing a presentation preview.
   */
  filterByPresentationPreview?: boolean
}
