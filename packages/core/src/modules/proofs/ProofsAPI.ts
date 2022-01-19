import type { PresentationExchangeRecord, PresentationRecordBinding } from './repository/PresentationExchangeRecord'
import type { ProofService } from './ProofService'
import type {
  AcceptProposalOptions,
  CreateRequestOptions,
  ProofRequestAsResponse,
  ProofRequestsOptions,
  ProposeProofOptions,
  RequestProofOptions,
} from './interface'
import type { ProofRecord } from './repository'
import type { RetrievedCredentials } from './protocol/v1/models'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { InjectionSymbols } from '../../constants'
import { AriesFrameworkError } from '../../error/AriesFrameworkError'
import { Wallet } from '../../wallet/Wallet'
import { ConnectionService } from '../connections/services/ConnectionService'
import { IndyHolderService } from '../indy'
import { MediationRecipientService } from '../routing'

import { PresentationRecordType } from './repository/PresentationExchangeRecord'
import { ProofProtocolVersion } from './models/ProofProtocolVersion'
import { ProofResponseCoordinator } from './ProofResponseCoordinator'
import { ProofRole } from './models/ProofRole'
import { ProofState } from './models/ProofState'
import { ProofsModule } from './ProofsModule'
import { ProofRepository } from './repository'
import { V1LegacyProofService } from './protocol/v1/V1LegacyProofService'
import { V1ProofService } from './protocol/v1/V1ProofService'
import { ProofRequest } from './protocol/v1/models'
import { V2ProofService } from './v2/V2ProofService'

export interface ProofsAPI {
  proposeProof(proofOptions: ProposeProofOptions): Promise<PresentationExchangeRecord>
  acceptProposal(acceptProposalOptions: AcceptProposalOptions): Promise<ProofRecord>
  requestProof(requestProofOptions: RequestProofOptions): Promise<ProofRecord>
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
  private wallet: Wallet

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
    indyHolderService: IndyHolderService,
    @inject(InjectionSymbols.Wallet) wallet: Wallet
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
    this.wallet = wallet
    this.v1Service = new V1ProofService(this.v1ProofService, this.connService)
    this.v2Service = new V2ProofService(
      this.proofRepository,
      this.connService,
      this.eventEmitter,
      this.agntConfig,
      this.dispatcher,
      this.proofResponseCoord,
      this.wallet,
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
        ? PresentationRecordType.Indy
        : PresentationRecordType.W3c,
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

  public async acceptProposal(acceptProposalOptions: AcceptProposalOptions): Promise<ProofRecord> {
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

  public async requestProof(requestProofOptions: RequestProofOptions): Promise<ProofRecord> {
    const version: ProofProtocolVersion = requestProofOptions.protocolVersion

    const { proofRequestOptions } = requestProofOptions

    const service: ProofService = this.getService(version)

    const connection = await this.connService.getById(requestProofOptions.connectionId)

    const nonce = proofRequestOptions.nonce ?? (await this.generateProofRequestNonce())

    const proofRequest = new ProofRequest({
      name: proofRequestOptions.name ?? 'proof-request',
      version: proofRequestOptions.name ?? '1.0',
      nonce,
      requestedAttributes: proofRequestOptions.requestedAttributes,
      requestedPredicates: proofRequestOptions.requestedPredicates,
    })

    const createRequestOptions: CreateRequestOptions = {
      proofRequest,
      connectionRecord: connection,
      comment: requestProofOptions.comment,
      autoAcceptProof: requestProofOptions.autoAcceptProof,
    }

    const { message, proofRecord } = await service.createRequest(createRequestOptions)

    const outboundMessage = createOutboundMessage(connection, message)
    await this.msgSender.sendMessage(outboundMessage)

    return proofRecord
  }

  public async generateProofRequestNonce() {
    return this.wallet.generateNonce()
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
