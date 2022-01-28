import type { AgentMessage } from '../../../../agent/AgentMessage'
import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../../logger'
import type { ProofStateChangedEvent } from '../../ProofEvents'
import type { CreatePresentationOptions, CreateRequestOptions } from '../../formats/ProofFormatService'
import type {
  CreateAckOptions,
  CreateProposalAsResponseOptions,
  CreateProposalOptions,
  CreateRequestAsResponseOptions,
  PresentationOptions,
  RequestProofOptions,
} from '../../models/ServiceOptions'
import type { PresentationProblemReportMessage } from './messages'
import type { RetrievedCredentials } from './models'
import type { PresentationPreviewAttribute } from './models/PresentationPreview'
import type { CredDef, IndyProof, Schema } from 'indy-sdk'
import type { Attachment } from 'packages/core/src/decorators/attachment/Attachment'

import { validateOrReject } from 'class-validator'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { ProofRepository } from '../..'
import { AgentConfig } from '../../../../agent/AgentConfig'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../../constants'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { Wallet } from '../../../../wallet'
import { AckStatus } from '../../../common/messages/AckMessage'
import { ConnectionService } from '../../../connections'
import { Credential, CredentialRepository, CredentialUtils } from '../../../credentials'
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
  PresentationAckMessageV1,
  PresentationMessage,
  ProposePresentationMessage,
  RequestPresentationMessage,
} from './messages'
import {
  AttributeFilter,
  ProofPredicateInfo,
  PartialProof,
  ProofRequest,
  RequestedCredentials,
  ProofAttributeInfo,
} from './models'
import { PresentationPreview } from './models/PresentationPreview'

