import type { AgentMessage } from '../../../../agent/AgentMessage'
import type { HandlerInboundMessage } from '../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../../logger'
import type { ProofStateChangedEvent } from '../../ProofEvents'
import type { CreatePresentationOptions, CreateRequestOptions } from '../../formats/ProofFormatService'
import type { AutoAcceptProof } from '../../models/ProofAutoAcceptType'
import type {
  CreateProposalAsResponseOptions,
  CreateProposalOptions,
  CreateRequestAsResponseOptions,
  PresentationOptions,
  RequestProofOptions,
} from '../../models/ServiceOptions'
import type { ProofAttributeInfo } from './models'
import type { CredDef, IndyProof, Schema } from 'indy-sdk'
import type { Attachment } from 'packages/core/src/decorators/attachment/Attachment'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { ProofRepository } from '../..'
import { AgentConfig } from '../../../../agent/AgentConfig'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../../constants'
import { Wallet } from '../../../../wallet'
import { ConnectionService } from '../../../connections'
import { CredentialRepository } from '../../../credentials/repository'
import { IndyHolderService, IndyVerifierService } from '../../../indy/services'
import { IndyLedgerService } from '../../../ledger/services/IndyLedgerService'
import { ProofEventTypes } from '../../ProofEvents'
import { ProofService } from '../../ProofService'
import { PresentationProblemReportError, PresentationProblemReportReason } from '../../errors'
import { IndyProofFormatService } from '../../formats/indy/IndyProofFormatService'
import { ProofProtocolVersion } from '../../models/ProofProtocolVersion'
import { ProofState } from '../../models/ProofState'
import { ProofRecord } from '../../repository/ProofRecord'

import {
  INDY_PROOF_ATTACHMENT_ID,
  INDY_PROOF_REQUEST_ATTACHMENT_ID,
  PresentationMessage,
  ProposePresentationMessage,
  RequestPresentationMessage,
} from './messages'
import { ProofRequest, RequestedCredentials, RequestedPredicate } from './models'
import { PresentationPreview } from './models/PresentationPreview'

import { AttachmentData } from 'packages/core/src/decorators/attachment/Attachment'
import { JsonEncoder } from 'packages/core/src/utils/JsonEncoder'

// const logger = new ConsoleLogger(LogLevel.debug)

/**
 * @todo add method to check if request matches proposal. Useful to see if a request I received is the same as the proposal I sent.
 * @todo add method to reject / revoke messages
 * @todo validate attachments / messages
 */
@scoped(Lifecycle.ContainerScoped)
export class V1ProofService extends ProofService {
  private proofRepository: ProofRepository
  private credentialRepository: CredentialRepository
  private ledgerService: IndyLedgerService
  private wallet: Wallet
  private logger: Logger
  private indyHolderService: IndyHolderService
  private indyVerifierService: IndyVerifierService
  private connectionService: ConnectionService
  private eventEmitter: EventEmitter
  private indyProofFormatService: IndyProofFormatService

  public constructor(
    proofRepository: ProofRepository,
    ledgerService: IndyLedgerService,
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    agentConfig: AgentConfig,
    indyHolderService: IndyHolderService,
    indyVerifierService: IndyVerifierService,
    connectionService: ConnectionService,
    eventEmitter: EventEmitter,
    credentialRepository: CredentialRepository,
    indyProofFormatService: IndyProofFormatService
  ) {
    super()
    this.proofRepository = proofRepository
    this.credentialRepository = credentialRepository
    this.ledgerService = ledgerService
    this.wallet = wallet
    this.logger = agentConfig.logger
    this.indyHolderService = indyHolderService
    this.indyVerifierService = indyVerifierService
    this.connectionService = connectionService
    this.eventEmitter = eventEmitter
    this.indyProofFormatService = indyProofFormatService
  }

  public getVersion(): ProofProtocolVersion {
    return ProofProtocolVersion.V1_0
  }

