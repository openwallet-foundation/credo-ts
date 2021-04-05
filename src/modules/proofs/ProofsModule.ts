import { createOutboundMessage } from '../../agent/helpers'
import { MessageSender } from '../../agent/MessageSender'
import { ConnectionService } from '../connections'
import { ProofService } from './services'
import { ProofRecord } from './repository/ProofRecord'
import { ProofRequest } from './models/ProofRequest'
import { JsonTransformer } from '../../utils/JsonTransformer'
import { EventEmitter } from 'events'
import { PresentationPreview, ProposePresentationMessage } from './messages'
import { RequestedCredentials } from './models'
import { Dispatcher } from '../../agent/Dispatcher'
import {
  ProposePresentationHandler,
  RequestPresentationHandler,
  PresentationAckHandler,
  PresentationHandler,
} from './handlers'

export class ProofsModule {
  private proofService: ProofService
  private connectionService: ConnectionService
  private messageSender: MessageSender

  public constructor(
    dispatcher: Dispatcher,
    proofService: ProofService,
    connectionService: ConnectionService,
    messageSender: MessageSender
  ) {
    this.proofService = proofService
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.registerHandlers(dispatcher)
  }

  /**
   * Get the event emitter for the proof service. Will emit state changed events
   * when the state of proof records changes.
   *
   * @returns event emitter for proof related actions
   */
  public get events(): EventEmitter {
    return this.proofService
  }

  /**
   * Initiate a new presentation exchange as prover by sending a presentation proposal message
   * to the connection with the specified connection id.
   *
   * @param connectionId The connection to send the proof proposal to
   * @param presentationProposal The presentation proposal to include in the message
   * @param config Additional configuration to use for the proposal
   * @returns Proof record associated with the sent proposal message
   *
   */
  public async proposeProof(
    connectionId: string,
    presentationProposal: PresentationPreview,
    config?: {
      comment?: string
    }
  ): Promise<ProofRecord> {
    const connection = await this.connectionService.getById(connectionId)

    const { message, proofRecord } = await this.proofService.createProposal(connection, presentationProposal, config)

    const outbound = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outbound)

