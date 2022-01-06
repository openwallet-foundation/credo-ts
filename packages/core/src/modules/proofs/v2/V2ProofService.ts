import type { ProofStateChangedEvent, ProposePresentationMessage } from '..'
import type { AgentConfig } from '../../../agent/AgentConfig'
import type { AgentMessage } from '../../../agent/AgentMessage'
import type { Dispatcher } from '../../../agent/Dispatcher'
import type { EventEmitter } from '../../../agent/EventEmitter'
import type { HandlerInboundMessage } from '../../../agent/Handler'
import type { Logger } from '../../../logger'
import type { ConnectionService } from '../../connections/services'
import type { ProofResponseCoordinator } from '../ProofResponseCoordinator'
import type { ProofRepository } from '../repository'
import type { ProofFormatService } from './formats/ProofFormatService'
import type { ProposeProofOptions } from './interface'
import type { V2ProposalPresentationMessage } from './messages/V2ProposalPresentationMessage'

import { Lifecycle, scoped } from 'tsyringe'

import { ProofEventTypes, ProofState } from '..'
import { PresentationRecordType } from '../PresentationExchangeRecord'
import { ProofProtocolVersion } from '../ProofProtocolVersion'
import { ProofService } from '../ProofService'
import { ProofRecord } from '../repository'

import { ProofMessageBuilder } from './ProofMessageBuilder'
import { IndyProofFormatService } from './formats/indy/IndyProofFormatService'
import { JsonLdProofFormatService } from './formats/jsonld/JsonLdProofFormatService'
import { V2ProposePresentationHandler } from './handlers/V2ProposePresentationHandler'

interface ProofRequestFromProposalConfig {
  name: string
  version: string
}

scoped(Lifecycle.ContainerScoped)
export class V2ProofService extends ProofService {
  public createRequestAsResponse(
    proofRecord: ProofRecord,
    proofRequest: void
  ): { message: any } | PromiseLike<{ message: any }> {
    throw new Error('Method not implemented.')
  }

  public createProofRequestFromProposal(
    proposalMessage: V2ProposalPresentationMessage | ProposePresentationMessage,
    proofRequestFromProposalConfig: ProofRequestFromProposalConfig
  ) {
    throw new Error('Method not implemented.')
  }

  private proofRepository: ProofRepository
  private connectionService: ConnectionService
  private eventEmitter: EventEmitter
  private agentConfig: AgentConfig
  private proofResponseCoordinator: ProofResponseCoordinator
  private dispatcher: Dispatcher
  private logger: Logger

  public constructor(
    proofRepository: ProofRepository,
    connectionService: ConnectionService,
    eventEmitter: EventEmitter,
    agentConfig: AgentConfig,
    dispatcher: Dispatcher,
    proofResponseCoordinator: ProofResponseCoordinator
  ) {
    super()
    this.proofRepository = proofRepository
    this.connectionService = connectionService
    this.eventEmitter = eventEmitter
    this.agentConfig = agentConfig
    this.dispatcher = dispatcher
    this.proofResponseCoordinator = proofResponseCoordinator
    this.logger = agentConfig.logger
  }

  public getFormatService(_proofRecordType: PresentationRecordType): ProofFormatService {
    const serviceFormatMap = {
      [PresentationRecordType.INDY]: IndyProofFormatService,
      [PresentationRecordType.W3C]: JsonLdProofFormatService,
    }
    return new serviceFormatMap[_proofRecordType](this.proofRepository, this.eventEmitter)
  }

  public getVersion(): ProofProtocolVersion {
    return ProofProtocolVersion.V1_0
  }

  public async createProposal(
    proposal: ProposeProofOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    this.logger.debug('----------- In V2 Proof Service  -----------------\n')

    const connection = await this.connectionService.getById(proposal.connectionId)

    const presentationRecordType = proposal.proofFormats?.indy
      ? PresentationRecordType.INDY
      : PresentationRecordType.W3C

    this.logger.debug('Get the Format Service and Create Proposal Message')

    const formatService: ProofFormatService = this.getFormatService(presentationRecordType)

    const presentationMessageBuilder = new ProofMessageBuilder()
    const { message, proofRecord } = presentationMessageBuilder.createProposal(
      formatService,
      proposal,
      connection.threadId
    )

    this.logger.debug('Save meta data and emit state change event')
    await formatService.save(proposal, proofRecord)

    return { proofRecord, message }
  }

  public async processProposal(
    messageContext: HandlerInboundMessage<V2ProposePresentationHandler>
  ): Promise<ProofRecord> {
    let proofRecord: ProofRecord
    const { message: proposalMessage, connection } = messageContext

    try {
      proofRecord = await this.getByThreadAndConnectionId(proposalMessage.threadId, connection?.id)

      proofRecord.assertState(ProofState.PresentationSent)
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

  private async getByThreadAndConnectionId(threadId: string, connectionId?: string): Promise<ProofRecord> {
    return this.proofRepository.getSingleByQuery({
      connectionId,
      threadId,
    })
  }

  private async updateState(proofRecord: ProofRecord, newState: ProofState) {
    const previousState = proofRecord.state
    proofRecord.state = newState
    await this.proofRepository.update(proofRecord)

    this.eventEmitter.emit<ProofStateChangedEvent>({
      type: ProofEventTypes.ProofStateChanged,
      payload: { proofRecord, previousState: previousState },
    })
  }

  public registerHandlers() {
    this.dispatcher.registerHandler(
      new V2ProposePresentationHandler(this, this.agentConfig, this.proofResponseCoordinator)
    )
  }
}
