import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ProofResponseCoordinator } from '../ProofResponseCoordinator'
import type { ProofRecord } from '../repository'
import type { ProofService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { RequestPresentationMessage } from '../messages'

export class RequestPresentationHandler implements Handler {
  private proofService: ProofService
  private agentConfig: AgentConfig
  private proofResponseCoordinator: ProofResponseCoordinator
  public supportedMessages = [RequestPresentationMessage]

  public constructor(
    proofService: ProofService,
    agentConfig: AgentConfig,
    proofResponseCoordinator: ProofResponseCoordinator
  ) {
    this.proofService = proofService
    this.agentConfig = agentConfig
    this.proofResponseCoordinator = proofResponseCoordinator
  }

  public async handle(messageContext: HandlerInboundMessage<RequestPresentationHandler>) {
    const proofRecord = await this.proofService.processRequest(messageContext)

    if (this.proofResponseCoordinator.shouldAutoRespondToRequest(proofRecord)) {
      return await this.sendPresentation(proofRecord, messageContext)
    }
  }

  private async sendPresentation(
    proofRecord: ProofRecord,
    messageContext: HandlerInboundMessage<RequestPresentationHandler>
  ) {
    const indyProofRequest = proofRecord.requestMessage?.indyProofRequest

    if (indyProofRequest) {
      const retrievedCredentials = await this.proofService.getRequestedCredentialsForProofRequest(
        indyProofRequest,
        proofRecord.proposalMessage?.presentationProposal
      )

      const requestedCredentials = this.proofService.autoSelectCredentialsForProofRequest(retrievedCredentials)

      const { message } = await this.proofService.createPresentation(proofRecord, requestedCredentials)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return createOutboundMessage(messageContext.connection!, message)
    }
  }
}
