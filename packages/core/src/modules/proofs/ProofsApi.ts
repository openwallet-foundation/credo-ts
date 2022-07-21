import type { AutoAcceptProof } from './ProofAutoAcceptType'
import type { PresentationPreview, RequestPresentationMessage } from './messages'
import type { RequestedCredentials, RetrievedCredentials } from './models'
import type { ProofRequestOptions } from './models/ProofRequest'
import type { ProofRecord } from './repository/ProofRecord'

import { AgentContext } from '../../agent'
import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { InjectionSymbols } from '../../constants'
import { ServiceDecorator } from '../../decorators/service/ServiceDecorator'
import { AriesFrameworkError } from '../../error'
import { Logger } from '../../logger'
import { inject, injectable } from '../../plugins'
import { ConnectionService } from '../connections/services/ConnectionService'
import { RoutingService } from '../routing/services/RoutingService'

import { ProofResponseCoordinator } from './ProofResponseCoordinator'
import { PresentationProblemReportReason } from './errors'
import {
  PresentationAckHandler,
  PresentationHandler,
  PresentationProblemReportHandler,
  ProposePresentationHandler,
  RequestPresentationHandler,
} from './handlers'
import { PresentationProblemReportMessage } from './messages/PresentationProblemReportMessage'
import { ProofRequest } from './models/ProofRequest'
import { ProofService } from './services'

@injectable()
export class ProofsApi {
  private proofService: ProofService
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private routingService: RoutingService
  private agentContext: AgentContext
  private proofResponseCoordinator: ProofResponseCoordinator
  private logger: Logger

