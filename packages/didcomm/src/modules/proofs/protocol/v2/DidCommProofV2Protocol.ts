import type { AgentContext } from '@credo-ts/core'
import { CredoError, utils } from '@credo-ts/core'
import type { DidCommFeatureRegistry } from '../../../../DidCommFeatureRegistry'
import type { DidCommMessage } from '../../../../DidCommMessage'
import type { DidCommMessageHandlerRegistry } from '../../../../DidCommMessageHandlerRegistry'
import type { DidCommProblemReportMessage } from '../../../../messages'
import { AckStatus } from '../../../../messages'
import type { DidCommInboundMessageContext } from '../../../../models'
import { DidCommProtocol } from '../../../../models'
import { DidCommMessageRepository, DidCommMessageRole } from '../../../../repository'
import { DidCommConnectionService } from '../../../connections'
import { DidCommProofsModuleConfig } from '../../DidCommProofsModuleConfig'
import { DidCommPresentationProblemReportReason } from '../../errors/DidCommPresentationProblemReportReason'
import type {
  DidCommProofFormat,
  DidCommProofFormatCredentialForRequestPayload,
  DidCommProofFormatPayload,
  ExtractProofFormats,
} from '../../formats'
import type { DidCommProofFormatService } from '../../formats/DidCommProofFormatService'
import { DidCommAutoAcceptProof, DidCommProofRole, DidCommProofState } from '../../models'
import type { DidCommProofFormatSpec } from '../../models/DidCommProofFormatSpec'
import { DidCommProofExchangeRecord, DidCommProofExchangeRepository } from '../../repository'
import { composeAutoAccept } from '../../utils'
import { DidCommBaseProofProtocol } from '../DidCommBaseProofProtocol'
import type { DidCommProofProtocol } from '../DidCommProofProtocol'
import type {
  AcceptPresentationOptions,
  AcceptProofProposalOptions,
  AcceptProofRequestOptions,
  CreateProofProblemReportOptions,
  CreateProofProposalOptions,
  CreateProofRequestOptions,
  GetCredentialsForRequestOptions,
  GetCredentialsForRequestReturn,
  GetProofFormatDataReturn,
  NegotiateProofProposalOptions,
  NegotiateProofRequestOptions,
  ProofFormatDataMessagePayload,
  ProofProtocolMsgReturnType,
  SelectCredentialsForRequestOptions,
  SelectCredentialsForRequestReturn,
} from '../DidCommProofProtocolOptions'

import { DidCommProofFormatCoordinator } from './DidCommProofFormatCoordinator'
import { V2PresentationProblemReportError } from './errors'
import { DidCommPresentationV2AckHandler } from './handlers/DidCommPresentationV2AckHandler'
import { DidCommPresentationV2Handler } from './handlers/DidCommPresentationV2Handler'
import { DidCommPresentationV2ProblemReportHandler } from './handlers/DidCommPresentationV2ProblemReportHandler'
import { DidCommProposePresentationV2Handler } from './handlers/DidCommProposePresentationV2Handler'
import { DidCommRequestPresentationV2Handler } from './handlers/DidCommRequestPresentationV2Handler'
import { DidCommPresentationV2AckMessage, DidCommRequestPresentationV2Message } from './messages'
import { DidCommPresentationV2Message } from './messages/DidCommPresentationV2Message'
import { DidCommPresentationV2ProblemReportMessage } from './messages/DidCommPresentationV2ProblemReportMessage'
import { DidCommProposePresentationV2Message } from './messages/DidCommProposePresentationV2Message'

export interface DidCommProofV2ProtocolConfig<ProofFormatServices extends DidCommProofFormatService[]> {
  proofFormats: ProofFormatServices
}

