import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { Logger } from '../../../logger'
import type { ProofResponseCoordinator } from '../ProofResponseCoordinator'
import type { ProofRecord } from '../repository'
import type { ProofService } from '../services'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../agent/helpers'
import { PresentationMessage } from '../messages'

export class PresentationHandler implements Handler {
  private proofService: ProofService
  private proofResponseCoordinator: ProofResponseCoordinator
  private logger: Logger
  public supportedMessages = [PresentationMessage]

  public constructor(proofService: ProofService, proofResponseCoordinator: ProofResponseCoordinator, logger: Logger) {
    this.proofService = proofService
    this.proofResponseCoordinator = proofResponseCoordinator
    this.logger = logger
  }

  public async handle(messageContext: HandlerInboundMessage<PresentationHandler>) {
    const proofRecord = await this.proofService.processPresentation(messageContext)

    if (this.proofResponseCoordinator.shouldAutoRespondToPresentation(messageContext.agentContext, proofRecord)) {
      return await this.createAck(proofRecord, messageContext)
    }
  }

  private async createAck(record: ProofRecord, messageContext: HandlerInboundMessage<PresentationHandler>) {
    this.logger.info(
      `Automatically sending acknowledgement with autoAccept on ${messageContext.agentContext.config.autoAcceptProofs}`
    )

    const { message, proofRecord } = await this.proofService.createAck(messageContext.agentContext, record)

    if (messageContext.connection) {
      return createOutboundMessage(messageContext.connection, message)
    } else if (proofRecord.requestMessage?.service && proofRecord.presentationMessage?.service) {
      const recipientService = proofRecord.presentationMessage?.service
      const ourService = proofRecord.requestMessage?.service

      return createOutboundServiceMessage({
        payload: message,
        service: recipientService.resolvedDidCommService,
        senderKey: ourService.resolvedDidCommService.recipientKeys[0],
      })
    }

    this.logger.error(`Could not automatically create presentation ack`)
  }
}
