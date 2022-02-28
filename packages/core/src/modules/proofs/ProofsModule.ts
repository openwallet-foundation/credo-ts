import type { ProofService } from './ProofService'
import type { GetRequestedCredentialsConfig } from './models/GetRequestedCredentialsConfig'
import type {
  AcceptPresentationOptions,
  AcceptProposalOptions,
  ProposeProofOptions,
  RequestProofsOptions,
} from './models/ModuleOptions'
import type { AutoAcceptProof } from './models/ProofAutoAcceptType'
import type {
  CreatePresentationOptions,
  CreateProposalOptions,
  CreateRequestOptions,
} from './models/ProofServiceOptions'
import type { ProofRequestOptions, RequestedCredentials, RetrievedCredentials } from './protocol/v1/models'
import type { ProofRecord } from './repository/ProofRecord'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { ServiceDecorator } from '../../decorators/service/ServiceDecorator'
import { AriesFrameworkError } from '../../error'
import { DidCommMessageRole } from '../../storage'
import { ConnectionService } from '../connections/services/ConnectionService'
import { MediationRecipientService } from '../routing/services/MediationRecipientService'

import { ProofResponseCoordinator } from './ProofResponseCoordinator'
import { ProofProtocolVersion } from './models/ProofProtocolVersion'
import { V1ProofService } from './protocol/v1/V1ProofService'
import { V2ProofService } from './protocol/v2/V2ProofService'

@scoped(Lifecycle.ContainerScoped)
export class ProofsModule {
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private agentConfig: AgentConfig
  private mediationRecipientService: MediationRecipientService
  private serviceMap: { [key in ProofProtocolVersion]: ProofService }

  public constructor(
    dispatcher: Dispatcher,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService,
    v1ProofService: V1ProofService,
    v2ProofService: V2ProofService
  ) {
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.agentConfig = agentConfig
    this.mediationRecipientService = mediationRecipientService

    this.serviceMap = {
      [ProofProtocolVersion.V1_0]: v1ProofService,
      [ProofProtocolVersion.V2_0]: v2ProofService,
    }

    this.registerHandlers(dispatcher, mediationRecipientService)
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
    const { proofRecordId } = options
    const proofRecord = await service.getById(proofRecordId)

    if (!proofRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${proofRecord.id}'. Connection-less issuance does not support presentation proposal or negotiation.`
      )
    }

    const connection = await this.connectionService.getById(proofRecord.connectionId)
    // console.log('indy:', options.proofFormats.indy)
    // console.log('preview:', options.proofFormats.indy?.proofPreview)

    // // const presentationProposal = proofRecord.proposalMessage?.presentationProposal
    // const presentationProposal = options.proofFormats.indy?.proofPreview

    // console.log('presentationProposal:', presentationProposal)

    // if (!presentationProposal) {
    //   throw new AriesFrameworkError(`Proof record with id ${proofRecordId} is missing required presentation proposal`)
    // }

    const proofRequest = await service.createProofRequestFromProposal({
      formats: {
        indy: {
          proofRecord,
        },
      },
      config: {
        indy: {
          name: 'proof request',
          version: '1.0',
          nonce: '1298236324864',
        },
      },
    })