export class DidCommProofV2Protocol<PFs extends DidCommProofFormatService[] = DidCommProofFormatService[]>
  extends DidCommBaseProofProtocol
  implements DidCommProofProtocol<PFs>
{
  private proofFormatCoordinator = new DidCommProofFormatCoordinator<PFs>()
  private proofFormats: PFs

  public constructor({ proofFormats }: DidCommProofV2ProtocolConfig<PFs>) {
    super()

    this.proofFormats = proofFormats
  }

  /**
   * The version of the present proof protocol this service supports
   */
  public readonly version = 'v2' as const

  public register(messageHandlerRegistry: DidCommMessageHandlerRegistry, featureRegistry: DidCommFeatureRegistry) {
    // Register message handlers for the Present Proof V2 Protocol
    messageHandlerRegistry.registerMessageHandlers([
      new DidCommProposePresentationV2Handler(this),
      new DidCommRequestPresentationV2Handler(this),
      new DidCommPresentationV2Handler(this),
      new DidCommPresentationV2AckHandler(this),
      new DidCommPresentationV2ProblemReportHandler(this),
    ])

    // Register Present Proof V2 in feature registry, with supported roles
    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/present-proof/2.0',
        roles: ['prover', 'verifier'],
      })
    )
  }

  public async createProposal(
    agentContext: AgentContext,
    {
      connectionRecord,
      proofFormats,
      comment,
      autoAcceptProof,
      goalCode,
      goal,
      parentThreadId,
    }: CreateProofProposalOptions<PFs>
  ): Promise<{ proofRecord: DidCommProofExchangeRecord; message: DidCommMessage }> {
    const proofRepository = agentContext.dependencyManager.resolve(DidCommProofExchangeRepository)

    const formatServices = this.getFormatServices(proofFormats)
    if (formatServices.length === 0) {
      throw new CredoError('Unable to create proposal. No supported formats')
    }

    const proofRecord = new DidCommProofExchangeRecord({
      connectionId: connectionRecord.id,
      threadId: utils.uuid(),
      parentThreadId,
      state: DidCommProofState.ProposalSent,
      role: DidCommProofRole.Prover,
      protocolVersion: 'v2',
      autoAcceptProof,
    })

    const proposalMessage = await this.proofFormatCoordinator.createProposal(agentContext, {
      proofFormats,
      proofRecord,
      formatServices,
      comment,
      goalCode,
      goal,
    })

    agentContext.config.logger.debug('Save record and emit state change event')
    await proofRepository.save(agentContext, proofRecord)
    this.emitStateChangedEvent(agentContext, proofRecord, null)

    return {
      proofRecord,
      message: proposalMessage,
    }
  }

  /**
   * Method called by {@link V2ProposeCredentialHandler} on reception of a propose presentation message
   * We do the necessary processing here to accept the proposal and do the state change, emit event etc.
   * @param messageContext the inbound propose presentation message
   * @returns proof record appropriate for this incoming message (once accepted)
   */
  public async processProposal(
    messageContext: DidCommInboundMessageContext<DidCommProposePresentationV2Message>
  ): Promise<DidCommProofExchangeRecord> {
    const { message: proposalMessage, connection, agentContext } = messageContext

    agentContext.config.logger.debug(`Processing presentation proposal with id ${proposalMessage.id}`)

    const proofRepository = agentContext.dependencyManager.resolve(DidCommProofExchangeRepository)
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)
    const connectionService = agentContext.dependencyManager.resolve(DidCommConnectionService)

    let proofRecord = await this.findByProperties(messageContext.agentContext, {
      threadId: proposalMessage.threadId,
      role: DidCommProofRole.Verifier,
      connectionId: connection?.id,
    })

    const formatServices = this.getFormatServicesFromMessage(proposalMessage.formats)
    if (formatServices.length === 0) {
      throw new CredoError('Unable to process proposal. No supported formats')
    }

    // credential record already exists
    if (proofRecord) {
      const lastReceivedMessage = await didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: DidCommProposePresentationV2Message,
        role: DidCommMessageRole.Receiver,
      })
      const lastSentMessage = await didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: DidCommRequestPresentationV2Message,
        role: DidCommMessageRole.Sender,
      })

      // Assert
      proofRecord.assertProtocolVersion('v2')
      proofRecord.assertState(DidCommProofState.RequestSent)
      await connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
        lastReceivedMessage,
        lastSentMessage,
        expectedConnectionId: proofRecord.connectionId,
      })

      await this.proofFormatCoordinator.processProposal(messageContext.agentContext, {
        proofRecord,
        formatServices,
        message: proposalMessage,
      })

      await this.updateState(messageContext.agentContext, proofRecord, DidCommProofState.ProposalReceived)

      return proofRecord
    }
    // Assert
    await connectionService.assertConnectionOrOutOfBandExchange(messageContext)

    // No proof record exists with thread id
    proofRecord = new DidCommProofExchangeRecord({
      connectionId: connection?.id,
      threadId: proposalMessage.threadId,
      state: DidCommProofState.ProposalReceived,
      role: DidCommProofRole.Verifier,
      protocolVersion: 'v2',
      parentThreadId: proposalMessage.thread?.parentThreadId,
    })

    await this.proofFormatCoordinator.processProposal(messageContext.agentContext, {
      proofRecord,
      formatServices,
      message: proposalMessage,
    })

    // Save record and emit event
    await proofRepository.save(messageContext.agentContext, proofRecord)
    this.emitStateChangedEvent(messageContext.agentContext, proofRecord, null)

    return proofRecord
  }

  public async acceptProposal(
    agentContext: AgentContext,
    {
      proofRecord,
      proofFormats,
      autoAcceptProof,
      comment,
      goalCode,
      goal,
      willConfirm,
    }: AcceptProofProposalOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<DidCommRequestPresentationV2Message>> {
    // Assert
    proofRecord.assertProtocolVersion('v2')
    proofRecord.assertState(DidCommProofState.ProposalReceived)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // Use empty proofFormats if not provided to denote all formats should be accepted
    let formatServices = this.getFormatServices(proofFormats ?? {})

    // if no format services could be extracted from the proofFormats
    // take all available format services from the proposal message
    if (formatServices.length === 0) {
      const proposalMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: DidCommProposePresentationV2Message,
        role: DidCommMessageRole.Receiver,
      })

      formatServices = this.getFormatServicesFromMessage(proposalMessage.formats)
    }

    // If the format services list is still empty, throw an error as we don't support any
    // of the formats
    if (formatServices.length === 0) {
      throw new CredoError('Unable to accept proposal. No supported formats provided as input or in proposal message')
    }

    const requestMessage = await this.proofFormatCoordinator.acceptProposal(agentContext, {
      proofRecord,
      formatServices,
      comment,
      proofFormats,
      goalCode,
      goal,
      willConfirm,
      // Not supported at the moment
      presentMultiple: false,
    })

    proofRecord.autoAcceptProof = autoAcceptProof ?? proofRecord.autoAcceptProof
    await this.updateState(agentContext, proofRecord, DidCommProofState.RequestSent)

    return { proofRecord, message: requestMessage }
  }

  /**
   * Negotiate a proof proposal as verifier (by sending a proof request message) to the connection
   * associated with the proof record.
   *
   * @param options configuration for the request see {@link NegotiateProofProposalOptions}
   * @returns Proof exchange record associated with the proof request
   *
   */
  public async negotiateProposal(
    agentContext: AgentContext,
    {
      proofRecord,
      proofFormats,
      autoAcceptProof,
      comment,
      goalCode,
      goal,
      willConfirm,
    }: NegotiateProofProposalOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<DidCommRequestPresentationV2Message>> {
    // Assert
    proofRecord.assertProtocolVersion('v2')
    proofRecord.assertState(DidCommProofState.ProposalReceived)

    if (!proofRecord.connectionId) {
      throw new CredoError(
        `No connectionId found for proof record '${proofRecord.id}'. Connection-less verification does not support negotiation.`
      )
    }

    const formatServices = this.getFormatServices(proofFormats)
    if (formatServices.length === 0) {
      throw new CredoError('Unable to create request. No supported formats')
    }

    const requestMessage = await this.proofFormatCoordinator.createRequest(agentContext, {
      formatServices,
      proofFormats,
      proofRecord,
      comment,
      goalCode,
      goal,
      willConfirm,
      // Not supported at the moment
      presentMultiple: false,
    })

    proofRecord.autoAcceptProof = autoAcceptProof ?? proofRecord.autoAcceptProof
    await this.updateState(agentContext, proofRecord, DidCommProofState.RequestSent)

    return { proofRecord, message: requestMessage }
  }

  /**
   * Create a {@link DidCommRequestPresentationV2Message} as beginning of protocol process.
   * @returns Object containing request message and associated credential record
   *
   */
  public async createRequest(
    agentContext: AgentContext,
    {
      proofFormats,
      autoAcceptProof,
      comment,
      connectionRecord,
      parentThreadId,
      goalCode,
      goal,
      willConfirm,
    }: CreateProofRequestOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<DidCommRequestPresentationV2Message>> {
    const proofRepository = agentContext.dependencyManager.resolve(DidCommProofExchangeRepository)

    const formatServices = this.getFormatServices(proofFormats)
    if (formatServices.length === 0) {
      throw new CredoError('Unable to create request. No supported formats')
    }

    const proofRecord = new DidCommProofExchangeRecord({
      connectionId: connectionRecord?.id,
      threadId: utils.uuid(),
      state: DidCommProofState.RequestSent,
      role: DidCommProofRole.Verifier,
      autoAcceptProof,
      protocolVersion: 'v2',
      parentThreadId,
    })

    const requestMessage = await this.proofFormatCoordinator.createRequest(agentContext, {
      formatServices,
      proofFormats,
      proofRecord,
      comment,
      goalCode,
      goal,
      willConfirm,
    })

    agentContext.config.logger.debug(
      `Saving record and emitting state changed for proof exchange record ${proofRecord.id}`
    )
    await proofRepository.save(agentContext, proofRecord)
    this.emitStateChangedEvent(agentContext, proofRecord, null)

    return { proofRecord, message: requestMessage }
  }

  /**
   * Process a received {@link DidCommRequestPresentationV2Message}. This will not accept the proof request
   * or send a proof. It will only update the existing proof record with
   * the information from the proof request message. Use {@link createCredential}
   * after calling this method to create a proof.
   *z
   * @param messageContext The message context containing a v2 proof request message
   * @returns proof record associated with the proof request message
   *
   */
  public async processRequest(
    messageContext: DidCommInboundMessageContext<DidCommRequestPresentationV2Message>
  ): Promise<DidCommProofExchangeRecord> {
    const { message: requestMessage, connection, agentContext } = messageContext

    const proofRepository = agentContext.dependencyManager.resolve(DidCommProofExchangeRepository)
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)
    const connectionService = agentContext.dependencyManager.resolve(DidCommConnectionService)

    agentContext.config.logger.debug(`Processing proof request with id ${requestMessage.id}`)

    let proofRecord = await this.findByProperties(messageContext.agentContext, {
      threadId: requestMessage.threadId,
      role: DidCommProofRole.Prover,
      connectionId: connection?.id,
    })

    const formatServices = this.getFormatServicesFromMessage(requestMessage.formats)
    if (formatServices.length === 0) {
      throw new CredoError('Unable to process request. No supported formats')
    }

    // proof record already exists
    if (proofRecord) {
      const lastSentMessage = await didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: DidCommProposePresentationV2Message,
        role: DidCommMessageRole.Sender,
      })

      const lastReceivedMessage = await didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: DidCommRequestPresentationV2Message,
        role: DidCommMessageRole.Receiver,
      })

      // Assert
      proofRecord.assertProtocolVersion('v2')
      proofRecord.assertState(DidCommProofState.ProposalSent)
      await connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
        lastReceivedMessage,
        lastSentMessage,
        expectedConnectionId: proofRecord.connectionId,
      })

      await this.proofFormatCoordinator.processRequest(messageContext.agentContext, {
        proofRecord,
        formatServices,
        message: requestMessage,
      })

      await this.updateState(messageContext.agentContext, proofRecord, DidCommProofState.RequestReceived)
      return proofRecord
    }
    // Assert
    await connectionService.assertConnectionOrOutOfBandExchange(messageContext)

    // No proof record exists with thread id
    agentContext.config.logger.debug('No proof record found for request, creating a new one')
    proofRecord = new DidCommProofExchangeRecord({
      connectionId: connection?.id,
      threadId: requestMessage.threadId,
      state: DidCommProofState.RequestReceived,
      role: DidCommProofRole.Prover,
      protocolVersion: 'v2',
      parentThreadId: requestMessage.thread?.parentThreadId,
    })

    await this.proofFormatCoordinator.processRequest(messageContext.agentContext, {
      proofRecord,
      formatServices,
      message: requestMessage,
    })

    // Save in repository
    agentContext.config.logger.debug('Saving proof record and emit request-received event')
    await proofRepository.save(messageContext.agentContext, proofRecord)

    this.emitStateChangedEvent(messageContext.agentContext, proofRecord, null)
    return proofRecord
  }

  public async acceptRequest(
    agentContext: AgentContext,
    { proofRecord, autoAcceptProof, comment, proofFormats, goalCode, goal }: AcceptProofRequestOptions<PFs>
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // Assert
    proofRecord.assertProtocolVersion('v2')
    proofRecord.assertState(DidCommProofState.RequestReceived)

    // Use empty proofFormats if not provided to denote all formats should be accepted
    let formatServices = this.getFormatServices(proofFormats ?? {})

    // if no format services could be extracted from the proofFormats
    // take all available format services from the request message
    if (formatServices.length === 0) {
      const requestMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: DidCommRequestPresentationV2Message,
        role: DidCommMessageRole.Receiver,
      })

      formatServices = this.getFormatServicesFromMessage(requestMessage.formats)
    }

    // If the format services list is still empty, throw an error as we don't support any
    // of the formats
    if (formatServices.length === 0) {
      throw new CredoError('Unable to accept request. No supported formats provided as input or in request message')
    }
    const message = await this.proofFormatCoordinator.acceptRequest(agentContext, {
      proofRecord,
      formatServices,
      comment,
      proofFormats,
      goalCode,
      goal,
      // Sending multiple presentation messages not supported at the moment
      lastPresentation: true,
    })

    proofRecord.autoAcceptProof = autoAcceptProof ?? proofRecord.autoAcceptProof
    await this.updateState(agentContext, proofRecord, DidCommProofState.PresentationSent)

    return { proofRecord, message }
  }

  /**
   * Create a {@link DidCommProposePresentationV2Message} as response to a received credential request.
   * To create a proposal not bound to an existing proof exchange, use {@link createProposal}.
   *
   * @param options configuration to use for the proposal
   * @returns Object containing proposal message and associated proof record
   *
   */
  public async negotiateRequest(
    agentContext: AgentContext,
    { proofRecord, proofFormats, autoAcceptProof, comment, goalCode, goal }: NegotiateProofRequestOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<DidCommProposePresentationV2Message>> {
    // Assert
    proofRecord.assertProtocolVersion('v2')
    proofRecord.assertState(DidCommProofState.RequestReceived)

    if (!proofRecord.connectionId) {
      throw new CredoError(
        `No connectionId found for proof record '${proofRecord.id}'. Connection-less verification does not support negotiation.`
      )
    }

    const formatServices = this.getFormatServices(proofFormats)
    if (formatServices.length === 0) {
      throw new CredoError('Unable to create proposal. No supported formats')
    }

    const proposalMessage = await this.proofFormatCoordinator.createProposal(agentContext, {
      formatServices,
      proofFormats,
      proofRecord,
      comment,
      goalCode,
      goal,
    })

    proofRecord.autoAcceptProof = autoAcceptProof ?? proofRecord.autoAcceptProof
    await this.updateState(agentContext, proofRecord, DidCommProofState.ProposalSent)

    return { proofRecord, message: proposalMessage }
  }

  public async getCredentialsForRequest(
    agentContext: AgentContext,
    { proofRecord, proofFormats }: GetCredentialsForRequestOptions<PFs>
  ): Promise<GetCredentialsForRequestReturn<PFs>> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // Assert
    proofRecord.assertProtocolVersion('v2')
    proofRecord.assertState(DidCommProofState.RequestReceived)

    // Use empty proofFormats if not provided to denote all formats should be accepted
    let formatServices = this.getFormatServices(proofFormats ?? {})

    // if no format services could be extracted from the proofFormats
    // take all available format services from the request message
    if (formatServices.length === 0) {
      const requestMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: DidCommRequestPresentationV2Message,
        role: DidCommMessageRole.Receiver,
      })

      formatServices = this.getFormatServicesFromMessage(requestMessage.formats)
    }

    // If the format services list is still empty, throw an error as we don't support any
    // of the formats
    if (formatServices.length === 0) {
      throw new CredoError(
        'Unable to get credentials for request. No supported formats provided as input or in request message'
      )
    }

    const result = await this.proofFormatCoordinator.getCredentialsForRequest(agentContext, {
      formatServices,
      proofFormats,
      proofRecord,
    })

    return {
      proofFormats: result,
    }
  }

  public async selectCredentialsForRequest(
    agentContext: AgentContext,
    { proofRecord, proofFormats }: SelectCredentialsForRequestOptions<PFs>
  ): Promise<SelectCredentialsForRequestReturn<PFs>> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // Assert
    proofRecord.assertProtocolVersion('v2')
    proofRecord.assertState(DidCommProofState.RequestReceived)

    // Use empty proofFormats if not provided to denote all formats should be accepted
    let formatServices = this.getFormatServices(proofFormats ?? {})

    // if no format services could be extracted from the proofFormats
    // take all available format services from the request message
    if (formatServices.length === 0) {
      const requestMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: DidCommRequestPresentationV2Message,
        role: DidCommMessageRole.Receiver,
      })

      formatServices = this.getFormatServicesFromMessage(requestMessage.formats)
    }

    // If the format services list is still empty, throw an error as we don't support any
    // of the formats
    if (formatServices.length === 0) {
      throw new CredoError(
        'Unable to get credentials for request. No supported formats provided as input or in request message'
      )
    }

    const result = await this.proofFormatCoordinator.selectCredentialsForRequest(agentContext, {
      formatServices,
      proofFormats,
      proofRecord,
    })

    return {
      proofFormats: result,
    }
  }

  public async processPresentation(
    messageContext: DidCommInboundMessageContext<DidCommPresentationV2Message>
  ): Promise<DidCommProofExchangeRecord> {
    const { message: presentationMessage, connection, agentContext } = messageContext

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)
    const connectionService = agentContext.dependencyManager.resolve(DidCommConnectionService)

    agentContext.config.logger.debug(`Processing presentation with id ${presentationMessage.id}`)

    const proofRecord = await this.getByProperties(messageContext.agentContext, {
      threadId: presentationMessage.threadId,
      role: DidCommProofRole.Verifier,
    })

    const lastSentMessage = await didCommMessageRepository.getAgentMessage(messageContext.agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommRequestPresentationV2Message,
      role: DidCommMessageRole.Sender,
    })

    const lastReceivedMessage = await didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommProposePresentationV2Message,
      role: DidCommMessageRole.Receiver,
    })

    // Assert
    proofRecord.assertProtocolVersion('v2')
    proofRecord.assertState(DidCommProofState.RequestSent)
    await connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
      lastReceivedMessage,
      lastSentMessage,
      expectedConnectionId: proofRecord.connectionId,
    })

    // This makes sure that the sender of the incoming message is authorized to do so.
    if (!proofRecord.connectionId) {
      await connectionService.matchIncomingMessageToRequestMessageInOutOfBandExchange(messageContext, {
        expectedConnectionId: proofRecord.connectionId,
      })

      proofRecord.connectionId = connection?.id
    }

    const formatServices = this.getFormatServicesFromMessage(presentationMessage.formats)
    // Abandon if no supported formats
    if (formatServices.length === 0) {
      proofRecord.errorMessage = 'Unable to process presentation. No supported formats'
      await this.updateState(messageContext.agentContext, proofRecord, DidCommProofState.Abandoned)
      throw new V2PresentationProblemReportError(proofRecord.errorMessage, {
        problemCode: DidCommPresentationProblemReportReason.Abandoned,
      })
    }

    const result = await this.proofFormatCoordinator.processPresentation(messageContext.agentContext, {
      proofRecord,
      formatServices,
      requestMessage: lastSentMessage,
      message: presentationMessage,
    })

    proofRecord.isVerified = result.isValid
    if (result.isValid) {
      await this.updateState(messageContext.agentContext, proofRecord, DidCommProofState.PresentationReceived)
    } else {
      proofRecord.errorMessage = result.message
      proofRecord.isVerified = false
      await this.updateState(messageContext.agentContext, proofRecord, DidCommProofState.Abandoned)
      throw new V2PresentationProblemReportError(proofRecord.errorMessage, {
        problemCode: DidCommPresentationProblemReportReason.Abandoned,
      })
    }

    return proofRecord
  }

  public async acceptPresentation(
    agentContext: AgentContext,
    { proofRecord }: AcceptPresentationOptions
  ): Promise<ProofProtocolMsgReturnType<DidCommPresentationV2AckMessage>> {
    proofRecord.assertProtocolVersion('v2')
    proofRecord.assertState(DidCommProofState.PresentationReceived)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // assert we've received the final presentation
    const presentation = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommPresentationV2Message,
      role: DidCommMessageRole.Receiver,
    })

    if (!presentation.lastPresentation) {
      throw new CredoError(
        `Trying to send an ack message while presentation with id ${presentation.id} indicates this is not the last presentation (presentation.last_presentation is set to false)`
      )
    }

    const message = new DidCommPresentationV2AckMessage({
      threadId: proofRecord.threadId,
      status: AckStatus.OK,
    })

    message.setThread({
      threadId: proofRecord.threadId,
      parentThreadId: proofRecord.parentThreadId,
    })

    await this.updateState(agentContext, proofRecord, DidCommProofState.Done)

    return {
      message,
      proofRecord,
    }
  }

  public async processAck(
    messageContext: DidCommInboundMessageContext<DidCommPresentationV2AckMessage>
  ): Promise<DidCommProofExchangeRecord> {
    const { message: ackMessage, connection, agentContext } = messageContext

    agentContext.config.logger.debug(`Processing proof ack with id ${ackMessage.id}`)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)
    const connectionService = agentContext.dependencyManager.resolve(DidCommConnectionService)

    const proofRecord = await this.getByProperties(messageContext.agentContext, {
      threadId: ackMessage.threadId,
      role: DidCommProofRole.Prover,
      connectionId: connection?.id,
    })
    proofRecord.connectionId = connection?.id

    const lastReceivedMessage = await didCommMessageRepository.getAgentMessage(messageContext.agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommRequestPresentationV2Message,
      role: DidCommMessageRole.Receiver,
    })

    const lastSentMessage = await didCommMessageRepository.getAgentMessage(messageContext.agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommPresentationV2Message,
      role: DidCommMessageRole.Sender,
    })

    // Assert
    proofRecord.assertProtocolVersion('v2')
    proofRecord.assertState(DidCommProofState.PresentationSent)
    await connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
      lastReceivedMessage,
      lastSentMessage,
      expectedConnectionId: proofRecord.connectionId,
    })

    // Update record
    await this.updateState(messageContext.agentContext, proofRecord, DidCommProofState.Done)

    return proofRecord
  }

  public async createProblemReport(
    _agentContext: AgentContext,
    { description, proofRecord }: CreateProofProblemReportOptions
  ): Promise<ProofProtocolMsgReturnType<DidCommProblemReportMessage>> {
    const message = new DidCommPresentationV2ProblemReportMessage({
      description: {
        en: description,
        code: DidCommPresentationProblemReportReason.Abandoned,
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
      proposalMessage: DidCommProposePresentationV2Message
    }
  ): Promise<boolean> {
    const { proofRecord, proposalMessage } = options
    const proofsModuleConfig = agentContext.dependencyManager.resolve(DidCommProofsModuleConfig)

    const autoAccept = composeAutoAccept(proofRecord.autoAcceptProof, proofsModuleConfig.autoAcceptProofs)

    // Handle always / never cases
    if (autoAccept === DidCommAutoAcceptProof.Always) return true
    if (autoAccept === DidCommAutoAcceptProof.Never) return false

    const requestMessage = await this.findRequestMessage(agentContext, proofRecord.id)
    if (!requestMessage) return false

    // NOTE: we take the formats from the requestMessage so we always check all services that we last sent
    // Otherwise we'll only check the formats from the proposal, which could be different from the formats
    // we use.
    const formatServices = this.getFormatServicesFromMessage(requestMessage.formats)

    for (const formatService of formatServices) {
      const requestAttachment = this.proofFormatCoordinator.getAttachmentForService(
        formatService,
        requestMessage.formats,
        requestMessage.requestAttachments
      )

      const proposalAttachment = this.proofFormatCoordinator.getAttachmentForService(
        formatService,
        proposalMessage.formats,
        proposalMessage.proposalAttachments
      )

      const shouldAutoRespondToFormat = await formatService.shouldAutoRespondToProposal(agentContext, {
        proofRecord,
        requestAttachment,
        proposalAttachment,
      })
      // If any of the formats return false, we should not auto accept
      if (!shouldAutoRespondToFormat) return false
    }

    return true
  }

  public async shouldAutoRespondToRequest(
    agentContext: AgentContext,
    options: {
      proofRecord: DidCommProofExchangeRecord
      requestMessage: DidCommRequestPresentationV2Message
    }
  ): Promise<boolean> {
    const { proofRecord, requestMessage } = options
    const proofsModuleConfig = agentContext.dependencyManager.resolve(DidCommProofsModuleConfig)

    const autoAccept = composeAutoAccept(proofRecord.autoAcceptProof, proofsModuleConfig.autoAcceptProofs)

    // Handle always / never cases
    if (autoAccept === DidCommAutoAcceptProof.Always) return true
    if (autoAccept === DidCommAutoAcceptProof.Never) return false

    const proposalMessage = await this.findProposalMessage(agentContext, proofRecord.id)
    if (!proposalMessage) return false

    // NOTE: we take the formats from the proposalMessage so we always check all services that we last sent
    // Otherwise we'll only check the formats from the request, which could be different from the formats
    // we use.
    const formatServices = this.getFormatServicesFromMessage(proposalMessage.formats)

    for (const formatService of formatServices) {
      const proposalAttachment = this.proofFormatCoordinator.getAttachmentForService(
        formatService,
        proposalMessage.formats,
        proposalMessage.proposalAttachments
      )

      const requestAttachment = this.proofFormatCoordinator.getAttachmentForService(
        formatService,
        requestMessage.formats,
        requestMessage.requestAttachments
      )

      const shouldAutoRespondToFormat = await formatService.shouldAutoRespondToRequest(agentContext, {
        proofRecord,
        requestAttachment,
        proposalAttachment,
      })

      // If any of the formats return false, we should not auto accept
      if (!shouldAutoRespondToFormat) return false
    }

    return true
  }

  public async shouldAutoRespondToPresentation(
    agentContext: AgentContext,
    options: { proofRecord: DidCommProofExchangeRecord; presentationMessage: DidCommPresentationV2Message }
  ): Promise<boolean> {
    const { proofRecord, presentationMessage } = options
    const proofsModuleConfig = agentContext.dependencyManager.resolve(DidCommProofsModuleConfig)

    // If this isn't the last presentation yet, we should not auto accept
    if (!presentationMessage.lastPresentation) return false

    const autoAccept = composeAutoAccept(proofRecord.autoAcceptProof, proofsModuleConfig.autoAcceptProofs)

    // Handle always / never cases
    if (autoAccept === DidCommAutoAcceptProof.Always) return true
    if (autoAccept === DidCommAutoAcceptProof.Never) return false

    const proposalMessage = await this.findProposalMessage(agentContext, proofRecord.id)

    const requestMessage = await this.findRequestMessage(agentContext, proofRecord.id)
    if (!requestMessage) return false
    if (!requestMessage.willConfirm) return false

    // NOTE: we take the formats from the requestMessage so we always check all services that we last sent
    // Otherwise we'll only check the formats from the credential, which could be different from the formats
    // we use.
    const formatServices = this.getFormatServicesFromMessage(requestMessage.formats)

    for (const formatService of formatServices) {
      const proposalAttachment = proposalMessage
        ? this.proofFormatCoordinator.getAttachmentForService(
            formatService,
            proposalMessage.formats,
            proposalMessage.proposalAttachments
          )
        : undefined

      const requestAttachment = this.proofFormatCoordinator.getAttachmentForService(
        formatService,
        requestMessage.formats,
        requestMessage.requestAttachments
      )

      const presentationAttachment = this.proofFormatCoordinator.getAttachmentForService(
        formatService,
        presentationMessage.formats,
        presentationMessage.presentationAttachments
      )

      const shouldAutoRespondToFormat = await formatService.shouldAutoRespondToPresentation(agentContext, {
        proofRecord,
        presentationAttachment,
        requestAttachment,
        proposalAttachment,
      })

      // If any of the formats return false, we should not auto accept
      if (!shouldAutoRespondToFormat) return false
    }
    return true
  }

  public async findRequestMessage(
    agentContext: AgentContext,
    proofExchangeRecordId: string
  ): Promise<DidCommRequestPresentationV2Message | null> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    return await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofExchangeRecordId,
      messageClass: DidCommRequestPresentationV2Message,
    })
  }

  public async findPresentationMessage(
    agentContext: AgentContext,
    proofExchangeRecordId: string
  ): Promise<DidCommPresentationV2Message | null> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    return await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofExchangeRecordId,
      messageClass: DidCommPresentationV2Message,
    })
  }

  public async findProposalMessage(
    agentContext: AgentContext,
    proofExchangeRecordId: string
  ): Promise<DidCommProposePresentationV2Message | null> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    return await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofExchangeRecordId,
      messageClass: DidCommProposePresentationV2Message,
    })
  }

  public async getFormatData(
    agentContext: AgentContext,
    proofExchangeRecordId: string
  ): Promise<GetProofFormatDataReturn> {
    // TODO: we could looking at fetching all record using a single query and then filtering based on the type of the message.
    const [proposalMessage, requestMessage, presentationMessage] = await Promise.all([
      this.findProposalMessage(agentContext, proofExchangeRecordId),
      this.findRequestMessage(agentContext, proofExchangeRecordId),
      this.findPresentationMessage(agentContext, proofExchangeRecordId),
    ])

    // Create object with the keys and the message formats/attachments. We can then loop over this in a generic
    // way so we don't have to add the same operation code four times
    const messages = {
      proposal: [proposalMessage?.formats, proposalMessage?.proposalAttachments],
      request: [requestMessage?.formats, requestMessage?.requestAttachments],
      presentation: [presentationMessage?.formats, presentationMessage?.presentationAttachments],
    } as const

    const formatData: GetProofFormatDataReturn = {}

    // We loop through all of the message keys as defined above
    for (const [messageKey, [formats, attachments]] of Object.entries(messages)) {
      // Message can be undefined, so we continue if it is not defined
      if (!formats || !attachments) continue

      // Find all format services associated with the message
      const formatServices = this.getFormatServicesFromMessage(formats)

      const messageFormatData: ProofFormatDataMessagePayload = {}

      // Loop through all of the format services, for each we will extract the attachment data and assign this to the object
      // using the unique format key (e.g. indy)
      for (const formatService of formatServices) {
        const attachment = this.proofFormatCoordinator.getAttachmentForService(formatService, formats, attachments)
        messageFormatData[formatService.formatKey] = attachment.getDataAsJson()
      }

      formatData[messageKey as keyof GetProofFormatDataReturn] = messageFormatData
    }

    return formatData
  }

  /**
   * Get all the format service objects for a given proof format from an incoming message
   * @param messageFormats the format objects containing the format name (eg indy)
   * @return the proof format service objects in an array - derived from format object keys
   */
  private getFormatServicesFromMessage(messageFormats: DidCommProofFormatSpec[]): DidCommProofFormatService[] {
    const formatServices = new Set<DidCommProofFormatService>()

    for (const msg of messageFormats) {
      const service = this.getFormatServiceForFormat(msg.format)
      if (service) formatServices.add(service)
    }

    return Array.from(formatServices)
  }

  /**
   * Get all the format service objects for a given proof format
   * @param proofFormats the format object containing various optional parameters
   * @return the proof format service objects in an array - derived from format object keys
   */
  private getFormatServices<M extends keyof DidCommProofFormat['proofFormats']>(
    proofFormats: M extends 'selectCredentialsForRequest' | 'getCredentialsForRequest'
      ? DidCommProofFormatCredentialForRequestPayload<ExtractProofFormats<PFs>, M, 'input'>
      : DidCommProofFormatPayload<ExtractProofFormats<PFs>, M>
  ): DidCommProofFormatService[] {
    const formats = new Set<DidCommProofFormatService>()

    for (const formatKey of Object.keys(proofFormats)) {
      const formatService = this.getFormatServiceForFormatKey(formatKey)

      if (formatService) formats.add(formatService)
    }

    return Array.from(formats)
  }

  private getFormatServiceForFormatKey(formatKey: string): DidCommProofFormatService | null {
    const formatService = this.proofFormats.find((proofFormats) => proofFormats.formatKey === formatKey)

    return formatService ?? null
  }

  private getFormatServiceForFormat(format: string): DidCommProofFormatService | null {
    const formatService = this.proofFormats.find((proofFormats) => proofFormats.supportsFormat(format))

    return formatService ?? null
  }
}
