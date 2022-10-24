import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { ProofResponseCoordinator } from '../../../ProofResponseCoordinator'
import type { ProofRecord } from '../../../repository'
import type { V1ProofService } from '../V1ProofService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { V1PresentationMessage, V1RequestPresentationMessage } from '../messages'

export class V1PresentationHandler implements Handler {
  private proofService: V1ProofService
  private agentConfig: AgentConfig
  private proofResponseCoordinator: ProofResponseCoordinator
  private didCommMessageRepository: DidCommMessageRepository
  public supportedMessages = [V1PresentationMessage]

  public constructor(
    proofService: V1ProofService,
    agentConfig: AgentConfig,
    proofResponseCoordinator: ProofResponseCoordinator,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.proofService = proofService
    this.agentConfig = agentConfig
    this.proofResponseCoordinator = proofResponseCoordinator
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: HandlerInboundMessage<V1PresentationHandler>) {
    const proofRecord = await this.proofService.processPresentation(messageContext)

    if (this.proofResponseCoordinator.shouldAutoRespondToPresentation(messageContext.agentContext, proofRecord)) {
      return await this.createAck(proofRecord, messageContext)
    }
  }

  private async createAck(record: ProofRecord, messageContext: HandlerInboundMessage<V1PresentationHandler>) {
    this.agentConfig.logger.info(
      `Automatically sending acknowledgement with autoAccept on ${this.agentConfig.autoAcceptProofs}`
    )

    const { message, proofRecord } = await this.proofService.createAck(messageContext.agentContext, {
      proofRecord: record,
    })

    const requestMessage = await this.didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V1RequestPresentationMessage,
    })

    const presentationMessage = await this.didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V1PresentationMessage,
    })

    if (messageContext.connection) {
      return createOutboundMessage(messageContext.connection, message)
    } else if (requestMessage?.service && presentationMessage?.service) {
      const recipientService = presentationMessage?.service
      const ourService = requestMessage?.service

      return createOutboundServiceMessage({
        payload: message,
        service: recipientService.resolvedDidCommService,
        senderKey: ourService.resolvedDidCommService.recipientKeys[0],
      })
    }

    this.agentConfig.logger.error(`Could not automatically create presentation ack`)
  }
}
