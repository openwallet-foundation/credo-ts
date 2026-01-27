import type { Query, QueryOptions } from '@credo-ts/core'
import { AgentContext, CredoError, injectable } from '@credo-ts/core'
import { DidCommMessage } from '../../DidCommMessage'
import { DidCommMessageSender } from '../../DidCommMessageSender'
import { getOutboundDidCommMessageContext } from '../../getDidCommOutboundMessageContext'
import { DidCommConnectionService } from '../connections'
import type {
  AcceptProofOptions,
  AcceptProofProposalOptions,
  AcceptProofRequestOptions,
  CreateProofProposalOptions,
  CreateProofRequestOptions,
  DeclineProofRequestOptions,
  DeleteProofOptions,
  FindProofPresentationMessageReturn,
  FindProofProposalMessageReturn,
  FindProofRequestMessageReturn,
  GetCredentialsForProofRequestOptions,
  GetCredentialsForProofRequestReturn,
  GetProofFormatDataReturn,
  NegotiateProofProposalOptions,
  NegotiateProofRequestOptions,
  ProposeProofOptions,
  RequestProofOptions,
  SelectCredentialsForProofRequestOptions,
  SelectCredentialsForProofRequestReturn,
  SendProofProblemReportOptions,
} from './DidCommProofsApiOptions'
import { DidCommProofsModuleConfig } from './DidCommProofsModuleConfig'
import { DidCommProofState } from './models/DidCommProofState'
import type { DidCommProofProtocol } from './protocol/DidCommProofProtocol'
import type { ProofFormatsFromProtocols } from './protocol/DidCommProofProtocolOptions'
import type { DidCommProofExchangeRecord } from './repository/DidCommProofExchangeRecord'
import { DidCommProofExchangeRepository } from './repository/DidCommProofExchangeRepository'

export interface DidCommProofsApi<PPs extends DidCommProofProtocol[]> {
  // Proposal methods
  proposeProof(options: ProposeProofOptions<PPs>): Promise<DidCommProofExchangeRecord>
  acceptProposal(options: AcceptProofProposalOptions<PPs>): Promise<DidCommProofExchangeRecord>
  negotiateProposal(options: NegotiateProofProposalOptions<PPs>): Promise<DidCommProofExchangeRecord>

  // Request methods
  requestProof(options: RequestProofOptions<PPs>): Promise<DidCommProofExchangeRecord>
  acceptRequest(options: AcceptProofRequestOptions<PPs>): Promise<DidCommProofExchangeRecord>
  declineRequest(options: DeclineProofRequestOptions): Promise<DidCommProofExchangeRecord>
  negotiateRequest(options: NegotiateProofRequestOptions<PPs>): Promise<DidCommProofExchangeRecord>

  // Present
  acceptPresentation(options: AcceptProofOptions): Promise<DidCommProofExchangeRecord>

  // out of band
  createRequest(options: CreateProofRequestOptions<PPs>): Promise<{
    message: DidCommMessage
    proofRecord: DidCommProofExchangeRecord
  }>
  createProofProposal(options: CreateProofProposalOptions<PPs>): Promise<{
    message: DidCommMessage
    proofRecord: DidCommProofExchangeRecord
  }>

  // Auto Select
  selectCredentialsForRequest(
    options: SelectCredentialsForProofRequestOptions<PPs>
  ): Promise<SelectCredentialsForProofRequestReturn<PPs>>

  // Get credentials for request
  getCredentialsForRequest(
    options: GetCredentialsForProofRequestOptions<PPs>
  ): Promise<GetCredentialsForProofRequestReturn<PPs>>

  sendProblemReport(options: SendProofProblemReportOptions): Promise<DidCommProofExchangeRecord>

  // Record Methods
  getAll(): Promise<DidCommProofExchangeRecord[]>
  findAllByQuery(
    query: Query<DidCommProofExchangeRecord>,
    queryOptions?: QueryOptions
  ): Promise<DidCommProofExchangeRecord[]>
  getById(proofExchangeRecordId: string): Promise<DidCommProofExchangeRecord>
  findById(proofExchangeRecordId: string): Promise<DidCommProofExchangeRecord | null>
  deleteById(proofId: string, options?: DeleteProofOptions): Promise<void>
  update(proofRecord: DidCommProofExchangeRecord): Promise<void>
  getFormatData(proofExchangeRecordId: string): Promise<GetProofFormatDataReturn<ProofFormatsFromProtocols<PPs>>>

