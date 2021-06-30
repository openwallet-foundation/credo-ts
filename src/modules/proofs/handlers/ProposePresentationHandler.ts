import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ProofRecord } from '../repository'
import type { ProofService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { AutoAcceptProof } from '../../../types'
import { ProofUtils } from '../ProofUtils'
import { ProposePresentationMessage } from '../messages'

export class ProposePresentationHandler implements Handler {
  private proofService: ProofService
  private agentConfig: AgentConfig
  public supportedMessages = [ProposePresentationMessage]

  public constructor(proofService: ProofService, agentConfig: AgentConfig) {
    this.proofService = proofService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<ProposePresentationHandler>) {
    const proofRecord = await this.proofService.processProposal(messageContext)

    const autoAccept = ProofUtils.composeAutoAccept(proofRecord.autoAcceptProof, this.agentConfig.autoAcceptProofs)

    if (autoAccept === AutoAcceptProof.always) {
      return await this.nextStep(proofRecord, messageContext)
    }
  }

  private async nextStep(proofRecord: ProofRecord, messageContext: HandlerInboundMessage<ProposePresentationHandler>) {
    const proofRequest = await this.proofService.createProofRequestFromProposal(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      proofRecord.proposalMessage!.presentationProposal,
      {
        name: 'proof-request',
        version: '1.0',
      }
    )
    const { message } = await this.proofService.createRequestAsResponse(proofRecord, proofRequest)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return createOutboundMessage(messageContext.connection!, message)
  }
}
