import type { AgentContext } from '@credo-ts/core'
import type {
  DidCommFeatureRegistry,
  DidCommInboundMessageContext,
  DidCommMessage,
  DidCommMessageHandlerRegistry,
  DidCommProblemReportMessage,
  DidCommProofFormat,
  GetProofFormatDataReturn,
  ProofProtocol,
  ProofProtocolOptions,
} from '@credo-ts/didcomm'
import type { LegacyIndyDidCommProofFormatService } from '../../../formats'

import { CredoError, JsonEncoder, JsonTransformer, MessageValidator, utils } from '@credo-ts/core'
import {
  AckStatus,
  BaseProofProtocol,
  DidCommAttachment,
  DidCommAutoAcceptProof,
  DidCommConnectionService,
  DidCommMessageRepository,
  DidCommMessageRole,
  DidCommPresentationProblemReportReason,
  DidCommProofExchangeRecord,
  DidCommProofExchangeRepository,
  DidCommProofRole,
  DidCommProofState,
  DidCommProofsModuleConfig,
  DidCommProtocol,
} from '@credo-ts/didcomm'

import { composeProofAutoAccept, createRequestFromPreview } from '../../../utils'

import { AnonCredsHolderService, AnonCredsHolderServiceSymbol } from '../../../services'
import { DidCommPresentationV1ProblemReportError } from './errors'
import {
  DidCommPresentationV1AckHandler,
  DidCommPresentationV1Handler,
  DidCommPresentationV1ProblemReportHandler,
  DidCommProposePresentationV1Handler,
  DidCommRequestPresentationV1Handler,
} from './handlers'
import {
  DidCommPresentationV1AckMessage,
  DidCommPresentationV1Message,
  DidCommProposePresentationV1Message,
  DidCommRequestPresentationV1Message,
  INDY_PROOF_ATTACHMENT_ID,
  INDY_PROOF_REQUEST_ATTACHMENT_ID,
} from './messages'
import { DidCommPresentationV1ProblemReportMessage } from './messages/DidCommPresentationV1ProblemReportMessage'
import { DidCommPresentationV1Preview } from './models/DidCommPresentationV1Preview'

export interface DidCommProofV1ProtocolConfig {
  indyProofFormat: LegacyIndyDidCommProofFormatService
}

export class DidCommProofV1Protocol extends BaseProofProtocol implements ProofProtocol<[LegacyIndyDidCommProofFormatService]> {
  private indyProofFormat: LegacyIndyDidCommProofFormatService

  public constructor({ indyProofFormat }: DidCommProofV1ProtocolConfig) {
    super()

    // TODO: just create a new instance of LegacyIndyDidCommProofFormatService here so it makes the setup easier
    this.indyProofFormat = indyProofFormat
  }

  /**
   * The version of the present proof protocol this protocol supports
   */
  public readonly version = 'v1' as const

