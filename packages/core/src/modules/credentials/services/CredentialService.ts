import type { AgentConfig } from '../../../agent/AgentConfig'
import type { AgentMessage } from '../../../agent/AgentMessage'
import type { Dispatcher } from '../../../agent/Dispatcher'
import type { EventEmitter } from '../../../agent/EventEmitter'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../logger'
import type { DidCommMessageRepository } from '../../../storage'
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
} from '../CredentialServiceOptions'
import type { CredentialFormat, CredentialFormatService } from '../formats'
import type { CredentialProtocolVersion } from '../models/CredentialProtocolVersion'
import type { CredentialExchangeRecord, CredentialRepository } from './../repository'

import { JsonTransformer } from '../../../utils'
import { CredentialState } from '../models/CredentialState'

import { CredentialEventTypes } from './../CredentialEvents'

export abstract class CredentialService<CFs extends CredentialFormat[] = CredentialFormat[]> {
  protected credentialRepository: CredentialRepository
  protected didCommMessageRepository: DidCommMessageRepository
  protected eventEmitter: EventEmitter
  protected dispatcher: Dispatcher
  protected agentConfig: AgentConfig
  protected logger: Logger

  public constructor(
    credentialRepository: CredentialRepository,
    didCommMessageRepository: DidCommMessageRepository,
    eventEmitter: EventEmitter,
    dispatcher: Dispatcher,
    agentConfig: AgentConfig
  ) {
    this.credentialRepository = credentialRepository
    this.didCommMessageRepository = didCommMessageRepository
    this.eventEmitter = eventEmitter
    this.dispatcher = dispatcher
    this.agentConfig = agentConfig
    this.logger = this.agentConfig.logger
  }

  abstract readonly version: CredentialProtocolVersion

  abstract getFormatServiceForRecordType(
    credentialRecordType: CFs[number]['credentialRecordType']
  ): CredentialFormatService<CFs[number]>

