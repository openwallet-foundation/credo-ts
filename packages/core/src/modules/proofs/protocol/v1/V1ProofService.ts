import type { AgentContext } from '../../../../agent'
import type { AgentMessage } from '../../../../agent/AgentMessage'
import type { Dispatcher } from '../../../../agent/Dispatcher'
import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { MediationRecipientService } from '../../../routing/services/MediationRecipientService'
import type { RoutingService } from '../../../routing/services/RoutingService'
import type { ProofResponseCoordinator } from '../../ProofResponseCoordinator'
import type { ProofFormatService } from '../../formats/ProofFormatService'
import type { IndyProofFormat, IndyProposeProofFormat } from '../../formats/indy/IndyProofFormat'
import type { ProofAttributeInfo } from '../../formats/indy/models'
import type {
  CreateProblemReportOptions,
  FormatCreatePresentationOptions,
} from '../../formats/models/ProofFormatServiceOptions'
import type {
  CreateAckOptions,
  CreatePresentationOptions,
  CreateProofRequestFromProposalOptions,
  CreateProposalAsResponseOptions,
  CreateProposalOptions,
  CreateRequestAsResponseOptions,
  CreateRequestOptions,
  FormatRequestedCredentialReturn,
  FormatRetrievedCredentialOptions,
  GetRequestedCredentialsForProofRequestOptions,
  ProofRequestFromProposalOptions,
} from '../../models/ProofServiceOptions'

import { validateOrReject } from 'class-validator'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../../agent/AgentConfig'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../../constants'
import { AriesFrameworkError } from '../../../../error/AriesFrameworkError'
import { DidCommMessageRole } from '../../../../storage'
import { DidCommMessageRepository } from '../../../../storage/didcomm/DidCommMessageRepository'
import { checkProofRequestForDuplicates } from '../../../../utils'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { MessageValidator } from '../../../../utils/MessageValidator'
import { Wallet } from '../../../../wallet'
import { AckStatus } from '../../../common/messages/AckMessage'
import { ConnectionService } from '../../../connections'
import { CredentialRepository } from '../../../credentials'
import { IndyCredentialInfo } from '../../../credentials/formats/indy/models/IndyCredentialInfo'
import { IndyHolderService, IndyRevocationService } from '../../../indy'
import { IndyLedgerService } from '../../../ledger/services/IndyLedgerService'
import { ProofService } from '../../ProofService'
import { PresentationProblemReportReason } from '../../errors/PresentationProblemReportReason'
import { ProofFormat } from '../../formats/ProofFormat'
import { IndyProofFormatService } from '../../formats/indy/IndyProofFormatService'
import { IndyProofUtils } from '../../formats/indy/IndyProofUtils'
import { ProofRequest } from '../../formats/indy/models/ProofRequest'
import { RequestedCredentials } from '../../formats/indy/models/RequestedCredentials'
import { ProofProtocolVersion } from '../../models/ProofProtocolVersion'
import { ProofState } from '../../models/ProofState'
import { ProofRecord } from '../../repository/ProofRecord'
import { ProofRepository } from '../../repository/ProofRepository'

import { V1PresentationProblemReportError } from './errors'
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
  V1PresentationAckMessage,
  V1PresentationMessage,
  V1ProposePresentationMessage,
  V1RequestPresentationMessage,
} from './messages'
import { V1PresentationProblemReportMessage } from './messages/V1PresentationProblemReportMessage'
import { PresentationPreview } from './models/V1PresentationPreview'

/**
 * @todo add method to check if request matches proposal. Useful to see if a request I received is the same as the proposal I sent.
 * @todo add method to reject / revoke messages
 * @todo validate attachments / messages
 */
@scoped(Lifecycle.ContainerScoped)
export class V1ProofService extends ProofService {
  private credentialRepository: CredentialRepository
  private ledgerService: IndyLedgerService
  private indyHolderService: IndyHolderService
  private indyRevocationService: IndyRevocationService
  private indyProofFormatService: ProofFormatService

