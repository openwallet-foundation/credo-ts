import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ProofResponseCoordinator } from '../ProofResponseCoordinator'
import type { ProofRecord } from '../repository'
import type { ProofService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { PresentationMessage } from '../messages'

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
    const proofRecord = await this.proofService.processPresentation(messageContext)

    if (this.proofResponseCoordinator.shouldAutoRespondToPresentation(proofRecord)) {
      return await this.sendAck(proofRecord, messageContext)
    }
  }

  private async sendAck(proofRecord: ProofRecord, messageContext: HandlerInboundMessage<PresentationHandler>) {
    this.agentConfig.logger.info(
      `Automatically sending acknowledgement with autoAccept on ${this.agentConfig.autoAcceptProofs}`
    )

    if (!messageContext.connection) {
      this.agentConfig.logger.error('No connection on the messageContext')
      return
    }

    const { message } = await this.proofService.createAck(proofRecord)

    return createOutboundMessage(messageContext.connection, message)
  }
}
