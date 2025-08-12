import type { AgentContext, Query, QueryOptions } from '@credo-ts/core'
import type { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import type { DidCommMessageHandlerRegistry } from '../../../DidCommMessageHandlerRegistry'
import type { ProblemReportMessage } from '../../../messages'
import type { InboundDidCommMessageContext } from '../../../models'
import type { DidCommCredentialStateChangedEvent } from '../DidCommCredentialEvents'
import type { CredentialFormatService, ExtractCredentialFormats } from '../formats'
import type { DidCommCredentialRole } from '../models'
import type { DidCommCredentialExchangeRecord } from '../repository'
import type { DidCommCredentialProtocol } from './DidCommCredentialProtocol'
import type {
  AcceptCredentialOfferOptions,
  AcceptCredentialOptions,
  AcceptCredentialProposalOptions,
  AcceptCredentialRequestOptions,
  CreateCredentialOfferOptions,
  CreateCredentialProblemReportOptions,
  CreateCredentialProposalOptions,
  CreateCredentialRequestOptions,
  CredentialProtocolMsgReturnType,
  DeleteCredentialOptions,
  GetCredentialFormatDataReturn,
  NegotiateCredentialOfferOptions,
  NegotiateCredentialProposalOptions,
} from './DidCommCredentialProtocolOptions'

import { EventEmitter } from '@credo-ts/core'

import { DidCommMessageRepository } from '../../../repository'
import { DidCommConnectionService } from '../../connections'
import { DidCommCredentialEventTypes } from '../DidCommCredentialEvents'
import { DidCommCredentialState } from '../models/DidCommCredentialState'
import { DidCommCredentialExchangeRepository } from '../repository'

/**
 * Base implementation of the DidCommCredentialProtocol that can be used as a foundation for implementing
 * the DidCommCredentialProtocol interface.
 */
export abstract class BaseDidCommCredentialProtocol<CFs extends CredentialFormatService[] = CredentialFormatService[]>
  implements DidCommCredentialProtocol<CFs>
{
  public abstract readonly version: string

  protected abstract getFormatServiceForRecordType(credentialRecordType: string): CFs[number]

  // methods for proposal
  public abstract createProposal(
    agentContext: AgentContext,
    options: CreateCredentialProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>
  public abstract processProposal(
    messageContext: InboundDidCommMessageContext<DidCommMessage>
  ): Promise<DidCommCredentialExchangeRecord>
  public abstract acceptProposal(
    agentContext: AgentContext,
    options: AcceptCredentialProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>
  public abstract negotiateProposal(
    agentContext: AgentContext,
    options: NegotiateCredentialProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>

  // methods for offer
  public abstract createOffer(
    agentContext: AgentContext,
    options: CreateCredentialOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>
  public abstract processOffer(messageContext: InboundDidCommMessageContext<DidCommMessage>): Promise<DidCommCredentialExchangeRecord>
  public abstract acceptOffer(
    agentContext: AgentContext,
    options: AcceptCredentialOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>
  public abstract negotiateOffer(
    agentContext: AgentContext,
    options: NegotiateCredentialOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>

  // methods for request
  public abstract createRequest(
    agentContext: AgentContext,
    options: CreateCredentialRequestOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>
  public abstract processRequest(messageContext: InboundDidCommMessageContext<DidCommMessage>): Promise<DidCommCredentialExchangeRecord>
  public abstract acceptRequest(
    agentContext: AgentContext,
    options: AcceptCredentialRequestOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>

  // methods for issue
  public abstract processCredential(
    messageContext: InboundDidCommMessageContext<DidCommMessage>
  ): Promise<DidCommCredentialExchangeRecord>
  public abstract acceptCredential(
    agentContext: AgentContext,
    options: AcceptCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>

  // methods for ack
  public abstract processAck(messageContext: InboundDidCommMessageContext<DidCommMessage>): Promise<DidCommCredentialExchangeRecord>

  // methods for problem-report
  public abstract createProblemReport(
    agentContext: AgentContext,
    options: CreateCredentialProblemReportOptions
  ): Promise<CredentialProtocolMsgReturnType<ProblemReportMessage>>

  public abstract findProposalMessage(
    agentContext: AgentContext,
    credentialExchangeId: string
  ): Promise<DidCommMessage | null>
  public abstract findOfferMessage(
    agentContext: AgentContext,
    credentialExchangeId: string
  ): Promise<DidCommMessage | null>
  public abstract findRequestMessage(
    agentContext: AgentContext,
    credentialExchangeId: string
  ): Promise<DidCommMessage | null>
  public abstract findCredentialMessage(
    agentContext: AgentContext,
    credentialExchangeId: string
  ): Promise<DidCommMessage | null>
  public abstract getFormatData(
    agentContext: AgentContext,
    credentialExchangeId: string
  ): Promise<GetCredentialFormatDataReturn<ExtractCredentialFormats<CFs>>>

  public abstract register(messageHandlerRegistry: DidCommMessageHandlerRegistry, featureRegistry: DidCommFeatureRegistry): void

  /**
   * Process a received credential {@link ProblemReportMessage}.
   *
   * @param messageContext The message context containing a credential problem report message
   * @returns credential record associated with the credential problem report message
   */
  public async processProblemReport(
    messageContext: InboundDidCommMessageContext<ProblemReportMessage>
  ): Promise<DidCommCredentialExchangeRecord> {
    const { message: credentialProblemReportMessage, agentContext, connection } = messageContext

    const connectionService = agentContext.dependencyManager.resolve(DidCommConnectionService)

    agentContext.config.logger.debug(`Processing problem report with message id ${credentialProblemReportMessage.id}`)

    const credentialRecord = await this.getByProperties(agentContext, {
      threadId: credentialProblemReportMessage.threadId,
    })

    // Assert
    await connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
      expectedConnectionId: credentialRecord.connectionId,
    })

    //  This makes sure that the sender of the incoming message is authorized to do so.
    if (!credentialRecord?.connectionId) {
      await connectionService.matchIncomingMessageToRequestMessageInOutOfBandExchange(messageContext, {
        expectedConnectionId: credentialRecord?.connectionId,
      })

      credentialRecord.connectionId = connection?.id
    }

    // Update record
    credentialRecord.errorMessage = `${credentialProblemReportMessage.description.code}: ${credentialProblemReportMessage.description.en}`
    await this.updateState(agentContext, credentialRecord, DidCommCredentialState.Abandoned)
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
    credentialRecord: DidCommCredentialExchangeRecord,
    newState: DidCommCredentialState
  ) {
    const credentialRepository = agentContext.dependencyManager.resolve(DidCommCredentialExchangeRepository)

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
    credentialRecord: DidCommCredentialExchangeRecord,
    previousState: DidCommCredentialState | null
  ) {
    const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)

    eventEmitter.emit<DidCommCredentialStateChangedEvent>(agentContext, {
      type: DidCommCredentialEventTypes.DidCommCredentialStateChanged,
      payload: {
        credentialExchangeRecord: credentialRecord.clone(),
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
  public getById(agentContext: AgentContext, credentialRecordId: string): Promise<DidCommCredentialExchangeRecord> {
    const credentialRepository = agentContext.dependencyManager.resolve(DidCommCredentialExchangeRepository)

    return credentialRepository.getById(agentContext, credentialRecordId)
  }

  /**
   * Retrieve all credential records
   *
   * @returns List containing all credential records
   */
  public getAll(agentContext: AgentContext): Promise<DidCommCredentialExchangeRecord[]> {
    const credentialRepository = agentContext.dependencyManager.resolve(DidCommCredentialExchangeRepository)

    return credentialRepository.getAll(agentContext)
  }

  public async findAllByQuery(
    agentContext: AgentContext,
    query: Query<DidCommCredentialExchangeRecord>,
    queryOptions?: QueryOptions
  ): Promise<DidCommCredentialExchangeRecord[]> {
    const credentialRepository = agentContext.dependencyManager.resolve(DidCommCredentialExchangeRepository)

    return credentialRepository.findByQuery(agentContext, query, queryOptions)
  }

  /**
   * Find a credential record by id
   *
   * @param credentialRecordId the credential record id
   * @returns The credential record or null if not found
   */
  public findById(agentContext: AgentContext, proofRecordId: string): Promise<DidCommCredentialExchangeRecord | null> {
    const credentialRepository = agentContext.dependencyManager.resolve(DidCommCredentialExchangeRepository)

    return credentialRepository.findById(agentContext, proofRecordId)
  }

  public async delete(
    agentContext: AgentContext,
    credentialRecord: DidCommCredentialExchangeRecord,
    options?: DeleteCredentialOptions
  ): Promise<void> {
    const credentialRepository = agentContext.dependencyManager.resolve(DidCommCredentialExchangeRepository)
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
   * @param properties Properties to query by
   *
   * @throws {RecordNotFoundError} If no record is found
   * @throws {RecordDuplicateError} If multiple records are found
   * @returns The credential record
   */
  public getByProperties(
    agentContext: AgentContext,
    properties: {
      threadId: string
      role?: DidCommCredentialRole
      connectionId?: string
    }
  ): Promise<DidCommCredentialExchangeRecord> {
    const { role, connectionId, threadId } = properties
    const credentialRepository = agentContext.dependencyManager.resolve(DidCommCredentialExchangeRepository)

    return credentialRepository.getSingleByQuery(agentContext, {
      connectionId,
      threadId,
      role,
    })
  }

  /**
   * Find a credential record by connection id and thread id, returns null if not found
   *
   * @param threadId The thread id
   * @param role The role of the record, i.e. holder or issuer
   * @param connectionId The connection id
   *
   * @returns The credential record
   */
  public findByProperties(
    agentContext: AgentContext,
    properties: {
      threadId: string
      role?: DidCommCredentialRole
      connectionId?: string
    }
  ): Promise<DidCommCredentialExchangeRecord | null> {
    const { role, connectionId, threadId } = properties
    const credentialRepository = agentContext.dependencyManager.resolve(DidCommCredentialExchangeRepository)

    return credentialRepository.findSingleByQuery(agentContext, {
      connectionId,
      threadId,
      role,
    })
  }

  public async update(agentContext: AgentContext, credentialRecord: DidCommCredentialExchangeRecord) {
    const credentialRepository = agentContext.dependencyManager.resolve(DidCommCredentialExchangeRepository)

    return await credentialRepository.update(agentContext, credentialRecord)
  }
}
