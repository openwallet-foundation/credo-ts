import type { AgentContext } from '../../../agent'
import type { AgentMessage } from '../../../agent/AgentMessage'
import type { FeatureRegistry } from '../../../agent/FeatureRegistry'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { DependencyManager } from '../../../plugins'
import type { Query } from '../../../storage/StorageService'
import type { ProblemReportMessage } from '../../problem-reports'
import type { CredentialStateChangedEvent } from '../CredentialEvents'
import type {
  CreateProposalOptions,
  CredentialProtocolMsgReturnType,
  DeleteCredentialOptions,
  AcceptProposalOptions,
  NegotiateProposalOptions,
  CreateOfferOptions,
  NegotiateOfferOptions,
  CreateRequestOptions,
  AcceptOfferOptions,
  AcceptRequestOptions,
  AcceptCredentialOptions,
  GetFormatDataReturn,
  CreateProblemReportOptions,
} from '../CredentialProtocolOptions'
import type { CredentialFormatService, ExtractCredentialFormats } from '../formats'
import type { CredentialExchangeRecord } from '../repository'
import type { CredentialProtocol } from './CredentialProtocol'

import { EventEmitter } from '../../../agent/EventEmitter'
import { DidCommMessageRepository } from '../../../storage'
import { JsonTransformer } from '../../../utils'
import { CredentialEventTypes } from '../CredentialEvents'
import { CredentialState } from '../models/CredentialState'
import { CredentialRepository } from '../repository'

/**
 * Base implementation of the CredentialProtocol that can be used as a foundation for implementing
 * the CredentialProtocol interface.
 */
