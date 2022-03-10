import type { AgentMessage } from '../../../../agent/AgentMessage'
import type { Dispatcher } from '../../../../agent/Dispatcher'
import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { MediationRecipientService } from '../../../routing/services/MediationRecipientService'
import type { ProofStateChangedEvent } from '../../ProofEvents'
import type { ProofResponseCoordinator } from '../../ProofResponseCoordinator'
import type { ProofFormatService } from '../../formats/ProofFormatService'
import type { CreateProblemReportOptions } from '../../formats/models/ProofFormatServiceOptions'
import type { ProofFormatSpec } from '../../formats/models/ProofFormatSpec'
import type { GetRequestedCredentialsConfig } from '../../models/GetRequestedCredentialsConfig'
import type {
  CreateAckOptions,
  CreatePresentationOptions,
  CreateProposalAsResponseOptions,
  CreateProposalOptions,
  CreateRequestAsResponseOptions,
  CreateRequestOptions,
} from '../../models/ProofServiceOptions'
import type { RetrievedCredentials, RequestedCredentials } from '../v1/models'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../../agent/AgentConfig'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../../constants'
import { AriesFrameworkError } from '../../../../error'
import { DidCommMessageRepository, DidCommMessageRole } from '../../../../storage'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { Wallet } from '../../../../wallet/Wallet'
import { AckStatus } from '../../../common'
import { ConnectionService } from '../../../connections'
import { ProofEventTypes } from '../../ProofEvents'
import { ProofService } from '../../ProofService'
import { IndyProofFormatService } from '../../formats/indy/IndyProofFormatService'
import { ProofProtocolVersion } from '../../models/ProofProtocolVersion'
import { ProofState } from '../../models/ProofState'
import { PresentationRecordType, ProofRecord, ProofRepository } from '../../repository'
import { V1PresentationProblemReportError } from '../v1/errors/V1PresentationProblemReportError'
import { V1PresentationProblemReportReason } from '../v1/errors/V1PresentationProblemReportReason'
import { PresentationPreview } from '../v1/models/PresentationPreview'
import { ProofRequest } from '../v1/models/ProofRequest'

