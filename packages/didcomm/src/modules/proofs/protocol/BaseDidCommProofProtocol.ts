import type { AgentContext, Query, QueryOptions } from '@credo-ts/core'
import type { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import type { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommMessageHandlerRegistry } from '../../../DidCommMessageHandlerRegistry'
import type { ProblemReportMessage } from '../../../messages'
import type { InboundDidCommMessageContext } from '../../../models'
import type { DidCommProofStateChangedEvent } from '../DidCommProofEvents'
import type { ExtractProofFormats, ProofFormatService } from '../formats'
import type { DidCommProofRole } from '../models'
import type { DidCommProofExchangeRecord } from '../repository'
import type { DidCommProofProtocol } from './DidCommProofProtocol'
import type {
  AcceptPresentationOptions,
  AcceptProofProposalOptions,
  AcceptProofRequestOptions,
  CreateProofProblemReportOptions,
  CreateProofProposalOptions,
  CreateProofRequestOptions,
  DeleteProofOptions,
  GetCredentialsForRequestOptions,
  GetCredentialsForRequestReturn,
  GetProofFormatDataReturn,
  NegotiateProofProposalOptions,
  NegotiateProofRequestOptions,
  ProofProtocolMsgReturnType,
  SelectCredentialsForRequestOptions,
  SelectCredentialsForRequestReturn,
} from './DidCommProofProtocolOptions'

import { EventEmitter } from '@credo-ts/core'

import { DidCommMessageRepository } from '../../../repository'
import { DidCommConnectionService } from '../../connections'
import { DidCommProofEventTypes } from '../DidCommProofEvents'
import { DidCommProofState } from '../models/DidCommProofState'
import { DidCommProofExchangeRepository } from '../repository'

export abstract class BaseDidCommProofProtocol<PFs extends ProofFormatService[] = ProofFormatService[]>
  implements DidCommProofProtocol<PFs>
{
  public abstract readonly version: string

  public abstract register(
    messageHandlerRegistry: DidCommMessageHandlerRegistry,
    featureRegistry: DidCommFeatureRegistry
  ): void

  // methods for proposal
  public abstract createProposal(
    agentContext: AgentContext,
    options: CreateProofProposalOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<DidCommMessage>>
  public abstract processProposal(
    messageContext: InboundDidCommMessageContext<DidCommMessage>
  ): Promise<DidCommProofExchangeRecord>
  public abstract acceptProposal(
    agentContext: AgentContext,
    options: AcceptProofProposalOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<DidCommMessage>>
  public abstract negotiateProposal(
    agentContext: AgentContext,
    options: NegotiateProofProposalOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<DidCommMessage>>

  // methods for request
  public abstract createRequest(
    agentContext: AgentContext,
    options: CreateProofRequestOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<DidCommMessage>>
  public abstract processRequest(
    messageContext: InboundDidCommMessageContext<DidCommMessage>
  ): Promise<DidCommProofExchangeRecord>
  public abstract acceptRequest(
    agentContext: AgentContext,
    options: AcceptProofRequestOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<DidCommMessage>>
  public abstract negotiateRequest(
    agentContext: AgentContext,
    options: NegotiateProofRequestOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<DidCommMessage>>

  // retrieving credentials for request
  public abstract getCredentialsForRequest(
    agentContext: AgentContext,
    options: GetCredentialsForRequestOptions<PFs>
  ): Promise<GetCredentialsForRequestReturn<PFs>>
  public abstract selectCredentialsForRequest(
    agentContext: AgentContext,
    options: SelectCredentialsForRequestOptions<PFs>
  ): Promise<SelectCredentialsForRequestReturn<PFs>>

  // methods for presentation
  public abstract processPresentation(
    messageContext: InboundDidCommMessageContext<DidCommMessage>
  ): Promise<DidCommProofExchangeRecord>
  public abstract acceptPresentation(
    agentContext: AgentContext,
    options: AcceptPresentationOptions
  ): Promise<ProofProtocolMsgReturnType<DidCommMessage>>

  // methods for ack
  public abstract processAck(
    messageContext: InboundDidCommMessageContext<DidCommMessage>
  ): Promise<DidCommProofExchangeRecord>
  // method for problem report
  public abstract createProblemReport(
    agentContext: AgentContext,
    options: CreateProofProblemReportOptions
  ): Promise<ProofProtocolMsgReturnType<ProblemReportMessage>>

  public abstract findProposalMessage(
    agentContext: AgentContext,
    proofExchangeId: string
  ): Promise<DidCommMessage | null>
  public abstract findRequestMessage(
    agentContext: AgentContext,
    proofExchangeId: string
  ): Promise<DidCommMessage | null>
  public abstract findPresentationMessage(
    agentContext: AgentContext,
    proofExchangeId: string
  ): Promise<DidCommMessage | null>
  public abstract getFormatData(
    agentContext: AgentContext,
    proofExchangeId: string
  ): Promise<GetProofFormatDataReturn<ExtractProofFormats<PFs>>>

  public async processProblemReport(
    messageContext: InboundDidCommMessageContext<ProblemReportMessage>
  ): Promise<DidCommProofExchangeRecord> {
    const { message: proofProblemReportMessage, agentContext, connection } = messageContext

    const connectionService = agentContext.dependencyManager.resolve(DidCommConnectionService)

    agentContext.config.logger.debug(`Processing problem report with message id ${proofProblemReportMessage.id}`)

    const proofRecord = await this.getByProperties(agentContext, {
      threadId: proofProblemReportMessage.threadId,
    })

    // Assert
    await connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
      expectedConnectionId: proofRecord.connectionId,
    })

    //  This makes sure that the sender of the incoming message is authorized to do so.
    if (!proofRecord?.connectionId) {
      await connectionService.matchIncomingMessageToRequestMessageInOutOfBandExchange(messageContext, {
        expectedConnectionId: proofRecord?.connectionId,
      })

      proofRecord.connectionId = connection?.id
    }

    // Update record
    proofRecord.errorMessage = `${proofProblemReportMessage.description.code}: ${proofProblemReportMessage.description.en}`
    await this.updateState(agentContext, proofRecord, DidCommProofState.Abandoned)
    return proofRecord
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param proofRecord The proof record to update the state for
   * @param newState The state to update to
   *
   */
  public async updateState(
    agentContext: AgentContext,
    proofRecord: DidCommProofExchangeRecord,
    newState: DidCommProofState
  ) {
    const proofRepository = agentContext.dependencyManager.resolve(DidCommProofExchangeRepository)

    agentContext.config.logger.debug(
      `Updating proof record ${proofRecord.id} to state ${newState} (previous=${proofRecord.state})`
    )

    const previousState = proofRecord.state
    proofRecord.state = newState
    await proofRepository.update(agentContext, proofRecord)

    this.emitStateChangedEvent(agentContext, proofRecord, previousState)
  }

  protected emitStateChangedEvent(
    agentContext: AgentContext,
    proofRecord: DidCommProofExchangeRecord,
    previousState: DidCommProofState | null
  ) {
    const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)

    eventEmitter.emit<DidCommProofStateChangedEvent>(agentContext, {
      type: DidCommProofEventTypes.ProofStateChanged,
      payload: {
        proofRecord: proofRecord.clone(),
        previousState: previousState,
      },
    })
  }

  /**
   * Retrieve a proof record by id
   *
   * @param proofRecordId The proof record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The proof record
   *
   */
  public getById(agentContext: AgentContext, proofRecordId: string): Promise<DidCommProofExchangeRecord> {
    const proofRepository = agentContext.dependencyManager.resolve(DidCommProofExchangeRepository)

    return proofRepository.getById(agentContext, proofRecordId)
  }

  /**
   * Retrieve all proof records
   *
   * @returns List containing all proof records
   */
  public getAll(agentContext: AgentContext): Promise<DidCommProofExchangeRecord[]> {
    const proofRepository = agentContext.dependencyManager.resolve(DidCommProofExchangeRepository)

    return proofRepository.getAll(agentContext)
  }

  public async findAllByQuery(
    agentContext: AgentContext,
    query: Query<DidCommProofExchangeRecord>,
    queryOptions?: QueryOptions
  ): Promise<DidCommProofExchangeRecord[]> {
    const proofRepository = agentContext.dependencyManager.resolve(DidCommProofExchangeRepository)

    return proofRepository.findByQuery(agentContext, query, queryOptions)
  }

  /**
   * Find a proof record by id
   *
   * @param proofRecordId the proof record id
   * @returns The proof record or null if not found
   */
  public findById(agentContext: AgentContext, proofRecordId: string): Promise<DidCommProofExchangeRecord | null> {
    const proofRepository = agentContext.dependencyManager.resolve(DidCommProofExchangeRepository)

    return proofRepository.findById(agentContext, proofRecordId)
  }

  public async delete(
    agentContext: AgentContext,
    proofRecord: DidCommProofExchangeRecord,
    options?: DeleteProofOptions
  ): Promise<void> {
    const proofRepository = agentContext.dependencyManager.resolve(DidCommProofExchangeRepository)
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    await proofRepository.delete(agentContext, proofRecord)

    const deleteAssociatedDidCommMessages = options?.deleteAssociatedDidCommMessages ?? true

    if (deleteAssociatedDidCommMessages) {
      const didCommMessages = await didCommMessageRepository.findByQuery(agentContext, {
        associatedRecordId: proofRecord.id,
      })
      for (const didCommMessage of didCommMessages) {
        await didCommMessageRepository.delete(agentContext, didCommMessage)
      }
    }
  }

  /**
   * Retrieve a proof record by connection id and thread id
   *
   * @param properties Properties to query by
   *
   * @throws {RecordNotFoundError} If no record is found
   * @throws {RecordDuplicateError} If multiple records are found
   *
   * @returns The proof record
   */
  public getByProperties(
    agentContext: AgentContext,
    properties: {
      threadId: string
      role?: DidCommProofRole
      connectionId?: string
    }
  ): Promise<DidCommProofExchangeRecord> {
    const { threadId, connectionId, role } = properties
    const proofRepository = agentContext.dependencyManager.resolve(DidCommProofExchangeRepository)

    return proofRepository.getSingleByQuery(agentContext, {
      connectionId,
      threadId,
      role,
    })
  }

  /**
   * Find a proof record by connection id and thread id, returns null if not found
   *
   * @param properties Properties to query by
   *
   * @returns The proof record
   */
  public findByProperties(
    agentContext: AgentContext,
    properties: {
      threadId: string
      role?: DidCommProofRole
      connectionId?: string
    }
  ): Promise<DidCommProofExchangeRecord | null> {
    const { role, connectionId, threadId } = properties
    const proofRepository = agentContext.dependencyManager.resolve(DidCommProofExchangeRepository)

    return proofRepository.findSingleByQuery(agentContext, {
      connectionId,
      threadId,
      role,
    })
  }

  public async update(agentContext: AgentContext, proofRecord: DidCommProofExchangeRecord) {
    const proofRepository = agentContext.dependencyManager.resolve(DidCommProofExchangeRepository)

    return await proofRepository.update(agentContext, proofRecord)
  }
}
