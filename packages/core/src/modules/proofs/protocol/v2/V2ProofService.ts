import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { ProofStateChangedEvent } from '../../ProofEvents'
import type { ProofFormatService } from '../../formats/ProofFormatService'
import type {
  CreateProposalAsResponseOptions,
  CreateProposalOptions,
  CreateRequestAsResponseOptions,
  CreateRequestOptions,
} from '../../models/ProofServiceOptions'
import type { RetrievedCredentials } from '../v1/models'
import type { AgentMessage } from '@aries-framework/core'

import { Lifecycle, scoped } from 'tsyringe'

import { EventEmitter } from '../../../../agent/EventEmitter'
import { DidCommMessageRecord, DidCommMessageRepository, DidCommMessageRole } from '../../../../storage'
import { ProofEventTypes } from '../../ProofEvents'
import { ProofService } from '../../ProofService'
import { IndyProofFormatService } from '../../formats/indy/IndyProofFormatService'
import { ProofProtocolVersion } from '../../models/ProofProtocolVersion'
import { ProofState } from '../../models/ProofState'
import { PresentationRecordType, ProofRecord, ProofRepository } from '../../repository'

import { V2ProposalPresentationMessage } from './messages/V2ProposalPresentationMessage'
import { V2RequestPresentationMessage } from './messages/V2RequestPresentationMessage'

@scoped(Lifecycle.ContainerScoped)
export class V2ProofService extends ProofService {
  private protocolVersion: ProofProtocolVersion
  private formatServiceMap: { [key: string]: ProofFormatService }

  public constructor(
    proofRepository: ProofRepository,
    didCommMessageRepository: DidCommMessageRepository,
    eventEmitter: EventEmitter
  ) {
    super(proofRepository, didCommMessageRepository, eventEmitter)
    this.protocolVersion = ProofProtocolVersion.V2_0
    this.formatServiceMap = {
      [PresentationRecordType.Indy]: new IndyProofFormatService(),
      // K-TODO add JSON-LD format service
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
          messageType: 'hlindy/proof-req@v2.0',
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
          messageType: 'hlindy/proof-req@v2.0',
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
  public processProposal(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    throw new Error('Method not implemented.')
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
          messageType: 'hlindy/proof-req@v2.0',
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
      state: ProofState.ProposalSent,
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

    // create attachment formats
    const formats = []
    for (const key of Object.keys(options.proofFormats)) {
      const service = this.formatServiceMap[key]
      formats.push(
        service.createRequest({
          messageType: 'hlindy/proof-req@v2.0',
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

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: requestMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: options.proofRecord.id,
    })

    this.updateState(options.proofRecord, ProofState.RequestSent)

    return { message: requestMessage, proofRecord: options.proofRecord }
  }
  public processRequest(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord> {
    throw new Error('Method not implemented.')
  }
  public createPresentation(
    options: CreatePresentationOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    throw new Error('Method not implemented.')
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
}
