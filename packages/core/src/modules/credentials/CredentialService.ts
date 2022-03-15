import type { AgentConfig } from '../../agent/AgentConfig'
import type { AgentMessage } from '../../agent/AgentMessage'
import type { Dispatcher } from '../../agent/Dispatcher'
import type { EventEmitter } from '../../agent/EventEmitter'
import type { Handler, HandlerInboundMessage } from '../../agent/Handler'
import type { InboundMessageContext } from '../../agent/models/InboundMessageContext'
import type { DidCommMessageRepository } from '../../storage'
import type { MediationRecipientService } from '../routing'
import type { CredentialStateChangedEvent } from './CredentialEvents'
import type { CredentialProtocolVersion } from './CredentialProtocolVersion'
import type { ServiceRequestCredentialOptions } from './CredentialServiceOptions'
import type { CredentialFormatService } from './formats/CredentialFormatService'
import type {
  CredentialIssueFormat,
  CredentialOfferFormat,
  CredentialProposeFormat,
  CredentialRequestFormat,
} from './formats/models/CredentialFormatServiceOptions'
import type {
  AcceptProposalOptions,
  AcceptRequestOptions,
  CredentialFormatType,
  NegotiateOfferOptions,
  NegotiateProposalOptions,
  OfferCredentialFormats,
  OfferCredentialOptions,
  ProposeCredentialOptions,
} from './interfaces'
import type { V1CredentialService } from './protocol/v1/V1CredentialService'
import type {
  CredentialAckMessage,
  CredentialProblemReportMessage,
  V1IssueCredentialMessage,
  V1RequestCredentialMessage,
} from './protocol/v1/messages'
import type { V2CredentialService } from './protocol/v2/V2CredentialService'
import type { V2IssueCredentialMessage } from './protocol/v2/messages/V2IssueCredentialMessage'
import type { V2RequestCredentialMessage } from './protocol/v2/messages/V2RequestCredentialMessage'
import type { CredentialExchangeRecord, CredentialRepository } from './repository'

import { ConsoleLogger, LogLevel } from '../../logger'

import { CredentialEventTypes } from './CredentialEvents'
import { CredentialState } from './CredentialState'

export type CredentialServiceType = V1CredentialService | V2CredentialService

const logger = new ConsoleLogger(LogLevel.info)

export type CredProposeOfferRequestFormat =
  | CredentialOfferFormat
  | CredentialProposeFormat
  | CredentialRequestFormat
  | CredentialIssueFormat

export abstract class CredentialService {
  protected credentialRepository: CredentialRepository
  protected eventEmitter: EventEmitter
  protected dispatcher: Dispatcher
  protected agentConfig: AgentConfig
  protected mediationRecipientService: MediationRecipientService
  protected didCommMessageRepository: DidCommMessageRepository

  public constructor(
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialRepository = credentialRepository
    this.eventEmitter = eventEmitter
    this.dispatcher = dispatcher
    this.agentConfig = agentConfig
    this.mediationRecipientService = mediationRecipientService
    this.didCommMessageRepository = didCommMessageRepository

    this.registerHandlers()
  }

  abstract getVersion(): CredentialProtocolVersion

  abstract getFormats(
    credentialFormats: OfferCredentialFormats | CredProposeOfferRequestFormat
  ): CredentialFormatService[]
  // methods for proposal
  abstract createProposal(
    proposal: ProposeCredentialOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }>
  abstract processProposal(messageContext: HandlerInboundMessage<Handler>): Promise<CredentialExchangeRecord>
  abstract acceptProposal(
    proposal: AcceptProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }>
  abstract negotiateProposal(
    options: NegotiateProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }>

  abstract createProposalAsResponse(
    credentialRecord: CredentialExchangeRecord,
    options: ProposeCredentialOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }>

  // methods for offer
  abstract createOffer(
    options: OfferCredentialOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }>
  abstract processOffer(messageContext: HandlerInboundMessage<Handler>): Promise<CredentialExchangeRecord>

  abstract createOutOfBandOffer(
    options: OfferCredentialOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }>

  // methods for request
  abstract createRequest(
    credentialRecord: CredentialExchangeRecord,
    options: ServiceRequestCredentialOptions,
    holderDid?: string // temporary workaround while we figure out out of band
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }>

  abstract processAck(messageContext: InboundMessageContext<CredentialAckMessage>): Promise<CredentialExchangeRecord>

  abstract negotiateOffer(
    options: NegotiateOfferOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }>

  // methods for issue

  abstract processRequest(
    messageContext: InboundMessageContext<V1RequestCredentialMessage | V2RequestCredentialMessage>
  ): Promise<CredentialExchangeRecord>

  // methods for issue
  abstract createCredential(
    credentialRecord: CredentialExchangeRecord,
    options?: AcceptRequestOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }>

  abstract processCredential(
    messageContext: InboundMessageContext<V1IssueCredentialMessage | V2IssueCredentialMessage>
  ): Promise<CredentialExchangeRecord>

  abstract createAck(
    credentialRecord: CredentialExchangeRecord
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }>

  abstract registerHandlers(): void

  abstract getFormatService(credentialFormatType?: CredentialFormatType): CredentialFormatService

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
   * Process a received {@link ProblemReportMessage}.
   *
   * @param messageContext The message context containing a credential problem report message
   * @returns credential record associated with the credential problem report message
   *
   */
  public async processProblemReport(
    messageContext: InboundMessageContext<CredentialProblemReportMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: credentialProblemReportMessage } = messageContext

    const connection = messageContext.assertReadyConnection()

    logger.debug(`Processing problem report with id ${credentialProblemReportMessage.id}`)

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
    const previousState = credentialRecord.state
    credentialRecord.state = newState
    await this.credentialRepository.update(credentialRecord)

    this.eventEmitter.emit<CredentialStateChangedEvent>({
      type: CredentialEventTypes.CredentialStateChanged,
      payload: {
        credentialRecord,
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

  /**
   * Delete a credential record by id
   *
   * @param credentialId the credential record id
   */
  public async deleteById(credentialId: string) {
    const credentialRecord = await this.getById(credentialId)
    return this.credentialRepository.delete(credentialRecord)
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

  public async update(credentialRecord: CredentialExchangeRecord) {
    return await this.credentialRepository.update(credentialRecord)
  }
}
