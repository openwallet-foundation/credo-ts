import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ProofResponseCoordinator } from '../ProofResponseCoordinator'
import type { ProofRecord } from '../repository'
import type { ProofService } from '../services'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../agent/helpers'
import { PresentationProblemReportError } from '../errors/PresentationProblemReportError'
import { PresentationMessage, PresentationProblemReportMessage } from '../messages'

export class PresentationHandler implements Handler {
  private proofService: ProofService
  private agentConfig: AgentConfig
  private proofResponseCoordinator: ProofResponseCoordinator
  public supportedMessages = [PresentationMessage]

  public constructor(
    proofService: ProofService,
    agentConfig: AgentConfig,
    proofResponseCoordinator: ProofResponseCoordinator
  ) {
    this.proofService = proofService
    this.agentConfig = agentConfig
    this.proofResponseCoordinator = proofResponseCoordinator
  }

  public async handle(messageContext: HandlerInboundMessage<PresentationHandler>) {
    try {
      const proofRecord = await this.proofService.processPresentation(messageContext)

      if (this.proofResponseCoordinator.shouldAutoRespondToPresentation(proofRecord)) {
        return await this.createAck(proofRecord, messageContext)
      }
    } catch (error) {
      if (error instanceof PresentationProblemReportError) {
        const credentialProblemReportMessage = new PresentationProblemReportMessage({
          description: {
            en: error.message,
            code: error.problemCode,
          },
        })
        credentialProblemReportMessage.setThread({
          threadId: messageContext.message.threadId,
        })
        return createOutboundMessage(messageContext.connection!, credentialProblemReportMessage)
      }
    }
  }

  private async createAck(record: ProofRecord, messageContext: HandlerInboundMessage<PresentationHandler>) {
    this.agentConfig.logger.info(
      `Automatically sending acknowledgement with autoAccept on ${this.agentConfig.autoAcceptProofs}`
    )

    const { message, proofRecord } = await this.proofService.createAck(record)

    if (messageContext.connection) {
      return createOutboundMessage(messageContext.connection, message)
    } else if (proofRecord.requestMessage?.service && proofRecord.presentationMessage?.service) {
      const recipientService = proofRecord.presentationMessage?.service
      const ourService = proofRecord.requestMessage?.service

      return createOutboundServiceMessage({
        payload: message,
        service: recipientService.toDidCommService(),
        senderKey: ourService.recipientKeys[0],
      })
    }

    this.agentConfig.logger.error(`Could not automatically create presentation ack`)
  }
}