  public constructor(
    dispatcher: Dispatcher,
    proofService: ProofService,
    connectionService: ConnectionService,
    routingService: RoutingService,
    agentContext: AgentContext,
    messageSender: MessageSender,
    proofResponseCoordinator: ProofResponseCoordinator,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.proofService = proofService
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.routingService = routingService
    this.agentContext = agentContext
    this.proofResponseCoordinator = proofResponseCoordinator
    this.logger = logger
    this.registerHandlers(dispatcher)
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
      autoAcceptProof?: AutoAcceptProof
    }
  ): Promise<ProofRecord> {
    const connection = await this.connectionService.getById(this.agentContext, connectionId)

    const { message, proofRecord } = await this.proofService.createProposal(
      this.agentContext,
      connection,
      presentationProposal,
      config
    )

    const outbound = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(this.agentContext, outbound)

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
    const proofRecord = await this.proofService.getById(this.agentContext, proofRecordId)

    if (!proofRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${proofRecord.id}'. Connection-less issuance does not support presentation proposal or negotiation.`
      )
    }

    const connection = await this.connectionService.getById(this.agentContext, proofRecord.connectionId)

    const presentationProposal = proofRecord.proposalMessage?.presentationProposal
    if (!presentationProposal) {
      throw new AriesFrameworkError(`Proof record with id ${proofRecordId} is missing required presentation proposal`)
    }

    const proofRequest = await this.proofService.createProofRequestFromProposal(
      this.agentContext,
      presentationProposal,
      {
        name: config?.request?.name ?? 'proof-request',
        version: config?.request?.version ?? '1.0',
        nonce: config?.request?.nonce,
      }
    )

    const { message } = await this.proofService.createRequestAsResponse(this.agentContext, proofRecord, proofRequest, {
      comment: config?.comment,
    })

    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(this.agentContext, outboundMessage)

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
  public async requestProof(
    connectionId: string,
    proofRequestOptions: CreateProofRequestOptions,
    config?: ProofRequestConfig
  ): Promise<ProofRecord> {
    const connection = await this.connectionService.getById(this.agentContext, connectionId)

    const nonce = proofRequestOptions.nonce ?? (await this.proofService.generateProofRequestNonce(this.agentContext))

    const proofRequest = new ProofRequest({
      name: proofRequestOptions.name ?? 'proof-request',
      version: proofRequestOptions.name ?? '1.0',
      nonce,
      requestedAttributes: proofRequestOptions.requestedAttributes,
      requestedPredicates: proofRequestOptions.requestedPredicates,
    })

    const { message, proofRecord } = await this.proofService.createRequest(
      this.agentContext,
      proofRequest,
      connection,
      config
    )

    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(this.agentContext, outboundMessage)

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
  public async createOutOfBandRequest(
    proofRequestOptions: CreateProofRequestOptions,
    config?: ProofRequestConfig
  ): Promise<{
    requestMessage: RequestPresentationMessage
    proofRecord: ProofRecord
  }> {
    const nonce = proofRequestOptions.nonce ?? (await this.proofService.generateProofRequestNonce(this.agentContext))

    const proofRequest = new ProofRequest({
      name: proofRequestOptions.name ?? 'proof-request',
      version: proofRequestOptions.name ?? '1.0',
      nonce,
      requestedAttributes: proofRequestOptions.requestedAttributes,
      requestedPredicates: proofRequestOptions.requestedPredicates,
    })

    const { message, proofRecord } = await this.proofService.createRequest(
      this.agentContext,
      proofRequest,
      undefined,
      config
    )

    // Create and set ~service decorator
    const routing = await this.routingService.getRouting(this.agentContext)
    message.service = new ServiceDecorator({
      serviceEndpoint: routing.endpoints[0],
      recipientKeys: [routing.recipientKey.publicKeyBase58],
      routingKeys: routing.routingKeys.map((key) => key.publicKeyBase58),
    })

    // Save ~service decorator to record (to remember our verkey)
    proofRecord.requestMessage = message
    await this.proofService.update(this.agentContext, proofRecord)

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
  public async acceptRequest(
    proofRecordId: string,
    requestedCredentials: RequestedCredentials,
    config?: {
      comment?: string
    }
  ): Promise<ProofRecord> {
    const record = await this.proofService.getById(this.agentContext, proofRecordId)
    const { message, proofRecord } = await this.proofService.createPresentation(
      this.agentContext,
      record,
      requestedCredentials,
      config
    )

    // Use connection if present
    if (proofRecord.connectionId) {
      const connection = await this.connectionService.getById(this.agentContext, proofRecord.connectionId)

      const outboundMessage = createOutboundMessage(connection, message)
      await this.messageSender.sendMessage(this.agentContext, outboundMessage)

      return proofRecord
    }
    // Use ~service decorator otherwise
    else if (proofRecord.requestMessage?.service) {
      // Create ~service decorator
      const routing = await this.routingService.getRouting(this.agentContext)
      const ourService = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.recipientKey.publicKeyBase58],
        routingKeys: routing.routingKeys.map((key) => key.publicKeyBase58),
      })

      const recipientService = proofRecord.requestMessage.service

      // Set and save ~service decorator to record (to remember our verkey)
      message.service = ourService
      proofRecord.presentationMessage = message
      await this.proofService.update(this.agentContext, proofRecord)

      await this.messageSender.sendMessageToService(this.agentContext, {
        message,
        service: recipientService.resolvedDidCommService,
        senderKey: ourService.resolvedDidCommService.recipientKeys[0],
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
  public async declineRequest(proofRecordId: string) {
    const proofRecord = await this.proofService.getById(this.agentContext, proofRecordId)
    await this.proofService.declineRequest(this.agentContext, proofRecord)
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
    const record = await this.proofService.getById(this.agentContext, proofRecordId)
    const { message, proofRecord } = await this.proofService.createAck(this.agentContext, record)

    // Use connection if present
    if (proofRecord.connectionId) {
      const connection = await this.connectionService.getById(this.agentContext, proofRecord.connectionId)
      const outboundMessage = createOutboundMessage(connection, message)
      await this.messageSender.sendMessage(this.agentContext, outboundMessage)
    }
    // Use ~service decorator otherwise
    else if (proofRecord.requestMessage?.service && proofRecord.presentationMessage?.service) {
      const recipientService = proofRecord.presentationMessage?.service
      const ourService = proofRecord.requestMessage.service

      await this.messageSender.sendMessageToService(this.agentContext, {
        message,
        service: recipientService.resolvedDidCommService,
        senderKey: ourService.resolvedDidCommService.recipientKeys[0],
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
   */
  public async getRequestedCredentialsForProofRequest(
    proofRecordId: string,
    config?: GetRequestedCredentialsConfig
  ): Promise<RetrievedCredentials> {
    const proofRecord = await this.proofService.getById(this.agentContext, proofRecordId)

    const indyProofRequest = proofRecord.requestMessage?.indyProofRequest
    const presentationPreview = config?.filterByPresentationPreview
      ? proofRecord.proposalMessage?.presentationProposal
      : undefined

    if (!indyProofRequest) {
      throw new AriesFrameworkError(
        'Unable to get requested credentials for proof request. No proof request message was found or the proof request message does not contain an indy proof request.'
      )
    }

    return this.proofService.getRequestedCredentialsForProofRequest(this.agentContext, indyProofRequest, {
      presentationProposal: presentationPreview,
      filterByNonRevocationRequirements: config?.filterByNonRevocationRequirements ?? true,
    })
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
  public autoSelectCredentialsForProofRequest(retrievedCredentials: RetrievedCredentials): RequestedCredentials {
    return this.proofService.autoSelectCredentialsForProofRequest(retrievedCredentials)
  }

  /**
   * Send problem report message for a proof record
   * @param proofRecordId  The id of the proof record for which to send problem report
   * @param message message to send
   * @returns proof record associated with the proof problem report message
   */
  public async sendProblemReport(proofRecordId: string, message: string) {
    const record = await this.proofService.getById(this.agentContext, proofRecordId)
    if (!record.connectionId) {
      throw new AriesFrameworkError(`No connectionId found for proof record '${record.id}'.`)
    }
    const connection = await this.connectionService.getById(this.agentContext, record.connectionId)
    const presentationProblemReportMessage = new PresentationProblemReportMessage({
      description: {
        en: message,
        code: PresentationProblemReportReason.Abandoned,
      },
    })
    presentationProblemReportMessage.setThread({
      threadId: record.threadId,
    })
    const outboundMessage = createOutboundMessage(connection, presentationProblemReportMessage)
    await this.messageSender.sendMessage(this.agentContext, outboundMessage)

    return record
  }

  /**
   * Retrieve all proof records
   *
   * @returns List containing all proof records
   */
  public getAll(): Promise<ProofRecord[]> {
    return this.proofService.getAll(this.agentContext)
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
    return this.proofService.getById(this.agentContext, proofRecordId)
  }

  /**
   * Retrieve a proof record by id
   *
   * @param proofRecordId The proof record id
   * @return The proof record or null if not found
   *
   */
  public async findById(proofRecordId: string): Promise<ProofRecord | null> {
    return this.proofService.findById(this.agentContext, proofRecordId)
  }

  /**
   * Delete a proof record by id
   *
   * @param proofId the proof record id
   */
  public async deleteById(proofId: string) {
    return this.proofService.deleteById(this.agentContext, proofId)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(
      new ProposePresentationHandler(this.proofService, this.proofResponseCoordinator, this.logger)
    )
    dispatcher.registerHandler(
      new RequestPresentationHandler(this.proofService, this.proofResponseCoordinator, this.routingService, this.logger)
    )
    dispatcher.registerHandler(new PresentationHandler(this.proofService, this.proofResponseCoordinator, this.logger))
    dispatcher.registerHandler(new PresentationAckHandler(this.proofService))
    dispatcher.registerHandler(new PresentationProblemReportHandler(this.proofService))
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
   *
   * @default false
   */
  filterByPresentationPreview?: boolean

  /**
   * Whether to filter the retrieved credentials using the non-revocation request in the proof request.
   * This configuration will only have effect if the proof request requires proof on non-revocation of any kind.
   * Default to true
   *
   * @default true
   */
  filterByNonRevocationRequirements?: boolean
}