import { AriesFrameworkError } from '@aries-framework/core'
import { AttachmentData } from 'packages/core/src/decorators/attachment/Attachment'
import { JsonEncoder } from 'packages/core/src/utils/JsonEncoder'
import { uuid } from 'packages/core/src/utils/uuid'

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

  public async createProposalAsResponse(
    options: CreateProposalAsResponseOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    const { proofRecord, proofFormats, comment } = options

    // Assert
    proofRecord.assertState(ProofState.RequestReceived)

    // Create message
    let proposalMessage: ProposePresentationMessage
    if (proofFormats.indy?.proofPreview) {
      proposalMessage = new ProposePresentationMessage({
        comment,
        presentationProposal: proofFormats.indy?.proofPreview,
      })
    } else {
      throw new AriesFrameworkError('')
    }

    proposalMessage.setThread({ threadId: proofRecord.threadId })

    // Update record
    proofRecord.proposalMessage = proposalMessage
    this.updateState(proofRecord, ProofState.ProposalSent)

    return { proofRecord, message: proposalMessage }
  }

  /**
   * Decline a proof request
   * @param proofRecord The proof request to be declined
   */
  public async declineRequest(proofRecord: ProofRecord): Promise<ProofRecord> {
    proofRecord.assertState(ProofState.RequestReceived)

    await this.updateState(proofRecord, ProofState.Declined)

    return proofRecord
  }

  public async processProposal(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    let proofRecord: ProofRecord
    const { message: proposalMessage, connection } = messageContext

    this.logger.debug(`Processing presentation proposal with id ${proposalMessage.id}`)

    try {
      // Proof record already exists
      proofRecord = await this.getByThreadAndConnectionId(proposalMessage.threadId, connection?.id)

      // Assert
      proofRecord.assertState(ProofState.RequestSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: proofRecord.proposalMessage,
        previousSentMessage: proofRecord.requestMessage,
      })

      // Update record
      proofRecord.proposalMessage = proposalMessage
      await this.updateState(proofRecord, ProofState.ProposalReceived)
    } catch {
      // No proof record exists with thread id
      proofRecord = new ProofRecord({
        connectionId: connection?.id,
        threadId: proposalMessage.threadId,
        proposalMessage,
        state: ProofState.ProposalReceived,
      })

      // Assert
      this.connectionService.assertConnectionOrServiceDecorator(messageContext)

      // Save record
      await this.proofRepository.save(proofRecord)
      this.eventEmitter.emit<ProofStateChangedEvent>({
        type: ProofEventTypes.ProofStateChanged,
        payload: {
          proofRecord,
          previousState: null,
        },
      })
    }

    return proofRecord
  }

  public async createRequestAsResponse(
    options: CreateRequestAsResponseOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    const { proofRecord, proofFormats, comment } = options

    let proofRequest: ProofRequest
    if (proofFormats.indy?.proofRequest) {
      proofRequest = proofFormats.indy?.proofRequest
    } else {
      throw new AriesFrameworkError('Proof request is required.')
    }
    // Assert
    proofRecord.assertState(ProofState.ProposalReceived)

    // Create message
    const createRequestOptions: CreateRequestOptions = {
      attachId: INDY_PROOF_REQUEST_ATTACHMENT_ID,
      messageType: 'V1_PROOF',
      proofRequest,
    }
    const { attachment } = await this.indyProofFormatService.createRequest(createRequestOptions)

    const requestPresentationMessage = new RequestPresentationMessage({
      comment,
      requestPresentationAttachments: [attachment],
    })
    requestPresentationMessage.setThread({
      threadId: proofRecord.threadId,
    })

    // Update record
    proofRecord.requestMessage = requestPresentationMessage
    await this.updateState(proofRecord, ProofState.RequestSent)

    return { message: requestPresentationMessage, proofRecord }
  }

  public async createRequest(
    options: RequestProofOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    this.logger.debug(`Creating proof request`)
    const { connectionRecord, proofFormats } = options

    let proofRequest: ProofRequest
    if (proofFormats.indy?.proofRequest) {
      proofRequest = new ProofRequest({
        name: proofFormats.indy?.proofRequest.name,
        nonce: proofFormats.indy?.proofRequest.nonce,
        version: proofFormats.indy?.proofRequest.nonce,
        requestedAttributes: proofFormats.indy?.proofRequest.requestedAttributes,
        requestedPredicates: proofFormats.indy?.proofRequest.requestedPredicates,
      })
    } else {
      throw new AriesFrameworkError(
        'Unable to get requested credentials for proof request. No proof request message was found or the proof request message does not contain an indy proof request.'
      )
    }

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

  public async processRequest(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    let proofRecord: ProofRecord
    const { message: proofRequestMsg, connection } = messageContext

    const proofRequestMessage = proofRequestMsg as RequestPresentationMessage

    this.logger.debug(`Processing presentation request with id ${proofRequestMessage.id}`)

    const proofRequest = proofRequestMessage.indyProofRequest

    // Assert attachment
    if (!proofRequest) {
      throw new PresentationProblemReportError(
        `Missing required base64 or json encoded attachment data for presentation request with thread id ${proofRequestMessage.threadId}`,
        { problemCode: PresentationProblemReportReason.Abandoned }
      )
    }
    await validateOrReject(proofRequest)

    this.logger.debug('received proof request', proofRequest)

    try {
      // Proof record already exists
      proofRecord = await this.getByThreadAndConnectionId(proofRequestMessage.threadId, connection?.id)

      // Assert
      proofRecord.assertState(ProofState.ProposalSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: proofRecord.requestMessage,
        previousSentMessage: proofRecord.proposalMessage,
      })

      // Update record
      proofRecord.requestMessage = proofRequestMessage
      await this.updateState(proofRecord, ProofState.RequestReceived)
    } catch {
      // No proof record exists with thread id
      proofRecord = new ProofRecord({
        connectionId: connection?.id,
        threadId: proofRequestMessage.threadId,
        requestMessage: proofRequestMessage,
        state: ProofState.RequestReceived,
      })

      // Assert
      this.connectionService.assertConnectionOrServiceDecorator(messageContext)

      // Save in repository
      await this.proofRepository.save(proofRecord)
      this.eventEmitter.emit<ProofStateChangedEvent>({
        type: ProofEventTypes.ProofStateChanged,
        payload: { proofRecord, previousState: null },
      })
    }

    return proofRecord
  }

  public async createPresentation(
    options: PresentationOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    const { proofRecord, proofFormats } = options

    let requestedCredentials: RequestedCredentials
    if (proofFormats.indy) {
      requestedCredentials = new RequestedCredentials({
        requestedAttributes: proofFormats.indy.requestedAttributes,
        requestedPredicates: proofFormats.indy.requestedPredicates,
        selfAttestedAttributes: proofFormats.indy.selfAttestedAttributes,
      })
    } else {
      throw new AriesFrameworkError('No attributes received for requested credentials.')
    }

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
    const attachments = await this.getRequestedAttachmentsForRequestedCredentials(
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

  public async processPresentation(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    const { message: presentationMsg, connection } = messageContext

    const presentationMessage = presentationMsg as PresentationMessage
    this.logger.debug(`Processing presentation with id ${presentationMessage.id}`)

    const proofRecord = await this.getByThreadAndConnectionId(presentationMessage.threadId, connection?.id)

    // Assert
    proofRecord.assertState(ProofState.RequestSent)
    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: proofRecord.proposalMessage,
      previousSentMessage: proofRecord.requestMessage,
    })

    // TODO: add proof class with validator
    const indyProofJson = presentationMessage.indyProof
    const indyProofRequest = proofRecord.requestMessage?.indyProofRequest

    if (!indyProofJson) {
      throw new PresentationProblemReportError(
        `Missing required base64 or json encoded attachment data for presentation with thread id ${presentationMessage.threadId}`,
        { problemCode: PresentationProblemReportReason.Abandoned }
      )
    }

    if (!indyProofRequest) {
      throw new PresentationProblemReportError(
        `Missing required base64 or json encoded attachment data for presentation request with thread id ${presentationMessage.threadId}`,
        { problemCode: PresentationProblemReportReason.Abandoned }
      )
    }

    const isValid = await this.verifyProof(indyProofJson, indyProofRequest)

    // Update record
    proofRecord.isVerified = isValid
    proofRecord.presentationMessage = presentationMessage
    await this.updateState(proofRecord, ProofState.PresentationReceived)

    return proofRecord
  }

  public async createAck(options: CreateAckOptions): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    const { proofRecord } = options
    this.logger.debug(`Creating presentation ack for proof record with id ${proofRecord.id}`)

    // Assert
    proofRecord.assertState(ProofState.PresentationReceived)

    // Create message
    const ackMessage = new PresentationAckMessageV1({
      status: AckStatus.OK,
      threadId: proofRecord.threadId,
    })

    // Update record
    await this.updateState(proofRecord, ProofState.Done)

    return { message: ackMessage, proofRecord }
  }

  public async processAck(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    const { message: presentationAckMessage, connection } = messageContext

    this.logger.debug(`Processing presentation ack with id ${presentationAckMessage.id}`)

    const proofRecord = await this.getByThreadAndConnectionId(presentationAckMessage.threadId, connection?.id)

    // Assert
    proofRecord.assertState(ProofState.PresentationSent)
    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: proofRecord.requestMessage,
      previousSentMessage: proofRecord.presentationMessage,
    })

    // Update record
    await this.updateState(proofRecord, ProofState.Done)

    return proofRecord
  }

  public createProblemReport(
    options: CreateProblemReportOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    throw new Error('Method not implemented.')
  }

  public async processProblemReport(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    const { message: presentationProblemReportMsg } = messageContext

    const presentationProblemReportMessage = presentationProblemReportMsg as PresentationProblemReportMessage
    const connection = messageContext.assertReadyConnection()

    this.logger.debug(`Processing problem report with id ${presentationProblemReportMessage.id}`)

    const proofRecord = await this.getByThreadAndConnectionId(presentationProblemReportMessage.threadId, connection?.id)

    proofRecord.errorMessage = `${presentationProblemReportMessage.description.code}: ${presentationProblemReportMessage.description.en}`
    await this.update(proofRecord)
    return proofRecord
  }

  public async generateProofRequestNonce() {
    return this.wallet.generateNonce()
  }

  /**
   * Create a {@link ProofRequest} from a presentation proposal. This method can be used to create the
   * proof request from a received proposal for use in {@link ProofService.createRequestAsResponse}
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

      proofRequest.requestedAttributes.set(referent, requestedAttribute)
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

      proofRequest.requestedPredicates.set(uuid(), requestedPredicate)
    }

    return proofRequest
  }

  /**
   * Retrieves the linked attachments for an {@link indyProofRequest}
   * @param indyProofRequest The proof request for which the linked attachments have to be found
   * @param requestedCredentials The requested credentials
   * @returns a list of attachments that are linked to the requested credentials
   */
  public async getRequestedAttachmentsForRequestedCredentials(
    indyProofRequest: ProofRequest,
    requestedCredentials: RequestedCredentials
  ): Promise<Attachment[] | undefined> {
    const attachments: Attachment[] = []
    const credentialIds = new Set<string>()
    const requestedAttributesNames: (string | undefined)[] = []

    // Get the credentialIds if it contains a hashlink
    for (const [referent, requestedAttribute] of Object.entries(requestedCredentials.requestedAttributes)) {
      // Find the requested Attributes
      const requestedAttributes = indyProofRequest.requestedAttributes.get(referent) as ProofAttributeInfo

      // List the requested attributes
      requestedAttributesNames.push(...(requestedAttributes.names ?? [requestedAttributes.name]))

      // Find the attributes that have a hashlink as a value
      for (const attribute of Object.values(requestedAttribute.credentialInfo.attributes)) {
        if (attribute.toLowerCase().startsWith('hl:')) {
          credentialIds.add(requestedAttribute.credentialId)
        }
      }
    }

    // Only continues if there is an attribute value that contains a hashlink
    for (const credentialId of credentialIds) {
      // Get the credentialRecord that matches the ID

      const credentialRecord = await this.credentialRepository.getSingleByQuery({ credentialId })

      if (credentialRecord.linkedAttachments) {
        // Get the credentials that have a hashlink as value and are requested
        const requestedCredentials = credentialRecord.credentialAttributes?.filter(
          (credential) =>
            credential.value.toLowerCase().startsWith('hl:') && requestedAttributesNames.includes(credential.name)
        )

        // Get the linked attachments that match the requestedCredentials
        const linkedAttachments = credentialRecord.linkedAttachments.filter((attachment) =>
          requestedCredentials?.map((credential) => credential.value.split(':')[1]).includes(attachment.id)
        )

        if (linkedAttachments) {
          attachments.push(...linkedAttachments)
        }
      }
    }

    return attachments.length ? attachments : undefined
  }

  public async getRequestedCredentialsForProofRequest(options: {
    proofRecord: ProofRecord
  }): Promise<{ indy?: RetrievedCredentials | undefined; w3c?: undefined }> {
    throw new Error('Method not implemented.')
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
    const requestedCredentials = new RequestedCredentials({})

    Object.keys(retrievedCredentials.requestedAttributes).forEach((attributeName) => {
      const attributeArray = retrievedCredentials.requestedAttributes[attributeName]

      if (attributeArray.length === 0) {
        throw new AriesFrameworkError('Unable to automatically select requested attributes.')
      } else {
        requestedCredentials.requestedAttributes[attributeName] = attributeArray[0]
      }
    })

    Object.keys(retrievedCredentials.requestedPredicates).forEach((attributeName) => {
      if (retrievedCredentials.requestedPredicates[attributeName].length === 0) {
        throw new AriesFrameworkError('Unable to automatically select requested predicates.')
      } else {
        requestedCredentials.requestedPredicates[attributeName] =
          retrievedCredentials.requestedPredicates[attributeName][0]
      }
    })

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
        throw new PresentationProblemReportError(
          `The encoded value for '${referent}' is invalid. ` +
            `Expected '${CredentialUtils.encode(attribute.raw)}'. ` +
            `Actual '${attribute.encoded}'`,
          { problemCode: PresentationProblemReportReason.Abandoned }
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

    return await this.indyVerifierService.verifyProof({
      proofRequest: proofRequest.toJSON(),
      proof: proofJson,
      schemas,
      credentialDefinitions,
    })
  }

  /**
   * Retrieve all proof records
   *
   * @returns List containing all proof records
   */
  public async getAll(): Promise<ProofRecord[]> {
    return this.proofRepository.getAll()
  }

  /**
   * Retrieve a proof record by id
   *
   * @param proofRecordId The proof record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The proof record
   *
   */
  public async getById(proofRecordId: string): Promise<ProofRecord> {
    return this.proofRepository.getById(proofRecordId)
  }

  /**
   * Retrieve a proof record by id
   *
   * @param proofRecordId The proof record id
   * @return The proof record or null if not found
   *
   */
  public async findById(proofRecordId: string): Promise<ProofRecord | null> {
    return this.proofRepository.findById(proofRecordId)
  }

  /**
   * Delete a proof record by id
   *
   * @param proofId the proof record id
   */
  public async deleteById(proofId: string) {
    const proofRecord = await this.getById(proofId)
    return this.proofRepository.delete(proofRecord)
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
  public async getByThreadAndConnectionId(threadId: string, connectionId?: string): Promise<ProofRecord> {
    return this.proofRepository.getSingleByQuery({ threadId, connectionId })
  }

  public update(proofRecord: ProofRecord) {
    return this.proofRepository.update(proofRecord)
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

  private async getCredentialsForProofRequest(
    proofRequest: ProofRequest,
    attributeReferent: string
  ): Promise<Credential[]> {
    const credentialsJson = await this.indyHolderService.getCredentialsForProofRequest({
      proofRequest: proofRequest.toJSON(),
      attributeReferent,
    })

    return JsonTransformer.fromJSON(credentialsJson, Credential) as unknown as Credential[]
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