  // DidComm Message Records
  findProposalMessage(proofExchangeRecordId: string): Promise<FindProofProposalMessageReturn<PPs>>
  findRequestMessage(proofExchangeRecordId: string): Promise<FindProofRequestMessageReturn<PPs>>
  findPresentationMessage(proofExchangeRecordId: string): Promise<FindProofPresentationMessageReturn<PPs>>
}

@injectable()
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: no explanation
export class DidCommProofsApi<PPs extends DidCommProofProtocol[]> implements DidCommProofsApi<PPs> {
  /**
   * Configuration for the proofs module
   */
  public readonly config: DidCommProofsModuleConfig<PPs>

  private connectionService: DidCommConnectionService
  private messageSender: DidCommMessageSender
  private proofRepository: DidCommProofExchangeRepository
  private agentContext: AgentContext

  public constructor(
    messageSender: DidCommMessageSender,
    connectionService: DidCommConnectionService,
    agentContext: AgentContext,
    proofRepository: DidCommProofExchangeRepository,
    config: DidCommProofsModuleConfig<PPs>
  ) {
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.proofRepository = proofRepository
    this.agentContext = agentContext
    this.config = config
  }

  private getProtocol<PVT extends PPs[number]['version']>(protocolVersion: PVT): DidCommProofProtocol {
    const proofProtocol = this.config.proofProtocols.find((protocol) => protocol.version === protocolVersion)

    if (!proofProtocol) {
      throw new CredoError(`No proof protocol registered for protocol version ${protocolVersion}`)
    }

    return proofProtocol
  }

