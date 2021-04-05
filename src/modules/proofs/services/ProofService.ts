import type { IndyProof, Schema, CredDef } from 'indy-sdk'

import { EventEmitter } from 'events'
import { validateOrReject } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'
import { LedgerService } from '../../ledger/services/LedgerService'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { ConnectionRecord } from '../../connections'
import { ProofRecord } from '../repository/ProofRecord'
import { Repository } from '../../../storage/Repository'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { uuid } from '../../../utils/uuid'
import { Wallet } from '../../../wallet/Wallet'
import { CredentialUtils, Credential, CredentialInfo } from '../../credentials'

import {
  PresentationMessage,
  PresentationPreview,
  PresentationPreviewAttribute,
  ProposePresentationMessage,
  RequestPresentationMessage,
  PresentationAckMessage,
  INDY_PROOF_REQUEST_ATTACHMENT_ID,
  INDY_PROOF_ATTACHMENT_ID,
} from '../messages'
import { AckStatus } from '../../common'
import {
  PartialProof,
  ProofAttributeInfo,
  AttributeFilter,
  ProofPredicateInfo,
  ProofRequest,
  RequestedCredentials,
  RequestedAttribute,
  RequestedPredicate,
} from '../models'
import { ProofState } from '../ProofState'
import { AgentConfig } from '../../../agent/AgentConfig'
import { Logger } from '../../../logger'

export enum ProofEventType {
  StateChanged = 'stateChanged',
}

export interface ProofStateChangedEvent {
  proofRecord: ProofRecord
  previousState: ProofState
}

export interface ProofProtocolMsgReturnType<MessageType extends AgentMessage> {
  message: MessageType
  proofRecord: ProofRecord
}

/**
 * @todo add method to check if request matches proposal. Useful to see if a request I received is the same as the proposal I sent.
 * @todo add method to reject / revoke messages
 * @todo validate attachments / messages
 */
export class ProofService extends EventEmitter {
  private proofRepository: Repository<ProofRecord>
  private ledgerService: LedgerService
  private wallet: Wallet
  private logger: Logger

  public constructor(
    proofRepository: Repository<ProofRecord>,
    ledgerService: LedgerService,
    wallet: Wallet,
    agentConfig: AgentConfig
  ) {
    super()

    this.proofRepository = proofRepository
    this.ledgerService = ledgerService
    this.wallet = wallet
    this.logger = agentConfig.logger
  }

  /**
   * Create a {@link ProposePresentationMessage} not bound to an existing presentation exchange.
   * To create a proposal as response to an existing presentation exchange, use {@link ProofService#createProposalAsResponse}.
   *
   * @param connectionRecord The connection for which to create the presentation proposal
   * @param presentationProposal The presentation proposal to include in the message
   * @param config Additional configuration to use for the proposal
   * @returns Object containing proposal message and associated proof record
   *
   */
  public async createProposal(
    connectionRecord: ConnectionRecord,
    presentationProposal: PresentationPreview,
    config?: {
      comment?: string
    }
  ): Promise<ProofProtocolMsgReturnType<ProposePresentationMessage>> {
    // Assert
    connectionRecord.assertReady()

    // Create message
    const proposalMessage = new ProposePresentationMessage({
      comment: config?.comment,
      presentationProposal,
    })

    // Create record
    const proofRecord = new ProofRecord({
      connectionId: connectionRecord.id,
      state: ProofState.ProposalSent,
      proposalMessage,
      tags: { threadId: proposalMessage.threadId },
    })
    await this.proofRepository.save(proofRecord)
    this.emit(ProofEventType.StateChanged, { proofRecord, previousState: null })

    return { message: proposalMessage, proofRecord }
  }

  /**
   * Create a {@link ProposePresentationMessage} as response to a received presentation request.
   * To create a proposal not bound to an existing presentation exchange, use {@link ProofService#createProposal}.
   *
   * @param proofRecord The proof record for which to create the presentation proposal
   * @param presentationProposal The presentation proposal to include in the message
   * @param config Additional configuration to use for the proposal
   * @returns Object containing proposal message and associated proof record
   *
   */
  public async createProposalAsResponse(
    proofRecord: ProofRecord,
    presentationProposal: PresentationPreview,
    config?: {
      comment?: string
    }
  ): Promise<ProofProtocolMsgReturnType<ProposePresentationMessage>> {
    // Assert
    proofRecord.assertState(ProofState.RequestReceived)

    // Create message
    const proposalMessage = new ProposePresentationMessage({
      comment: config?.comment,
      presentationProposal,
    })
    proposalMessage.setThread({ threadId: proofRecord.tags.threadId })

    // Update record
    proofRecord.proposalMessage = proposalMessage
    this.updateState(proofRecord, ProofState.ProposalSent)

    return { message: proposalMessage, proofRecord }
  }

