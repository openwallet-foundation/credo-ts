import type { ProofRequest, ProofState, ProofStateChangedEvent, RequestedCredentials, RetrievedCredentials } from '.'
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
import type { ProofResponseCoordinator } from './ProofResponseCoordinator'
import type { ProofFormatService } from './formats/ProofFormatService'
import type { CreateProblemReportOptions } from './formats/models/ProofFormatServiceOptions'
import type { GetRequestedCredentialsConfig } from './models/GetRequestedCredentialsConfig'
import type { ProofProtocolVersion } from './models/ProofProtocolVersion'
import type {
  CreateAckOptions,
  CreatePresentationOptions,
  CreateProposalAsResponseOptions,
  CreateProposalOptions,
  CreateRequestAsResponseOptions,
  CreateRequestOptions,
} from './models/ProofServiceOptions'
import type { ProofRecord, ProofRepository } from './repository'
import type { PresentationRecordType } from './repository/PresentationExchangeRecord'

import { ConsoleLogger, LogLevel } from '../../logger'

import { ProofEventTypes } from './ProofEvents'

const logger = new ConsoleLogger(LogLevel.debug)

/**
 * - creates records & messages
 * - stores records
 * - returns records & messages
 */

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

    // this.registerHandlers(dispatcher, agentConfig, mediationRecipientService)
  }

  public async generateProofRequestNonce() {
    return this.wallet.generateNonce()
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param proofRecord The proof record to update the state for
   * @param newState The state to update to
   *
   */
  protected async updateState(proofRecord: ProofRecord, newState: ProofState) {
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
   * 1. Create proposal message
   * 2. loop through all formats from ProposeProofOptions and call format service
   * 3. Create and store proof record
   * 4. Store proposal message
   * 5. Return proposal message + proof record
   */
  abstract createProposal(options: CreateProposalOptions): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>

  /**
   * Create a proposal message in response to a received proof request message
   *
   * 1. assert record state
   * 1. Create proposal message
   * 2. loop through all formats from ProposeProofOptions and call format service
   * 3. Update proof record
   * 4. Create or update proposal message
   * 5. Return proposal message + proof record
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

  abstract declineRequest(proofRecord: ProofRecord): Promise<ProofRecord>

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

  public getFormatService(presentationRecordType: PresentationRecordType): ProofFormatService {
    logger.debug(presentationRecordType.toString())
    throw Error('Not Implemented')
  }

  public abstract shouldAutoRespondToRequest(proofRecord: ProofRecord): Promise<boolean>

  public abstract shouldAutoRespondToPresentation(proofRecord: ProofRecord): Promise<boolean>

  public abstract registerHandlers(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    proofResponseCoordinator: ProofResponseCoordinator,
    mediationRecipientService: MediationRecipientService
  ): Promise<void>

  public abstract findRequestMessage(options: { proofRecord: ProofRecord }): Promise<AgentMessage | null>

  public abstract findPresentationMessage(options: { proofRecord: ProofRecord }): Promise<AgentMessage | null>

  public abstract findProposalMessage(options: { proofRecord: ProofRecord }): Promise<AgentMessage | null>

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

  public abstract getRequestedCredentialsForProofRequest(options: {
    proofRecord: ProofRecord
    config: {
      indy?: GetRequestedCredentialsConfig
      jsonLd?: never
    }
  }): Promise<{
    indy?: RetrievedCredentials
    jsonLd?: never
  }>

  public abstract autoSelectCredentialsForProofRequest(options: {
    indy?: RetrievedCredentials
    jsonLd?: never
  }): Promise<{
    indy?: RequestedCredentials
    jsonLd?: never
  }>

  public abstract createProofRequestFromProposal(options: {
    formats: {
      indy?: {
        proofRecord: ProofRecord
      }
      jsonLd?: never
    }
    config?: { indy?: { name: string; version: string; nonce?: string }; jsonLd?: never }
  }): Promise<{
    indy?: ProofRequest
    jsonLd?: never
  }>

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
}