    return proofRecord
  }

  /**
   * Accept a presentation proposal as verifier (by sending a presentation request message) to the connection
   * associated with the proof record.
   *
   * @param proofRecordId The id of the proof record for which to accept the proposal
   * @param config Additional configuration to use for the request
   * @returns Proof record associated with the presentation request
   *
   */
  public async acceptProposal(
    proofRecordId: string,
    config?: {
      request?: {
        name?: string
        version?: string
        nonce?: string
      }
      comment?: string
    }
  ): Promise<ProofRecord> {
    const proofRecord = await this.proofService.getById(proofRecordId)
    const connection = await this.connectionService.getById(proofRecord.connectionId)

    // FIXME: transformation should be handled by record class
    const presentationProposal = JsonTransformer.fromJSON(proofRecord.proposalMessage, ProposePresentationMessage)
      .presentationProposal

    if (!presentationProposal) {
      throw new Error(`Proof record with id ${proofRecordId} is missing required presentation proposal`)
    }

    const proofRequest = await this.proofService.createProofRequestFromProposal(presentationProposal, {
      name: config?.request?.name ?? 'proof-request',
      version: config?.request?.version ?? '1.0',
      nonce: config?.request?.nonce,
    })

    const { message } = await this.proofService.createRequestAsResponse(proofRecord, proofRequest, {
      comment: config?.comment,
    })

    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    return proofRecord
  }

  /**
   * Initiate a new presentation exchange as verifier by sending a presentation request message
   * to the connection with the specified connection id
   *
   * @param connectionId The connection to send the proof request to
   * @param proofRequestOptions Options to build the proof request
   * @param config Additional configuration to use for the request
   * @returns Proof record associated with the sent request message
   *
   */
  public async requestProof(
    connectionId: string,
    proofRequestOptions: Partial<Pick<ProofRequest, 'name' | 'nonce' | 'requestedAttributes' | 'requestedPredicates'>>,
    config?: {
      comment?: string
    }
  ): Promise<ProofRecord> {
    const connection = await this.connectionService.getById(connectionId)

    const nonce = proofRequestOptions.nonce ?? (await this.proofService.generateProofRequestNonce())

    const proofRequest = new ProofRequest({
      name: proofRequestOptions.name ?? 'proof-request',
      version: proofRequestOptions.name ?? '1.0',
      nonce,
      requestedAttributes: proofRequestOptions.requestedAttributes,
      requestedPredicates: proofRequestOptions.requestedPredicates,
    })

    const { message, proofRecord } = await this.proofService.createRequest(connection, proofRequest, config)

    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    return proofRecord
  }

  /**
   * Accept a presentation request as prover (by sending a presentation message) to the connection
   * associated with the proof record.
   *
   * @param proofRecordId The id of the proof record for which to accept the request
   * @param requestedCredentials The requested credentials object specifying which credentials to use for the proof
   * @param config Additional configuration to use for the presentation
   * @returns Proof record associated with the sent presentation message
   *
   */
  public async acceptRequest(
    proofRecordId: string,
    requestedCredentials: RequestedCredentials,
    config?: {
      comment?: string
    }
  ): Promise<ProofRecord> {
    const proofRecord = await this.proofService.getById(proofRecordId)
    const connection = await this.connectionService.getById(proofRecord.connectionId)

    const { message } = await this.proofService.createPresentation(proofRecord, requestedCredentials, config)

    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    return proofRecord
  }

  /**
   * Accept a presentation as prover (by sending a presentation acknowledgement message) to the connection
   * associated with the proof record.
   *
   * @param proofRecordId The id of the proof record for which to accept the presentation
   * @returns Proof record associated with the sent presentation acknowledgement message
   *
   */
  public async acceptPresentation(proofRecordId: string): Promise<ProofRecord> {
    const proofRecord = await this.proofService.getById(proofRecordId)
    const connection = await this.connectionService.getById(proofRecord.connectionId)

    const { message } = await this.proofService.createAck(proofRecord)
    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    return proofRecord
  }

  /**
   * Create a RequestedCredentials object. Given input proof request and presentation proposal,
   * use credentials in the wallet to build indy requested credentials object for input to proof creation.
   * If restrictions allow, self attested attributes will be used.
   *
   * Use the return value of this method as input to {@link ProofService.createPresentation} to automatically
   * accept a received presentation request.
   *
   * @param proofRequest The proof request to build the requested credentials object from
   * @param presentationProposal Optional presentation proposal to improve credential selection algorithm
   * @returns Requested credentials object for use in proof creation
   */
  public async getRequestedCredentialsForProofRequest(
    proofRequest: ProofRequest,
    presentationProposal?: PresentationPreview
  ) {
    return this.proofService.getRequestedCredentialsForProofRequest(proofRequest, presentationProposal)
  }

  /**
   * Retrieve all proof records
   *
   * @returns List containing all proof records
   */
  public async getAll(): Promise<ProofRecord[]> {
    return this.proofService.getAll()
  }

  /**
   * Retrieve a proof record by id
   *
   * @param proofRecordId The proof record id
   * @throws {Error} If no record is found
   * @return The proof record
   *
   */
  public async getById(proofRecordId: string): Promise<ProofRecord> {
    return this.proofService.getById(proofRecordId)
  }

  /**
   * Retrieve a proof record by thread id
   *
   * @param threadId The thread id
   * @throws {Error} If no record is found
   * @throws {Error} If multiple records are found
   * @returns The proof record
   */
  public async getByThreadId(threadId: string): Promise<ProofRecord> {
    return this.proofService.getByThreadId(threadId)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new ProposePresentationHandler(this.proofService))
    dispatcher.registerHandler(new RequestPresentationHandler(this.proofService))
    dispatcher.registerHandler(new PresentationHandler(this.proofService))
    dispatcher.registerHandler(new PresentationAckHandler(this.proofService))
  }
}
