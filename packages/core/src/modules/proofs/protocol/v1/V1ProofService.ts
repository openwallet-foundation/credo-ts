import type { AgentMessage } from '../../../../agent/AgentMessage'
import type { Dispatcher } from '../../../../agent/Dispatcher'
import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { MediationRecipientService } from '../../../routing/services/MediationRecipientService'
import type { ProofStateChangedEvent } from '../../ProofEvents'
import type { ProofResponseCoordinator } from '../../ProofResponseCoordinator'
import type { GetRequestedCredentialsConfig } from '../../ProofsModule'
import type { CreateProblemReportOptions } from '../../formats/models/ProofFormatServiceOptions'
import type {
  CreateAckOptions,
  CreatePresentationOptions,
  CreateProposalAsResponseOptions,
  CreateProposalOptions,
  CreateRequestAsResponseOptions,
  CreateRequestOptions,
  RequestedCredentialForProofRequestOptions,
} from '../../models/ProofServiceOptions'
import type { RetrievedCredentials } from './models'
import type { PresentationPreviewAttribute } from './models/PresentationPreview'
import type { CredDef, Schema } from 'indy-sdk'

import { validateOrReject } from 'class-validator'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../../agent/AgentConfig'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../../constants'
import { AriesFrameworkError } from '../../../../error/AriesFrameworkError'
import { DidCommMessageRole } from '../../../../storage'
import { DidCommMessageRepository } from '../../../../storage/didcomm/DidCommMessageRepository'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { uuid } from '../../../../utils/uuid'
import { Wallet } from '../../../../wallet'
import { ConnectionService } from '../../../connections'
import { Credential, CredentialRepository } from '../../../credentials'
import { IndyHolderService } from '../../../indy'
import { IndyLedgerService } from '../../../ledger/services/IndyLedgerService'
import { ProofEventTypes } from '../../ProofEvents'
import { ProofService } from '../../ProofService'
import { IndyProofFormatService } from '../../formats/indy/IndyProofFormatService'
import { ProofProtocolVersion } from '../../models/ProofProtocolVersion'
import { ProofState } from '../../models/ProofState'
import { ProofRecord } from '../../repository/ProofRecord'
import { ProofRepository } from '../../repository/ProofRepository'
import { V2RequestPresentationMessage } from '../v2/messages'

import { V1PresentationProblemReportError, V1PresentationProblemReportReason } from './errors'
import {
  V1PresentationAckHandler,
  V1PresentationHandler,
  V1PresentationProblemReportHandler,
  V1ProposePresentationHandler,
  V1RequestPresentationHandler,
} from './handlers'
import {
  INDY_PROOF_ATTACHMENT_ID,
  INDY_PROOF_REQUEST_ATTACHMENT_ID,
  V1PresentationMessage,
  V1PresentationProblemReportMessage,
  V1ProposePresentationMessage,
  V1RequestPresentationMessage,
} from './messages'
import {
  AttributeFilter,
  ProofAttributeInfo,
  ProofPredicateInfo,
  ProofRequest,
  RequestedAttribute,
  RequestedCredentials,
  RequestedPredicate,
} from './models'
import { PresentationPreview } from './models/PresentationPreview'

// const logger = new ConsoleLogger(LogLevel.debug)

/**
 * @todo add method to check if request matches proposal. Useful to see if a request I received is the same as the proposal I sent.
 * @todo add method to reject / revoke messages
 * @todo validate attachments / messages
 */
@scoped(Lifecycle.ContainerScoped)
export class V1ProofService extends ProofService {
  private credentialRepository: CredentialRepository
  private ledgerService: IndyLedgerService
  private indyProofFormatService: IndyProofFormatService
  private indyHolderService: IndyHolderService

  public constructor(
    proofRepository: ProofRepository,
    didCommMessageRepository: DidCommMessageRepository,
    ledgerService: IndyLedgerService,
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    agentConfig: AgentConfig,
    connectionService: ConnectionService,
    eventEmitter: EventEmitter,
    credentialRepository: CredentialRepository,
    indyProofFormatService: IndyProofFormatService,
    indyHolderService: IndyHolderService
  ) {
    super(agentConfig, proofRepository, connectionService, didCommMessageRepository, wallet, eventEmitter)
    this.credentialRepository = credentialRepository
    this.ledgerService = ledgerService
    this.wallet = wallet
    this.indyProofFormatService = indyProofFormatService
    this.indyHolderService = indyHolderService
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
    const proposalMessage = new V1ProposePresentationMessage({
      comment: options?.comment,
      presentationProposal,
    })

    // Create record
    const proofRecord = new ProofRecord({
      connectionId: connectionRecord.id,
      threadId: proposalMessage.threadId,
      state: ProofState.ProposalSent,
      autoAcceptProof: options?.autoAcceptProof,
      protocolVersion: ProofProtocolVersion.V1_0,
    })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: proposalMessage,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
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
    let proposalMessage: V1ProposePresentationMessage
    if (proofFormats.indy?.proofPreview) {
      proposalMessage = new V1ProposePresentationMessage({
        comment,
        presentationProposal: proofFormats.indy?.proofPreview,
      })
    } else {
      throw new AriesFrameworkError('')
    }

    proposalMessage.setThread({ threadId: proofRecord.threadId })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: proposalMessage,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    // Update record
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

      const requestMessage = await this.didCommMessageRepository.findAgentMessage({
        associatedRecordId: proofRecord.id,
        messageClass: V1RequestPresentationMessage,
      })

      // Assert
      proofRecord.assertState(ProofState.RequestSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: proposalMessage,
        previousSentMessage: requestMessage ?? undefined,
      })

