import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ProofResponseCoordinator } from '../ProofResponseCoordinator'
import type { ProofRecord } from '../repository'
import type { ProofService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { ProposePresentationMessage } from '../messages'

export class ProposePresentationHandler implements Handler {
  private proofService: ProofService
  private agentConfig: AgentConfig
  private proofResponseCoordinator: ProofResponseCoordinator
  public supportedMessages = [ProposePresentationMessage]

  public constructor(
    proofService: ProofService,
    agentConfig: AgentConfig,
    proofResponseCoordinator: ProofResponseCoordinator
  ) {
    this.proofService = proofService
    this.agentConfig = agentConfig
    this.proofResponseCoordinator = proofResponseCoordinator
  }

  public async handle(messageContext: HandlerInboundMessage<ProposePresentationHandler>) {
    const proofRecord = await this.proofService.processProposal(messageContext)

    if (this.proofResponseCoordinator.shoudlAutoRespondToProposal(proofRecord)) {
      return await this.sendRequest(proofRecord, messageContext)
    }
  }

  private async sendRequest(
    proofRecord: ProofRecord,
    messageContext: HandlerInboundMessage<ProposePresentationHandler>
  ) {
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
