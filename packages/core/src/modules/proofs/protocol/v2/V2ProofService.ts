import type { AgentContext } from '../../../../agent'
import type { AgentMessage } from '../../../../agent/AgentMessage'
import type { Dispatcher } from '../../../../agent/Dispatcher'
import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { MediationRecipientService } from '../../../routing/services/MediationRecipientService'
import type { RoutingService } from '../../../routing/services/RoutingService'
import type { ProofResponseCoordinator } from '../../ProofResponseCoordinator'
import type { ProofFormat } from '../../formats/ProofFormat'
import type { ProofFormatService } from '../../formats/ProofFormatService'
import type { CreateProblemReportOptions } from '../../formats/models/ProofFormatServiceOptions'
import type { ProofFormatSpec } from '../../models/ProofFormatSpec'
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

import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../../agent/AgentConfig'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../../constants'
import { AriesFrameworkError } from '../../../../error'
import { DidCommMessageRepository, DidCommMessageRole } from '../../../../storage'
import { MessageValidator } from '../../../../utils/MessageValidator'
import { Wallet } from '../../../../wallet/Wallet'
import { AckStatus } from '../../../common'
import { ConnectionService } from '../../../connections'
import { ProofService } from '../../ProofService'
import { PresentationProblemReportReason } from '../../errors/PresentationProblemReportReason'
import { V2_INDY_PRESENTATION_REQUEST } from '../../formats/ProofFormatConstants'
import { IndyProofFormatService } from '../../formats/indy/IndyProofFormatService'
import { IndyProofUtils } from '../../formats/indy/IndyProofUtils'
import { ProofProtocolVersion } from '../../models/ProofProtocolVersion'
import { ProofState } from '../../models/ProofState'
import { PresentationRecordType, ProofRecord, ProofRepository } from '../../repository'

import { V2PresentationProblemReportError } from './errors'
import { V2PresentationAckHandler } from './handlers/V2PresentationAckHandler'
import { V2PresentationHandler } from './handlers/V2PresentationHandler'
import { V2PresentationProblemReportHandler } from './handlers/V2PresentationProblemReportHandler'
import { V2ProposePresentationHandler } from './handlers/V2ProposePresentationHandler'
import { V2RequestPresentationHandler } from './handlers/V2RequestPresentationHandler'
import { V2PresentationAckMessage } from './messages'
import { V2PresentationMessage } from './messages/V2PresentationMessage'
import { V2PresentationProblemReportMessage } from './messages/V2PresentationProblemReportMessage'
import { V2ProposalPresentationMessage } from './messages/V2ProposalPresentationMessage'
import { V2RequestPresentationMessage } from './messages/V2RequestPresentationMessage'

@scoped(Lifecycle.ContainerScoped)
export class V2ProofService<PFs extends ProofFormat[] = ProofFormat[]> extends ProofService<PFs> {
  private formatServiceMap: { [key: string]: ProofFormatService }

  public constructor(
    agentConfig: AgentConfig,
    connectionService: ConnectionService,
    proofRepository: ProofRepository,
    didCommMessageRepository: DidCommMessageRepository,
    eventEmitter: EventEmitter,
    indyProofFormatService: IndyProofFormatService,
    @inject(InjectionSymbols.Wallet) wallet: Wallet
  ) {
    super(agentConfig, proofRepository, connectionService, didCommMessageRepository, wallet, eventEmitter)
    this.wallet = wallet
    this.formatServiceMap = {
      [PresentationRecordType.Indy]: indyProofFormatService,
      // other format services to be added to the map
    }
  }

  /**
   * The version of the issue credential protocol this service supports
   */
  public readonly version = 'v2' as const

