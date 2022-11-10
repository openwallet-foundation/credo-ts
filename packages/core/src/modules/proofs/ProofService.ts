import type { AgentConfig } from '../../agent/AgentConfig'
import type { Dispatcher } from '../../agent/Dispatcher'
import type { EventEmitter } from '../../agent/EventEmitter'
import type { AgentContext } from '../../agent/context/AgentContext'
import type { DIDCommV1Message } from '../../agent/didcomm'
import type { InboundMessageContext } from '../../agent/models/InboundMessageContext'
import type { Logger } from '../../logger'
import type { DidCommMessageRepository, DidCommMessageRole } from '../../storage'
import type { Wallet } from '../../wallet/Wallet'
import type { ConnectionService } from '../connections/services'
import type { MediationRecipientService, RoutingService } from '../routing'
import type { ProofStateChangedEvent } from './ProofEvents'
import type { ProofResponseCoordinator } from './ProofResponseCoordinator'
import type { ProofFormat } from './formats/ProofFormat'
import type { CreateProblemReportOptions } from './formats/models/ProofFormatServiceOptions'
import type {
  CreateAckOptions,
  CreatePresentationOptions,
  CreateProofRequestFromProposalOptions,
  CreateProposalAsResponseOptions,
  CreateProposalOptions,
  CreateRequestAsResponseOptions,
  CreateRequestOptions,
  DeleteProofOptions,
  FormatRequestedCredentialReturn,
  FormatRetrievedCredentialOptions,
  GetFormatDataReturn,
  GetRequestedCredentialsForProofRequestOptions,
  ProofRequestFromProposalOptions,
} from './models/ProofServiceOptions'
import type { ProofState } from './models/ProofState'
import type { ProofExchangeRecord, ProofRepository } from './repository'

import { JsonTransformer } from '../../utils/JsonTransformer'

import { ProofEventTypes } from './ProofEvents'

export abstract class ProofService<PFs extends ProofFormat[] = ProofFormat[]> {
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
  abstract readonly version: string

  public emitStateChangedEvent(
    agentContext: AgentContext,
    proofRecord: ProofExchangeRecord,
    previousState: ProofState | null
  ) {
    const clonedProof = JsonTransformer.clone(proofRecord)

    this.eventEmitter.emit<ProofStateChangedEvent>(agentContext, {
      type: ProofEventTypes.ProofStateChanged,
      payload: {
        proofRecord: clonedProof,
        previousState: previousState,
      },
    })
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param proofRecord The proof record to update the state for
   * @param newState The state to update to
   *
   */
  public async updateState(agentContext: AgentContext, proofRecord: ProofExchangeRecord, newState: ProofState) {
    const previousState = proofRecord.state
    proofRecord.state = newState
    await this.proofRepository.update(agentContext, proofRecord)

    this.emitStateChangedEvent(agentContext, proofRecord, previousState)
  }

  public update(agentContext: AgentContext, proofRecord: ProofExchangeRecord) {
    return this.proofRepository.update(agentContext, proofRecord)
  }

  /**
   * 1. Assert (connection ready, record state)
   * 2. Create proposal message
   * 3. loop through all formats from ProposeProofOptions and call format service
   * 4. Create and store proof record
   * 5. Store proposal message
   * 6. Return proposal message + proof record
   */
  abstract createProposal(
    agentContext: AgentContext,
    options: CreateProposalOptions<PFs>
  ): Promise<{ proofRecord: ProofExchangeRecord; message: DIDCommV1Message }>

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
    agentContext: AgentContext,
    options: CreateProposalAsResponseOptions<PFs>
  ): Promise<{ proofRecord: ProofExchangeRecord; message: DIDCommV1Message }>

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
  abstract processProposal(messageContext: InboundMessageContext<DIDCommV1Message>): Promise<ProofExchangeRecord>

  abstract createRequest(
    agentContext: AgentContext,
    options: CreateRequestOptions<PFs>
  ): Promise<{ proofRecord: ProofExchangeRecord; message: DIDCommV1Message }>