  /**
   * Registers the protocol implementation (handlers, feature registry) on the agent.
   */
  public register(messageHandlerRegistry: DidCommMessageHandlerRegistry, featureRegistry: DidCommFeatureRegistry) {
    // Register message handlers for the Issue Credential V1 Protocol
    messageHandlerRegistry.registerMessageHandlers([
      new DidCommProposePresentationV1Handler(this),
      new DidCommRequestPresentationV1Handler(this),
      new DidCommPresentationV1Handler(this),
      new DidCommPresentationV1AckHandler(this),
      new DidCommPresentationV1ProblemReportHandler(this),
    ])

    // Register Present Proof V1 in feature registry, with supported roles
    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/present-proof/1.0',
        roles: ['prover', 'verifier'],
      })
    )
  }

  public async createProposal(
    agentContext: AgentContext,
    {
      proofFormats,
      connectionRecord,
      comment,
      parentThreadId,
      autoAcceptProof,
    }: ProofProtocolOptions.CreateProofProposalOptions<[LegacyIndyDidCommProofFormatService]>
  ): Promise<ProofProtocolOptions.ProofProtocolMsgReturnType<DidCommProposePresentationV1Message>> {
    this.assertOnlyIndyFormat(proofFormats)

    const proofRepository = agentContext.dependencyManager.resolve(DidCommProofExchangeRepository)
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    if (!proofFormats.indy) {
      throw new CredoError('Missing indy proof format in v1 create proposal call.')
    }

    const presentationProposal = new DidCommPresentationV1Preview({
      attributes: proofFormats.indy?.attributes,
      predicates: proofFormats.indy?.predicates,
    })

    // validate input data from user
    MessageValidator.validateSync(presentationProposal)

    // Create message
    const message = new DidCommProposePresentationV1Message({
      presentationProposal,
      comment,
    })

    if (parentThreadId)
      message.setThread({
        parentThreadId,
      })

    // Create record
    const proofRecord = new DidCommProofExchangeRecord({
      connectionId: connectionRecord.id,
      threadId: message.threadId,
      parentThreadId: message.thread?.parentThreadId,
      state: DidCommProofState.ProposalSent,
      role: DidCommProofRole.Prover,
      autoAcceptProof,
      protocolVersion: 'v1',
    })

    await didCommMessageRepository.saveAgentMessage(agentContext, {
      agentMessage: message,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    await proofRepository.save(agentContext, proofRecord)
    this.emitStateChangedEvent(agentContext, proofRecord, null)

    return { proofRecord, message }
  }

  public async processProposal(
    messageContext: DidCommInboundMessageContext<DidCommProposePresentationV1Message>
  ): Promise<DidCommProofExchangeRecord> {
    const { message: proposalMessage, connection, agentContext } = messageContext

    const proofRepository = agentContext.dependencyManager.resolve(DidCommProofExchangeRepository)
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // TODO: with this method, we should update the credential protocol to use the ConnectionApi, so it
    // only depends on the public api, rather than the internal API (this helps with breaking changes)
    const connectionService = agentContext.dependencyManager.resolve(DidCommConnectionService)

    agentContext.config.logger.debug(`Processing presentation proposal with message id ${proposalMessage.id}`)

    let proofRecord = await this.findByProperties(agentContext, {
      threadId: proposalMessage.threadId,
      role: DidCommProofRole.Verifier,
      connectionId: connection?.id,
    })

    // Proof record already exists, this is a response to an earlier message sent by us
    if (proofRecord) {
      agentContext.config.logger.debug('Proof record already exists for incoming proposal')

      // Assert
      proofRecord.assertState(DidCommProofState.RequestSent)
      proofRecord.assertProtocolVersion('v1')

      const lastReceivedMessage = await didCommMessageRepository.findAgentMessage(agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: DidCommProposePresentationV1Message,
        role: DidCommMessageRole.Receiver,
      })
      const lastSentMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: DidCommRequestPresentationV1Message,
        role: DidCommMessageRole.Sender,
      })
      await connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
        lastReceivedMessage,
        lastSentMessage,
        expectedConnectionId: proofRecord.connectionId,
      })

      // Update record
      await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
        agentMessage: proposalMessage,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Receiver,
      })
      await this.updateState(agentContext, proofRecord, DidCommProofState.ProposalReceived)
    } else {
      agentContext.config.logger.debug('Proof record does not exist yet for incoming proposal')
      // Assert
      await connectionService.assertConnectionOrOutOfBandExchange(messageContext)

      // No proof record exists with thread id
      proofRecord = new DidCommProofExchangeRecord({
        connectionId: connection?.id,
        threadId: proposalMessage.threadId,
        parentThreadId: proposalMessage.thread?.parentThreadId,
        state: DidCommProofState.ProposalReceived,
        role: DidCommProofRole.Verifier,
        protocolVersion: 'v1',
      })

      await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
        agentMessage: proposalMessage,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Receiver,
      })

      // Save record
      await proofRepository.save(agentContext, proofRecord)
      this.emitStateChangedEvent(agentContext, proofRecord, null)
    }

    return proofRecord
  }

  public async acceptProposal(
    agentContext: AgentContext,
    {
      proofRecord,
      proofFormats,
      comment,
      autoAcceptProof,
    }: ProofProtocolOptions.AcceptProofProposalOptions<[LegacyIndyDidCommProofFormatService]>
  ): Promise<ProofProtocolOptions.ProofProtocolMsgReturnType<DidCommRequestPresentationV1Message>> {
    // Assert
    proofRecord.assertProtocolVersion('v1')
    proofRecord.assertState(DidCommProofState.ProposalReceived)
    if (proofFormats) this.assertOnlyIndyFormat(proofFormats)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const proposalMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommProposePresentationV1Message,
      role: DidCommMessageRole.Receiver,
    })

    const indyFormat = proofFormats?.indy

    const anonCredsHolderService = agentContext.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    // Create a proof request from the preview, so we can let the messages
    // be handled using the indy proof format which supports RFC0592
    const requestFromPreview = createRequestFromPreview({
      attributes: proposalMessage.presentationProposal.attributes,
      predicates: proposalMessage.presentationProposal.predicates,
      name: indyFormat?.name ?? 'Proof Request',
      version: indyFormat?.version ?? '1.0',
      nonce: anonCredsHolderService.generateNonce(agentContext),
    })

    const proposalAttachment = new DidCommAttachment({
      data: {
        json: JsonTransformer.toJSON(requestFromPreview),
      },
    })

    // Create message
    const { attachment } = await this.indyProofFormat.acceptProposal(agentContext, {
      attachmentId: INDY_PROOF_REQUEST_ATTACHMENT_ID,
      proofRecord,
      proposalAttachment,
    })

    const requestPresentationMessage = new DidCommRequestPresentationV1Message({
      comment,
      requestAttachments: [attachment],
    })

    requestPresentationMessage.setThread({
      threadId: proofRecord.threadId,
      parentThreadId: proofRecord.parentThreadId,
    })

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: requestPresentationMessage,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    // Update record
    proofRecord.autoAcceptProof = autoAcceptProof ?? proofRecord.autoAcceptProof
    await this.updateState(agentContext, proofRecord, DidCommProofState.RequestSent)

    return { message: requestPresentationMessage, proofRecord }
  }

  public async negotiateProposal(
    agentContext: AgentContext,
    {
      proofFormats,
      proofRecord,
      comment,
      autoAcceptProof,
    }: ProofProtocolOptions.NegotiateProofProposalOptions<[LegacyIndyDidCommProofFormatService]>
  ): Promise<ProofProtocolOptions.ProofProtocolMsgReturnType<DidCommMessage>> {
    // Assert
    proofRecord.assertProtocolVersion('v1')
    proofRecord.assertState(DidCommProofState.ProposalReceived)
    this.assertOnlyIndyFormat(proofFormats)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // Create message
    const { attachment } = await this.indyProofFormat.createRequest(agentContext, {
      attachmentId: INDY_PROOF_REQUEST_ATTACHMENT_ID,
      proofFormats,
      proofRecord,
    })

    const requestPresentationMessage = new DidCommRequestPresentationV1Message({
      comment,
      requestAttachments: [attachment],
    })
    requestPresentationMessage.setThread({
      threadId: proofRecord.threadId,
      parentThreadId: proofRecord.parentThreadId,
    })

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: requestPresentationMessage,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    proofRecord.autoAcceptProof = autoAcceptProof ?? proofRecord.autoAcceptProof
    await this.updateState(agentContext, proofRecord, DidCommProofState.RequestSent)

    return { message: requestPresentationMessage, proofRecord }
  }

  public async createRequest(
    agentContext: AgentContext,
    {
      proofFormats,
      connectionRecord,
      comment,
      parentThreadId,
      autoAcceptProof,
    }: ProofProtocolOptions.CreateProofRequestOptions<[LegacyIndyDidCommProofFormatService]>
  ): Promise<ProofProtocolOptions.ProofProtocolMsgReturnType<DidCommMessage>> {
    this.assertOnlyIndyFormat(proofFormats)

    const proofRepository = agentContext.dependencyManager.resolve(DidCommProofExchangeRepository)
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    if (!proofFormats.indy) {
      throw new CredoError('Missing indy proof request data for v1 create request')
    }

    // Create record
    const proofRecord = new DidCommProofExchangeRecord({
      connectionId: connectionRecord?.id,
      threadId: utils.uuid(),
      parentThreadId,
      state: DidCommProofState.RequestSent,
      role: DidCommProofRole.Verifier,
      autoAcceptProof,
      protocolVersion: 'v1',
    })

    // Create message
    const { attachment } = await this.indyProofFormat.createRequest(agentContext, {
      attachmentId: INDY_PROOF_REQUEST_ATTACHMENT_ID,
      proofFormats,
      proofRecord,
    })

    // Construct request message
    const message = new DidCommRequestPresentationV1Message({
      id: proofRecord.threadId,
      comment,
      requestAttachments: [attachment],
    })

    message.setThread({
      threadId: proofRecord.threadId,
      parentThreadId: proofRecord.parentThreadId,
    })

    await didCommMessageRepository.saveAgentMessage(agentContext, {
      agentMessage: message,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    await proofRepository.save(agentContext, proofRecord)
    this.emitStateChangedEvent(agentContext, proofRecord, null)

    return { message, proofRecord }
  }

  public async processRequest(
    messageContext: DidCommInboundMessageContext<DidCommRequestPresentationV1Message>
  ): Promise<DidCommProofExchangeRecord> {
    const { message: proofRequestMessage, connection, agentContext } = messageContext

    const proofRepository = agentContext.dependencyManager.resolve(DidCommProofExchangeRepository)
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // TODO: with this method, we should update the credential protocol to use the ConnectionApi, so it
    // only depends on the public api, rather than the internal API (this helps with breaking changes)
    const connectionService = agentContext.dependencyManager.resolve(DidCommConnectionService)

    agentContext.config.logger.debug(`Processing presentation request with id ${proofRequestMessage.id}`)

    let proofRecord = await this.findByProperties(agentContext, {
      threadId: proofRequestMessage.threadId,
      role: DidCommProofRole.Prover,
      connectionId: connection?.id,
    })

    const requestAttachment = proofRequestMessage.getRequestAttachmentById(INDY_PROOF_REQUEST_ATTACHMENT_ID)
    if (!requestAttachment) {
      throw new CredoError(`Indy attachment with id ${INDY_PROOF_REQUEST_ATTACHMENT_ID} not found in request message`)
    }

    // proof record already exists, this means we are the message is sent as reply to a proposal we sent
    if (proofRecord) {
      const lastReceivedMessage = await didCommMessageRepository.findAgentMessage(agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: DidCommRequestPresentationV1Message,
        role: DidCommMessageRole.Receiver,
      })
      const lastSentMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: DidCommProposePresentationV1Message,
        role: DidCommMessageRole.Sender,
      })

      // Assert
      proofRecord.assertProtocolVersion('v1')
      proofRecord.assertState(DidCommProofState.ProposalSent)
      await connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
        lastReceivedMessage,
        lastSentMessage,
        expectedConnectionId: proofRecord.connectionId,
      })

      await this.indyProofFormat.processRequest(agentContext, {
        attachment: requestAttachment,
        proofRecord,
      })

      await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
        agentMessage: proofRequestMessage,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Receiver,
      })
      await this.updateState(agentContext, proofRecord, DidCommProofState.RequestReceived)
    } else {
      // Assert
      await connectionService.assertConnectionOrOutOfBandExchange(messageContext)

      // No proof record exists with thread id
      proofRecord = new DidCommProofExchangeRecord({
        connectionId: connection?.id,
        threadId: proofRequestMessage.threadId,
        parentThreadId: proofRequestMessage.thread?.parentThreadId,
        state: DidCommProofState.RequestReceived,
        role: DidCommProofRole.Prover,
        protocolVersion: 'v1',
      })

      await this.indyProofFormat.processRequest(agentContext, {
        attachment: requestAttachment,
        proofRecord,
      })

      await didCommMessageRepository.saveAgentMessage(agentContext, {
        agentMessage: proofRequestMessage,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Receiver,
      })

      // Save in repository
      await proofRepository.save(agentContext, proofRecord)
      this.emitStateChangedEvent(agentContext, proofRecord, null)
    }

    return proofRecord
  }

  public async negotiateRequest(
    agentContext: AgentContext,
    {
      proofFormats,
      proofRecord,
      comment,
      autoAcceptProof,
    }: ProofProtocolOptions.NegotiateProofRequestOptions<[LegacyIndyDidCommProofFormatService]>
  ): Promise<ProofProtocolOptions.ProofProtocolMsgReturnType<DidCommMessage>> {
    // Assert
    proofRecord.assertProtocolVersion('v1')
    proofRecord.assertState(DidCommProofState.RequestReceived)
    this.assertOnlyIndyFormat(proofFormats)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    if (!proofRecord.connectionId) {
      throw new CredoError(
        `No connectionId found for proof record '${proofRecord.id}'. Connection-less verification does not support negotiation.`
      )
    }

    if (!proofFormats.indy) {
      throw new CredoError('Missing indy proof format in v1 negotiate request call.')
    }

    const presentationProposal = new DidCommPresentationV1Preview({
      attributes: proofFormats.indy?.attributes,
      predicates: proofFormats.indy?.predicates,
    })

    // validate input data from user
    MessageValidator.validateSync(presentationProposal)

    const message = new DidCommProposePresentationV1Message({
      comment,
      presentationProposal,
    })
    message.setThread({ threadId: proofRecord.threadId, parentThreadId: proofRecord.parentThreadId })

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    // Update record
    proofRecord.autoAcceptProof = autoAcceptProof ?? proofRecord.autoAcceptProof
    await this.updateState(agentContext, proofRecord, DidCommProofState.ProposalSent)

    return { proofRecord, message: message }
  }

  public async acceptRequest(
    agentContext: AgentContext,
    {
      proofRecord,
      proofFormats,
      autoAcceptProof,
      comment,
    }: ProofProtocolOptions.AcceptProofRequestOptions<[LegacyIndyDidCommProofFormatService]>
  ): Promise<ProofProtocolOptions.ProofProtocolMsgReturnType<DidCommMessage>> {
    // Assert
    proofRecord.assertProtocolVersion('v1')
    proofRecord.assertState(DidCommProofState.RequestReceived)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const requestMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommRequestPresentationV1Message,
      role: DidCommMessageRole.Receiver,
    })
    const proposalMessage = await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommProposePresentationV1Message,
      role: DidCommMessageRole.Sender,
    })

    const requestAttachment = requestMessage.getRequestAttachmentById(INDY_PROOF_REQUEST_ATTACHMENT_ID)
    const indyProofRequest = requestMessage.indyProofRequest

    if (!requestAttachment || !indyProofRequest) {
      throw new DidCommPresentationV1ProblemReportError(
        `Missing indy attachment in request message for presentation with thread id ${proofRecord.threadId}`,
        { problemCode: DidCommPresentationProblemReportReason.Abandoned }
      )
    }

    const proposalAttachment = proposalMessage
      ? new DidCommAttachment({
          data: {
            json: JsonTransformer.toJSON(
              createRequestFromPreview({
                attributes: proposalMessage.presentationProposal?.attributes,
                predicates: proposalMessage.presentationProposal?.predicates,
                name: indyProofRequest.name,
                nonce: indyProofRequest.nonce,
                version: indyProofRequest.nonce,
              })
            ),
          },
        })
      : undefined

    const { attachment } = await this.indyProofFormat.acceptRequest(agentContext, {
      attachmentId: INDY_PROOF_ATTACHMENT_ID,
      requestAttachment,
      proposalAttachment,
      proofFormats,
      proofRecord,
    })

    const message = new DidCommPresentationV1Message({
      comment,
      presentationAttachments: [attachment],
    })
    message.setThread({ threadId: proofRecord.threadId, parentThreadId: proofRecord.parentThreadId })

    await didCommMessageRepository.saveAgentMessage(agentContext, {
      agentMessage: message,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    // Update record
    proofRecord.autoAcceptProof = autoAcceptProof ?? proofRecord.autoAcceptProof
    await this.updateState(agentContext, proofRecord, DidCommProofState.PresentationSent)

    return { message, proofRecord }
  }

  public async getCredentialsForRequest(
    agentContext: AgentContext,
    { proofRecord, proofFormats }: ProofProtocolOptions.GetCredentialsForRequestOptions<[LegacyIndyDidCommProofFormatService]>
  ): Promise<ProofProtocolOptions.GetCredentialsForRequestReturn<[LegacyIndyDidCommProofFormatService]>> {
    if (proofFormats) this.assertOnlyIndyFormat(proofFormats)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const requestMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommRequestPresentationV1Message,
      role: DidCommMessageRole.Receiver,
    })

    const proposalMessage = await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommProposePresentationV1Message,
      role: DidCommMessageRole.Sender,
    })

    const requestAttachment = requestMessage.getRequestAttachmentById(INDY_PROOF_REQUEST_ATTACHMENT_ID)
    const indyProofRequest = requestMessage.indyProofRequest

    if (!requestAttachment || !indyProofRequest) {
      throw new CredoError(
        `Missing indy attachment in request message for presentation with thread id ${proofRecord.threadId}`
      )
    }

    const proposalAttachment = proposalMessage
      ? new DidCommAttachment({
          data: {
            json: JsonTransformer.toJSON(
              createRequestFromPreview({
                attributes: proposalMessage.presentationProposal?.attributes,
                predicates: proposalMessage.presentationProposal?.predicates,
                name: indyProofRequest.name,
                nonce: indyProofRequest.nonce,
                version: indyProofRequest.nonce,
              })
            ),
          },
        })
      : undefined

    const credentialForRequest = await this.indyProofFormat.getCredentialsForRequest(agentContext, {
      proofRecord,
      requestAttachment,
      proofFormats,
      proposalAttachment,
    })

    return {
      proofFormats: {
        indy: credentialForRequest,
      },
    }
  }

  public async selectCredentialsForRequest(
    agentContext: AgentContext,
    {
      proofRecord,
      proofFormats,
    }: ProofProtocolOptions.SelectCredentialsForRequestOptions<[LegacyIndyDidCommProofFormatService]>
  ): Promise<ProofProtocolOptions.SelectCredentialsForRequestReturn<[LegacyIndyDidCommProofFormatService]>> {
    if (proofFormats) this.assertOnlyIndyFormat(proofFormats)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const requestMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommRequestPresentationV1Message,
      role: DidCommMessageRole.Receiver,
    })

    const proposalMessage = await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommProposePresentationV1Message,
      role: DidCommMessageRole.Sender,
    })

    const requestAttachment = requestMessage.getRequestAttachmentById(INDY_PROOF_REQUEST_ATTACHMENT_ID)
    const indyProofRequest = requestMessage.indyProofRequest

    if (!requestAttachment || !indyProofRequest) {
      throw new CredoError(
        `Missing indy attachment in request message for presentation with thread id ${proofRecord.threadId}`
      )
    }

    const proposalAttachment = proposalMessage
      ? new DidCommAttachment({
          data: {
            json: JsonTransformer.toJSON(
              createRequestFromPreview({
                attributes: proposalMessage.presentationProposal?.attributes,
                predicates: proposalMessage.presentationProposal?.predicates,
                name: indyProofRequest.name,
                nonce: indyProofRequest.nonce,
                version: indyProofRequest.nonce,
              })
            ),
          },
        })
      : undefined

    const selectedCredentials = await this.indyProofFormat.selectCredentialsForRequest(agentContext, {
      proofFormats,
      proofRecord,
      requestAttachment,
      proposalAttachment,
    })

    return {
      proofFormats: {
        indy: selectedCredentials,
      },
    }
  }

  public async processPresentation(
    messageContext: DidCommInboundMessageContext<DidCommPresentationV1Message>
  ): Promise<DidCommProofExchangeRecord> {
    const { message: presentationMessage, connection, agentContext } = messageContext

    agentContext.config.logger.debug(`Processing presentation with message id ${presentationMessage.id}`)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // TODO: with this method, we should update the credential protocol to use the ConnectionApi, so it
    // only depends on the public api, rather than the internal API (this helps with breaking changes)
    const connectionService = agentContext.dependencyManager.resolve(DidCommConnectionService)

    const proofRecord = await this.getByProperties(agentContext, {
      threadId: presentationMessage.threadId,
      role: DidCommProofRole.Verifier,
    })

    const proposalMessage = await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommProposePresentationV1Message,
      role: DidCommMessageRole.Receiver,
    })

    const requestMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommRequestPresentationV1Message,
      role: DidCommMessageRole.Sender,
    })

    // Assert
    proofRecord.assertState(DidCommProofState.RequestSent)
    proofRecord.assertProtocolVersion('v1')
    await connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
      lastReceivedMessage: proposalMessage,
      lastSentMessage: requestMessage,
      expectedConnectionId: proofRecord.connectionId,
    })

    // This makes sure that the sender of the incoming message is authorized to do so.
    if (!proofRecord.connectionId) {
      await connectionService.matchIncomingMessageToRequestMessageInOutOfBandExchange(messageContext, {
        expectedConnectionId: proofRecord.connectionId,
      })

      proofRecord.connectionId = connection?.id
    }

    const presentationAttachment = presentationMessage.getPresentationAttachmentById(INDY_PROOF_ATTACHMENT_ID)
    if (!presentationAttachment) {
      proofRecord.errorMessage = 'Missing indy proof attachment'
      await this.updateState(agentContext, proofRecord, DidCommProofState.Abandoned)
      throw new DidCommPresentationV1ProblemReportError(proofRecord.errorMessage, {
        problemCode: DidCommPresentationProblemReportReason.Abandoned,
      })
    }

    const requestAttachment = requestMessage.getRequestAttachmentById(INDY_PROOF_REQUEST_ATTACHMENT_ID)
    if (!requestAttachment) {
      proofRecord.errorMessage = 'Missing indy proof request attachment'
      await this.updateState(agentContext, proofRecord, DidCommProofState.Abandoned)
      throw new DidCommPresentationV1ProblemReportError(proofRecord.errorMessage, {
        problemCode: DidCommPresentationProblemReportReason.Abandoned,
      })
    }

    await didCommMessageRepository.saveAgentMessage(agentContext, {
      agentMessage: presentationMessage,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Receiver,
    })

    let isValid: boolean
    try {
      isValid = await this.indyProofFormat.processPresentation(agentContext, {
        proofRecord,
        attachment: presentationAttachment,
        requestAttachment,
      })
    } catch (error) {
      proofRecord.errorMessage = error.message ?? 'Error verifying proof on presentation'
      proofRecord.isVerified = false
      await this.updateState(agentContext, proofRecord, DidCommProofState.Abandoned)
      throw new DidCommPresentationV1ProblemReportError('Error verifying proof on presentation', {
        problemCode: DidCommPresentationProblemReportReason.Abandoned,
      })
    }

    if (!isValid) {
      proofRecord.errorMessage = 'Invalid proof'
      proofRecord.isVerified = false
      await this.updateState(agentContext, proofRecord, DidCommProofState.Abandoned)
      throw new DidCommPresentationV1ProblemReportError('Invalid proof', {
        problemCode: DidCommPresentationProblemReportReason.Abandoned,
      })
    }

    // Update record
    proofRecord.isVerified = isValid
    await this.updateState(agentContext, proofRecord, DidCommProofState.PresentationReceived)

    return proofRecord
  }

  public async acceptPresentation(
    agentContext: AgentContext,
    { proofRecord }: ProofProtocolOptions.AcceptPresentationOptions
  ): Promise<ProofProtocolOptions.ProofProtocolMsgReturnType<DidCommPresentationV1AckMessage>> {
    agentContext.config.logger.debug(`Creating presentation ack for proof record with id ${proofRecord.id}`)

    // Assert
    proofRecord.assertProtocolVersion('v1')
    proofRecord.assertState(DidCommProofState.PresentationReceived)

    // Create message
    const ackMessage = new DidCommPresentationV1AckMessage({
      status: AckStatus.OK,
      threadId: proofRecord.threadId,
    })

    ackMessage.setThread({
      threadId: proofRecord.threadId,
      parentThreadId: proofRecord.parentThreadId,
    })

    // Update record
    await this.updateState(agentContext, proofRecord, DidCommProofState.Done)

    return { message: ackMessage, proofRecord }
  }

  public async processAck(
    messageContext: DidCommInboundMessageContext<DidCommPresentationV1AckMessage>
  ): Promise<DidCommProofExchangeRecord> {
    const { message: presentationAckMessage, connection, agentContext } = messageContext

    agentContext.config.logger.debug(`Processing presentation ack with message id ${presentationAckMessage.id}`)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // TODO: with this method, we should update the credential protocol to use the ConnectionApi, so it
    // only depends on the public api, rather than the internal API (this helps with breaking changes)
    const connectionService = agentContext.dependencyManager.resolve(DidCommConnectionService)

    const proofRecord = await this.getByProperties(agentContext, {
      threadId: presentationAckMessage.threadId,
      role: DidCommProofRole.Prover,
      connectionId: connection?.id,
    })

    const lastReceivedMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommRequestPresentationV1Message,
      role: DidCommMessageRole.Receiver,
    })

    const lastSentMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommPresentationV1Message,
      role: DidCommMessageRole.Sender,
    })

    // Assert
    proofRecord.assertProtocolVersion('v1')
    proofRecord.assertState(DidCommProofState.PresentationSent)
    await connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
      lastReceivedMessage,
      lastSentMessage,
      expectedConnectionId: proofRecord.connectionId,
    })

    // Update record
    await this.updateState(agentContext, proofRecord, DidCommProofState.Done)

    return proofRecord
  }

  public async createProblemReport(
    _agentContext: AgentContext,
    { proofRecord, description }: ProofProtocolOptions.CreateProofProblemReportOptions
  ): Promise<ProofProtocolOptions.ProofProtocolMsgReturnType<DidCommProblemReportMessage>> {
    const message = new DidCommPresentationV1ProblemReportMessage({
      description: {
        code: DidCommPresentationProblemReportReason.Abandoned,
        en: description,
      },
    })

    message.setThread({
      threadId: proofRecord.threadId,
      parentThreadId: proofRecord.parentThreadId,
    })

    return {
      proofRecord,
      message,
    }
  }

  public async shouldAutoRespondToProposal(
    agentContext: AgentContext,
    options: {
      proofRecord: DidCommProofExchangeRecord
      proposalMessage: DidCommProposePresentationV1Message
    }
  ): Promise<boolean> {
    const { proofRecord, proposalMessage } = options

    const proofsModuleConfig = agentContext.dependencyManager.resolve(DidCommProofsModuleConfig)

    const autoAccept = composeProofAutoAccept(proofRecord.autoAcceptProof, proofsModuleConfig.autoAcceptProofs)

    // Handle always / never cases
    if (autoAccept === DidCommAutoAcceptProof.Always) return true
    if (autoAccept === DidCommAutoAcceptProof.Never) return false

    // We are in the ContentApproved case. We need to make sure we've sent a request, and it matches the proposal
    const requestMessage = await this.findRequestMessage(agentContext, proofRecord.id)
    const requestAttachment = requestMessage?.getRequestAttachmentById(INDY_PROOF_REQUEST_ATTACHMENT_ID)
    if (!requestAttachment) return false

    const anonCredsHolderService = agentContext.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    const rfc0592Proposal = JsonTransformer.toJSON(
      createRequestFromPreview({
        name: 'Proof Request',
        nonce: anonCredsHolderService.generateNonce(agentContext),
        version: '1.0',
        attributes: proposalMessage.presentationProposal.attributes,
        predicates: proposalMessage.presentationProposal.predicates,
      })
    )

    return this.indyProofFormat.shouldAutoRespondToProposal(agentContext, {
      proofRecord,
      proposalAttachment: new DidCommAttachment({
        data: {
          json: rfc0592Proposal,
        },
      }),
      requestAttachment,
    })
  }

  public async shouldAutoRespondToRequest(
    agentContext: AgentContext,
    options: {
      proofRecord: DidCommProofExchangeRecord
      requestMessage: DidCommRequestPresentationV1Message
    }
  ): Promise<boolean> {
    const { proofRecord, requestMessage } = options

    const proofsModuleConfig = agentContext.dependencyManager.resolve(DidCommProofsModuleConfig)

    const autoAccept = composeProofAutoAccept(proofRecord.autoAcceptProof, proofsModuleConfig.autoAcceptProofs)

    // Handle always / never cases
    if (autoAccept === DidCommAutoAcceptProof.Always) return true
    if (autoAccept === DidCommAutoAcceptProof.Never) return false

    const requestAttachment = requestMessage.getRequestAttachmentById(INDY_PROOF_REQUEST_ATTACHMENT_ID)
    if (!requestAttachment) return false

    // We are in the ContentApproved case. We need to make sure we've sent a proposal, and it matches the request
    const proposalMessage = await this.findProposalMessage(agentContext, proofRecord.id)
    if (!proposalMessage) return false

    const anonCredsHolderService = agentContext.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    const rfc0592Proposal = createRequestFromPreview({
      name: 'Proof Request',
      nonce: anonCredsHolderService.generateNonce(agentContext),
      version: '1.0',
      attributes: proposalMessage.presentationProposal.attributes,
      predicates: proposalMessage.presentationProposal.predicates,
    })

    return this.indyProofFormat.shouldAutoRespondToRequest(agentContext, {
      proofRecord,
      proposalAttachment: new DidCommAttachment({
        data: {
          base64: JsonEncoder.toBase64(rfc0592Proposal),
        },
      }),
      requestAttachment,
    })
  }

  public async shouldAutoRespondToPresentation(
    agentContext: AgentContext,
    options: {
      proofRecord: DidCommProofExchangeRecord
      presentationMessage: DidCommPresentationV1Message
    }
  ): Promise<boolean> {
    const { proofRecord, presentationMessage } = options

    const proofsModuleConfig = agentContext.dependencyManager.resolve(DidCommProofsModuleConfig)

    const autoAccept = composeProofAutoAccept(proofRecord.autoAcceptProof, proofsModuleConfig.autoAcceptProofs)

    // Handle always / never cases
    if (autoAccept === DidCommAutoAcceptProof.Always) return true
    if (autoAccept === DidCommAutoAcceptProof.Never) return false

    const presentationAttachment = presentationMessage.getPresentationAttachmentById(INDY_PROOF_ATTACHMENT_ID)
    if (!presentationAttachment) return false

    // We are in the ContentApproved case. We need to make sure we've sent a request, and it matches the presentation
    const requestMessage = await this.findRequestMessage(agentContext, proofRecord.id)
    const requestAttachment = requestMessage?.getRequestAttachmentById(INDY_PROOF_REQUEST_ATTACHMENT_ID)
    if (!requestAttachment) return false

    // We are in the ContentApproved case. We need to make sure we've sent a proposal, and it matches the request
    const proposalMessage = await this.findProposalMessage(agentContext, proofRecord.id)

    const anonCredsHolderService = agentContext.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    const rfc0592Proposal = proposalMessage
      ? JsonTransformer.toJSON(
          createRequestFromPreview({
            name: 'Proof Request',
            nonce: await anonCredsHolderService.generateNonce(agentContext),
            version: '1.0',
            attributes: proposalMessage.presentationProposal.attributes,
            predicates: proposalMessage.presentationProposal.predicates,
          })
        )
      : undefined

    return this.indyProofFormat.shouldAutoRespondToPresentation(agentContext, {
      proofRecord,
      requestAttachment,
      presentationAttachment,
      proposalAttachment: new DidCommAttachment({
        data: {
          json: rfc0592Proposal,
        },
      }),
    })
  }

  public async findProposalMessage(
    agentContext: AgentContext,
    proofExchangeRecordId: string
  ): Promise<DidCommProposePresentationV1Message | null> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)
    return await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofExchangeRecordId,
      messageClass: DidCommProposePresentationV1Message,
    })
  }

  public async findRequestMessage(
    agentContext: AgentContext,
    proofExchangeRecordId: string
  ): Promise<DidCommRequestPresentationV1Message | null> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)
    return await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofExchangeRecordId,
      messageClass: DidCommRequestPresentationV1Message,
    })
  }

  public async findPresentationMessage(
    agentContext: AgentContext,
    proofExchangeRecordId: string
  ): Promise<DidCommPresentationV1Message | null> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)
    return await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofExchangeRecordId,
      messageClass: DidCommPresentationV1Message,
    })
  }

  public async getFormatData(
    agentContext: AgentContext,
    proofExchangeRecordId: string
  ): Promise<GetProofFormatDataReturn<DidCommProofFormat[]>> {
    const anonCredsHolderService = agentContext.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    // TODO: we could looking at fetching all record using a single query and then filtering based on the type of the message.
    const [proposalMessage, requestMessage, presentationMessage] = await Promise.all([
      this.findProposalMessage(agentContext, proofExchangeRecordId),
      this.findRequestMessage(agentContext, proofExchangeRecordId),
      this.findPresentationMessage(agentContext, proofExchangeRecordId),
    ])

    let indyProposeProof = undefined
    const indyRequestProof = requestMessage?.indyProofRequest ?? undefined
    const indyPresentProof = presentationMessage?.indyProof ?? undefined

    if (proposalMessage && indyRequestProof) {
      indyProposeProof = createRequestFromPreview({
        name: indyRequestProof.name,
        version: indyRequestProof.version,
        nonce: indyRequestProof.nonce,
        attributes: proposalMessage.presentationProposal.attributes,
        predicates: proposalMessage.presentationProposal.predicates,
      })
    } else if (proposalMessage) {
      indyProposeProof = createRequestFromPreview({
        name: 'Proof Request',
        version: '1.0',
        nonce: anonCredsHolderService.generateNonce(agentContext),
        attributes: proposalMessage.presentationProposal.attributes,
        predicates: proposalMessage.presentationProposal.predicates,
      })
    }

    return {
      proposal: proposalMessage
        ? {
            indy: indyProposeProof,
          }
        : undefined,
      request: requestMessage
        ? {
            indy: indyRequestProof,
          }
        : undefined,
      presentation: presentationMessage
        ? {
            indy: indyPresentProof,
          }
        : undefined,
    }
  }

  private assertOnlyIndyFormat(proofFormats: Record<string, unknown>) {
    const formatKeys = Object.keys(proofFormats)

    // It's fine to not have any formats in some cases, if indy is required the method that calls this should check for this
    if (formatKeys.length === 0) return

    if (formatKeys.length !== 1 || !formatKeys.includes('indy')) {
      throw new CredoError('Only indy proof format is supported for present proof v1 protocol')
    }
  }
}