  public async createProposal(
    options: CreateProposalOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    const { connectionRecord, proofFormats } = options

    const presentationProposal = proofFormats.indy?.proofPreview
      ? new PresentationPreview({
          attributes: proofFormats.indy?.proofPreview.attributes,
          predicates: proofFormats.indy?.proofPreview.predicates,
        })
      : new PresentationPreview({
          attributes: [],
          predicates: [],
        })

    // Assert
    connectionRecord.assertReady()

    // Create message
    const proposalMessage = new ProposePresentationMessage({
      comment: options?.comment,
      presentationProposal,
    })

    // Create record
    const proofRecord = new ProofRecord({
      connectionId: connectionRecord.id,
      threadId: proposalMessage.threadId,
      state: ProofState.ProposalSent,
      proposalMessage,
      autoAcceptProof: options?.autoAcceptProof,
    })

    await this.proofRepository.save(proofRecord)
    this.eventEmitter.emit<ProofStateChangedEvent>({
      type: ProofEventTypes.ProofStateChanged,
      payload: { proofRecord, previousState: null },
    })

    return { proofRecord, message: proposalMessage }
  }

  public createProposalAsResponse(
    options: CreateProposalAsResponseOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    throw new Error('Method not implemented.')
  }

  public processProposal(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    throw new Error('Method not implemented.')
  }

  public async createRequest(
    options: RequestProofOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    this.logger.debug(`Creating proof request`)
    const { connectionRecord, proofFormats } = options

    const proofRequest = proofFormats.indy?.proofRequest
      ? new ProofRequest({
          name: proofFormats.indy?.proofRequest.name,
          nonce: proofFormats.indy?.proofRequest.nonce,
          version: proofFormats.indy?.proofRequest.nonce,
          requestedAttributes: proofFormats.indy?.proofRequest.requestedAttributes,
          requestedPredicates: proofFormats.indy?.proofRequest.requestedPredicates,
        })
      : new ProofRequest({
          name: 'proof-request',
          version: '1.0',
          nonce: '',
          requestedAttributes: {},
          requestedPredicates: {},
        })

    // Assert
    connectionRecord?.assertReady()

    // Create message
    const createRequestOptions: CreateRequestOptions = {
      attachId: INDY_PROOF_REQUEST_ATTACHMENT_ID,
      messageType: 'V1_PROOF',
      proofRequest,
    }
    const { attachment } = await this.indyProofFormatService.createRequest(createRequestOptions)

    const requestPresentationMessage = new RequestPresentationMessage({
      comment: options?.comment,
      requestPresentationAttachments: [attachment],
    })

    // Create record
    const proofRecord = new ProofRecord({
      connectionId: connectionRecord?.id,
      threadId: requestPresentationMessage.threadId,
      requestMessage: requestPresentationMessage,
      state: ProofState.RequestSent,
      autoAcceptProof: options?.autoAcceptProof,
    })

    await this.proofRepository.save(proofRecord)
    this.eventEmitter.emit<ProofStateChangedEvent>({
      type: ProofEventTypes.ProofStateChanged,
      payload: { proofRecord, previousState: null },
    })

    return { message: requestPresentationMessage, proofRecord }
  }

  public createRequestAsResponse(
    options: CreateRequestAsResponseOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    throw new Error('Method not implemented.')
  }

  public processRequest(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    throw new Error('Method not implemented.')
  }

  public async createPresentation(
    options: PresentationOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    const { proofRecord, proofFormats } = options
    const requestedCredentials = proofFormats.indy
      ? new RequestedCredentials({
          requestedAttributes: proofFormats.indy.requestedAttributes,
          requestedPredicates: proofFormats.indy.requestedPredicates,
          selfAttestedAttributes: proofFormats.indy.selfAttestedAttributes,
        })
      : new RequestedCredentials({
          requestedAttributes: {},
          requestedPredicates: {},
          selfAttestedAttributes: {},
        })

    this.logger.debug(`Creating presentation for proof record with id ${proofRecord.id}`)

    // Assert
    proofRecord.assertState(ProofState.RequestReceived)

    const indyProofRequest = proofRecord.requestMessage?.indyProofRequest
    if (!indyProofRequest) {
      throw new PresentationProblemReportError(
        `Missing required base64 or json encoded attachment data for presentation with thread id ${proofRecord.threadId}`,
        { problemCode: PresentationProblemReportReason.Abandoned }
      )
    }

    // Get the matching attachments to the requested credentials
    const attachments = await this.indyProofFormatService.getRequestedAttachmentsForRequestedCredentials(
      indyProofRequest,
      requestedCredentials
    )

    // Create proof
    const proof = await this.createProof(indyProofRequest, requestedCredentials)

    // Create payload
    const createPresentationOptions: CreatePresentationOptions = {
      attachId: INDY_PROOF_ATTACHMENT_ID,
      messageType: 'V1_PROOF',
      attachData: new AttachmentData({
        base64: JsonEncoder.toBase64(proof),
      }),
    }

    // Create indy attachment
    const { attachment } = await this.indyProofFormatService.createPresentation(createPresentationOptions)

    const presentationMessage = new PresentationMessage({
      comment: options?.comment,
      presentationAttachments: [attachment],
      attachments,
    })
    presentationMessage.setThread({ threadId: proofRecord.threadId })

    // Update record
    proofRecord.presentationMessage = presentationMessage
    await this.updateState(proofRecord, ProofState.PresentationSent)

    return { message: presentationMessage, proofRecord }
  }