  public async createProposal(
    agentContext: AgentContext,
    options: CreateProposalOptions<PFs>
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    const formats = []
    for (const key of Object.keys(options.proofFormats)) {
      const service = this.formatServiceMap[key]

      formats.push(
        await service.createProposal({
          formats:
            key === PresentationRecordType.Indy
              ? await IndyProofUtils.createRequestFromPreview(options)
              : options.proofFormats,
        })
      )
    }

    const proposalMessage = new V2ProposalPresentationMessage({
      attachmentInfo: formats,
      comment: options.comment,
      willConfirm: options.willConfirm,
      goalCode: options.goalCode,
      parentThreadId: options.parentThreadId,
    })

    const proofRecord = new ProofRecord({
      connectionId: options.connectionRecord.id,
      threadId: proposalMessage.threadId,
      parentThreadId: proposalMessage.thread?.parentThreadId,
      state: ProofState.ProposalSent,
      protocolVersion: ProofProtocolVersion.V2,
    })

    await this.proofRepository.save(agentContext, proofRecord)

    await this.didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: proposalMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: proofRecord.id,
    })

    this.emitStateChangedEvent(agentContext, proofRecord, null)

    return {
      proofRecord: proofRecord,
      message: proposalMessage,
    }
  }

  public async createProposalAsResponse(
    agentContext: AgentContext,
    options: CreateProposalAsResponseOptions<PFs>
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    options.proofRecord.assertState(ProofState.RequestReceived)

    const formats = []
    for (const key of Object.keys(options.proofFormats)) {
      const service = this.formatServiceMap[key]
      formats.push(
        await service.createProposal({
          formats: options.proofFormats,
        })
      )
    }

    const proposalMessage = new V2ProposalPresentationMessage({
      attachmentInfo: formats,
      comment: options.comment,
      goalCode: options.goalCode,
      willConfirm: options.willConfirm,
    })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: proposalMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: options.proofRecord.id,
    })

    await this.updateState(agentContext, options.proofRecord, ProofState.ProposalSent)

    return { message: proposalMessage, proofRecord: options.proofRecord }
  }

  public async processProposal(
    messageContext: InboundMessageContext<V2ProposalPresentationMessage>
  ): Promise<ProofRecord> {
    const { message: proposalMessage, connection: connectionRecord } = messageContext
    let proofRecord: ProofRecord

    const proposalAttachments = proposalMessage.getAttachmentFormats()

    for (const attachmentFormat of proposalAttachments) {
      const service = this.getFormatServiceForFormat(attachmentFormat.format)
      await service?.processProposal({
        proposal: attachmentFormat,
      })
    }

    try {
      proofRecord = await this.proofRepository.getSingleByQuery(messageContext.agentContext, {
        threadId: proposalMessage.threadId,
        connectionId: connectionRecord?.id,
      })

      const requestMessage = await this.didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: V2RequestPresentationMessage,
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

      await this.updateState(messageContext.agentContext, proofRecord, ProofState.ProposalReceived)
    } catch {
      // No proof record exists with thread id
      proofRecord = new ProofRecord({
        connectionId: connectionRecord?.id,
        threadId: proposalMessage.threadId,
        parentThreadId: proposalMessage.thread?.parentThreadId,
        state: ProofState.ProposalReceived,
        protocolVersion: ProofProtocolVersion.V2,
      })

      // Assert
      this.connectionService.assertConnectionOrServiceDecorator(messageContext)

      // Save record
      await this.didCommMessageRepository.saveOrUpdateAgentMessage(messageContext.agentContext, {
        agentMessage: proposalMessage,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Receiver,
      })

      await this.proofRepository.save(messageContext.agentContext, proofRecord)
      this.emitStateChangedEvent(messageContext.agentContext, proofRecord, null)
    }

    return proofRecord
  }

  public async createRequest(
    agentContext: AgentContext,
    options: CreateRequestOptions<PFs>
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    // create attachment formats
    const formats = []
    for (const key of Object.keys(options.proofFormats)) {
      const service = this.formatServiceMap[key]
      formats.push(
        await service.createRequest({
          formats: options.proofFormats,
        })
      )
    }

    // create request message
    const requestMessage = new V2RequestPresentationMessage({
      attachmentInfo: formats,
      comment: options.comment,
      willConfirm: options.willConfirm,
      goalCode: options.goalCode,
      parentThreadId: options.parentThreadId,
    })

    // create & store proof record
    const proofRecord = new ProofRecord({
      connectionId: options.connectionRecord?.id,
      threadId: requestMessage.threadId,
      parentThreadId: requestMessage.thread?.parentThreadId,
      state: ProofState.RequestSent,
      protocolVersion: ProofProtocolVersion.V2,
    })

    await this.proofRepository.save(agentContext, proofRecord)

    // create DIDComm message
    await this.didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: requestMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: proofRecord.id,
    })

    this.emitStateChangedEvent(agentContext, proofRecord, null)

    return {
      proofRecord: proofRecord,
      message: requestMessage,
    }
  }

  public async createRequestAsResponse(
    agentContext: AgentContext,
    options: CreateRequestAsResponseOptions<PFs>
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    options.proofRecord.assertState(ProofState.ProposalReceived)

    const proposal = await this.didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: options.proofRecord.id,
      messageClass: V2ProposalPresentationMessage,
    })

    if (!proposal) {
      throw new AriesFrameworkError(
        `Proof record with id ${options.proofRecord.id} is missing required presentation proposal`
      )
    }

    // create attachment formats
    const formats = []

    for (const key of Object.keys(options.proofFormats)) {
      const service = this.formatServiceMap[key]
      const requestOptions: CreateRequestAsResponseOptions<PFs> = {
        proofFormats: options.proofFormats,
        proofRecord: options.proofRecord,
      }
      formats.push(await service.createRequestAsResponse(requestOptions))
    }

    // create request message
    const requestMessage = new V2RequestPresentationMessage({
      attachmentInfo: formats,
      comment: options.comment,
      willConfirm: options.willConfirm,
      goalCode: options.goalCode,
    })
    requestMessage.setThread({ threadId: options.proofRecord.threadId })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: requestMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: options.proofRecord.id,
    })

    await this.updateState(agentContext, options.proofRecord, ProofState.RequestSent)

    return { message: requestMessage, proofRecord: options.proofRecord }
  }

  public async processRequest(
    messageContext: InboundMessageContext<V2RequestPresentationMessage>
  ): Promise<ProofRecord> {
    const { message: proofRequestMessage, connection: connectionRecord } = messageContext

    const requestAttachments = proofRequestMessage.getAttachmentFormats()

    for (const attachmentFormat of requestAttachments) {
      const service = this.getFormatServiceForFormat(attachmentFormat.format)
      service?.processRequest({
        requestAttachment: attachmentFormat,
      })
    }

    // assert
    if (proofRequestMessage.requestPresentationsAttach.length === 0) {
      throw new V2PresentationProblemReportError(
        `Missing required base64 or json encoded attachment data for presentation request with thread id ${proofRequestMessage.threadId}`,
        { problemCode: PresentationProblemReportReason.Abandoned }
      )
    }

    this.logger.debug(`Received proof request`, proofRequestMessage)

    let proofRecord: ProofRecord

    try {
      proofRecord = await this.proofRepository.getSingleByQuery(messageContext.agentContext, {
        threadId: proofRequestMessage.threadId,
        connectionId: connectionRecord?.id,
      })

      const requestMessage = await this.didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: V2RequestPresentationMessage,
      })

      const proposalMessage = await this.didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: V2ProposalPresentationMessage,
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
        connectionId: connectionRecord?.id,
        threadId: proofRequestMessage.threadId,
        parentThreadId: proofRequestMessage.thread?.parentThreadId,
        state: ProofState.RequestReceived,
        protocolVersion: ProofProtocolVersion.V2,
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
    options: CreatePresentationOptions<PFs>
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    // assert state
    options.proofRecord.assertState(ProofState.RequestReceived)

    const proofRequest = await this.didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: options.proofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })

    const formats = []
    for (const key of Object.keys(options.proofFormats)) {
      const service = this.formatServiceMap[key]
      formats.push(
        await service.createPresentation(agentContext, {
          attachment: proofRequest.getAttachmentByFormatIdentifier(V2_INDY_PRESENTATION_REQUEST),
          proofFormats: options.proofFormats,
        })
      )
    }

    const presentationMessage = new V2PresentationMessage({
      comment: options.comment,
      attachmentInfo: formats,
      goalCode: options.goalCode,
      lastPresentation: options.lastPresentation,
    })
    presentationMessage.setThread({ threadId: options.proofRecord.threadId })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: presentationMessage,
      associatedRecordId: options.proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    await this.updateState(agentContext, options.proofRecord, ProofState.PresentationSent)

    return { message: presentationMessage, proofRecord: options.proofRecord }
  }

  public async processPresentation(messageContext: InboundMessageContext<V2PresentationMessage>): Promise<ProofRecord> {
    const { message: presentationMessage, connection: connectionRecord } = messageContext

    this.logger.debug(`Processing presentation with id ${presentationMessage.id}`)

    const proofRecord = await this.proofRepository.getSingleByQuery(messageContext.agentContext, {
      threadId: presentationMessage.threadId,
      connectionId: connectionRecord?.id,
    })

    const proposalMessage = await this.didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V2ProposalPresentationMessage,
    })

    const requestMessage = await this.didCommMessageRepository.getAgentMessage(messageContext.agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })

    // Assert
    proofRecord.assertState(ProofState.RequestSent)
    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: proposalMessage ?? undefined,
      previousSentMessage: requestMessage ?? undefined,
    })

    const formatVerificationResults = []
    for (const attachmentFormat of presentationMessage.getAttachmentFormats()) {
      const service = this.getFormatServiceForFormat(attachmentFormat.format)
      if (service) {
        try {
          formatVerificationResults.push(
            await service.processPresentation(messageContext.agentContext, {
              record: proofRecord,
              formatAttachments: {
                request: requestMessage?.getAttachmentFormats(),
                presentation: presentationMessage.getAttachmentFormats(),
              },
            })
          )
        } catch (e) {
          if (e instanceof AriesFrameworkError) {
            throw new V2PresentationProblemReportError(e.message, {
              problemCode: PresentationProblemReportReason.Abandoned,
            })
          }
          throw e
        }
      }
    }
    if (formatVerificationResults.length === 0) {
      throw new V2PresentationProblemReportError('None of the received formats are supported.', {
        problemCode: PresentationProblemReportReason.Abandoned,
      })
    }

    const isValid = formatVerificationResults.every((x) => x === true)

    await this.didCommMessageRepository.saveOrUpdateAgentMessage(messageContext.agentContext, {
      agentMessage: presentationMessage,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Receiver,
    })

    // Update record
    proofRecord.isVerified = isValid
    await this.updateState(messageContext.agentContext, proofRecord, ProofState.PresentationReceived)

    return proofRecord
  }

  public async createAck(
    agentContext: AgentContext,
    options: CreateAckOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    // assert we've received the final presentation
    const presentation = await this.didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: options.proofRecord.id,
      messageClass: V2PresentationMessage,
    })

    if (!presentation.lastPresentation) {
      throw new AriesFrameworkError(
        `Trying to send an ack message while presentation with id ${presentation.id} indicates this is not the last presentation (presentation.lastPresentation is set to false)`
      )
    }

    const msg = new V2PresentationAckMessage({
      threadId: options.proofRecord.threadId,
      status: AckStatus.OK,
    })

    await this.updateState(agentContext, options.proofRecord, ProofState.Done)

    return {
      message: msg,
      proofRecord: options.proofRecord,
    }
  }

  public async processAck(messageContext: InboundMessageContext<V2PresentationAckMessage>): Promise<ProofRecord> {
    const { message: ackMessage, connection: connectionRecord } = messageContext

    const proofRecord = await this.proofRepository.getSingleByQuery(messageContext.agentContext, {
      threadId: ackMessage.threadId,
      connectionId: connectionRecord?.id,
    })

    const requestMessage = await this.didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })

    const presentationMessage = await this.didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V2PresentationMessage,
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
    const msg = new V2PresentationProblemReportMessage({
      description: {
        code: PresentationProblemReportReason.Abandoned,
        en: options.description,
      },
    })

    msg.setThread({
      threadId: options.proofRecord.threadId,
      parentThreadId: options.proofRecord.threadId,
    })

    return {
      proofRecord: options.proofRecord,
      message: msg,
    }
  }

  public async processProblemReport(
    messageContext: InboundMessageContext<V2PresentationProblemReportMessage>
  ): Promise<ProofRecord> {
    const { message: presentationProblemReportMessage } = messageContext

    const connectionRecord = messageContext.assertReadyConnection()

    this.logger.debug(`Processing problem report with id ${presentationProblemReportMessage.id}`)

    const proofRecord = await this.proofRepository.getSingleByQuery(messageContext.agentContext, {
      threadId: presentationProblemReportMessage.threadId,
      connectionId: connectionRecord?.id,
    })

    proofRecord.errorMessage = `${presentationProblemReportMessage.description.code}: ${presentationProblemReportMessage.description.en}`
    await this.updateState(messageContext.agentContext, proofRecord, ProofState.Abandoned)
    return proofRecord
  }

  public async createProofRequestFromProposal(
    agentContext: AgentContext,
    options: CreateProofRequestFromProposalOptions
  ): Promise<ProofRequestFromProposalOptions<PFs>> {
    const proofRecordId = options.proofRecord.id
    const proposalMessage = await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecordId,
      messageClass: V2ProposalPresentationMessage,
    })

    if (!proposalMessage) {
      throw new AriesFrameworkError(`Proof record with id ${proofRecordId} is missing required presentation proposal`)
    }

    const proposalAttachments = proposalMessage.getAttachmentFormats()

    let result = {}

    for (const attachmentFormat of proposalAttachments) {
      const service = this.getFormatServiceForFormat(attachmentFormat.format)

      if (!service) {
        throw new AriesFrameworkError('No format service found for getting requested.')
      }

      result = {
        ...result,
        ...(await service.createProofRequestFromProposal({
          presentationAttachment: attachmentFormat.attachment,
        })),
      }
    }

    const retVal: ProofRequestFromProposalOptions<PFs> = {
      proofRecord: options.proofRecord,
      proofFormats: result,
    }
    return retVal
  }

  public async shouldAutoRespondToProposal(agentContext: AgentContext, proofRecord: ProofRecord): Promise<boolean> {
    const proposal = await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V2ProposalPresentationMessage,
    })

    if (!proposal) {
      return false
    }
    const request = await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })
    if (!request) {
      return true
    }
    await MessageValidator.validateSync(proposal)

    const proposalAttachments = proposal.getAttachmentFormats()
    const requestAttachments = request.getAttachmentFormats()

    const equalityResults = []
    for (const attachmentFormat of proposalAttachments) {
      const service = this.getFormatServiceForFormat(attachmentFormat.format)
      equalityResults.push(service?.proposalAndRequestAreEqual(proposalAttachments, requestAttachments))
    }
    return true
  }

  public async shouldAutoRespondToRequest(agentContext: AgentContext, proofRecord: ProofRecord): Promise<boolean> {
    const proposal = await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V2ProposalPresentationMessage,
    })

    if (!proposal) {
      return false
    }

    const request = await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })

    if (!request) {
      throw new AriesFrameworkError(`Expected to find a request message for ProofRecord with id ${proofRecord.id}`)
    }

    const proposalAttachments = proposal.getAttachmentFormats()
    const requestAttachments = request.getAttachmentFormats()

    const equalityResults = []
    for (const attachmentFormat of proposalAttachments) {
      const service = this.getFormatServiceForFormat(attachmentFormat.format)
      equalityResults.push(service?.proposalAndRequestAreEqual(proposalAttachments, requestAttachments))
    }

    return equalityResults.every((x) => x === true)
  }

  public async shouldAutoRespondToPresentation(agentContext: AgentContext, proofRecord: ProofRecord): Promise<boolean> {
    const request = await this.didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })

    return request.willConfirm
  }

  public async findRequestMessage(
    agentContext: AgentContext,
    proofRecordId: string
  ): Promise<V2RequestPresentationMessage | null> {
    return await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecordId,
      messageClass: V2RequestPresentationMessage,
    })
  }

  public async findPresentationMessage(
    agentContext: AgentContext,
    proofRecordId: string
  ): Promise<V2PresentationMessage | null> {
    return await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecordId,
      messageClass: V2PresentationMessage,
    })
  }

  public async findProposalMessage(
    agentContext: AgentContext,
    proofRecordId: string
  ): Promise<V2ProposalPresentationMessage | null> {
    return await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecordId,
      messageClass: V2ProposalPresentationMessage,
    })
  }

  public async getRequestedCredentialsForProofRequest(
    agentContext: AgentContext,
    options: GetRequestedCredentialsForProofRequestOptions
  ): Promise<FormatRetrievedCredentialOptions<PFs>> {
    const requestMessage = await this.didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: options.proofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })

    if (!requestMessage) {
      throw new AriesFrameworkError('No proof request found.')
    }

    const requestAttachments = requestMessage.getAttachmentFormats()

    let result = {
      proofFormats: {},
    }
    for (const attachmentFormat of requestAttachments) {
      const service = this.getFormatServiceForFormat(attachmentFormat.format)

      if (!service) {
        throw new AriesFrameworkError('No format service found for getting requested.')
      }

      result = {
        ...result,
        ...(await service.getRequestedCredentialsForProofRequest(agentContext, {
          attachment: attachmentFormat.attachment,
          presentationProposal: undefined,
          config: options.config,
        })),
      }
    }

    return result
  }

  public async autoSelectCredentialsForProofRequest(
    options: FormatRetrievedCredentialOptions<PFs>
  ): Promise<FormatRequestedCredentialReturn<PFs>> {
    let returnValue = {
      proofFormats: {},
    }

    for (const [id] of Object.entries(options.proofFormats)) {
      const service = this.formatServiceMap[id]
      const credentials = await service.autoSelectCredentialsForProofRequest(options)
      returnValue = { ...returnValue, ...credentials }
    }

    return returnValue
  }

  public registerHandlers(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    proofResponseCoordinator: ProofResponseCoordinator,
    mediationRecipientService: MediationRecipientService,
    routingService: RoutingService
  ): void {
    dispatcher.registerHandler(
      new V2ProposePresentationHandler<PFs>(this, agentConfig, this.didCommMessageRepository, proofResponseCoordinator)
    )

    dispatcher.registerHandler(
      new V2RequestPresentationHandler(
        this,
        agentConfig,
        proofResponseCoordinator,
        mediationRecipientService,
        this.didCommMessageRepository,
        routingService
      )
    )

    dispatcher.registerHandler(
      new V2PresentationHandler(this, agentConfig, proofResponseCoordinator, this.didCommMessageRepository)
    )
    dispatcher.registerHandler(new V2PresentationAckHandler(this))
    dispatcher.registerHandler(new V2PresentationProblemReportHandler(this))
  }

  private getFormatServiceForFormat(format: ProofFormatSpec) {
    for (const service of Object.values(this.formatServiceMap)) {
      if (service.supportsFormat(format.format)) {
        return service
      }
    }
    return null
  }
}