export abstract class BaseCredentialProtocol<CFs extends CredentialFormatService[] = CredentialFormatService[]>
  implements CredentialProtocol<CFs>
{
  abstract readonly version: string

  protected abstract getFormatServiceForRecordType(credentialRecordType: string): CFs[number]

  // methods for proposal
  abstract createProposal(
    agentContext: AgentContext,
    options: CreateProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>
  abstract processProposal(messageContext: InboundMessageContext<AgentMessage>): Promise<CredentialExchangeRecord>
  abstract acceptProposal(
    agentContext: AgentContext,
    options: AcceptProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>
  abstract negotiateProposal(
    agentContext: AgentContext,
    options: NegotiateProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>

  // methods for offer
  abstract createOffer(
    agentContext: AgentContext,
    options: CreateOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>
  abstract processOffer(messageContext: InboundMessageContext<AgentMessage>): Promise<CredentialExchangeRecord>
  abstract acceptOffer(
    agentContext: AgentContext,
    options: AcceptOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>
  abstract negotiateOffer(
    agentContext: AgentContext,
    options: NegotiateOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>

  // methods for request
  abstract createRequest(
    agentContext: AgentContext,
    options: CreateRequestOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>
  abstract processRequest(messageContext: InboundMessageContext<AgentMessage>): Promise<CredentialExchangeRecord>
  abstract acceptRequest(
    agentContext: AgentContext,
    options: AcceptRequestOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>

  // methods for issue
  abstract processCredential(messageContext: InboundMessageContext<AgentMessage>): Promise<CredentialExchangeRecord>
  abstract acceptCredential(
    agentContext: AgentContext,
    options: AcceptCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>

  // methods for ack
  abstract processAck(messageContext: InboundMessageContext<AgentMessage>): Promise<CredentialExchangeRecord>

  // methods for problem-report
  abstract createProblemReport(agentContext: AgentContext, options: CreateProblemReportOptions): ProblemReportMessage

  abstract findProposalMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<AgentMessage | null>
  abstract findOfferMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<AgentMessage | null>
  abstract findRequestMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<AgentMessage | null>
  abstract findCredentialMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<AgentMessage | null>
  abstract getFormatData(
    agentContext: AgentContext,
    credentialExchangeId: string
  ): Promise<GetFormatDataReturn<ExtractCredentialFormats<CFs>>>

  abstract register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry): void

  /**
   * Decline a credential offer
   * @param credentialRecord The credential to be declined
   */
  public async declineOffer(
    agentContext: AgentContext,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialExchangeRecord> {
    credentialRecord.assertState(CredentialState.OfferReceived)

    await this.updateState(agentContext, credentialRecord, CredentialState.Declined)

    return credentialRecord
  }

  /**
   * Process a received credential {@link ProblemReportMessage}.
   *
   * @param messageContext The message context containing a credential problem report message
   * @returns credential record associated with the credential problem report message
   */
  public async processProblemReport(
    messageContext: InboundMessageContext<ProblemReportMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: credentialProblemReportMessage, agentContext } = messageContext

    const connection = messageContext.assertReadyConnection()

    agentContext.config.logger.debug(`Processing problem report with id ${credentialProblemReportMessage.id}`)

    const credentialRecord = await this.getByThreadAndConnectionId(
      messageContext.agentContext,
      credentialProblemReportMessage.threadId,
      connection.id
    )

    // Update record
    credentialRecord.errorMessage = `${credentialProblemReportMessage.description.code}: ${credentialProblemReportMessage.description.en}`
    await this.update(messageContext.agentContext, credentialRecord)
    return credentialRecord
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param credentialRecord The credential record to update the state for
   * @param newState The state to update to
   *
   */
  public async updateState(
    agentContext: AgentContext,
    credentialRecord: CredentialExchangeRecord,
    newState: CredentialState
  ) {
    const credentialRepository = agentContext.dependencyManager.resolve(CredentialRepository)

    agentContext.config.logger.debug(
      `Updating credential record ${credentialRecord.id} to state ${newState} (previous=${credentialRecord.state})`
    )

    const previousState = credentialRecord.state
    credentialRecord.state = newState
    await credentialRepository.update(agentContext, credentialRecord)

    this.emitStateChangedEvent(agentContext, credentialRecord, previousState)
  }

  protected emitStateChangedEvent(
    agentContext: AgentContext,
    credentialRecord: CredentialExchangeRecord,
    previousState: CredentialState | null
  ) {
    const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)

    const clonedCredential = JsonTransformer.clone(credentialRecord)

    eventEmitter.emit<CredentialStateChangedEvent>(agentContext, {
      type: CredentialEventTypes.CredentialStateChanged,
      payload: {
        credentialRecord: clonedCredential,
        previousState: previousState,
      },
    })
  }

  /**
   * Retrieve a credential record by id
   *
   * @param credentialRecordId The credential record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The credential record
   *
   */
  public getById(agentContext: AgentContext, credentialRecordId: string): Promise<CredentialExchangeRecord> {
    const credentialRepository = agentContext.dependencyManager.resolve(CredentialRepository)

    return credentialRepository.getById(agentContext, credentialRecordId)
  }

  /**
   * Retrieve all credential records
   *
   * @returns List containing all credential records
   */
  public getAll(agentContext: AgentContext): Promise<CredentialExchangeRecord[]> {
    const credentialRepository = agentContext.dependencyManager.resolve(CredentialRepository)

    return credentialRepository.getAll(agentContext)
  }

  public async findAllByQuery(
    agentContext: AgentContext,
    query: Query<CredentialExchangeRecord>
  ): Promise<CredentialExchangeRecord[]> {
    const credentialRepository = agentContext.dependencyManager.resolve(CredentialRepository)

    return credentialRepository.findByQuery(agentContext, query)
  }

  /**
   * Find a credential record by id
   *
   * @param credentialRecordId the credential record id
   * @returns The credential record or null if not found
   */
  public findById(agentContext: AgentContext, connectionId: string): Promise<CredentialExchangeRecord | null> {
    const credentialRepository = agentContext.dependencyManager.resolve(CredentialRepository)

    return credentialRepository.findById(agentContext, connectionId)
  }

  public async delete(
    agentContext: AgentContext,
    credentialRecord: CredentialExchangeRecord,
    options?: DeleteCredentialOptions
  ): Promise<void> {
    const credentialRepository = agentContext.dependencyManager.resolve(CredentialRepository)
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    await credentialRepository.delete(agentContext, credentialRecord)

    const deleteAssociatedCredentials = options?.deleteAssociatedCredentials ?? true
    const deleteAssociatedDidCommMessages = options?.deleteAssociatedDidCommMessages ?? true

    if (deleteAssociatedCredentials) {
      for (const credential of credentialRecord.credentials) {
        const formatService = this.getFormatServiceForRecordType(credential.credentialRecordType)
        await formatService.deleteCredentialById(agentContext, credential.credentialRecordId)
      }
    }

    if (deleteAssociatedDidCommMessages) {
      const didCommMessages = await didCommMessageRepository.findByQuery(agentContext, {
        associatedRecordId: credentialRecord.id,
      })
      for (const didCommMessage of didCommMessages) {
        await didCommMessageRepository.delete(agentContext, didCommMessage)
      }
    }
  }

  /**
   * Retrieve a credential record by connection id and thread id
   *
   * @param connectionId The connection id
   * @param threadId The thread id
   * @throws {RecordNotFoundError} If no record is found
   * @throws {RecordDuplicateError} If multiple records are found
   * @returns The credential record
   */
  public getByThreadAndConnectionId(
    agentContext: AgentContext,
    threadId: string,
    connectionId?: string
  ): Promise<CredentialExchangeRecord> {
    const credentialRepository = agentContext.dependencyManager.resolve(CredentialRepository)

    return credentialRepository.getSingleByQuery(agentContext, {
      connectionId,
      threadId,
    })
  }

  /**
   * Find a credential record by connection id and thread id, returns null if not found
   *
   * @param connectionId The connection id
   * @param threadId The thread id
   * @returns The credential record
   */
  public findByThreadAndConnectionId(
    agentContext: AgentContext,
    threadId: string,
    connectionId?: string
  ): Promise<CredentialExchangeRecord | null> {
    const credentialRepository = agentContext.dependencyManager.resolve(CredentialRepository)

    return credentialRepository.findSingleByQuery(agentContext, {
      connectionId,
      threadId,
    })
  }

  public async update(agentContext: AgentContext, credentialRecord: CredentialExchangeRecord) {
    const credentialRepository = agentContext.dependencyManager.resolve(CredentialRepository)

    return await credentialRepository.update(agentContext, credentialRecord)
  }
}
