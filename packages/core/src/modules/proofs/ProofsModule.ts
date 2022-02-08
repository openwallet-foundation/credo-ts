import type {
  AcceptPresentationOptions,
  AcceptProposalOptions,
  CreateOutOfBandRequestOptions,
  ProposeProofOptions,
  RequestProofsOptions,
} from './models/ModuleOptions'
import type { AutoAcceptProof } from './models/ProofAutoAcceptType'
import type {
  CreateProposalOptions,
  CreateRequestAsResponseOptions,
  PresentationOptions,
  RequestedCredentialForProofRequestOptions,
  CreateRequestOptions,
} from './models/ProofServiceOptions'
import type { V1RequestPresentationMessage } from './protocol/v1/messages'
import type { ProofRequestOptions, RequestedCredentials, RetrievedCredentials } from './protocol/v1/models'
import type { ProofRecord } from './repository/ProofRecord'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { ServiceDecorator } from '../../decorators/service/ServiceDecorator'
import { AriesFrameworkError } from '../../error'
import { Wallet } from '../../wallet'
import { ConnectionService } from '../connections/services/ConnectionService'
import { CredentialRepository } from '../credentials/repository'
import { IndyVerifierService } from '../indy'
import { IndyHolderService } from '../indy/services/IndyHolderService'
import { IndyLedgerService } from '../ledger'
import { MediationRecipientService } from '../routing/services/MediationRecipientService'

import { ProofResponseCoordinator } from './ProofResponseCoordinator'
import { V1PresentationProblemReportReason } from './protocol/v1/errors'
import { IndyProofFormatService } from './formats/indy/IndyProofFormatService'
import { ProofProtocolVersion } from './models/ProofProtocolVersion'
import { V1ProofService } from './protocol/v1/V1ProofService'
import {
  ProposePresentationHandler,
  RequestPresentationHandler,
  PresentationAckHandler,
  PresentationHandler,
  PresentationProblemReportHandler,
} from './protocol/v1/handlers'
import { V1PresentationProblemReportMessage } from './protocol/v1/messages'
import { ProofRequest } from './protocol/v1/models'
import { V2ProofService } from './protocol/v2/V2ProofService'
import { ProofRepository } from './repository'
import { ProofService } from './ProofService'

@scoped(Lifecycle.ContainerScoped)
export class ProofsModule {
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private agentConfig: AgentConfig
  private serviceMap: { [key in ProofProtocolVersion]: ProofService }
  // private serviceMap: { '1.0': V1ProofService; '2.0': V2ProofService }

  public constructor(
    dispatcher: Dispatcher,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    agentConfig: AgentConfig,
    v1ProofService: V1ProofService,
    v2ProofService: V2ProofService
  ) {
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.agentConfig = agentConfig

    this.serviceMap = {
      [ProofProtocolVersion.V1_0]: v1ProofService,
      [ProofProtocolVersion.V2_0]: v2ProofService,
    }

    this.registerHandlers(dispatcher)
  }

