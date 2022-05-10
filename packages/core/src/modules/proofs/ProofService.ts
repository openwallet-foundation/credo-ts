import type { AgentConfig } from '../../agent/AgentConfig'
import type { AgentMessage } from '../../agent/AgentMessage'
import type { Dispatcher } from '../../agent/Dispatcher'
import type { EventEmitter } from '../../agent/EventEmitter'
import type { InboundMessageContext } from '../../agent/models/InboundMessageContext'
import type { Logger } from '../../logger'
import type { DidCommMessageRepository, DidCommMessageRole } from '../../storage'
import type { Wallet } from '../../wallet/Wallet'
import type { ConnectionService } from '../connections/services'
import type { MediationRecipientService } from '../routing'
import type { ProofStateChangedEvent } from './ProofEvents'
import type { ProofResponseCoordinator } from './ProofResponseCoordinator'
import type { CreateProblemReportOptions } from './formats/models/ProofFormatServiceOptions'
import type { ProofProtocolVersion } from './models/ProofProtocolVersion'
import type {
  CreateAckOptions,
  CreatePresentationOptions,
  CreateProposalAsResponseOptions,
  CreateProposalOptions,
  CreateRequestAsResponseOptions,
  CreateRequestOptions,
  GetRequestedCredentialsForProofRequestOptions,
  ProofRequestFromProposalOptions,
} from './models/ProofServiceOptions'
import type { ProofState } from './models/ProofState'
import type {
  RetrievedCredentialOptions,
  ProofRequestFormats,
  RequestedCredentialsFormats,
} from './models/SharedOptions'
import type { ProofRecord, ProofRepository } from './repository'

import { ProofEventTypes } from './ProofEvents'

export abstract class ProofService {
  protected proofRepository: ProofRepository
  protected didCommMessageRepository: DidCommMessageRepository
  protected eventEmitter: EventEmitter
  protected connectionService: ConnectionService
  protected wallet: Wallet
  protected logger: Logger

  public constructor(
    agentConfig: AgentConfig,
    proofRepository: ProofRepository,
    connectionService: ConnectionService,
    didCommMessageRepository: DidCommMessageRepository,
    wallet: Wallet,
    eventEmitter: EventEmitter
  ) {
    this.proofRepository = proofRepository
    this.connectionService = connectionService
    this.didCommMessageRepository = didCommMessageRepository
    this.eventEmitter = eventEmitter
    this.wallet = wallet
    this.logger = agentConfig.logger
  }

  public async generateProofRequestNonce() {
    return await this.wallet.generateNonce()
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param proofRecord The proof record to update the state for
   * @param newState The state to update to
   *
   */
  public async updateState(proofRecord: ProofRecord, newState: ProofState) {
    const previousState = proofRecord.state
    proofRecord.state = newState
    await this.proofRepository.update(proofRecord)

    this.eventEmitter.emit<ProofStateChangedEvent>({
      type: ProofEventTypes.ProofStateChanged,
      payload: { proofRecord, previousState: previousState },
    })
  }

  abstract getVersion(): ProofProtocolVersion

  /**
   * 1. Assert (connection ready, record state)
   * 2. Create proposal message
   * 3. loop through all formats from ProposeProofOptions and call format service
   * 4. Create and store proof record
   * 5. Store proposal message
   * 6. Return proposal message + proof record
   */
  abstract createProposal(options: CreateProposalOptions): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>

  /**
   * Create a proposal message in response to a received proof request message
   *
   * 1. assert record state
   * 2. Create proposal message
   * 3. loop through all formats from ProposeProofOptions and call format service
   * 4. Update proof record
   * 5. Create or update proposal message
   * 6. Return proposal message + proof record
   */
  abstract createProposalAsResponse(
    options: CreateProposalAsResponseOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>

  /**
   * Process a received proposal message (does not accept yet)
   *
   * 1. Find proof record by thread and connection id
   *
   * Two flows possible:
   * - Proof record already exist
   *    2. Assert state
   *    3. Save or update proposal message in storage (didcomm message record)
   *    4. Loop through all format services to process proposal message
   *    5. Update & return record
   *
   * - Proof record does not exist yet
   *    2. Create record
   *    3. Save proposal message
   *    4. Loop through all format services to process proposal message
   *    5. Save & return record
   */
  abstract processProposal(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord>

  abstract createRequest(options: CreateRequestOptions): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>

  abstract createRequestAsResponse(
    options: CreateRequestAsResponseOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>

  abstract processRequest(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord>

  abstract createPresentation(
    options: CreatePresentationOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>

  abstract processPresentation(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord>

  abstract createAck(options: CreateAckOptions): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>

  abstract processAck(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord>

  abstract createProblemReport(
    options: CreateProblemReportOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>
  abstract processProblemReport(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord>

  public abstract shouldAutoRespondToRequest(proofRecord: ProofRecord): Promise<boolean>

  public abstract shouldAutoRespondToPresentation(proofRecord: ProofRecord): Promise<boolean>

  public abstract registerHandlers(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    proofResponseCoordinator: ProofResponseCoordinator,
    mediationRecipientService: MediationRecipientService
  ): Promise<void>

  public abstract findRequestMessage(proofRecordId: string): Promise<AgentMessage | null>

  public abstract findPresentationMessage(proofRecordId: string): Promise<AgentMessage | null>

  public abstract findProposalMessage(proofRecordId: string): Promise<AgentMessage | null>

  public async saveOrUpdatePresentationMessage(options: {
    proofRecord: ProofRecord
    message: AgentMessage
    role: DidCommMessageRole
  }): Promise<void> {
    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      associatedRecordId: options.proofRecord.id,
      agentMessage: options.message,
      role: options.role,
    })
  }

  public abstract getRequestedCredentialsForProofRequest(
    options: GetRequestedCredentialsForProofRequestOptions
  ): Promise<RetrievedCredentialOptions>

  public abstract autoSelectCredentialsForProofRequest(
    options: RetrievedCredentialOptions
  ): Promise<RequestedCredentialsFormats>

  public abstract createProofRequestFromProposal(options: ProofRequestFromProposalOptions): Promise<ProofRequestFormats>

  /**
   * Retrieve all proof records
   *
   * @returns List containing all proof records
   */
  public async getAll(): Promise<ProofRecord[]> {
    return this.proofRepository.getAll()
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

  /**
   * Retrieve a proof record by id
   *
   * @param proofRecordId The proof record id
   * @return The proof record or null if not found
   *
   */
  public async findById(proofRecordId: string): Promise<ProofRecord | null> {
    return this.proofRepository.findById(proofRecordId)
  }

  /**
   * Delete a proof record by id
   *
   * @param proofId the proof record id
   */
  public async deleteById(proofId: string) {
    const proofRecord = await this.getById(proofId)
    return this.proofRepository.delete(proofRecord)
  }

  /**
   * Update a proof record by
   *
   * @param proofRecord the proof record
   */
  public update(proofRecord: ProofRecord) {
    return this.proofRepository.update(proofRecord)
  }
}