      await this.didCommMessageRepository.saveOrUpdateAgentMessage({
        agentMessage: proposalMessage,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Receiver,
      })

      // Update record
      await this.updateState(proofRecord, ProofState.ProposalReceived)
    } catch {
      // No proof record exists with thread id
      proofRecord = new ProofRecord({
        connectionId: connection?.id,
        threadId: proposalMessage.threadId,
        state: ProofState.ProposalReceived,
        protocolVersion: ProofProtocolVersion.V1_0,
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
    const { proofRecord, comment } = options

    // Assert
    proofRecord.assertState(ProofState.ProposalReceived)

    // Create message
    const { attachment } = this.indyProofFormatService.createRequest({
      attachId: INDY_PROOF_REQUEST_ATTACHMENT_ID,
      formats: options.proofFormats,
    })

    const requestPresentationMessage = new V1RequestPresentationMessage({
      comment,
      requestPresentationAttachments: [attachment],
    })
    requestPresentationMessage.setThread({
      threadId: proofRecord.threadId,
    })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: requestPresentationMessage,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    // Update record
    await this.updateState(proofRecord, ProofState.RequestSent)

    return { message: requestPresentationMessage, proofRecord }
  }

  public async createRequest(
    options: CreateRequestOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    this.logger.debug(`Creating proof request`)

    // Assert
    options.connectionRecord?.assertReady()

    // Create message
    const { attachment } = await this.indyProofFormatService.createRequest({
      attachId: INDY_PROOF_REQUEST_ATTACHMENT_ID,
      formats: options.proofFormats,
    })

    const requestPresentationMessage = new V1RequestPresentationMessage({
      comment: options?.comment,
      requestPresentationAttachments: [attachment],
    })

    // Create record
    const proofRecord = new ProofRecord({
      connectionId: options.connectionRecord?.id,
      threadId: requestPresentationMessage.threadId,
      state: ProofState.RequestSent,
      autoAcceptProof: options?.autoAcceptProof,
      protocolVersion: ProofProtocolVersion.V1_0,
    })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: requestPresentationMessage,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
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

    const proofRequestMessage = proofRequestMsg as V1RequestPresentationMessage

    this.logger.debug(`Processing presentation request with id ${proofRequestMessage.id}`)

    const proofRequest = proofRequestMessage.indyProofRequest

    // Assert attachment
    if (!proofRequest) {
      throw new V1PresentationProblemReportError(
        `Missing required base64 or json encoded attachment data for presentation request with thread id ${proofRequestMessage.threadId}`,
        { problemCode: V1PresentationProblemReportReason.Abandoned }
      )
    }
    await validateOrReject(proofRequest)

    this.logger.debug('received proof request', proofRequest)

    try {
      // Proof record already exists
      proofRecord = await this.getByThreadAndConnectionId(proofRequestMessage.threadId, connection?.id)

      const requestMessage = await this.didCommMessageRepository.findAgentMessage({
        associatedRecordId: proofRecord.id,
        messageClass: V1RequestPresentationMessage,
      })

      const proposalMessage = await this.didCommMessageRepository.findAgentMessage({
        associatedRecordId: proofRecord.id,
        messageClass: V1ProposePresentationMessage,
      })

      // Assert
      proofRecord.assertState(ProofState.ProposalSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: requestMessage ?? undefined,
        previousSentMessage: proposalMessage ?? undefined,
      })

      await this.didCommMessageRepository.saveOrUpdateAgentMessage({
        agentMessage: proofRequestMessage,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Receiver,
      })

      // Update record
      await this.updateState(proofRecord, ProofState.RequestReceived)
    } catch {
      // No proof record exists with thread id
      proofRecord = new ProofRecord({
        connectionId: connection?.id,
        threadId: proofRequestMessage.threadId,
        state: ProofState.RequestReceived,
        protocolVersion: ProofProtocolVersion.V1_0,
      })

      await this.didCommMessageRepository.saveOrUpdateAgentMessage({
        agentMessage: proofRequestMessage,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Receiver,
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
    options: CreatePresentationOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    const { proofRecord, proofFormats } = options

    this.logger.debug(`Creating presentation for proof record with id ${proofRecord.id}`)

    // Assert
    proofRecord.assertState(ProofState.RequestReceived)

    const requestMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: proofRecord.id,
      messageClass: V1RequestPresentationMessage,
    })

    const requestAttachment = requestMessage?.indyAttachment

    if (!requestAttachment) {
      throw new V1PresentationProblemReportError(
        `Missing required base64 or json encoded attachment data for presentation with thread id ${proofRecord.threadId}`,
        { problemCode: V1PresentationProblemReportReason.Abandoned }
      )
    }

    const proof = await this.indyProofFormatService.createPresentation({
      attachId: INDY_PROOF_ATTACHMENT_ID,
      attachment: requestAttachment,
      formats: {
        indy: {
          requestedAttributes: proofFormats.indy?.requestedAttributes,
          requestedPredicates: proofFormats.indy?.requestedPredicates,
          selfAttestedAttributes: proofFormats.indy?.selfAttestedAttributes,
        },
      },
    })

    // Extract proof request from attachment
    const proofRequestJson = requestAttachment.getDataAsJson<ProofRequest>() ?? null
    const proofRequest = JsonTransformer.fromJSON(proofRequestJson, ProofRequest)

    const requestedCredentials = new RequestedCredentials({
      requestedAttributes: proofFormats.indy?.requestedAttributes,
      requestedPredicates: proofFormats.indy?.requestedPredicates,
      selfAttestedAttributes: proofFormats.indy?.selfAttestedAttributes,
    })

    // Get the matching attachments to the requested credentials
    const linkedAttachments = await this.getRequestedAttachmentsForRequestedCredentials(
      proofRequest,
      requestedCredentials
    )

    const presentationMessage = new V1PresentationMessage({
      comment: options?.comment,
      presentationAttachments: [proof.attachment],
      attachments: linkedAttachments,
    })
    presentationMessage.setThread({ threadId: proofRecord.threadId })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: presentationMessage,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    // Update record
    await this.updateState(proofRecord, ProofState.PresentationSent)

    return { message: presentationMessage, proofRecord }
  }

  public async processPresentation(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    const { message: presentationMsg, connection } = messageContext

    const presentationMessage = presentationMsg as V1PresentationMessage
    this.logger.debug(`Processing presentation with id ${presentationMessage.id}`)

    const proofRecord = await this.getByThreadAndConnectionId(presentationMessage.threadId, connection?.id)

    const proposalMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: proofRecord.id,
      messageClass: V1ProposePresentationMessage,
    })

    const requestMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: proofRecord.id,
      messageClass: V1RequestPresentationMessage,
    })

    // Assert
    proofRecord.assertState(ProofState.RequestSent)
    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: proposalMessage ?? undefined,
      previousSentMessage: requestMessage ?? undefined,
    })

    try {
      const isValid = await this.indyProofFormatService.processPresentation({
        record: proofRecord,
        presentation: {
          proof: presentationMessage.getAttachmentFormats(),
          request: requestMessage.getAttachmentFormats(),
        },
      })
      await this.didCommMessageRepository.saveOrUpdateAgentMessage({
        agentMessage: presentationMessage,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Receiver,
      })

      // Update record
      proofRecord.isVerified = isValid
      await this.updateState(proofRecord, ProofState.PresentationReceived)
    } catch (e) {
      if (e instanceof AriesFrameworkError) {
        throw new V1PresentationProblemReportError(e.message, {
          problemCode: V1PresentationProblemReportReason.Abandoned,
        })
      }
      throw e
    }

    return proofRecord
  }

  public async processAck(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    const { message: presentationAckMessage, connection } = messageContext

    this.logger.debug(`Processing presentation ack with id ${presentationAckMessage.id}`)

    const proofRecord = await this.getByThreadAndConnectionId(presentationAckMessage.threadId, connection?.id)

    const requestMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: proofRecord.id,
      messageClass: V1RequestPresentationMessage,
    })

    const presentationMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: proofRecord.id,
      messageClass: V1PresentationMessage,
    })

    // Assert
    proofRecord.assertState(ProofState.PresentationSent)
    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: requestMessage ?? undefined,
      previousSentMessage: presentationMessage ?? undefined,
    })

    // Update record
    await this.updateState(proofRecord, ProofState.Done)

    return proofRecord
  }

  public async createProblemReport(
    options: CreateProblemReportOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    const msg = new V1PresentationProblemReportMessage({
      description: {
        code: V1PresentationProblemReportReason.Abandoned,
        en: options.description,
      },
    })

    msg.setThread({
      threadId: options.proofRecord.threadId,
    })

    return {
      proofRecord: options.proofRecord,
      message: msg,
    }
  }

  public async processProblemReport(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    const { message: presentationProblemReportMsg } = messageContext

    const presentationProblemReportMessage = presentationProblemReportMsg as V1PresentationProblemReportMessage
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

  public async shouldAutoRespondToRequest(proofRecord: ProofRecord): Promise<boolean> {
    const proposal = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: proofRecord.id,
      messageClass: V1ProposePresentationMessage,
    })

    if (!proposal) {
      return false
    }

    const request = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: proofRecord.id,
      messageClass: V1RequestPresentationMessage,
    })

    if (!request) {
      throw new AriesFrameworkError(`Expected to find a request message for ProofRecord with id ${proofRecord.id}`)
    }

    const requestAttachment = request
      .getAttachmentFormats()
      .find((x) => x.format.format === 'hlindy/proof-req@2.0')?.attachment

    if (!requestAttachment) {
      throw new AriesFrameworkError('Request message has no attachment linked to it')
    }

    const requestAttachmentData = requestAttachment.getDataAsJson<ProofRequest>()

    const proposalAttributes = proposal.presentationProposal.attributes
    const requestedAttributes = requestAttachmentData.requestedAttributes

    const proposedAttributeNames = proposalAttributes.map((x) => x.name)
    let requestedAttributeNames: string[] = []

    const requestedAttributeList = Array.from(requestedAttributes.values())

    requestedAttributeList.forEach((x) => {
      if (x.name) {
        requestedAttributeNames.push(x.name)
      } else if (x.names) {
        requestedAttributeNames = requestedAttributeNames.concat(x.names)
      }
    })

    if (requestedAttributeNames.length > proposedAttributeNames.length) {
      // more attributes are requested than have been proposed
      return false
    }

    requestedAttributeNames.forEach((x) => {
      if (!proposedAttributeNames.includes(x)) {
        this.logger.debug(`Attribute ${x} was requested but wasn't proposed.`)
        return false
      }
    })

    // assert that all requested attributes are provided
    const providedPredicateNames = proposal.presentationProposal.predicates.map((x) => x.name)
    requestAttachmentData.requestedPredicates.forEach((x) => {
      if (!providedPredicateNames.includes(x.name)) {
        return false
      }
    })

    return true
  }

  public async shouldAutoRespondToPresentation(proofRecord: ProofRecord): Promise<boolean> {
    return true
  }

  public async getRequestedCredentialsForProofRequest(options: {
    proofRecord: ProofRecord
    config: {
      indy?: GetRequestedCredentialsConfig
      jsonLd?: never
    }
  }): Promise<{ indy?: RetrievedCredentials | undefined; w3c?: undefined }> {
    return await this.indyProofFormatService.getRequestedCredentialsForProofRequest({
      proofRecord: options.proofRecord,
      config: options.config,
    })
  }

  public async autoSelectCredentialsForProofRequest(options: {
    indy?: RetrievedCredentials | undefined
    jsonLd?: undefined
  }): Promise<{ indy?: RequestedCredentials | undefined; jsonLd?: undefined }> {
    return await this.indyProofFormatService.autoSelectCredentialsForProofRequest(options)
  }

  public async registerHandlers(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    proofResponseCoordinator: ProofResponseCoordinator,
    mediationRecipientService: MediationRecipientService
  ): Promise<void> {
    dispatcher.registerHandler(
      new V1ProposePresentationHandler(this, agentConfig, proofResponseCoordinator, this.didCommMessageRepository)
    )

    dispatcher.registerHandler(
      new V1RequestPresentationHandler(
        this,
        agentConfig,
        proofResponseCoordinator,
        mediationRecipientService,
        this.didCommMessageRepository
      )
    )

    dispatcher.registerHandler(
      new V1PresentationHandler(this, agentConfig, proofResponseCoordinator, this.didCommMessageRepository)
    )
    dispatcher.registerHandler(new V1PresentationAckHandler(this))
    dispatcher.registerHandler(new V1PresentationProblemReportHandler(this))
  }

  public async findRequestMessage(options: { proofRecord: ProofRecord }): Promise<V1RequestPresentationMessage | null> {
    return await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: options.proofRecord.id,
      messageClass: V1RequestPresentationMessage,
    })
  }
  public async findPresentationMessage(options: { proofRecord: ProofRecord }): Promise<V1PresentationMessage | null> {
    return await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: options.proofRecord.id,
      messageClass: V1PresentationMessage,
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

  public createAck(options: CreateAckOptions): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    throw new Error('Method not implemented.')
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