  // methods for proposal
  abstract createProposal(options: CreateProposalOptions<CFs>): Promise<CredentialProtocolMsgReturnType<AgentMessage>>
  abstract processProposal(messageContext: InboundMessageContext<AgentMessage>): Promise<CredentialExchangeRecord>
  abstract acceptProposal(options: AcceptProposalOptions<CFs>): Promise<CredentialProtocolMsgReturnType<AgentMessage>>
  abstract negotiateProposal(
    options: NegotiateProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>

  // methods for offer
  abstract createOffer(options: CreateOfferOptions<CFs>): Promise<CredentialProtocolMsgReturnType<AgentMessage>>
  abstract processOffer(messageContext: InboundMessageContext<AgentMessage>): Promise<CredentialExchangeRecord>
  abstract acceptOffer(options: AcceptOfferOptions<CFs>): Promise<CredentialProtocolMsgReturnType<AgentMessage>>
  abstract negotiateOffer(options: NegotiateOfferOptions<CFs>): Promise<CredentialProtocolMsgReturnType<AgentMessage>>

  // methods for request
  abstract createRequest(options: CreateRequestOptions<CFs>): Promise<CredentialProtocolMsgReturnType<AgentMessage>>
  abstract processRequest(messageContext: InboundMessageContext<AgentMessage>): Promise<CredentialExchangeRecord>
  abstract acceptRequest(options: AcceptRequestOptions<CFs>): Promise<CredentialProtocolMsgReturnType<AgentMessage>>

  // methods for issue
  abstract processCredential(messageContext: InboundMessageContext<AgentMessage>): Promise<CredentialExchangeRecord>
  abstract acceptCredential(options: AcceptCredentialOptions): Promise<CredentialProtocolMsgReturnType<AgentMessage>>

  // methods for ack
  abstract processAck(messageContext: InboundMessageContext<AgentMessage>): Promise<CredentialExchangeRecord>

  abstract findProposalMessage(credentialExchangeId: string): Promise<AgentMessage | null>
  abstract findOfferMessage(credentialExchangeId: string): Promise<AgentMessage | null>
  abstract findRequestMessage(credentialExchangeId: string): Promise<AgentMessage | null>
  abstract findCredentialMessage(credentialExchangeId: string): Promise<AgentMessage | null>

  /**
   * Decline a credential offer
   * @param credentialRecord The credential to be declined
   */
  public async declineOffer(credentialRecord: CredentialExchangeRecord): Promise<CredentialExchangeRecord> {
    credentialRecord.assertState(CredentialState.OfferReceived)

    await this.updateState(credentialRecord, CredentialState.Declined)

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
    const { message: credentialProblemReportMessage } = messageContext

    const connection = messageContext.assertReadyConnection()

    this.logger.debug(`Processing problem report with id ${credentialProblemReportMessage.id}`)

    const credentialRecord = await this.getByThreadAndConnectionId(
      credentialProblemReportMessage.threadId,
      connection.id
    )

    // Update record
    credentialRecord.errorMessage = `${credentialProblemReportMessage.description.code}: ${credentialProblemReportMessage.description.en}`
    await this.update(credentialRecord)
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
  public async updateState(credentialRecord: CredentialExchangeRecord, newState: CredentialState) {
    this.logger.debug(
      `Updating credential record ${credentialRecord.id} to state ${newState} (previous=${credentialRecord.state})`
    )

    const previousState = credentialRecord.state
    credentialRecord.state = newState
    await this.credentialRepository.update(credentialRecord)

    this.emitStateChangedEvent(credentialRecord, previousState)
  }

  protected emitStateChangedEvent(credentialRecord: CredentialExchangeRecord, previousState: CredentialState | null) {
    const clonedCredential = JsonTransformer.clone(credentialRecord)

    this.eventEmitter.emit<CredentialStateChangedEvent>({
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
  public getById(credentialRecordId: string): Promise<CredentialExchangeRecord> {
    return this.credentialRepository.getById(credentialRecordId)
  }

  /**
   * Retrieve all credential records
   *
   * @returns List containing all credential records
   */
  public getAll(): Promise<CredentialExchangeRecord[]> {
    return this.credentialRepository.getAll()
  }

  /**
   * Find a credential record by id
   *
   * @param credentialRecordId the credential record id
   * @returns The credential record or null if not found
   */
  public findById(connectionId: string): Promise<CredentialExchangeRecord | null> {
    return this.credentialRepository.findById(connectionId)
  }

  public async delete(credentialRecord: CredentialExchangeRecord, options?: DeleteCredentialOptions): Promise<void> {
    await this.credentialRepository.delete(credentialRecord)

    const deleteAssociatedCredentials = options?.deleteAssociatedCredentials ?? true
    const deleteAssociatedDidCommMessages = options?.deleteAssociatedDidCommMessages ?? true

    if (deleteAssociatedCredentials) {
      for (const credential of credentialRecord.credentials) {
        const formatService = this.getFormatServiceForRecordType(credential.credentialRecordType)
        await formatService.deleteCredentialById(credential.credentialRecordId)
      }
    }

    if (deleteAssociatedDidCommMessages) {
      const didCommMessages = await this.didCommMessageRepository.findByQuery({
        associatedRecordId: credentialRecord.id,
      })
      for (const didCommMessage of didCommMessages) {
        await this.didCommMessageRepository.delete(didCommMessage)
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
  public getByThreadAndConnectionId(threadId: string, connectionId?: string): Promise<CredentialExchangeRecord> {
    return this.credentialRepository.getSingleByQuery({
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
    threadId: string,
    connectionId?: string
  ): Promise<CredentialExchangeRecord | null> {
    return this.credentialRepository.findSingleByQuery({
      connectionId,
      threadId,
    })
  }

  public async update(credentialRecord: CredentialExchangeRecord) {
    return await this.credentialRepository.update(credentialRecord)
  }
}