  public constructor(
    proofRepository: ProofRepository,
    didCommMessageRepository: DidCommMessageRepository,
    ledgerService: IndyLedgerService,
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    agentConfig: AgentConfig,
    connectionService: ConnectionService,
    eventEmitter: EventEmitter,
    credentialRepository: CredentialRepository,
    formatService: IndyProofFormatService,
    indyHolderService: IndyHolderService,
    indyRevocationService: IndyRevocationService
  ) {
    super(agentConfig, proofRepository, connectionService, didCommMessageRepository, wallet, eventEmitter)
    this.credentialRepository = credentialRepository
    this.ledgerService = ledgerService
    this.wallet = wallet
    this.indyProofFormatService = formatService
    this.indyHolderService = indyHolderService
    this.indyRevocationService = indyRevocationService
  }

  public readonly version = 'v1' as const

  public getFormatServiceForRecordType(proofRecordType: string) {
    if (proofRecordType !== this.indyProofFormatService.proofRecordType) {
      throw new AriesFrameworkError(
        `Unsupported proof record type ${proofRecordType} for v1 issue proof protocol (need ${this.indyProofFormatService.proofRecordType})`
      )
    }

    return this.indyProofFormatService
  }

  public async createProposal(
    agentContext: AgentContext,
    options: CreateProposalOptions<[IndyProofFormat]>
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    const { connectionRecord, proofFormats } = options

    // Assert
    connectionRecord.assertReady()

    if (!proofFormats.indy || Object.keys(proofFormats).length !== 1) {
      throw new AriesFrameworkError('Only indy proof format is supported for present proof protocol v1')
    }

    const presentationProposal = new PresentationPreview({
      attributes: proofFormats.indy?.attributes,
      predicates: proofFormats.indy?.predicates,
    })

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
      protocolVersion: ProofProtocolVersion.V1,
    })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: proposalMessage,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    await this.proofRepository.save(agentContext, proofRecord)
    this.emitStateChangedEvent(agentContext, proofRecord, null)

    return { proofRecord, message: proposalMessage }
  }

  public async createProposalAsResponse(
    agentContext: AgentContext,
    options: CreateProposalAsResponseOptions<[IndyProofFormat]>
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    const { proofRecord, proofFormats, comment } = options

    // Assert
    proofRecord.assertState(ProofState.RequestReceived)

    if (!proofFormats.indy || Object.keys(proofFormats).length !== 1) {
      throw new AriesFrameworkError('Only indy proof format is supported for present proof protocol v1')
    }

    // Create message
    const presentationPreview = new PresentationPreview({
      attributes: proofFormats.indy?.attributes,
      predicates: proofFormats.indy?.predicates,
    })

    const proposalMessage: V1ProposePresentationMessage = new V1ProposePresentationMessage({
      comment,
      presentationProposal: presentationPreview,
    })

    proposalMessage.setThread({ threadId: proofRecord.threadId })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: proposalMessage,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    // Update record
    await this.updateState(agentContext, proofRecord, ProofState.ProposalSent)

    return { proofRecord, message: proposalMessage }
  }

  public async processProposal(
    messageContext: InboundMessageContext<V1ProposePresentationMessage>
  ): Promise<ProofRecord> {
    let proofRecord: ProofRecord
    const { message: proposalMessage, connection } = messageContext

    this.logger.debug(`Processing presentation proposal with id ${proposalMessage.id}`)

    try {
      // Proof record already exists
      proofRecord = await this.getByThreadAndConnectionId(
        messageContext.agentContext,
        proposalMessage.threadId,
        connection?.id
      )

      const requestMessage = await this.didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: V1RequestPresentationMessage,
      })

      // Assert
      proofRecord.assertState(ProofState.RequestSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: proposalMessage,
        previousSentMessage: requestMessage ?? undefined,
      })

      await this.didCommMessageRepository.saveOrUpdateAgentMessage(messageContext.agentContext, {
        agentMessage: proposalMessage,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Receiver,
      })

      // Update record
      await this.updateState(messageContext.agentContext, proofRecord, ProofState.ProposalReceived)
    } catch {
      // No proof record exists with thread id
      proofRecord = new ProofRecord({
        connectionId: connection?.id,
        threadId: proposalMessage.threadId,
        state: ProofState.ProposalReceived,
        protocolVersion: ProofProtocolVersion.V1,
      })

      // Assert
      this.connectionService.assertConnectionOrServiceDecorator(messageContext)

      // Save record
      await this.didCommMessageRepository.saveOrUpdateAgentMessage(messageContext.agentContext, {
        agentMessage: proposalMessage,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Sender,
      })

      await this.proofRepository.save(messageContext.agentContext, proofRecord)

      this.emitStateChangedEvent(messageContext.agentContext, proofRecord, null)
    }

    return proofRecord
  }

  public async createRequestAsResponse(
    agentContext: AgentContext,
    options: CreateRequestAsResponseOptions<[IndyProofFormat]>
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    const { proofRecord, comment, proofFormats } = options
    if (!proofFormats.indy) {
      throw new AriesFrameworkError('Only indy proof format is supported for present proof protocol v1')
    }

    // Assert
    proofRecord.assertState(ProofState.ProposalReceived)

    // Create message
    const { attachment } = await this.indyProofFormatService.createRequest({
      id: INDY_PROOF_REQUEST_ATTACHMENT_ID,
      formats: proofFormats,
    })

    const requestPresentationMessage = new V1RequestPresentationMessage({
      comment,
      requestPresentationAttachments: [attachment],
    })
    requestPresentationMessage.setThread({
      threadId: proofRecord.threadId,
    })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: requestPresentationMessage,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    // Update record
    await this.updateState(agentContext, proofRecord, ProofState.RequestSent)

    return { message: requestPresentationMessage, proofRecord }
  }

  public async createRequest(
    agentContext: AgentContext,
    options: CreateRequestOptions<[IndyProofFormat]>
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    this.logger.debug(`Creating proof request`)

    // Assert
    if (options.connectionRecord) {
      options.connectionRecord.assertReady()
    }

    if (!options.proofFormats.indy || Object.keys(options.proofFormats).length !== 1) {
      throw new AriesFrameworkError('Only indy proof format is supported for present proof protocol v1')
    }

    // Create message
    const { attachment } = await this.indyProofFormatService.createRequest({
      id: INDY_PROOF_REQUEST_ATTACHMENT_ID,
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
      protocolVersion: ProofProtocolVersion.V1,
    })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: requestPresentationMessage,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    await this.proofRepository.save(agentContext, proofRecord)
    this.emitStateChangedEvent(agentContext, proofRecord, null)

    return { message: requestPresentationMessage, proofRecord }
  }

  public async processRequest(
    messageContext: InboundMessageContext<V1RequestPresentationMessage>
  ): Promise<ProofRecord> {
    let proofRecord: ProofRecord
    const { message: proofRequestMessage, connection } = messageContext

    this.logger.debug(`Processing presentation request with id ${proofRequestMessage.id}`)

    const requestAttachments = proofRequestMessage.getAttachmentFormats()

    for (const attachmentFormat of requestAttachments) {
      await this.indyProofFormatService.processRequest({
        requestAttachment: attachmentFormat,
      })
    }

    const proofRequest = proofRequestMessage.indyProofRequest

    // Assert attachment
    if (!proofRequest) {
      throw new V1PresentationProblemReportError(
        `Missing required base64 or json encoded attachment data for presentation request with thread id ${proofRequestMessage.threadId}`,
        { problemCode: PresentationProblemReportReason.Abandoned }
      )
    }
    await validateOrReject(proofRequest)

    // Assert attribute and predicate (group) names do not match
    checkProofRequestForDuplicates(proofRequest)

    this.logger.debug('received proof request', proofRequest)

    try {
      // Proof record already exists
      proofRecord = await this.getByThreadAndConnectionId(
        messageContext.agentContext,
        proofRequestMessage.threadId,
        connection?.id
      )

      const requestMessage = await this.didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: V1RequestPresentationMessage,
      })

      const proposalMessage = await this.didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: V1ProposePresentationMessage,
      })

      // Assert
      proofRecord.assertState(ProofState.ProposalSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: requestMessage ?? undefined,
        previousSentMessage: proposalMessage ?? undefined,
      })

      await this.didCommMessageRepository.saveOrUpdateAgentMessage(messageContext.agentContext, {
        agentMessage: proofRequestMessage,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Receiver,
      })

      // Update record
      await this.updateState(messageContext.agentContext, proofRecord, ProofState.RequestReceived)
    } catch {
      // No proof record exists with thread id
      proofRecord = new ProofRecord({
        connectionId: connection?.id,
        threadId: proofRequestMessage.threadId,
        state: ProofState.RequestReceived,
        protocolVersion: ProofProtocolVersion.V1,
      })

      await this.didCommMessageRepository.saveOrUpdateAgentMessage(messageContext.agentContext, {
        agentMessage: proofRequestMessage,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Receiver,
      })

      // Assert
      this.connectionService.assertConnectionOrServiceDecorator(messageContext)

      // Save in repository
      await this.proofRepository.save(messageContext.agentContext, proofRecord)
      this.emitStateChangedEvent(messageContext.agentContext, proofRecord, null)
    }

    return proofRecord
  }

  public async createPresentation(
    agentContext: AgentContext,
    options: CreatePresentationOptions<[IndyProofFormat]>
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    const { proofRecord, proofFormats } = options

    this.logger.debug(`Creating presentation for proof record with id ${proofRecord.id}`)

    if (!proofFormats.indy || Object.keys(proofFormats).length !== 1) {
      throw new AriesFrameworkError('Only indy proof format is supported for present proof protocol v1')
    }

    // Assert
    proofRecord.assertState(ProofState.RequestReceived)

    const requestMessage = await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V1RequestPresentationMessage,
    })

    const requestAttachment = requestMessage?.indyAttachment

    if (!requestAttachment) {
      throw new V1PresentationProblemReportError(
        `Missing required base64 or json encoded attachment data for presentation with thread id ${proofRecord.threadId}`,
        { problemCode: PresentationProblemReportReason.Abandoned }
      )
    }

    const presentationOptions: FormatCreatePresentationOptions<IndyProofFormat> = {
      id: INDY_PROOF_ATTACHMENT_ID,
      attachment: requestAttachment,
      proofFormats: proofFormats,
    }

    const proof = await this.indyProofFormatService.createPresentation(agentContext, presentationOptions)

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
      agentContext,
      proofRequest,
      requestedCredentials
    )

    const presentationMessage = new V1PresentationMessage({
      comment: options?.comment,
      presentationAttachments: [proof.attachment],
      attachments: linkedAttachments,
    })
    presentationMessage.setThread({ threadId: proofRecord.threadId })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: presentationMessage,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    // Update record
    await this.updateState(agentContext, proofRecord, ProofState.PresentationSent)

    return { message: presentationMessage, proofRecord }
  }

  public async processPresentation(messageContext: InboundMessageContext<V1PresentationMessage>): Promise<ProofRecord> {
    const { message: presentationMessage, connection } = messageContext

    this.logger.debug(`Processing presentation with id ${presentationMessage.id}`)

    const proofRecord = await this.getByThreadAndConnectionId(
      messageContext.agentContext,
      presentationMessage.threadId,
      connection?.id
    )

    const proposalMessage = await this.didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V1ProposePresentationMessage,
    })

    const requestMessage = await this.didCommMessageRepository.getAgentMessage(messageContext.agentContext, {
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
      const isValid = await this.indyProofFormatService.processPresentation(messageContext.agentContext, {
        record: proofRecord,
        formatAttachments: {
          presentation: presentationMessage.getAttachmentFormats(),
          request: requestMessage.getAttachmentFormats(),
        },
      })
      await this.didCommMessageRepository.saveOrUpdateAgentMessage(messageContext.agentContext, {
        agentMessage: presentationMessage,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Receiver,
      })

      // Update record
      proofRecord.isVerified = isValid
      await this.updateState(messageContext.agentContext, proofRecord, ProofState.PresentationReceived)
    } catch (e) {
      if (e instanceof AriesFrameworkError) {
        throw new V1PresentationProblemReportError(e.message, {
          problemCode: PresentationProblemReportReason.Abandoned,
        })
      }
      throw e
    }

    return proofRecord
  }

  public async processAck(messageContext: InboundMessageContext<V1PresentationAckMessage>): Promise<ProofRecord> {
    const { message: presentationAckMessage, connection } = messageContext

    this.logger.debug(`Processing presentation ack with id ${presentationAckMessage.id}`)

    const proofRecord = await this.getByThreadAndConnectionId(
      messageContext.agentContext,
      presentationAckMessage.threadId,
      connection?.id
    )

    const requestMessage = await this.didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V1RequestPresentationMessage,
    })

    const presentationMessage = await this.didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
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
    await this.updateState(messageContext.agentContext, proofRecord, ProofState.Done)

    return proofRecord
  }

  public async createProblemReport(
    agentContext: AgentContext,
    options: CreateProblemReportOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    const msg = new V1PresentationProblemReportMessage({
      description: {
        code: PresentationProblemReportReason.Abandoned,
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

  public async processProblemReport(
    messageContext: InboundMessageContext<V1PresentationProblemReportMessage>
  ): Promise<ProofRecord> {
    const { message: presentationProblemReportMessage } = messageContext

    const connection = messageContext.assertReadyConnection()

    this.logger.debug(`Processing problem report with id ${presentationProblemReportMessage.id}`)

    const proofRecord = await this.getByThreadAndConnectionId(
      messageContext.agentContext,
      presentationProblemReportMessage.threadId,
      connection?.id
    )

    proofRecord.errorMessage = `${presentationProblemReportMessage.description.code}: ${presentationProblemReportMessage.description.en}`
    await this.updateState(messageContext.agentContext, proofRecord, ProofState.Abandoned)
    return proofRecord
  }

  public async generateProofRequestNonce() {
    return this.wallet.generateNonce()
  }

  public async createProofRequestFromProposal(
    agentContext: AgentContext,
    options: CreateProofRequestFromProposalOptions
  ): Promise<ProofRequestFromProposalOptions<[IndyProofFormat]>> {
    const proofRecordId = options.proofRecord.id
    const proposalMessage = await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecordId,
      messageClass: V1ProposePresentationMessage,
    })

    if (!proposalMessage) {
      throw new AriesFrameworkError(`Proof record with id ${proofRecordId} is missing required presentation proposal`)
    }

    const indyProposeProofFormat: IndyProposeProofFormat = {
      name: 'Proof Request',
      version: '1.0',
      nonce: await this.generateProofRequestNonce(),
    }

    const proofRequest: ProofRequest = IndyProofUtils.createReferentForProofRequest(
      indyProposeProofFormat,
      proposalMessage.presentationProposal
    )

    return {
      proofRecord: options.proofRecord,
      proofFormats: {
        indy: proofRequest,
      },
    }
  }

  /**
   * Retrieves the linked attachments for an {@link indyProofRequest}
   * @param indyProofRequest The proof request for which the linked attachments have to be found
   * @param requestedCredentials The requested credentials
   * @returns a list of attachments that are linked to the requested credentials
   */
  public async getRequestedAttachmentsForRequestedCredentials(
    agentContext: AgentContext,
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

      //Get credentialInfo
      if (!requestedAttribute.credentialInfo) {
        const indyCredentialInfo = await this.indyHolderService.getCredential(
          agentContext,
          requestedAttribute.credentialId
        )
        requestedAttribute.credentialInfo = JsonTransformer.fromJSON(indyCredentialInfo, IndyCredentialInfo)
      }

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

      const credentialRecord = await this.credentialRepository.getSingleByQuery(agentContext, {
        credentialIds: [credentialId],
      })

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

  public async shouldAutoRespondToProposal(agentContext: AgentContext, proofRecord: ProofRecord): Promise<boolean> {
    const proposal = await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V1ProposePresentationMessage,
    })

    if (!proposal) {
      return false
    }
    await MessageValidator.validateSync(proposal)

    // check the proposal against a possible previous request
    const request = await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V1RequestPresentationMessage,
    })

    if (!request) {
      return false
    }

    const proofRequest = request.indyProofRequest

    if (!proofRequest) {
      throw new V1PresentationProblemReportError(
        `Missing required base64 or json encoded attachment data for presentation request with thread id ${request.threadId}`,
        { problemCode: PresentationProblemReportReason.Abandoned }
      )
    }
    await validateOrReject(proofRequest)

    // Assert attribute and predicate (group) names do not match
    checkProofRequestForDuplicates(proofRequest)

    const proposalAttributes = proposal.presentationProposal.attributes
    const requestedAttributes = proofRequest.requestedAttributes

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
    proofRequest.requestedPredicates.forEach((x) => {
      if (!providedPredicateNames.includes(x.name)) {
        return false
      }
    })
    return true
  }

  public async shouldAutoRespondToRequest(agentContext: AgentContext, proofRecord: ProofRecord): Promise<boolean> {
    const proposal = await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V1ProposePresentationMessage,
    })

    if (!proposal) {
      return false
    }

    const request = await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V1RequestPresentationMessage,
    })

    if (!request) {
      throw new AriesFrameworkError(`Expected to find a request message for ProofRecord with id ${proofRecord.id}`)
    }

    const proofRequest = request.indyProofRequest

    // Assert attachment
    if (!proofRequest) {
      throw new V1PresentationProblemReportError(
        `Missing required base64 or json encoded attachment data for presentation request with thread id ${request.threadId}`,
        { problemCode: PresentationProblemReportReason.Abandoned }
      )
    }
    await validateOrReject(proofRequest)

    // Assert attribute and predicate (group) names do not match
    checkProofRequestForDuplicates(proofRequest)

    const proposalAttributes = proposal.presentationProposal.attributes
    const requestedAttributes = proofRequest.requestedAttributes

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
    proofRequest.requestedPredicates.forEach((x) => {
      if (!providedPredicateNames.includes(x.name)) {
        return false
      }
    })

    return true
  }

  public async shouldAutoRespondToPresentation(agentContext: AgentContext, proofRecord: ProofRecord): Promise<boolean> {
    this.logger.debug(`Should auto respond to presentation for proof record id: ${proofRecord.id}`)
    return true
  }