  abstract createRequestAsResponse(
    agentContext: AgentContext,
    options: CreateRequestAsResponseOptions<PFs>
  ): Promise<{ proofRecord: ProofExchangeRecord; message: DIDCommV1Message }>

  abstract processRequest(messageContext: InboundMessageContext<DIDCommV1Message>): Promise<ProofExchangeRecord>

  abstract createPresentation(
    agentContext: AgentContext,
    options: CreatePresentationOptions<PFs>
  ): Promise<{ proofRecord: ProofExchangeRecord; message: DIDCommV1Message }>

  abstract processPresentation(messageContext: InboundMessageContext<DIDCommV1Message>): Promise<ProofExchangeRecord>

  abstract createAck(
    agentContext: AgentContext,
    options: CreateAckOptions
  ): Promise<{ proofRecord: ProofExchangeRecord; message: DIDCommV1Message }>

  abstract processAck(messageContext: InboundMessageContext<DIDCommV1Message>): Promise<ProofExchangeRecord>

  abstract createProblemReport(
    agentContext: AgentContext,
    options: CreateProblemReportOptions
  ): Promise<{ proofRecord: ProofExchangeRecord; message: DIDCommV1Message }>

  abstract processProblemReport(messageContext: InboundMessageContext<DIDCommV1Message>): Promise<ProofExchangeRecord>

  public abstract shouldAutoRespondToProposal(
    agentContext: AgentContext,
    proofRecord: ProofExchangeRecord
  ): Promise<boolean>

  public abstract shouldAutoRespondToRequest(
    agentContext: AgentContext,
    proofRecord: ProofExchangeRecord
  ): Promise<boolean>

  public abstract shouldAutoRespondToPresentation(
    agentContext: AgentContext,
    proofRecord: ProofExchangeRecord
  ): Promise<boolean>

  public abstract registerHandlers(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    proofResponseCoordinator: ProofResponseCoordinator,
    mediationRecipientService: MediationRecipientService,
    routingService: RoutingService
  ): void

  public abstract findProposalMessage(
    agentContext: AgentContext,
    proofRecordId: string
  ): Promise<DIDCommV1Message | null>
  public abstract findRequestMessage(
    agentContext: AgentContext,
    proofRecordId: string
  ): Promise<DIDCommV1Message | null>
  public abstract findPresentationMessage(
    agentContext: AgentContext,
    proofRecordId: string
  ): Promise<DIDCommV1Message | null>

  public async saveOrUpdatePresentationMessage(
    agentContext: AgentContext,
    options: {
      proofRecord: ProofExchangeRecord
      message: DIDCommV1Message
      role: DidCommMessageRole
    }
  ): Promise<void> {
    await this.didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      associatedRecordId: options.proofRecord.id,
      agentMessage: options.message,
      role: options.role,
    })
  }

  public async delete(
    agentContext: AgentContext,
    proofRecord: ProofExchangeRecord,
    options?: DeleteProofOptions
  ): Promise<void> {
    await this.proofRepository.delete(agentContext, proofRecord)

    const deleteAssociatedDidCommMessages = options?.deleteAssociatedDidCommMessages ?? true

    if (deleteAssociatedDidCommMessages) {
      const didCommMessages = await this.didCommMessageRepository.findByQuery(agentContext, {
        associatedRecordId: proofRecord.id,
      })
      for (const didCommMessage of didCommMessages) {
        await this.didCommMessageRepository.delete(agentContext, didCommMessage)
      }
    }
  }

  public abstract getRequestedCredentialsForProofRequest(
    agentContext: AgentContext,
    options: GetRequestedCredentialsForProofRequestOptions
  ): Promise<FormatRetrievedCredentialOptions<PFs>>

  public abstract autoSelectCredentialsForProofRequest(
    options: FormatRetrievedCredentialOptions<PFs>
  ): Promise<FormatRequestedCredentialReturn<PFs>>

  public abstract createProofRequestFromProposal(
    agentContext: AgentContext,
    options: CreateProofRequestFromProposalOptions
  ): Promise<ProofRequestFromProposalOptions<PFs>>

  public abstract getFormatData(agentContext: AgentContext, proofRecordId: string): Promise<GetFormatDataReturn<PFs>>
}