import { V2PresentationProblemReportError, V2PresentationProblemReportReason } from './errors'
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
export class V2ProofService extends ProofService {
  private protocolVersion: ProofProtocolVersion
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
    this.protocolVersion = ProofProtocolVersion.V2_0
    this.wallet = wallet
    this.formatServiceMap = {
      [PresentationRecordType.Indy]: indyProofFormatService,
    }
  }

  public getVersion(): ProofProtocolVersion {
    return this.protocolVersion
  }

  public async createProposal(
    options: CreateProposalOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    options.connectionRecord.assertReady() // K-TODO: move to module

    const formats = []
    for (const key of Object.keys(options.proofFormats)) {
      const service = this.formatServiceMap[key]
      formats.push(
        service.createProposal({
          formats: options.proofFormats,
        })
      )
    }

    const proposalMessage = new V2ProposalPresentationMessage({
      attachmentInfo: formats,
      comment: options.comment,
      willConfirm: options.willConfirm,
      goalCode: options.goalCode,
    })

    const proofRecord = new ProofRecord({
      connectionId: options.connectionRecord.id,
      threadId: proposalMessage.threadId,
      state: ProofState.ProposalSent,
      protocolVersion: ProofProtocolVersion.V2_0,
    })

    await this.proofRepository.save(proofRecord)

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: proposalMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: proofRecord.id,
    })

    this.eventEmitter.emit<ProofStateChangedEvent>({
      type: ProofEventTypes.ProofStateChanged,
      payload: { proofRecord, previousState: null },
    })

    return {
      proofRecord: proofRecord,
      message: proposalMessage,
    }
  }

  public async createProposalAsResponse(
    options: CreateProposalAsResponseOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    options.proofRecord.assertState(ProofState.RequestReceived)

    const formats = []
    for (const key of Object.keys(options.proofFormats)) {
      const service = this.formatServiceMap[key]
      formats.push(
        service.createProposal({
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

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: proposalMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: options.proofRecord.id,
    })

    this.updateState(options.proofRecord, ProofState.ProposalSent)

    return { message: proposalMessage, proofRecord: options.proofRecord }
  }

  public async processProposal(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    const { message: proposalMessage, connection: connectionRecord } = messageContext
    let proofRecord: ProofRecord

    try {
      proofRecord = await this.proofRepository.getSingleByQuery({
        threadId: proposalMessage.threadId,
        connectionId: connectionRecord?.id,
      })

      const requestMessage = await this.didCommMessageRepository.findAgentMessage({
        associatedRecordId: proofRecord.id,
        messageClass: V2RequestPresentationMessage,
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

      await this.updateState(proofRecord, ProofState.ProposalReceived)
    } catch {
      // No proof record exists with thread id
      proofRecord = new ProofRecord({
        connectionId: connectionRecord?.id,
        threadId: proposalMessage.threadId,
        state: ProofState.ProposalReceived,
        protocolVersion: ProofProtocolVersion.V2_0,
      })

      // Assert
      this.connectionService.assertConnectionOrServiceDecorator(messageContext)

      // Save record
      await this.didCommMessageRepository.saveOrUpdateAgentMessage({
        agentMessage: proposalMessage,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Receiver,
      })

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

  public async createRequest(
    options: CreateRequestOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    // create attachment formats
    const formats = []
    for (const key of Object.keys(options.proofFormats)) {
      const service = this.formatServiceMap[key]
      formats.push(
        service.createRequest({
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
    })

    // create & store proof record
    const proofRecord = new ProofRecord({
      connectionId: options.connectionRecord.id,
      threadId: requestMessage.threadId,
      state: ProofState.RequestSent,
      protocolVersion: ProofProtocolVersion.V2_0,
    })

    await this.proofRepository.save(proofRecord)

    // create DIDComm message
    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: requestMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: proofRecord.id,
    })

    this.eventEmitter.emit<ProofStateChangedEvent>({
      type: ProofEventTypes.ProofStateChanged,
      payload: { proofRecord, previousState: null },
    })

    return {
      proofRecord: proofRecord,
      message: requestMessage,
    }
  }

  public async createRequestAsResponse(
    options: CreateRequestAsResponseOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    options.proofRecord.assertState(ProofState.ProposalReceived)

    const proposal = await this.didCommMessageRepository.getAgentMessage({
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
      formats.push(
        service.createRequest({
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
    })
    requestMessage.setThread({ threadId: options.proofRecord.threadId })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: requestMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: options.proofRecord.id,
    })

    this.updateState(options.proofRecord, ProofState.RequestSent)

    return { message: requestMessage, proofRecord: options.proofRecord }
  }

  public async processRequest(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    const { message: _proofRequestMessage, connection: connectionRecord } = messageContext

    const proofRequestMessage = _proofRequestMessage as V2RequestPresentationMessage

    // assert
    if (proofRequestMessage.requestPresentationsAttach.length === 0) {
      throw new V1PresentationProblemReportError(
        `Missing required base64 or json encoded attachment data for presentation request with thread id ${proofRequestMessage.threadId}`,
        { problemCode: V1PresentationProblemReportReason.Abandoned }
      )
    }

    // // K-TODO remove this
    // proofRequestMessage.getAttachmentFormats().forEach(async (x) => {
    //   await validateOrReject(x.format)
    //   await validateOrReject(x.attachment)
    // })

    this.logger.debug(`Received proof request`, proofRequestMessage)

    let proofRecord: ProofRecord

    try {
      proofRecord = await this.proofRepository.getSingleByQuery({
        threadId: proofRequestMessage.threadId,
        connectionId: connectionRecord?.id,
      })

      const requestMessage = await this.didCommMessageRepository.findAgentMessage({
        associatedRecordId: proofRecord.id,
        messageClass: V2RequestPresentationMessage,
      })

      const proposalMessage = await this.didCommMessageRepository.findAgentMessage({
        associatedRecordId: proofRecord.id,
        messageClass: V2ProposalPresentationMessage,
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
        connectionId: connectionRecord?.id,
        threadId: proofRequestMessage.threadId,
        state: ProofState.RequestReceived,
        protocolVersion: ProofProtocolVersion.V2_0,
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

  /**
   * Decline a proof request
   * @param proofRecord The proof request to be declined
   */
  public async declineRequest(proofRecord: ProofRecord): Promise<ProofRecord> {
    proofRecord.assertState(ProofState.RequestReceived)

    await this.updateState(proofRecord, ProofState.Declined)

    return proofRecord
  }

  public async createPresentation(
    options: CreatePresentationOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    // assert state
    options.proofRecord.assertState(ProofState.RequestReceived)

    const proofRequest = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: options.proofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })

    const formats = []
    for (const key of Object.keys(options.proofFormats)) {
      const service = this.formatServiceMap[key]
      formats.push(
        await service.createPresentation({
          attachment: proofRequest.getAttachmentByFormatIdentifier('hlindy/proof-req@v2.0'),
          formats: options.proofFormats,
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

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: presentationMessage,
      associatedRecordId: options.proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    await this.updateState(options.proofRecord, ProofState.PresentationSent)

    return { message: presentationMessage, proofRecord: options.proofRecord }
  }

  public async processPresentation(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    const { message: _presentationMessage, connection: connectionRecord } = messageContext

    const presentationMessage = _presentationMessage as V2PresentationMessage

    this.logger.debug(`Processing presentation with id ${presentationMessage.id}`)

    const proofRecord = await this.proofRepository.getSingleByQuery({
      threadId: presentationMessage.threadId,
      connectionId: connectionRecord?.id,
    })

    const proposalMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: proofRecord.id,
      messageClass: V2ProposalPresentationMessage,
    })

    const requestMessage = await this.didCommMessageRepository.getAgentMessage({
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
            await service.processPresentation({
              record: proofRecord,
              presentation: {
                request: requestMessage?.getAttachmentFormats(),
                proof: presentationMessage.getAttachmentFormats(),
              },
            })
          )
        } catch (e) {
          if (e instanceof AriesFrameworkError) {
            throw new V2PresentationProblemReportError(e.message, {
              problemCode: V2PresentationProblemReportReason.Abandoned,
            })
          }
          throw e
        }
      }
    }
    if (formatVerificationResults.length === 0) {
      throw new V2PresentationProblemReportError('None of the received formats are supported.', {
        problemCode: V2PresentationProblemReportReason.Abandoned,
      })
    }

    const isValid = formatVerificationResults.every((x) => x === true)

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: presentationMessage,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Receiver,
    })

    // Update record
    proofRecord.isVerified = isValid
    await this.updateState(proofRecord, ProofState.PresentationReceived)

    return proofRecord
  }

  public async createAck(options: CreateAckOptions): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    // assert we've received the final presentation
    const presentation = await this.didCommMessageRepository.getAgentMessage({
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

    return {
      message: msg,
      proofRecord: options.proofRecord,
    }
  }

  public async processAck(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    const { message: _ackMessage, connection: connectionRecord } = messageContext

    const ackMessage = _ackMessage as V2PresentationAckMessage

    const proofRecord = await this.proofRepository.getSingleByQuery({
      threadId: ackMessage.threadId,
      connectionId: connectionRecord?.id,
    })

    const requestMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: proofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })

    const presentationMessage = await this.didCommMessageRepository.findAgentMessage({
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
    await this.updateState(proofRecord, ProofState.Done)

    return proofRecord
  }

  public async createProblemReport(
    options: CreateProblemReportOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    const msg = new V2PresentationProblemReportMessage({
      description: {
        code: V2PresentationProblemReportReason.Abandoned,
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

    const presentationProblemReportMessage = presentationProblemReportMsg as V2PresentationProblemReportMessage
    const connectionRecord = messageContext.assertReadyConnection()

    this.logger.debug(`Processing problem report with id ${presentationProblemReportMessage.id}`)

    const proofRecord = await this.proofRepository.getSingleByQuery({
      threadId: presentationProblemReportMessage.threadId,
      connectionId: connectionRecord?.id,
    })

    proofRecord.errorMessage = `${presentationProblemReportMessage.description.code}: ${presentationProblemReportMessage.description.en}`
    await this.proofRepository.update(proofRecord)
    return proofRecord
  }

  public async shouldAutoRespondToRequest(proofRecord: ProofRecord): Promise<boolean> {
    const proposal = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: proofRecord.id,
      messageClass: V2ProposalPresentationMessage,
    })

    if (!proposal) {
      return false
    }

    const request = await this.didCommMessageRepository.findAgentMessage({
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

  public async shouldAutoRespondToPresentation(proofRecord: ProofRecord): Promise<boolean> {
    const request = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: proofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })

    return request.willConfirm
  }

  public async createProofRequestFromProposal(options: {
    formats: {
      indy?: {
        proofRecord: ProofRecord
      }
      jsonLd?: never
    }
    config?: { indy?: { name: string; version: string; nonce?: string }; jsonLd?: never }
  }): Promise<{
    indy?: ProofRequest
    jsonLd?: never
  }> {
    let result = {}

    for (const [format, value] of Object.entries(options.formats)) {
      const service = this.formatServiceMap[format]

      const indyFormat = options.formats.indy
      const indyConfig = options.config?.indy

      if (!indyFormat) {
        throw new AriesFrameworkError('Indy format must be provided')
      }

      if (!indyConfig) {
        throw new AriesFrameworkError('Indy config must be provided')
      }

      const proofRecordId = indyFormat.proofRecord.id
      const proposalMessage = await this.didCommMessageRepository.findAgentMessage({
        associatedRecordId: proofRecordId,
        messageClass: V2ProposalPresentationMessage,
      })

      if (!proposalMessage) {
        throw new AriesFrameworkError(`Proof record with id ${proofRecordId} is missing required presentation proposal`)
      }

      result = {
        ...result,
        ...(await service.createProofRequestFromProposal({
          formats: {
            indy: {
              presentationProposal: proposalMessage?.proposalsAttach[0],
            },
          },
          config: { indy: indyConfig, jsonLd: undefined },
        })),
      }
    }
    return result
  }

  public async findRequestMessage(options: { proofRecord: ProofRecord }): Promise<AgentMessage | null> {
    return await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: options.proofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })
  }

  public async findPresentationMessage(options: { proofRecord: ProofRecord }): Promise<AgentMessage | null> {
    return await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: options.proofRecord.id,
      messageClass: V2PresentationMessage,
    })
  }

  public async findProposalMessage(options: { proofRecord: ProofRecord }): Promise<AgentMessage | null> {
    return await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: options.proofRecord.id,
      messageClass: V2ProposalPresentationMessage,
    })
  }

  public async getRequestedCredentialsForProofRequest(options: {
    proofRecord: ProofRecord
    config: { indy?: GetRequestedCredentialsConfig | undefined; jsonLd?: undefined }
  }): Promise<{ indy?: RetrievedCredentials | undefined; jsonLd?: undefined }> {
    const requestMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: options.proofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })

    if (!requestMessage) {
      throw new AriesFrameworkError('No proof request found.')
    }

    const proposalMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: options.proofRecord.id,
      messageClass: V2ProposalPresentationMessage,
    })

    const proposalJson = proposalMessage?.proposalsAttach[0].getDataAsJson<PresentationPreview>() ?? null
    const proofPreview = JsonTransformer.fromJSON(proposalJson, PresentationPreview)

    const proofRequestJson = requestMessage.requestPresentationsAttach[0].getDataAsJson<ProofRequest>() ?? null
    const proofRequest = JsonTransformer.fromJSON(proofRequestJson, ProofRequest)

    const requestAttachments = requestMessage.formats

    let result = {}
    for (const attachmentFormat of requestAttachments) {
      const service = this.getFormatServiceForFormat(attachmentFormat)

      if (!service) {
        throw new AriesFrameworkError('')
      }

      result = {
        ...result,
        ...(await service.getRequestedCredentialsForProofRequest({
          proofRequest: proofRequest,
          presentationProposal: proofPreview,
          config: options.config,
        })),
      }
    }

    return result
  }

  public async autoSelectCredentialsForProofRequest(options: {
    indy?: RetrievedCredentials | undefined
    jsonLd?: undefined
  }): Promise<{ indy?: RequestedCredentials | undefined; jsonLd?: undefined }> {
    let returnValue = {}

    for (const [id, format] of Object.entries(options)) {
      const service = this.formatServiceMap[id]
      const credentials = await service.autoSelectCredentialsForProofRequest(options)
      returnValue = { ...returnValue, ...credentials }
    }

    return returnValue
  }

  public async registerHandlers(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    proofResponseCoordinator: ProofResponseCoordinator,
    mediationRecipientService: MediationRecipientService
  ): Promise<void> {
    dispatcher.registerHandler(
      new V2ProposePresentationHandler(this, agentConfig, this.didCommMessageRepository, proofResponseCoordinator)
    )

    dispatcher.registerHandler(
      new V2RequestPresentationHandler(
        this,
        agentConfig,
        proofResponseCoordinator,
        mediationRecipientService,
        this.didCommMessageRepository
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