    const { message } = await service.createRequestAsResponse({
      proofRecord: proofRecord,
      protocolVersion: version,
      proofFormats: proofRequest,
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

    const connection = await this.connectionService.getById(options.connectionId)

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

  // /**
  //  * Initiate a new presentation exchange as verifier by creating a presentation request
  //  * not bound to any connection. The request must be delivered out-of-band to the holder
  //  *
  //  * @param proofRequestOptions Options to build the proof request
  //  * @returns The proof record and proof request message
  //  *
  //  */
  // public async createOutOfBandRequest(options: CreateOutOfBandRequestOptions): Promise<{
  //   requestMessage: V1RequestPresentationMessage
  //   proofRecord: ProofRecord
  // }> {
  //   const { proofRequestOptions } = options
  //   const version: ProofProtocolVersion = options.protocolVersion

  //   const service = this.getService(version)

  //   const nonce = proofRequestOptions.nonce ?? (await service.generateProofRequestNonce())

  //   const proofRequest = new ProofRequest({
  //     name: proofRequestOptions.name ?? 'proof-request',
  //     version: proofRequestOptions.name ?? '1.0',
  //     nonce,
  //     requestedAttributes: proofRequestOptions.requestedAttributes,
  //     requestedPredicates: proofRequestOptions.requestedPredicates,
  //   })

  //   const createProofRequest: CreateRequestOptions = {
  //     connectionRecord: undefined,
  //     proofFormats: proofRequest,
  //     protocolVersion: version,
  //     autoAcceptProof: options.autoAcceptProof,
  //     comment: options.comment,
  //   }

  //   const { message, proofRecord } = await service.createRequest(createProofRequest)

  //   // Create and set ~service decorator
  //   const routing = await this.mediationRecipientService.getRouting()
  //   message.service = new ServiceDecorator({
  //     serviceEndpoint: routing.endpoints[0],
  //     recipientKeys: [routing.verkey],
  //     routingKeys: routing.routingKeys,
  //   })

  //   // Save ~service decorator to record (to remember our verkey)
  //   proofRecord.requestMessage = message
  //   await service.update(proofRecord)

  //   return { proofRecord, requestMessage: message }
  // }

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
    const presentationOptions: CreatePresentationOptions = {
      proofFormats,
      proofRecord: record,
      protocolVersion: version,
      comment,
    }
    const { message, proofRecord } = await service.createPresentation(presentationOptions)

    const requestMessage = await service.findRequestMessage({ proofRecord: proofRecord })

    // Use connection if present
    if (proofRecord.connectionId) {
      const connection = await this.connectionService.getById(proofRecord.connectionId)

      const outboundMessage = createOutboundMessage(connection, message)
      await this.messageSender.sendMessage(outboundMessage)

      return proofRecord
    }

    // Use ~service decorator otherwise
    else if (requestMessage?.service) {
      // Create ~service decorator
      const routing = await this.mediationRecipientService.getRouting()
      const ourService = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.verkey],
        routingKeys: routing.routingKeys,
      })

      const recipientService = requestMessage.service

      // Set and save ~service decorator to record (to remember our verkey)
      message.service = ourService

      await service.saveOrUpdatePresentationMessage({
        proofRecord: proofRecord,
        message: message,
        role: DidCommMessageRole.Sender,
      })

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
    const { message, proofRecord } = await service.createAck({
      proofRecord: record,
    })

    // Use connection if present
    if (proofRecord.connectionId) {
      const connection = await this.connectionService.getById(proofRecord.connectionId)
      const outboundMessage = createOutboundMessage(connection, message)
      await this.messageSender.sendMessage(outboundMessage)
    }
    // Use ~service decorator otherwise
    else {
      const requestMessage = await service.findRequestMessage({
        proofRecord: record,
      })

      const presentationMessage = await service.findPresentationMessage({
        proofRecord: record,
      })

      if (requestMessage?.service && presentationMessage?.service) {
        const recipientService = presentationMessage.service
        const ourService = requestMessage.service

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
    }
    return record
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
  ): Promise<{
    indy?: RetrievedCredentials
    jsonLd?: never
  }> {
    const service = this.getService(version)

    const proofRecord = await service.getById(proofRecordId)

    return service.getRequestedCredentialsForProofRequest({
      proofRecord: proofRecord,
      config: {
        indy: config,
      },
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
  public async autoSelectCredentialsForProofRequest(options: {
    formats: {
      indy?: RetrievedCredentials
      jsonLd?: never
    }
    version: ProofProtocolVersion
  }): Promise<{
    indy?: RequestedCredentials
    jsonLd?: never
  }> {
    const service = this.getService(options.version)
    return await service.autoSelectCredentialsForProofRequest(options.formats)
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
    return this.serviceMap['1.0'].getAll()
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
    return this.serviceMap['1.0'].getById(proofRecordId)
  }

  /**
   * Retrieve a proof record by id
   *
   * @param proofRecordId The proof record id
   * @return The proof record or null if not found
   *
   */
  public async findById(proofRecordId: string): Promise<ProofRecord | null> {
    return this.serviceMap['1.0'].findById(proofRecordId)
  }

  /**
   * Delete a proof record by id
   *
   * @param proofId the proof record id
   */
  public async deleteById(proofId: string) {
    return this.serviceMap['1.0'].deleteById(proofId)
  }

  private async registerHandlers(dispatcher: Dispatcher, mediationRecipientService: MediationRecipientService) {
    for (const service of Object.values(this.serviceMap)) {
      await service.registerHandlers(
        dispatcher,
        this.agentConfig,
        new ProofResponseCoordinator(this.agentConfig, service),
        mediationRecipientService
      )
    }
  }
}

export type CreateProofRequestOptions = Partial<
  Pick<ProofRequestOptions, 'name' | 'nonce' | 'requestedAttributes' | 'requestedPredicates'>
>

export interface ProofRequestConfig {
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}
