import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ProofRecord } from '../repository'
import type { ProofService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { AutoAcceptProof } from '../../../types'
import { ProofUtils } from '../ProofUtils'
import { PresentationMessage } from '../messages'

export class PresentationHandler implements Handler {
  private proofService: ProofService
  private agentConfig: AgentConfig
  public supportedMessages = [PresentationMessage]

  public constructor(proofService: ProofService, agentConfig: AgentConfig) {
    this.proofService = proofService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<PresentationHandler>) {
    const proofRecord = await this.proofService.processPresentation(messageContext)

    const autoAccept = ProofUtils.composeAutoAccept(proofRecord.autoAcceptProof, this.agentConfig.autoAcceptProofs)

    if (autoAccept === AutoAcceptProof.always) {
      return await this.nextStep(proofRecord, messageContext)
    }
  }
  private async nextStep(proofRecord: ProofRecord, messageContext: HandlerInboundMessage<PresentationHandler>) {
    const { message } = await this.proofService.createAck(proofRecord)

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return createOutboundMessage(messageContext.connection!, message)
  }
}