//   src/modules/proofs/ProofsApi.ts:87:37 - error TS2344: Type '[V1ProofService, V2ProofService<PFs>]' does not satisfy the constraint 'ProofService<PFs>[]'.
//   Type 'V1ProofService | V2ProofService<PFs>' is not assignable to type 'ProofService<PFs>'.
//     Type 'V1ProofService' is not assignable to type 'ProofService<PFs>'.
//       The types returned by 'getRequestedCredentialsForProofRequest(...)' are incompatible between these types.
//         Type 'Promise<FormatRetrievedCredentialOptions<[IndyProofFormat]>>' is not assignable to type 'Promise<FormatRetrievedCredentialOptions<PFs>>'.
//           Type 'FormatRetrievedCredentialOptions<[IndyProofFormat]>' is not assignable to type 'FormatRetrievedCredentialOptions<PFs>'.
//             Types of property 'proofFormats' are incompatible.
//               Type 'ProofFormatPayload<[IndyProofFormat], "retrieveCredentials">' is not assignable to type 'ProofFormatPayload<PFs, "retrieveCredentials">'.

// 87   PSs extends ProofService<PFs>[] = [V1ProofService, V2ProofService<PFs>]

  public async getRequestedCredentialsForProofRequest(
    agentContext: AgentContext,
    options: GetRequestedCredentialsForProofRequestOptions
  ): Promise<FormatRetrievedCredentialOptions<[IndyProofFormat]>> {
    const requestMessage = await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: options.proofRecord.id,
      messageClass: V1RequestPresentationMessage,
    })

    const proposalMessage = await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: options.proofRecord.id,
      messageClass: V1ProposePresentationMessage,
    })

    const indyProofRequest = requestMessage?.requestPresentationAttachments

    if (!indyProofRequest) {
      throw new AriesFrameworkError('Could not find proof request')
    }

    const requestedCredentials: FormatRetrievedCredentialOptions<[IndyProofFormat]> =
      await this.indyProofFormatService.getRequestedCredentialsForProofRequest(agentContext, {
        attachment: indyProofRequest[0],
        presentationProposal: proposalMessage?.presentationProposal,
        config: options.config ?? undefined,
      })
    return requestedCredentials
  }

  public async autoSelectCredentialsForProofRequest(
    options: FormatRetrievedCredentialOptions<[IndyProofFormat]>
  ): Promise<FormatRequestedCredentialReturn<[IndyProofFormat]>> {
    return await this.indyProofFormatService.autoSelectCredentialsForProofRequest(options)
  }

  public registerHandlers(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    proofResponseCoordinator: ProofResponseCoordinator,
    mediationRecipientService: MediationRecipientService,
    routingService: RoutingService
  ): void {
    dispatcher.registerHandler(
      new V1ProposePresentationHandler(this, agentConfig, proofResponseCoordinator, this.didCommMessageRepository)
    )

    dispatcher.registerHandler(
      new V1RequestPresentationHandler(
        this,
        agentConfig,
        proofResponseCoordinator,
        mediationRecipientService,
        this.didCommMessageRepository,
        routingService
      )
    )

    dispatcher.registerHandler(
      new V1PresentationHandler(this, agentConfig, proofResponseCoordinator, this.didCommMessageRepository)
    )
    dispatcher.registerHandler(new V1PresentationAckHandler(this))
    dispatcher.registerHandler(new V1PresentationProblemReportHandler(this))
  }

  public async findRequestMessage(
    agentContext: AgentContext,
    proofRecordId: string
  ): Promise<V1RequestPresentationMessage | null> {
    return await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecordId,
      messageClass: V1RequestPresentationMessage,
    })
  }
  public async findPresentationMessage(
    agentContext: AgentContext,
    proofRecordId: string
  ): Promise<V1PresentationMessage | null> {
    return await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecordId,
      messageClass: V1PresentationMessage,
    })
  }

  public async findProposalMessage(
    agentContext: AgentContext,
    proofRecordId: string
  ): Promise<V1ProposePresentationMessage | null> {
    return await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecordId,
      messageClass: V1ProposePresentationMessage,
    })
  }

  /**
   * Retrieve all proof records
   *
   * @returns List containing all proof records
   */
  public async getAll(agentContext: AgentContext): Promise<ProofRecord[]> {
    return this.proofRepository.getAll(agentContext)
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
    agentContext: AgentContext,
    threadId: string,
    connectionId?: string
  ): Promise<ProofRecord> {
    return this.proofRepository.getSingleByQuery(agentContext, { threadId, connectionId })
  }

  public async createAck(
    gentContext: AgentContext,
    options: CreateAckOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    const { proofRecord } = options
    this.logger.debug(`Creating presentation ack for proof record with id ${proofRecord.id}`)

    // Assert
    proofRecord.assertState(ProofState.PresentationReceived)

    // Create message
    const ackMessage = new V1PresentationAckMessage({
      status: AckStatus.OK,
      threadId: proofRecord.threadId,
    })

    // Update record
    await this.updateState(gentContext, proofRecord, ProofState.Done)

    return { message: ackMessage, proofRecord }
  }
}