  /**
   * Process a received {@link ProposePresentationMessage}. This will not accept the presentation proposal
   * or send a presentation request. It will only create a new, or update the existing proof record with
   * the information from the presentation proposal message. Use {@link ProofService#createRequestAsResponse}
   * after calling this method to create a presentation request.
   *
   * @param messageContext The message context containing a presentation proposal message
   * @returns proof record associated with the presentation proposal message
   *
   */
  public async processProposal(
    messageContext: InboundMessageContext<ProposePresentationMessage>
  ): Promise<ProofRecord> {
    let proofRecord: ProofRecord
    const { message: proposalMessage, connection } = messageContext

    // Assert connection
    connection?.assertReady()
    if (!connection) {
      throw new Error(
        `No connection associated with incoming presentation proposal message with thread id ${proposalMessage.threadId}`
      )
    }

    try {
      // Proof record already exists
      proofRecord = await this.getByThreadId(proposalMessage.threadId)

      // Assert
      proofRecord.assertState(ProofState.RequestSent)
      proofRecord.assertConnection(connection.id)

      // Update record
      proofRecord.proposalMessage = proposalMessage
      await this.updateState(proofRecord, ProofState.ProposalReceived)
    } catch {
      // No proof record exists with thread id
      proofRecord = new ProofRecord({
        connectionId: connection.id,
        proposalMessage,
        state: ProofState.ProposalReceived,
        tags: { threadId: proposalMessage.threadId },
      })

      // Save record
      await this.proofRepository.save(proofRecord)
      this.emit(ProofEventType.StateChanged, {
        proofRecord,
        previousState: null,
      })
    }

    return proofRecord
  }