  public getService(protocolVersion: ProofProtocolVersion) {
    return this.serviceMap[protocolVersion]
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

  public async proposeProof(options: ProposeProofOptions): Promise<ProofRecord> {
    const version: ProofProtocolVersion = options.protocolVersion

    const service = this.getService(version)

    const { connectionId } = options

    const connection = await this.connectionService.getById(connectionId)

    const proposalOptions: CreateProposalOptions = {
      connectionRecord: connection,
      protocolVersion: version,
      proofFormats: options.proofFormats,
      autoAcceptProof: options.autoAcceptProof,
      goalCode: options.goalCode,
      willConfirm: options.willConfirm,
      comment: options.comment,
    }

    const { message, proofRecord } = await service.createProposal(proposalOptions)

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
  public async acceptProposal(options: AcceptProposalOptions): Promise<ProofRecord> {
    const version: ProofProtocolVersion = options.protocolVersion

    const service = this.getService(version)
    const { proofRecordId, proofFormats } = options
    const proofRecord = await service.getById(proofRecordId)

    if (!proofRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${proofRecord.id}'. Connection-less issuance does not support presentation proposal or negotiation.`
      )
    }

    const connection = await this.connectionService.getById(proofRecord.connectionId)

    const { message } = await service.createRequestAsResponse({
      proofRecord: proofRecord,
      protocolVersion: version,
      proofFormats: options.proofFormats,
      autoAcceptProof: options.autoAcceptProof,
      goalCode: options.goalCode,
      willConfirm: options.willConfirm,
      comment: options.comment,
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
   * @returns Proof record associated with the sent request message
   *
   */
  // connectionId: string,
  // proofRequestOptions: CreateProofRequestOptions,
  // config?: ProofRequestConfig
  public async requestProof(options: RequestProofsOptions): Promise<ProofRecord> {
    const version: ProofProtocolVersion = options.protocolVersion
    const service = this.getService(version)

    const { connectionId, proofRequestOptions } = options
    const connection = await this.connectionService.getById(connectionId)

    const createProofRequest: CreateRequestOptions = {
      connectionRecord: connection,
      proofFormats: options.proofRequestOptions,
      protocolVersion: version,
      autoAcceptProof: options.autoAcceptProof,
      comment: options.comment,
    }
    const { message, proofRecord } = await service.createRequest(createProofRequest)

    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    return proofRecord
  }

  /**
   * Initiate a new presentation exchange as verifier by creating a presentation request
   * not bound to any connection. The request must be delivered out-of-band to the holder
   *
   * @param proofRequestOptions Options to build the proof request
   * @returns The proof record and proof request message
   *
   */
  public async createOutOfBandRequest(options: CreateOutOfBandRequestOptions): Promise<{
    requestMessage: V1RequestPresentationMessage
    proofRecord: ProofRecord
  }> {
    const { proofRequestOptions } = options
    const version: ProofProtocolVersion = options.protocolVersion

    const service = this.getService(version)

    const nonce = proofRequestOptions.nonce ?? (await service.generateProofRequestNonce())

    const proofRequest = new ProofRequest({
      name: proofRequestOptions.name ?? 'proof-request',
      version: proofRequestOptions.name ?? '1.0',
      nonce,
      requestedAttributes: proofRequestOptions.requestedAttributes,
      requestedPredicates: proofRequestOptions.requestedPredicates,
    })

    const createProofRequest: RequestProofOptions = {
      connectionRecord: undefined,
      proofFormats: proofRequest,
      protocolVersion: version,
      autoAcceptProof: options.autoAcceptProof,
      comment: options.comment,
    }

    const { message, proofRecord } = await service.createRequest(createProofRequest)

    // Create and set ~service decorator
    const routing = await this.mediationRecipientService.getRouting()
    message.service = new ServiceDecorator({
      serviceEndpoint: routing.endpoints[0],
      recipientKeys: [routing.verkey],
      routingKeys: routing.routingKeys,
    })

    // Save ~service decorator to record (to remember our verkey)
    proofRecord.requestMessage = message
    await service.update(proofRecord)

    return { proofRecord, requestMessage: message }
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
  public async acceptRequest(options: AcceptPresentationOptions): Promise<ProofRecord> {
    const { proofRecordId, proofFormats, comment } = options

    const version: ProofProtocolVersion = options.protocolVersion
    const service = this.getService(version)

    const record = await service.getById(proofRecordId)
    const presentationOptions: PresentationOptions = {
      proofFormats,
      proofRecord: record,
      comment,
    }
    const { message, proofRecord } = await service.createPresentation(presentationOptions)

    // Use connection if present
    if (proofRecord.connectionId) {
      const connection = await this.connectionService.getById(proofRecord.connectionId)

      const outboundMessage = createOutboundMessage(connection, message)
      await this.messageSender.sendMessage(outboundMessage)

      return proofRecord
    }
    // Use ~service decorator otherwise
    else if (proofRecord.requestMessage?.service) {
      // Create ~service decorator
      const routing = await this.mediationRecipientService.getRouting()
      const ourService = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.verkey],
        routingKeys: routing.routingKeys,
      })

      const recipientService = proofRecord.requestMessage.service

      // Set and save ~service decorator to record (to remember our verkey)
      message.service = ourService
      proofRecord.presentationMessage = message
      await service.update(proofRecord)

      await this.messageSender.sendMessageToService({
        message,
        service: recipientService.toDidCommService(),
        senderKey: ourService.recipientKeys[0],
        returnRoute: true,
      })

      return proofRecord
    }
    // Cannot send message without connectionId or ~service decorator
    else {
      throw new AriesFrameworkError(
        `Cannot accept presentation request without connectionId or ~service decorator on presentation request.`
      )
    }
  }

  /**
   * Declines a proof request as holder
   * @param proofRecordId the id of the proof request to be declined
   * @returns proof record that was declined
   */
  public async declineRequest(proofRecordId: string, version: ProofProtocolVersion) {
    const service = this.getService(version)

    const proofRecord = await service.getById(proofRecordId)
    await service.declineRequest(proofRecord)
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
  public async acceptPresentation(proofRecordId: string, version: ProofProtocolVersion): Promise<ProofRecord> {
    const service = this.getService(version)

    const record = await service.getById(proofRecordId)
    const { message, proofRecord } = await service.createAck(record)

    // Use connection if present
    if (proofRecord.connectionId) {
      const connection = await this.connectionService.getById(proofRecord.connectionId)
      const outboundMessage = createOutboundMessage(connection, message)
      await this.messageSender.sendMessage(outboundMessage)
    }
    // Use ~service decorator otherwise
    else if (proofRecord.requestMessage?.service && proofRecord.presentationMessage?.service) {
      const recipientService = proofRecord.presentationMessage?.service
      const ourService = proofRecord.requestMessage?.service

      await this.messageSender.sendMessageToService({
        message,
        service: recipientService.toDidCommService(),
        senderKey: ourService.recipientKeys[0],
        returnRoute: true,
      })
    }

    // Cannot send message without credentialId or ~service decorator
    else {
      throw new AriesFrameworkError(
        `Cannot accept presentation without connectionId or ~service decorator on presentation message.`
      )
    }

    return proofRecord
  }

  /**
   * Create a {@link RetrievedCredentials} object. Given input proof request and presentation proposal,
   * use credentials in the wallet to build indy requested credentials object for input to proof creation.
   * If restrictions allow, self attested attributes will be used.
   *
   *
   * @param proofRecordId the id of the proof request to get the matching credentials for
   * @param config optional configuration for credential selection process. Use `filterByPresentationPreview` (default `true`) to only include
   *  credentials that match the presentation preview from the presentation proposal (if available).

   * @returns RetrievedCredentials object
  //  */
  public async getRequestedCredentialsForProofRequest(
    proofRecordId: string,
    version: ProofProtocolVersion,
    config?: GetRequestedCredentialsConfig
  ): Promise<RetrievedCredentials> {
    const service = this.getService(version)

    const proofRecord = await service.getById(proofRecordId)

    const indyProofRequest = proofRecord.requestMessage?.indyProofRequest
    const presentationPreview = config?.filterByPresentationPreview ? proofRecord.proposalMessage : undefined

    if (!indyProofRequest) {
      throw new AriesFrameworkError(
        'Unable to get requested credentials for proof request. No proof request message was found or the proof request message does not contain an indy proof request.'
      )
    }
    const requestedCredentialsForProofRequest: RequestedCredentialForProofRequestOptions = {
      proofRequest: indyProofRequest,
      presentationProposal: presentationPreview,
    }
    return service.getRequestedCredentialsForProofRequest(requestedCredentialsForProofRequest)
  }

  /**
   * Takes a RetrievedCredentials object and auto selects credentials in a RequestedCredentials object
   *
   * Use the return value of this method as input to {@link ProofService.createPresentation} to
   * automatically accept a received presentation request.
   *
   * @param retrievedCredentials The retrieved credentials object to get credentials from
   *
   * @returns RequestedCredentials
   */
  public autoSelectCredentialsForProofRequest(
    retrievedCredentials: RetrievedCredentials,
    version: ProofProtocolVersion
  ): RequestedCredentials {
    const service = this.getService(version)
    return service.autoSelectCredentialsForProofRequest(retrievedCredentials)
  }

  /**
   * Send problem report message for a proof record
   * @param proofRecordId  The id of the proof record for which to send problem report
   * @param message message to send
   * @returns proof record associated with the proof problem report message
   */
  public async sendProblemReport(proofRecordId: string, message: string, version: ProofProtocolVersion) {
    const service = this.getService(version)
    const record = await service.getById(proofRecordId)
    if (!record.connectionId) {
      throw new AriesFrameworkError(`No connectionId found for proof record '${record.id}'.`)
    }
    const connection = await this.connectionService.getById(record.connectionId)

    const { message: problemReport } = await service.createProblemReport({
      proofRecord: record,
      description: message,
    })

    const outboundMessage = createOutboundMessage(connection, problemReport)
    await this.messageSender.sendMessage(outboundMessage)

    return record
  }

  /**
   * Retrieve all proof records
   *
   * @returns List containing all proof records
   */
  public getAll(): Promise<ProofRecord[]> {
    return this.proofService.getAll()
  }

  /**
   * Retrieve a proof record by id
   *
   * @param proofRecordId The proof record id
   * @throws {RecordNotFoundError} If no record is found
   * @throws {RecordDuplicateError} If multiple records are found
   * @return The proof record
   *
   */
  public async getById(proofRecordId: string): Promise<ProofRecord> {
    return this.proofService.getById(proofRecordId)
  }

  /**
   * Retrieve a proof record by id
   *
   * @param proofRecordId The proof record id
   * @return The proof record or null if not found
   *
   */
  public async findById(proofRecordId: string): Promise<ProofRecord | null> {
    return this.proofService.findById(proofRecordId)
  }

  /**
   * Delete a proof record by id
   *
   * @param proofId the proof record id
   */
  public async deleteById(proofId: string) {
    return this.proofService.deleteById(proofId)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    for (const service of Object.values(this.serviceMap)) {
      await service.registerHandlers(dispatcher, this.agentConfig, this.proofResponseCoordinator, this.mediation)
    }
}


export type CreateProofRequestOptions = Partial<
  Pick<ProofRequestOptions, 'name' | 'nonce' | 'requestedAttributes' | 'requestedPredicates'>
>

export interface ProofRequestConfig {
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface GetRequestedCredentialsConfig {
  /**
   * Whether to filter the retrieved credentials using the presentation preview.
   * This configuration will only have effect if a presentation proposal message is available
   * containing a presentation preview.
   */
  filterByPresentationPreview?: boolean
}