  /**
   * Initiate a new presentation exchange as prover by sending a presentation proposal message
   * to the connection with the specified connection id.
   *
   * @param options configuration to use for the proposal
   * @returns Proof exchange record associated with the sent proposal message
   */
  public async proposeProof(options: ProposeProofOptions<PPs>): Promise<DidCommProofExchangeRecord> {
    const protocol = this.getProtocol(options.protocolVersion)

    const connectionRecord = await this.connectionService.getById(this.agentContext, options.connectionId)

    // Assert
    connectionRecord.assertReady()

    const { message, proofRecord } = await protocol.createProposal(this.agentContext, {
      connectionRecord,
      proofFormats: options.proofFormats,
      autoAcceptProof: options.autoAcceptProof,
      goalCode: options.goalCode,
      goal: options.goal,
      comment: options.comment,
      parentThreadId: options.parentThreadId,
    })

    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message,
      associatedRecord: proofRecord,
      connectionRecord,
    })

    await this.messageSender.sendMessage(outboundMessageContext)
    return proofRecord
  }

  /**
   * Initiate a new presentation exchange as prover by sending an out of band proof proposal message
   *
   * @param options multiple properties like protocol version, proof Formats to build the proof request
   * @returns the message itself and the proof record associated with the sent request message
   */
  public async createProofProposal(options: CreateProofProposalOptions<PPs>): Promise<{
    message: DidCommMessage
    proofRecord: DidCommProofExchangeRecord
  }> {
    const protocol = this.getProtocol(options.protocolVersion)

    return await protocol.createProposal(this.agentContext, {
      proofFormats: options.proofFormats,
      autoAcceptProof: options.autoAcceptProof,
      goalCode: options.goalCode,
      comment: options.comment,
      parentThreadId: options.parentThreadId,
    })
  }

  /**
   * Accept a presentation proposal as verifier (by sending a presentation request message) to the connection
   * associated with the proof record.
   *
   * @param options config object for accepting the proposal
   * @returns Proof exchange record associated with the presentation request
   */
  public async acceptProposal(options: AcceptProofProposalOptions<PPs>): Promise<DidCommProofExchangeRecord> {
    const proofRecord = await this.getById(options.proofExchangeRecordId)

    if (!proofRecord.connectionId) {
      throw new CredoError(
        `No connectionId found for proof record '${proofRecord.id}'. Connection-less verification does not support presentation proposal or negotiation.`
      )
    }

    // with version we can get the protocol
    const protocol = this.getProtocol(proofRecord.protocolVersion)
    const connectionRecord = await this.connectionService.getById(this.agentContext, proofRecord.connectionId)

    // Assert
    connectionRecord.assertReady()

    const { message } = await protocol.acceptProposal(this.agentContext, {
      proofRecord,
      proofFormats: options.proofFormats,
      goalCode: options.goalCode,
      goal: options.goal,
      willConfirm: options.willConfirm,
      comment: options.comment,
      autoAcceptProof: options.autoAcceptProof,
    })

    // send the message
    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message,
      associatedRecord: proofRecord,
      connectionRecord,
    })

    await this.messageSender.sendMessage(outboundMessageContext)
    return proofRecord
  }

  /**
   * Answer with a new presentation request in response to received presentation proposal message
   * to the connection associated with the proof record.
   *
   * @param options multiple properties like proof record id, proof formats to accept requested credentials object
   * specifying which credentials to use for the proof
   * @returns Proof record associated with the sent request message
   */
  public async negotiateProposal(options: NegotiateProofProposalOptions<PPs>): Promise<DidCommProofExchangeRecord> {
    const proofRecord = await this.getById(options.proofExchangeRecordId)

    if (!proofRecord.connectionId) {
      throw new CredoError(
        `No connectionId found for proof record '${proofRecord.id}'. Connection-less verification does not support negotiation.`
      )
    }

    const protocol = this.getProtocol(proofRecord.protocolVersion)
    const connectionRecord = await this.connectionService.getById(this.agentContext, proofRecord.connectionId)

    // Assert
    connectionRecord.assertReady()

    const { message } = await protocol.negotiateProposal(this.agentContext, {
      proofRecord,
      proofFormats: options.proofFormats,
      autoAcceptProof: options.autoAcceptProof,
      comment: options.comment,
      goalCode: options.goalCode,
      goal: options.goal,
      willConfirm: options.willConfirm,
    })

    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message,
      associatedRecord: proofRecord,
      connectionRecord,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return proofRecord
  }

  /**
   * Initiate a new presentation exchange as verifier by sending a presentation request message
   * to the connection with the specified connection id
   *
   * @param options multiple properties like connection id, protocol version, proof Formats to build the proof request
   * @returns Proof record associated with the sent request message
   */
  public async requestProof(options: RequestProofOptions<PPs>): Promise<DidCommProofExchangeRecord> {
    const connectionRecord = await this.connectionService.getById(this.agentContext, options.connectionId)
    const protocol = this.getProtocol(options.protocolVersion)

    // Assert
    connectionRecord.assertReady()

    const { message, proofRecord } = await protocol.createRequest(this.agentContext, {
      connectionRecord,
      proofFormats: options.proofFormats,
      autoAcceptProof: options.autoAcceptProof,
      parentThreadId: options.parentThreadId,
      comment: options.comment,
      goalCode: options.goalCode,
      goal: options.goal,
      willConfirm: options.willConfirm,
    })

    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message,
      associatedRecord: proofRecord,
      connectionRecord,
    })

    await this.messageSender.sendMessage(outboundMessageContext)
    return proofRecord
  }

  /**
   * Accept a presentation request as prover (by sending a presentation message) to the connection
   * associated with the proof record.
   *
   * @param options multiple properties like proof record id, proof formats to accept requested credentials object
   * specifying which credentials to use for the proof
   * @returns Proof record associated with the sent presentation message
   */
  public async acceptRequest(options: AcceptProofRequestOptions<PPs>): Promise<DidCommProofExchangeRecord> {
    const proofRecord = await this.getById(options.proofExchangeRecordId)

    const protocol = this.getProtocol(proofRecord.protocolVersion)

    const requestMessage = await protocol.findRequestMessage(this.agentContext, proofRecord.id)
    if (!requestMessage) {
      throw new CredoError(`No request message found for proof record with id '${proofRecord.id}'`)
    }

    // Use connection if present
    const connectionRecord = proofRecord.connectionId
      ? await this.connectionService.getById(this.agentContext, proofRecord.connectionId)
      : undefined
    connectionRecord?.assertReady()

    const { message } = await protocol.acceptRequest(this.agentContext, {
      proofFormats: options.proofFormats,
      proofRecord,
      comment: options.comment,
      autoAcceptProof: options.autoAcceptProof,
      goalCode: options.goalCode,
      goal: options.goal,
    })

    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message,
      connectionRecord,
      associatedRecord: proofRecord,
      lastReceivedMessage: requestMessage,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return proofRecord
  }

  public async declineRequest(options: DeclineProofRequestOptions): Promise<DidCommProofExchangeRecord> {
    const proofRecord = await this.getById(options.proofExchangeRecordId)
    proofRecord.assertState(DidCommProofState.RequestReceived)

    const protocol = this.getProtocol(proofRecord.protocolVersion)
    if (options.sendProblemReport) {
      await this.sendProblemReport({
        proofExchangeRecordId: options.proofExchangeRecordId,
        description: options.problemReportDescription ?? 'Request declined',
      })
    }

    await protocol.updateState(this.agentContext, proofRecord, DidCommProofState.Declined)

    return proofRecord
  }

  /**
   * Answer with a new presentation proposal in response to received presentation request message
   * to the connection associated with the proof record.
   *
   * @param options multiple properties like proof record id, proof format (indy/ presentation exchange)
   * to include in the message
   * @returns Proof record associated with the sent proposal message
   */
  public async negotiateRequest(options: NegotiateProofRequestOptions<PPs>): Promise<DidCommProofExchangeRecord> {
    const proofRecord = await this.getById(options.proofExchangeRecordId)

    if (!proofRecord.connectionId) {
      throw new CredoError(
        `No connectionId found for proof record '${proofRecord.id}'. Connection-less verification does not support presentation proposal or negotiation.`
      )
    }

    const connectionRecord = await this.connectionService.getById(this.agentContext, proofRecord.connectionId)

    // Assert
    connectionRecord.assertReady()

    const protocol = this.getProtocol(proofRecord.protocolVersion)
    const { message } = await protocol.negotiateRequest(this.agentContext, {
      proofRecord,
      proofFormats: options.proofFormats,
      autoAcceptProof: options.autoAcceptProof,
      goalCode: options.goalCode,
      goal: options.goal,
      comment: options.comment,
    })

    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message,
      connectionRecord,
      associatedRecord: proofRecord,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return proofRecord
  }

  /**
   * Initiate a new presentation exchange as verifier by sending an out of band presentation
   * request message
   *
   * @param options multiple properties like protocol version, proof Formats to build the proof request
   * @returns the message itself and the proof record associated with the sent request message
   */
  public async createRequest(options: CreateProofRequestOptions<PPs>): Promise<{
    message: DidCommMessage
    proofRecord: DidCommProofExchangeRecord
  }> {
    const protocol = this.getProtocol(options.protocolVersion)

    return await protocol.createRequest(this.agentContext, {
      proofFormats: options.proofFormats,
      autoAcceptProof: options.autoAcceptProof,
      comment: options.comment,
      parentThreadId: options.parentThreadId,
      goalCode: options.goalCode,
      goal: options.goal,
      willConfirm: options.willConfirm,
    })
  }

  /**
   * Accept a presentation as prover (by sending a presentation acknowledgement message) to the connection
   * associated with the proof record.
   *
   * @param proofExchangeRecordId The id of the proof exchange record for which to accept the presentation
   * @returns Proof record associated with the sent presentation acknowledgement message
   *
   */
  public async acceptPresentation(options: AcceptProofOptions): Promise<DidCommProofExchangeRecord> {
    const proofRecord = await this.getById(options.proofExchangeRecordId)
    const protocol = this.getProtocol(proofRecord.protocolVersion)

    const requestMessage = await protocol.findRequestMessage(this.agentContext, proofRecord.id)
    if (!requestMessage) {
      throw new CredoError(`No request message found for proof record with id '${proofRecord.id}'`)
    }

    const presentationMessage = await protocol.findPresentationMessage(this.agentContext, proofRecord.id)
    if (!presentationMessage) {
      throw new CredoError(`No presentation message found for proof record with id '${proofRecord.id}'`)
    }

    // Use connection if present
    const connectionRecord = proofRecord.connectionId
      ? await this.connectionService.getById(this.agentContext, proofRecord.connectionId)
      : undefined
    connectionRecord?.assertReady()

    const { message } = await protocol.acceptPresentation(this.agentContext, {
      proofRecord,
    })

    // FIXME: returnRoute: false
    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message,
      connectionRecord,
      associatedRecord: proofRecord,
      lastSentMessage: requestMessage,
      lastReceivedMessage: presentationMessage,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return proofRecord
  }

  /**
   * Create a {@link RetrievedCredentials} object. Given input proof request and presentation proposal,
   * use credentials in the wallet to build indy requested credentials object for input to proof creation.
   * If restrictions allow, self attested attributes will be used.
   *
   * @param options multiple properties like proof record id and optional configuration
   * @returns RequestedCredentials
   */
  public async selectCredentialsForRequest(
    options: SelectCredentialsForProofRequestOptions<PPs>
  ): Promise<SelectCredentialsForProofRequestReturn<PPs>> {
    const proofRecord = await this.getById(options.proofExchangeRecordId)

    const protocol = this.getProtocol(proofRecord.protocolVersion)

    return protocol.selectCredentialsForRequest(this.agentContext, {
      proofFormats: options.proofFormats,
      proofRecord,
    })
  }

  /**
   * Get credentials in the wallet for a received proof request.
   *
   * @param options multiple properties like proof record id and optional configuration
   */
  public async getCredentialsForRequest(
    options: GetCredentialsForProofRequestOptions<PPs>
  ): Promise<GetCredentialsForProofRequestReturn<PPs>> {
    const proofRecord = await this.getById(options.proofExchangeRecordId)

    const protocol = this.getProtocol(proofRecord.protocolVersion)

    return protocol.getCredentialsForRequest(this.agentContext, {
      proofRecord,
      proofFormats: options.proofFormats,
    })
  }

  /**
   * Send problem report message for a proof record
   *
   * @param proofExchangeRecordId  The id of the proof record for which to send problem report
   * @param message message to send
   * @returns proof record associated with the proof problem report message
   */
  public async sendProblemReport(options: SendProofProblemReportOptions): Promise<DidCommProofExchangeRecord> {
    const proofRecord = await this.getById(options.proofExchangeRecordId)

    const protocol = this.getProtocol(proofRecord.protocolVersion)

    const requestMessage = await protocol.findRequestMessage(this.agentContext, proofRecord.id)

    const proposalMessage = await protocol.findProposalMessage(this.agentContext, proofRecord.id)

    const { message: problemReport } = await protocol.createProblemReport(this.agentContext, {
      proofRecord,
      description: options.description,
    })

    // Use connection if present
    const connectionRecord = proofRecord.connectionId
      ? await this.connectionService.getById(this.agentContext, proofRecord.connectionId)
      : undefined
    connectionRecord?.assertReady()

    // If there's no connection (so connection-less, we require the state to be request received or proposal sent)
    if (!connectionRecord) {
      proofRecord.assertState([DidCommProofState.RequestReceived, DidCommProofState.ProposalSent])

      if (!requestMessage && !proposalMessage) {
        throw new CredoError(`No request or proposal message found for proof record with id '${proofRecord.id}'`)
      }
    }

    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message: problemReport,
      connectionRecord,
      associatedRecord: proofRecord,
      lastSentMessage: proposalMessage ?? undefined,
      lastReceivedMessage: requestMessage ?? undefined,
    })
    await this.messageSender.sendMessage(outboundMessageContext)

    return proofRecord
  }

  public async getFormatData(
    proofExchangeRecordId: string
  ): Promise<GetProofFormatDataReturn<ProofFormatsFromProtocols<PPs>>> {
    const proofRecord = await this.getById(proofExchangeRecordId)
    const protocol = this.getProtocol(proofRecord.protocolVersion)

    return protocol.getFormatData(this.agentContext, proofExchangeRecordId)
  }

  /**
   * Retrieve all proof records
   *
   * @returns List containing all proof records
   */
  public async getAll(): Promise<DidCommProofExchangeRecord[]> {
    return this.proofRepository.getAll(this.agentContext)
  }

  /**
   * Retrieve all proof records by specified query params
   *
   * @returns List containing all proof records matching specified params
   */
  public findAllByQuery(
    query: Query<DidCommProofExchangeRecord>,
    queryOptions?: QueryOptions
  ): Promise<DidCommProofExchangeRecord[]> {
    return this.proofRepository.findByQuery(this.agentContext, query, queryOptions)
  }

  /**
   * Retrieve a proof record by id
   *
   * @param proofExchangeRecordId The proof record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The proof record
   *
   */
  public async getById(proofExchangeRecordId: string): Promise<DidCommProofExchangeRecord> {
    return await this.proofRepository.getById(this.agentContext, proofExchangeRecordId)
  }

  /**
   * Retrieve a proof record by id
   *
   * @param proofExchangeRecordId The proof record id
   * @return The proof record or null if not found
   *
   */
  public async findById(proofExchangeRecordId: string): Promise<DidCommProofExchangeRecord | null> {
    return await this.proofRepository.findById(this.agentContext, proofExchangeRecordId)
  }

  /**
   * Delete a proof record by id
   *
   * @param proofId the proof record id
   */
  public async deleteById(proofId: string, options?: DeleteProofOptions) {
    const proofRecord = await this.getById(proofId)
    const protocol = this.getProtocol(proofRecord.protocolVersion)
    return protocol.delete(this.agentContext, proofRecord, options)
  }

  /**
   * Retrieve a proof record by connection id and thread id
   *
   * @param connectionId The connection id
   * @param threadId The thread id
   * @throws {RecordNotFoundError} If no record is found
   * @throws {RecordDuplicateError} If multiple records are found
   * @returns The proof record
   */
  public async getByThreadAndConnectionId(
    threadId: string,
    connectionId?: string
  ): Promise<DidCommProofExchangeRecord> {
    return this.proofRepository.getByThreadAndConnectionId(this.agentContext, threadId, connectionId)
  }

  /**
   * Retrieve proof records by connection id and parent thread id
   *
   * @param connectionId The connection id
   * @param parentThreadId The parent thread id
   * @returns List containing all proof records matching the given query
   */
  public async getByParentThreadAndConnectionId(
    parentThreadId: string,
    connectionId?: string
  ): Promise<DidCommProofExchangeRecord[]> {
    return this.proofRepository.getByParentThreadAndConnectionId(this.agentContext, parentThreadId, connectionId)
  }

  /**
   * Update a proof record by
   *
   * @param proofRecord the proof record
   */
  public async update(proofRecord: DidCommProofExchangeRecord): Promise<void> {
    await this.proofRepository.update(this.agentContext, proofRecord)
  }

  public async findProposalMessage(proofExchangeRecordId: string): Promise<FindProofProposalMessageReturn<PPs>> {
    const record = await this.getById(proofExchangeRecordId)
    const protocol = this.getProtocol(record.protocolVersion)
    return protocol.findProposalMessage(this.agentContext, proofExchangeRecordId) as FindProofProposalMessageReturn<PPs>
  }

  public async findRequestMessage(proofExchangeRecordId: string): Promise<FindProofRequestMessageReturn<PPs>> {
    const record = await this.getById(proofExchangeRecordId)
    const protocol = this.getProtocol(record.protocolVersion)
    return protocol.findRequestMessage(this.agentContext, proofExchangeRecordId) as FindProofRequestMessageReturn<PPs>
  }

  public async findPresentationMessage(
    proofExchangeRecordId: string
  ): Promise<FindProofPresentationMessageReturn<PPs>> {
    const record = await this.getById(proofExchangeRecordId)
    const protocol = this.getProtocol(record.protocolVersion)
    return protocol.findPresentationMessage(
      this.agentContext,
      proofExchangeRecordId
    ) as FindProofPresentationMessageReturn<PPs>
  }
}