  /**
   * Create a {@link RequestPresentationMessage} as response to a received presentation proposal.
   * To create a request not bound to an existing presentation exchange, use {@link ProofService#createRequest}.
   *
   * @param proofRecord The proof record for which to create the presentation request
   * @param proofRequest The proof request to include in the message
   * @param config Additional configuration to use for the request
   * @returns Object containing request message and associated proof record
   *
   */
  public async createRequestAsResponse(
    proofRecord: ProofRecord,
    proofRequest: ProofRequest,
    config?: {
      comment?: string
    }
  ): Promise<ProofProtocolMsgReturnType<RequestPresentationMessage>> {
    // Assert
    proofRecord.assertState(ProofState.ProposalReceived)

    // Create message
    const attachment = new Attachment({
      id: INDY_PROOF_REQUEST_ATTACHMENT_ID,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(proofRequest),
      }),
    })
    const requestPresentationMessage = new RequestPresentationMessage({
      comment: config?.comment,
      attachments: [attachment],
    })
    requestPresentationMessage.setThread({
      threadId: proofRecord.tags.threadId,
    })

    // Update record
    proofRecord.requestMessage = requestPresentationMessage
    await this.updateState(proofRecord, ProofState.RequestSent)

    return { message: requestPresentationMessage, proofRecord }
  }

  /**
   * Create a {@link RequestPresentationMessage} not bound to an existing presentation exchange.
   * To create a request as response to an existing presentation exchange, use {@link ProofService#createRequestAsResponse}.
   *
   * @param connectionRecord The connection for which to create the presentation request
   * @param proofRequest The proof request to include in the message
   * @param config Additional configuration to use for the request
   * @returns Object containing request message and associated proof record
   *
   */
  public async createRequest(
    connectionRecord: ConnectionRecord,
    proofRequest: ProofRequest,
    config?: {
      comment?: string
    }
  ): Promise<ProofProtocolMsgReturnType<RequestPresentationMessage>> {
    // Assert
    connectionRecord.assertReady()

    // Create message
    const attachment = new Attachment({
      id: INDY_PROOF_REQUEST_ATTACHMENT_ID,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(proofRequest),
      }),
    })
    const requestPresentationMessage = new RequestPresentationMessage({
      comment: config?.comment,
      attachments: [attachment],
    })

    // Create record
    const proofRecord = new ProofRecord({
      connectionId: connectionRecord.id,
      requestMessage: requestPresentationMessage,
      state: ProofState.RequestSent,
      tags: { threadId: requestPresentationMessage.threadId },
    })

    await this.proofRepository.save(proofRecord)
    this.emit(ProofEventType.StateChanged, { proofRecord, previousState: null })

    return { message: requestPresentationMessage, proofRecord }
  }

  /**
   * Process a received {@link RequestPresentationMessage}. This will not accept the presentation request
   * or send a presentation. It will only create a new, or update the existing proof record with
   * the information from the presentation request message. Use {@link ProofService#createPresentation}
   * after calling this method to create a presentation.
   *
   * @param messageContext The message context containing a presentation request message
   * @returns proof record associated with the presentation request message
   *
   */
  public async processRequest(messageContext: InboundMessageContext<RequestPresentationMessage>): Promise<ProofRecord> {
    let proofRecord: ProofRecord
    const { message: proofRequestMessage, connection } = messageContext

    // Assert connection
    connection?.assertReady()
    if (!connection) {
      throw new Error(
        `No connection associated with incoming presentation request message with thread id ${proofRequestMessage.threadId}`
      )
    }

    const proofRequest = proofRequestMessage.indyProofRequest

    // Assert attachment
    if (!proofRequest) {
      throw new Error(
        `Missing required base64 encoded attachment data for presentation request with thread id ${proofRequestMessage.threadId}`
      )
    }
    await validateOrReject(proofRequest)

    this.logger.debug('received proof request', proofRequest)

    try {
      // Proof record already exists
      proofRecord = await this.getByThreadId(proofRequestMessage.threadId)

      // Assert
      proofRecord.assertState(ProofState.ProposalSent)
      proofRecord.assertConnection(connection.id)

      // Update record
      proofRecord.requestMessage = proofRequestMessage
      await this.updateState(proofRecord, ProofState.RequestReceived)
    } catch {
      // No proof record exists with thread id
      proofRecord = new ProofRecord({
        connectionId: connection.id,
        requestMessage: proofRequestMessage,
        state: ProofState.RequestReceived,
        tags: { threadId: proofRequestMessage.threadId },
      })

      // Save in repository
      await this.proofRepository.save(proofRecord)
      this.emit(ProofEventType.StateChanged, {
        proofRecord,
        previousState: null,
      })
    }

    return proofRecord
  }

  /**
   * Create a {@link PresentationMessage} as response to a received presentation request.
   *
   * @param proofRecord The proof record for which to create the presentation
   * @param requestedCredentials The requested credentials object specifying which credentials to use for the proof
   * @param config Additional configuration to use for the presentation
   * @returns Object containing presentation message and associated proof record
   *
   */
  public async createPresentation(
    proofRecord: ProofRecord,
    requestedCredentials: RequestedCredentials,
    config?: {
      comment?: string
    }
  ): Promise<ProofProtocolMsgReturnType<PresentationMessage>> {
    // Assert
    proofRecord.assertState(ProofState.RequestReceived)

    // Transform proof request to class instance if this is not already the case
    // FIXME: proof record should handle transformation
    const requestMessage =
      proofRecord.requestMessage instanceof RequestPresentationMessage
        ? proofRecord.requestMessage
        : JsonTransformer.fromJSON(proofRecord.requestMessage, RequestPresentationMessage)

    const indyProofRequest = requestMessage.indyProofRequest
    if (!indyProofRequest) {
      throw new Error(
        `Missing required base64 encoded attachment data for presentation with thread id ${proofRecord.tags.threadId}`
      )
    }

    // Create proof
    const proof = await this.createProof(indyProofRequest, requestedCredentials)

    // Create message
    const attachment = new Attachment({
      id: INDY_PROOF_ATTACHMENT_ID,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(proof),
      }),
    })
    const presentationMessage = new PresentationMessage({
      comment: config?.comment,
      attachments: [attachment],
    })
    presentationMessage.setThread({ threadId: proofRecord.tags.threadId })

    // Update record
    proofRecord.presentationMessage = presentationMessage
    await this.updateState(proofRecord, ProofState.PresentationSent)

    return { message: presentationMessage, proofRecord }
  }

  /**
   * Process a received {@link PresentationMessage}. This will not accept the presentation
   * or send a presentation acknowledgement. It will only update the existing proof record with
   * the information from the presentation message. Use {@link ProofService#createAck}
   * after calling this method to create a presentation acknowledgement.
   *
   * @param messageContext The message context containing a presentation message
   * @returns proof record associated with the presentation message
   *
   */
  public async processPresentation(messageContext: InboundMessageContext<PresentationMessage>): Promise<ProofRecord> {
    const { message: presentationMessage, connection } = messageContext

    // Assert connection
    connection?.assertReady()
    if (!connection) {
      throw new Error(
        `No connection associated with incoming presentation message with thread id ${presentationMessage.threadId}`
      )
    }

    // Assert proof record
    const proofRecord = await this.getByThreadId(presentationMessage.threadId)
    proofRecord.assertState(ProofState.RequestSent)

    // TODO: add proof class with validator
    const indyProofJson = presentationMessage.indyProof
    // FIXME: Transformation should be handled by record class
    const indyProofRequest = JsonTransformer.fromJSON(proofRecord.requestMessage, RequestPresentationMessage)
      .indyProofRequest

    if (!indyProofJson) {
      throw new Error(
        `Missing required base64 encoded attachment data for presentation with thread id ${presentationMessage.threadId}`
      )
    }

    if (!indyProofRequest) {
      throw new Error(
        `Missing required base64 encoded attachment data for presentation request with thread id ${presentationMessage.threadId}`
      )
    }

    const isValid = await this.verifyProof(indyProofJson, indyProofRequest)

    // Update record
    proofRecord.isVerified = isValid
    proofRecord.presentationMessage = presentationMessage
    await this.updateState(proofRecord, ProofState.PresentationReceived)

    return proofRecord
  }

  /**
   * Create a {@link PresentationAckMessage} as response to a received presentation.
   *
   * @param proofRecord The proof record for which to create the presentation acknowledgement
   * @returns Object containing presentation acknowledgement message and associated proof record
   *
   */
  public async createAck(proofRecord: ProofRecord): Promise<ProofProtocolMsgReturnType<PresentationAckMessage>> {
    // Assert
    proofRecord.assertState(ProofState.PresentationReceived)

    // Create message
    const ackMessage = new PresentationAckMessage({
      status: AckStatus.OK,
      threadId: proofRecord.tags.threadId!,
    })

    // Update record
    await this.updateState(proofRecord, ProofState.Done)

    return { message: ackMessage, proofRecord }
  }

  /**
   * Process a received {@link PresentationAckMessage}.
   *
   * @param messageContext The message context containing a presentation acknowledgement message
   * @returns proof record associated with the presentation acknowledgement message
   *
   */
  public async processAck(messageContext: InboundMessageContext<PresentationAckMessage>): Promise<ProofRecord> {
    const { message: presentationAckMessage, connection } = messageContext

    // Assert connection
    connection?.assertReady()
    if (!connection) {
      throw new Error(
        `No connection associated with incoming presentation acknowledgement message with thread id ${presentationAckMessage.threadId}`
      )
    }

    // Assert proof record
    const proofRecord = await this.getByThreadId(presentationAckMessage.threadId)
    proofRecord.assertState(ProofState.PresentationSent)

    // Update record
    await this.updateState(proofRecord, ProofState.Done)

    return proofRecord
  }

  public async generateProofRequestNonce() {
    return this.wallet.generateNonce()
  }

  /**
   * Create a {@link ProofRequest} from a presentation proposal. This method can be used to create the
   * proof request from a received proposal for use in {@link ProofService#createRequestAsResponse}
   *
   * @param presentationProposal The presentation proposal to create a proof request from
   * @param config Additional configuration to use for the proof request
   * @returns proof request object
   *
   */
  public async createProofRequestFromProposal(
    presentationProposal: PresentationPreview,
    config: { name: string; version: string; nonce?: string }
  ): Promise<ProofRequest> {
    const nonce = config.nonce ?? (await this.generateProofRequestNonce())

    const proofRequest = new ProofRequest({
      name: config.name,
      version: config.version,
      nonce,
    })

    /**
     * Create mapping of attributes by referent. This required the
     * attributes to come from the same credential.
     * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0037-present-proof/README.md#referent
     *
     * {
     *  "referent1": [Attribute1, Attribute2],
     *  "referent2": [Attribute3]
     * }
     */
    const attributesByReferent: Record<string, PresentationPreviewAttribute[]> = {}
    for (const proposedAttributes of presentationProposal.attributes) {
      if (!proposedAttributes.referent) proposedAttributes.referent = uuid()

      const referentAttributes = attributesByReferent[proposedAttributes.referent]

      // Referent key already exist, add to list
      if (referentAttributes) {
        referentAttributes.push(proposedAttributes)
      }
      // Referent key does not exist yet, create new entry
      else {
        attributesByReferent[proposedAttributes.referent] = [proposedAttributes]
      }
    }

    // Transform attributes by referent to requested attributes
    for (const [referent, proposedAttributes] of Object.entries(attributesByReferent)) {
      // Either attributeName or attributeNames will be undefined
      const attributeName = proposedAttributes.length == 1 ? proposedAttributes[0].name : undefined
      const attributeNames = proposedAttributes.length > 1 ? proposedAttributes.map((a) => a.name) : undefined

      const requestedAttribute = new ProofAttributeInfo({
        name: attributeName,
        names: attributeNames,
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: proposedAttributes[0].credentialDefinitionId,
          }),
        ],
      })

      proofRequest.requestedAttributes[referent] = requestedAttribute
    }

    this.logger.debug('proposal predicates', presentationProposal.predicates)
    // Transform proposed predicates to requested predicates
    for (const proposedPredicate of presentationProposal.predicates) {
      const requestedPredicate = new ProofPredicateInfo({
        name: proposedPredicate.name,
        predicateType: proposedPredicate.predicate,
        predicateValue: proposedPredicate.threshold,
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: proposedPredicate.credentialDefinitionId,
          }),
        ],
      })

      proofRequest.requestedPredicates[uuid()] = requestedPredicate
    }

    return proofRequest
  }

  /**
   * Create a {@link RequestedCredentials} object. Given input proof request and presentation proposal,
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
  ): Promise<RequestedCredentials> {
    const requestedCredentials = new RequestedCredentials({})

    for (const [referent, requestedAttribute] of Object.entries(proofRequest.requestedAttributes)) {
      let credentialMatch: Credential | null = null
      const credentials = await this.getCredentialsForProofRequest(proofRequest, referent)

      // Can't construct without matching credentials
      if (credentials.length === 0) {
        throw new Error(
          `Could not automatically construct requested credentials for proof request '${proofRequest.name}'`
        )
      }
      // If we have exactly one credential, or no proposal to pick preferences
      // on the credential to use, we will use the first one
      else if (credentials.length === 1 || !presentationProposal) {
        credentialMatch = credentials[0]
      }
      // If we have a proposal we will use that to determine the credential to use
      else {
        const names = requestedAttribute.names ?? [requestedAttribute.name]

        // Find credential that matches all parameters from the proposal
        for (const credential of credentials) {
          const { attributes, credentialDefinitionId } = credential.credentialInfo

          // Check if credential matches all parameters from proposal
          const isMatch = names.every((name) =>
            presentationProposal.attributes.find(
              (a) =>
                a.name === name &&
                a.credentialDefinitionId === credentialDefinitionId &&
                (!a.value || a.value === attributes[name])
            )
          )

          if (isMatch) {
            credentialMatch = credential
            break
          }
        }

        if (!credentialMatch) {
          throw new Error(
            `Could not automatically construct requested credentials for proof request '${proofRequest.name}'`
          )
        }
      }

      if (requestedAttribute.restrictions) {
        requestedCredentials.requestedAttributes[referent] = new RequestedAttribute({
          credentialId: credentialMatch.credentialInfo.referent,
          revealed: true,
        })
      }
      // If there are no restrictions we can self attest the attribute
      else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const value = credentialMatch.credentialInfo.attributes[requestedAttribute.name!]

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        requestedCredentials.selfAttestedAttributes[referent] = value!
      }
    }

    for (const [referent, requestedPredicate] of Object.entries(proofRequest.requestedPredicates)) {
      const credentials = await this.getCredentialsForProofRequest(proofRequest, referent)

      // Can't create requestedPredicates without matching credentials
      if (credentials.length === 0) {
        throw new Error(
          `Could not automatically construct requested credentials for proof request '${proofRequest.name}'`
        )
      }

      const credentialMatch = credentials[0]
      if (requestedPredicate.restrictions) {
        requestedCredentials.requestedPredicates[referent] = new RequestedPredicate({
          credentialId: credentialMatch.credentialInfo.referent,
        })
      }
      // If there are no restrictions we can self attest the attribute
      else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const value = credentialMatch.credentialInfo.attributes[requestedPredicate.name!]

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        requestedCredentials.selfAttestedAttributes[referent] = value!
      }
    }

    return requestedCredentials
  }

  /**
   * Verify an indy proof object. Will also verify raw values against encodings.
   *
   * @param proofRequest The proof request to use for proof verification
   * @param proofJson The proof object to verify
   * @throws {Error} If the raw values do not match the encoded values
   * @returns Boolean whether the proof is valid
   *
   */
  public async verifyProof(proofJson: IndyProof, proofRequest: ProofRequest): Promise<boolean> {
    const proof = JsonTransformer.fromJSON(proofJson, PartialProof)

    for (const [referent, attribute] of proof.requestedProof.revealedAttributes.entries()) {
      if (!CredentialUtils.checkValidEncoding(attribute.raw, attribute.encoded)) {
        throw new Error(
          `The encoded value for '${referent}' is invalid. ` +
            `Expected '${CredentialUtils.encode(attribute.raw)}'. ` +
            `Actual '${attribute.encoded}'`
        )
      }
    }

    // TODO: pre verify proof json
    // I'm not 100% sure how much indy does. Also if it checks whether the proof requests matches the proof
    // @see https://github.com/hyperledger/aries-cloudagent-python/blob/master/aries_cloudagent/indy/sdk/verifier.py#L79-L164

    const schemas = await this.getSchemas(new Set(proof.identifiers.map((i) => i.schemaId)))
    const credentialDefinitions = await this.getCredentialDefinitions(
      new Set(proof.identifiers.map((i) => i.credentialDefinitionId))
    )

    return await this.wallet.verifyProof(proofRequest.toJSON(), proofJson, schemas, credentialDefinitions, {}, {})
  }

  /**
   * Retrieve all proof records
   *
   * @returns List containing all proof records
   */
  public async getAll(): Promise<ProofRecord[]> {
    return this.proofRepository.findAll()
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
    return this.proofRepository.find(proofRecordId)
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
    const proofRecords = await this.proofRepository.findByQuery({ threadId })

    if (proofRecords.length === 0) {
      throw new Error(`Proof record not found by thread id ${threadId}`)
    }

    if (proofRecords.length > 1) {
      throw new Error(`Multiple proof records found by thread id ${threadId}`)
    }

    return proofRecords[0]
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
    const credentialObjects: CredentialInfo[] = []

    for (const credentialId of requestedCredentials.getCredentialIdentifiers()) {
      const credentialInfo = JsonTransformer.fromJSON(await this.wallet.getCredential(credentialId), CredentialInfo)

      credentialObjects.push(credentialInfo)
    }

    const schemas = await this.getSchemas(new Set(credentialObjects.map((c) => c.schemaId)))
    const credentialDefinitions = await this.getCredentialDefinitions(
      new Set(credentialObjects.map((c) => c.credentialDefinitionId))
    )

    const proof = await this.wallet.createProof(
      proofRequest.toJSON(),
      requestedCredentials.toJSON(),
      schemas,
      credentialDefinitions,
      {}
    )

    return proof
  }

  private async getCredentialsForProofRequest(
    proofRequest: ProofRequest,
    attributeReferent: string
  ): Promise<Credential[]> {
    const credentialsJson = await this.wallet.getCredentialsForProofRequest(proofRequest.toJSON(), attributeReferent)
    return (JsonTransformer.fromJSON(credentialsJson, Credential) as unknown) as Credential[]
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

    const event: ProofStateChangedEvent = {
      proofRecord,
      previousState: previousState,
    }

    this.emit(ProofEventType.StateChanged, event)
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