  public processPresentation(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    throw new Error('Method not implemented.')
  }

  public createAck(options: CreateAckOptions): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    throw new Error('Method not implemented.')
  }

  public processAck(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    throw new Error('Method not implemented.')
  }

  public createProblemReport(
    options: CreateProblemReportOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    throw new Error('Method not implemented.')
  }

  public processProblemReport(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    throw new Error('Method not implemented.')
  }

  public getRequestedCredentialsForProofRequest(options: {
    proofRecord: ProofRecord
  }): Promise<{ indy?: RetrievedCredentials | undefined; w3c?: undefined }> {
    throw new Error('Method not implemented.')
  }

  /**
   * Create indy proof from a given proof request and requested credential object.
   *
   * @param proofRequest The proof request to create the proof for
   * @param requestedCredentials The requested credentials object specifying which credentials to use for the proof
   * @returns indy proof object
   */
  private async createProof(
    proofRequest: ProofRequest,
    requestedCredentials: RequestedCredentials
  ): Promise<IndyProof> {
    const credentialObjects = [
      ...Object.values(requestedCredentials.requestedAttributes),
      ...Object.values(requestedCredentials.requestedPredicates),
    ].map((c) => c.credentialInfo)

    const schemas = await this.getSchemas(new Set(credentialObjects.map((c) => c.schemaId)))
    const credentialDefinitions = await this.getCredentialDefinitions(
      new Set(credentialObjects.map((c) => c.credentialDefinitionId))
    )

    const proof = await this.indyHolderService.createProof({
      proofRequest: proofRequest.toJSON(),
      requestedCredentials: requestedCredentials.toJSON(),
      schemas,
      credentialDefinitions,
    })

    return proof
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param proofRecord The proof record to update the state for
   * @param newState The state to update to
   *
   */
  private async updateState(proofRecord: ProofRecord, newState: ProofState) {
    const previousState = proofRecord.state
    proofRecord.state = newState
    await this.proofRepository.update(proofRecord)

    this.eventEmitter.emit<ProofStateChangedEvent>({
      type: ProofEventTypes.ProofStateChanged,
      payload: { proofRecord, previousState: previousState },
    })
  }

  /**
   * Build schemas object needed to create and verify proof objects.
   *
   * Creates object with `{ schemaId: Schema }` mapping
   *
   * @param schemaIds List of schema ids
   * @returns Object containing schemas for specified schema ids
   *
   */
  private async getSchemas(schemaIds: Set<string>) {
    const schemas: { [key: string]: Schema } = {}

    for (const schemaId of schemaIds) {
      const schema = await this.ledgerService.getSchema(schemaId)
      schemas[schemaId] = schema
    }

    return schemas
  }

  /**
   * Build credential definitions object needed to create and verify proof objects.
   *
   * Creates object with `{ credentialDefinitionId: CredentialDefinition }` mapping
   *
   * @param credentialDefinitionIds List of credential definition ids
   * @returns Object containing credential definitions for specified credential definition ids
   *
   */
  private async getCredentialDefinitions(credentialDefinitionIds: Set<string>) {
    const credentialDefinitions: { [key: string]: CredDef } = {}

    for (const credDefId of credentialDefinitionIds) {
      const credDef = await this.ledgerService.getCredentialDefinition(credDefId)
      credentialDefinitions[credDefId] = credDef
    }

    return credentialDefinitions
  }
}
